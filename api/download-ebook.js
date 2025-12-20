// Vercel Serverless Function - Pobieranie e-booka przez token
console.log('[INIT] Loading download-ebook.js module...');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Import Vercel KV - jeśli nie jest dostępny, kod użyje fallback w funkcjach
let kv = null;
try {
    const kvModule = await import('@vercel/kv');
    kv = kvModule.kv;
    console.log('[INIT] ✅ Vercel KV loaded');
} catch (error) {
    console.error('[INIT] ⚠️ Vercel KV not available (will use memory fallback):', error.message, error.stack);
    kv = null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('[INIT] ✅ Module download-ebook.js loaded successfully');

// Funkcja do pobierania tokenu
async function getToken(token) {
    try {
        if (kv) {
            const data = await kv.get(`token:${token}`);
            if (data) {
                return typeof data === 'string' ? data : JSON.stringify(data);
            }
        }
    } catch (error) {
        console.error('❌ Vercel KV error, trying fallback:', error.message, error.stack);
    }
    
    // Fallback do pamięci
    if (typeof global !== 'undefined' && !global.tokenStore) {
        global.tokenStore = new Map();
    }
    if (global?.tokenStore) {
        return global.tokenStore.get(token);
    }
    
    return null;
}

// Funkcja do aktualizacji tokenu
async function updateToken(token, tokenData) {
    try {
        if (kv) {
            await kv.set(`token:${token}`, JSON.stringify(tokenData), { ex: 604800 });
            return true;
        }
    } catch (error) {
        console.error('❌ Vercel KV update error:', error.message, error.stack);
    }
    
    // Fallback
    if (global?.tokenStore) {
        global.tokenStore.set(token, JSON.stringify(tokenData));
        return true;
    }
    
    return false;
}

export default async function handler(req, res) {
    console.log('=== DOWNLOAD EBOOK REQUEST ===');
    console.log('Query params:', req.query);
    
    try {
        // Pobierz token z query string
        const token = req.query?.token;
        
        if (!token) {
            return res.status(400).send(errorPage('Brak tokenu', 'Brak tokenu dostępu. Link do pobrania jest nieprawidłowy.<br>Jeśli otrzymałeś ten link w emailu, upewnij się, że skopiowałeś go w całości.'));
        }

        // Dekoduj token (token zawiera dane - nie potrzebujemy storage!)
        console.log('🔍 Decoding token');
        console.log('Token length:', token.length);
        console.log('Token (first 100 chars):', token.substring(0, 100));
        
        // Token może być URL-encoded, więc najpierw go zdekoduj
        let decodedToken = token;
        try {
            decodedToken = decodeURIComponent(token);
            console.log('✅ Token URL-decoded');
        } catch (e) {
            console.log('⚠️ Token not URL-encoded, using as-is');
        }
        
        let tokenData;
        try {
            // Token format: payload.signature
            const parts = decodedToken.split('.');
            console.log('Token parts count:', parts.length);
            
            if (parts.length !== 2) {
                console.error('❌ Invalid token format - expected 2 parts separated by dot');
                throw new Error('Invalid token format - expected payload.signature');
            }
            
            const [payloadBase64, signature] = parts;
            console.log('Payload length:', payloadBase64.length);
            console.log('Signature length:', signature.length);
            console.log('Signature:', signature);
            
            // Zweryfikuj podpis
            const secret = process.env.TOKEN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'default-secret-change-in-production';
            console.log('Using secret:', secret ? secret.substring(0, 10) + '...' : 'NOT SET');
            
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(payloadBase64);
            const expectedSignature = hmac.digest('hex').substring(0, 32);
            console.log('Expected signature:', expectedSignature);
            console.log('Received signature:', signature);
            
            if (signature !== expectedSignature) {
                console.error('❌ Signature mismatch!');
                console.error('Expected:', expectedSignature);
                console.error('Got:', signature);
                throw new Error('Token signature verification failed');
            }
            
            console.log('✅ Signature verified');
            
            // Dekoduj payload - base64url
            try {
                const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
                console.log('✅ Payload decoded');
                console.log('Payload JSON:', payloadJson.substring(0, 200));
                
                tokenData = JSON.parse(payloadJson);
                console.log('✅ Token data parsed successfully');
            } catch (decodeError) {
                console.error('❌ Failed to decode payload:', decodeError.message);
                // Spróbuj zwykłego base64 jako fallback
                try {
                    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
                    tokenData = JSON.parse(payloadJson);
                    console.log('✅ Payload decoded using base64 (fallback)');
                } catch (fallbackError) {
                    throw new Error(`Payload decode failed: ${decodeError.message}`);
                }
            }
            
            console.log('✅ Token decoded and verified successfully');
        } catch (error) {
            console.error('❌ Token decode/verification failed:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Token (first 100 chars):', token.substring(0, 100));
            return res.status(404).send(errorPage('Token nieważny', 'Ten link do pobrania jest nieważny lub został uszkodzony.<br>Linki są ważne przez 7 dni od zakupu.<br><br>Jeśli właśnie dokonałeś zakup, sprawdź czy skopiowałeś link w całości.'));
        }
        const { email, expiresAt, downloadCount, maxDownloads } = tokenData;
        console.log('Token data:', { email, expiresAt, downloadCount, maxDownloads });

        // Sprawdź datę ważności (7 dni)
        const now = new Date();
        const expiryDate = new Date(expiresAt);
        
        if (now > expiryDate) {
            console.log('❌ Token expired');
            return res.status(410).send(errorPage('Link wygasł', 'Ten link do pobrania wygasł. Linki są ważne przez 7 dni od zakupu.<br>Jeśli potrzebujesz nowego linku, skontaktuj się ze mną na Instagramie.'));
        }

        // Sprawdź limit pobrań (5 razy)
        if (downloadCount >= maxDownloads) {
            console.log('❌ Download limit reached');
            return res.status(429).send(errorPage('Limit pobrań', `Osiągnąłeś maksymalną liczbę pobrań (${maxDownloads}).<br>Jeśli potrzebujesz nowego linku, skontaktuj się ze mną na Instagramie.`));
        }

        // Znajdź plik PDF
        let pdfBuffer = null;
        
        // Możliwe ścieżki do pliku PDF
        const possiblePaths = [
            path.join(process.cwd(), 'ebooks', 'original-ebook.pdf'),
            path.join(process.cwd(), '..', 'ebooks', 'original-ebook.pdf'),
            process.env.EBOOK_PATH ? path.join(process.cwd(), process.env.EBOOK_PATH) : null
        ].filter(Boolean);
        
        console.log('Looking for PDF in paths:', possiblePaths);
        
        for (const ebookPath of possiblePaths) {
            console.log('Checking path:', ebookPath);
            if (fs.existsSync(ebookPath)) {
                pdfBuffer = fs.readFileSync(ebookPath);
                console.log('✅ Found PDF at:', ebookPath, 'Size:', pdfBuffer.length);
                break;
            }
        }
        
        // Fallback: pobierz z URL jeśli skonfigurowano
        if (!pdfBuffer && process.env.EBOOK_URL) {
            console.log('Trying to fetch from URL:', process.env.EBOOK_URL);
            try {
                const response = await fetch(process.env.EBOOK_URL);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    pdfBuffer = Buffer.from(arrayBuffer);
                    console.log('✅ Fetched PDF from URL, size:', pdfBuffer.length);
                }
            } catch (fetchError) {
                console.error('❌ Failed to fetch from URL:', fetchError.message);
            }
        }
        
        if (!pdfBuffer) {
            console.error('❌ PDF file not found');
            return res.status(500).send(errorPage('Błąd serwera', 'Nie udało się pobrać pliku e-booka.<br>Skontaktuj się z nami, a pomożemy rozwiązać problem.'));
        }

        // Zwiększ licznik pobrań w tokenie (dla informacji, ale nie zapisujemy - token jest read-only)
        tokenData.downloadCount = downloadCount + 1;
        tokenData.lastDownloadAt = new Date().toISOString();
        console.log('✅ Download count:', downloadCount + 1, 'of', maxDownloads);

        // Sprawdź czy request jest z przeglądarki (czy pokazać stronę HTML)
        const userAgent = req.headers['user-agent'] || '';
        const acceptHeader = req.headers['accept'] || '';
        const isBrowser = acceptHeader.includes('text/html') || userAgent.includes('Mozilla');
        
        // Jeśli request jest bezpośredni (curl, wget, etc.) - zwróć PDF bezpośrednio
        if (!isBrowser || req.query?.direct === 'true') {
            console.log('✅ Returning PDF file directly');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="E-book-Korekta-bez-skrotow-Julia-Wojcik.pdf"');
            res.setHeader('Content-Length', pdfBuffer.length.toString());
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.send(pdfBuffer);
        }
        
        // Jeśli request jest z przeglądarki - pokaż stronę HTML z automatycznym pobieraniem
        console.log('✅ Returning HTML page with auto-download');
        
        // Zakoduj PDF w base64 dla inline download
        const pdfBase64 = pdfBuffer.toString('base64');
        const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
        
        return res.send(downloadPage(pdfDataUrl, downloadCount + 1, maxDownloads));

    } catch (error) {
        console.error('❌ Error in download-ebook:', error);
        console.error('Stack:', error.stack);
        return res.status(500).send(errorPage('Błąd', 'Wystąpił nieoczekiwany błąd podczas pobierania e-booka.<br>Spróbuj ponownie później lub skontaktuj się z nami.'));
    }
}

function downloadPage(pdfDataUrl, downloadCount, maxDownloads) {
    return `
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pobieranie e-booka - Julia Wójcik</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                    background: linear-gradient(135deg, #C5A572 0%, #a89263 100%);
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .container {
                    background: white;
                    border-radius: 16px;
                    padding: 50px 40px;
                    max-width: 600px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                }
                .icon {
                    font-size: 80px;
                    margin-bottom: 30px;
                    animation: bounce 1s ease-in-out;
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }
                h1 {
                    color: #212121;
                    margin: 0 0 20px 0;
                    font-size: 32px;
                    font-weight: 700;
                }
                .status {
                    background: #f0f8ff;
                    border-left: 4px solid #4CAF50;
                    padding: 20px;
                    margin: 30px 0;
                    border-radius: 8px;
                    text-align: left;
                }
                .status strong {
                    color: #4CAF50;
                    font-size: 18px;
                    display: block;
                    margin-bottom: 10px;
                }
                .info {
                    color: #666;
                    line-height: 1.8;
                    margin: 20px 0;
                    font-size: 16px;
                }
                .download-button {
                    display: inline-block;
                    background: #212121;
                    color: white !important;
                    padding: 18px 40px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 18px;
                    border-radius: 8px;
                    margin: 30px 0;
                    transition: background 0.3s;
                    border: none;
                    cursor: pointer;
                }
                .download-button:hover {
                    background: #333;
                }
                .spinner {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255,255,255,.3);
                    border-radius: 50%;
                    border-top-color: white;
                    animation: spin 1s ease-in-out infinite;
                    margin-right: 10px;
                    vertical-align: middle;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    color: #999;
                    font-size: 14px;
                }
                .footer a {
                    color: #C5A572;
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">📥</div>
                <h1>Pobieranie rozpoczęte!</h1>
                
                <div class="status">
                    <strong>✅ Twój e-book jest gotowy do pobrania</strong>
                    <div class="info">
                        Jeśli pobieranie nie rozpoczęło się automatycznie, kliknij przycisk poniżej.
                    </div>
                </div>
                
                <div id="downloadStatus" style="margin: 20px 0;">
                    <p style="color: #666;">Trwa przygotowywanie pliku...</p>
                </div>
                
                <a href="#" id="downloadLink" class="download-button" download="E-book-Korekta-bez-skrotow-Julia-Wojcik.pdf" style="display: none;">
                    <span class="spinner"></span>Pobierz e-book
                </a>
                
                <div class="info" style="margin-top: 30px;">
                    <strong>📋 Informacje:</strong><br>
                    • Plik: <strong>Korekta bez skrótów</strong> (PDF)<br>
                    • Liczba pobrań: ${downloadCount} z ${maxDownloads}<br>
                    • Link jest ważny przez 7 dni
                </div>
                
                <div class="footer">
                    <p>Julia Wójcik - Profesjonalna Stylizacja Paznokci</p>
                    <p>📸 <a href="https://www.instagram.com/juliawojcik_instruktor/">Instagram</a> | 
                    🎵 <a href="https://www.tiktok.com/@nailsbyjul_kawojcik">TikTok</a></p>
                </div>
            </div>
            
            <script>
                // Automatycznie rozpocznij pobieranie
                (function() {
                    const pdfDataUrl = '${pdfDataUrl}';
                    const link = document.getElementById('downloadLink');
                    const status = document.getElementById('downloadStatus');
                    
                    // Konwertuj data URL na blob i utwórz link do pobrania
                    try {
                        // Dla większych plików, użyj fetch zamiast bezpośredniego data URL
                        fetch(pdfDataUrl)
                            .then(res => res.blob())
                            .then(blob => {
                                const url = window.URL.createObjectURL(blob);
                                link.href = url;
                                link.style.display = 'inline-block';
                                
                                status.innerHTML = '<p style="color: #4CAF50;"><strong>✅ Plik gotowy!</strong></p>';
                                
                                // Automatycznie kliknij link po 1 sekundzie
                                setTimeout(() => {
                                    link.click();
                                    status.innerHTML = '<p style="color: #4CAF50;"><strong>✅ Pobieranie rozpoczęte!</strong><br><small style="color: #666;">Jeśli pobieranie się nie rozpoczęło, kliknij przycisk powyżej.</small></p>';
                                }, 1000);
                            })
                            .catch(err => {
                                console.error('Download error:', err);
                                status.innerHTML = '<p style="color: #f44336;">⚠️ Wystąpił problem. Kliknij przycisk poniżej.</p>';
                                link.href = pdfDataUrl;
                                link.style.display = 'inline-block';
                            });
                    } catch (error) {
                        console.error('Error:', error);
                        link.href = pdfDataUrl;
                        link.style.display = 'inline-block';
                        status.innerHTML = '<p style="color: #f44336;">⚠️ Kliknij przycisk poniżej aby pobrać.</p>';
                    }
                })();
            </script>
        </body>
        </html>
    `;
}

function errorPage(title, message) {
    return `
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title} - Julia Wójcik</title>
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                    background: linear-gradient(135deg, #f9f8f6 0%, #ebe8e3 100%);
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }
                .container {
                    background: white;
                    border-radius: 12px;
                    padding: 40px;
                    max-width: 500px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    text-align: center;
                }
                .icon { font-size: 48px; margin-bottom: 20px; }
                h1 { color: #212121; margin: 0 0 15px 0; font-size: 24px; }
                p { color: #666; line-height: 1.7; margin: 0 0 20px 0; }
                .contact { 
                    background: #f9f8f6; 
                    border-left: 4px solid #C5A572; 
                    padding: 15px; 
                    text-align: left;
                    margin-top: 25px;
                }
                .contact a { color: #C5A572; text-decoration: none; font-weight: 500; }
                .contact a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="icon">⚠️</div>
                <h1>${title}</h1>
                <p>${message}</p>
                <div class="contact">
                    <p style="margin-bottom: 10px;"><strong>Potrzebujesz pomocy?</strong></p>
                    <p style="margin: 5px 0;">📸 <a href="https://www.instagram.com/juliawojcik_instruktor/">@juliawojcik_instruktor</a></p>
                    <p style="margin: 5px 0;">🎵 <a href="https://www.tiktok.com/@nailsbyjul_kawojcik">@nailsbyjul_kawojcik</a></p>
                </div>
            </div>
        </body>
        </html>
    `;
}

