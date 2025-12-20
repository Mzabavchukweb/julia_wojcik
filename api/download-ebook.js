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
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400&family=Roboto+Condensed:wght@400;500&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: 'Roboto Condensed', 'Avenir Next Condensed', sans-serif;
                    background: #f3f1ee;
                    margin: 0;
                    padding: 40px 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    color: #6b6b6b;
                    line-height: 1.8;
                    -webkit-font-smoothing: antialiased;
                }
                .container {
                    background: #ffffff;
                    max-width: 550px;
                    width: 100%;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                    text-align: center;
                }
                .logo-section {
                    padding: 48px 48px 0 48px;
                }
                .logo {
                    font-family: 'Instrument Serif', Georgia, serif;
                    font-size: 18px;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: #212121;
                    margin: 0;
                    font-weight: 400;
                }
                .gold-line {
                    width: 60px;
                    height: 2px;
                    background: #C5A572;
                    margin: 24px auto 0 auto;
                }
                .header {
                    padding: 32px 48px 0 48px;
                }
                h1 {
                    font-family: 'Instrument Serif', Georgia, serif;
                    color: #212121;
                    margin: 0 0 12px 0;
                    font-size: 32px;
                    font-weight: 400;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    line-height: 1.1;
                }
                .subtitle {
                    color: #8a8a8a;
                    font-size: 15px;
                    margin: 0;
                }
                .content {
                    padding: 40px 48px 48px 48px;
                }
                .status-box {
                    background: #f9f8f6;
                    border-left: 3px solid #C5A572;
                    padding: 24px;
                    margin: 0 0 32px 0;
                    text-align: left;
                }
                .status-box p {
                    margin: 0;
                    color: #6b6b6b;
                    line-height: 1.7;
                }
                .download-button {
                    display: inline-block;
                    background: #212121;
                    color: #ffffff !important;
                    padding: 18px 42px;
                    text-decoration: none;
                    font-family: 'Roboto Condensed', sans-serif;
                    font-weight: 500;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin: 0 0 36px 0;
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                    border: none;
                    cursor: pointer;
                }
                .download-button:hover {
                    background: #2d2d2d;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 32px rgba(197, 165, 114, 0.25);
                }
                .button-arrow {
                    margin-left: 12px;
                    font-size: 16px;
                }
                .info {
                    background: #f9f8f6;
                    border-left: 3px solid #C5A572;
                    padding: 24px;
                    text-align: left;
                }
                .info-title {
                    font-family: 'Instrument Serif', Georgia, serif;
                    color: #212121;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin: 0 0 12px 0;
                    font-weight: 400;
                }
                .info-text {
                    color: #6b6b6b;
                    font-size: 14px;
                    line-height: 1.8;
                    margin: 0;
                }
                .footer {
                    background: #212121;
                    padding: 32px 48px;
                    color: #8a8a8a;
                    font-size: 12px;
                }
                .footer-brand {
                    font-family: 'Instrument Serif', Georgia, serif;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    color: #ffffff;
                    margin: 0 0 8px 0;
                }
                .footer p {
                    margin: 0 0 6px 0;
                }
                .footer a {
                    color: #C5A572;
                    text-decoration: none;
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .footer a:hover {
                    color: #a89263;
                }
                .footer-gold-line {
                    width: 40px;
                    height: 1px;
                    background: #C5A572;
                    margin: 16px auto;
                }
                .credits {
                    margin-top: 20px;
                    padding-top: 16px;
                    border-top: 1px solid #3a3a3a;
                    font-size: 10px;
                    color: #555555;
                }
                .credits a {
                    color: #6b6b6b;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Logo Section -->
                <div class="logo-section">
                    <p class="logo">Julia Wójcik</p>
                    <div class="gold-line"></div>
                </div>
                
                <!-- Header -->
                <div class="header">
                    <h1>Dziękuję za zakup</h1>
                    <p class="subtitle">Twój e-book jest gotowy do pobrania</p>
                </div>
                
                <!-- Content -->
                <div class="content">
                    <div class="status-box">
                        <p id="downloadStatus">Trwa przygotowywanie pliku...</p>
                    </div>
                    
                    <a href="#" id="downloadLink" class="download-button" download="E-book-Korekta-bez-skrotow-Julia-Wojcik.pdf" style="display: none;">
                        POBIERZ E-BOOK<span class="button-arrow">→</span>
                    </a>
                    
                    <div class="info">
                        <p class="info-title">Informacje</p>
                        <p class="info-text">
                            Plik: Korekta bez skrótów (PDF)<br>
                            Liczba pobrań: ${downloadCount} z ${maxDownloads}<br>
                            Link jest ważny przez 7 dni
                        </p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="footer">
                    <p class="footer-brand">Julia Wójcik</p>
                    <div class="footer-gold-line"></div>
                    <p>Profesjonalna Stylizacja Paznokci</p>
                    <p><a href="https://www.instagram.com/juliawojcik_instruktor/">Instagram</a> · <a href="https://www.tiktok.com/@nailsbyjul_kawojcik">TikTok</a></p>
                    <div class="credits">
                        <p>Projekt i wykonanie: <a href="https://codingmaks.com">codingmaks.com</a></p>
                    </div>
                </div>
            </div>
            
            <script>
                (function() {
                    const pdfDataUrl = '${pdfDataUrl}';
                    const link = document.getElementById('downloadLink');
                    const status = document.getElementById('downloadStatus');
                    
                    try {
                        fetch(pdfDataUrl)
                            .then(res => res.blob())
                            .then(blob => {
                                const url = window.URL.createObjectURL(blob);
                                link.href = url;
                                link.style.display = 'inline-block';
                                
                                status.innerHTML = 'Plik gotowy do pobrania';
                                
                                setTimeout(() => {
                                    link.click();
                                    status.innerHTML = 'Pobieranie rozpoczęte. Jeśli plik się nie pobiera, kliknij przycisk powyżej.';
                                }, 1000);
                            })
                            .catch(err => {
                                console.error('Download error:', err);
                                status.innerHTML = 'Wystąpił problem. Kliknij przycisk poniżej.';
                                link.href = pdfDataUrl;
                                link.style.display = 'inline-block';
                            });
                    } catch (error) {
                        console.error('Error:', error);
                        link.href = pdfDataUrl;
                        link.style.display = 'inline-block';
                        status.innerHTML = 'Kliknij przycisk poniżej, aby pobrać e-book.';
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
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400&family=Roboto+Condensed:wght@400;500&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; }
                body {
                    font-family: 'Roboto Condensed', 'Avenir Next Condensed', sans-serif;
                    background: #f3f1ee;
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    color: #6b6b6b;
                    line-height: 1.8;
                    -webkit-font-smoothing: antialiased;
                }
                .container {
                    background: #ffffff;
                    padding: 60px 48px;
                    max-width: 500px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                    text-align: center;
                }
                .logo {
                    font-family: 'Instrument Serif', Georgia, serif;
                    font-size: 14px;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: #212121;
                    margin-bottom: 48px;
                    font-weight: 400;
                }
                h1 { 
                    font-family: 'Instrument Serif', Georgia, serif;
                    color: #212121; 
                    margin: 0 0 20px 0; 
                    font-size: 28px; 
                    font-weight: 400;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    line-height: 1.2;
                }
                p { 
                    color: #6b6b6b; 
                    line-height: 1.8; 
                    margin: 0 0 20px 0; 
                    font-size: 16px;
                }
                .contact { 
                    background: #f9f8f6; 
                    border-left: 3px solid #C5A572; 
                    padding: 24px; 
                    text-align: left;
                    margin-top: 36px;
                }
                .contact-title {
                    font-family: 'Instrument Serif', Georgia, serif;
                    font-size: 16px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: #212121;
                    margin: 0 0 12px 0;
                    font-weight: 400;
                }
                .contact p { 
                    margin: 0 0 8px 0; 
                    font-size: 15px;
                }
                .contact a { 
                    color: #C5A572; 
                    text-decoration: none;
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .contact a:hover { 
                    color: #a89263;
                }
                .footer {
                    margin-top: 48px;
                    padding-top: 20px;
                    border-top: 1px solid #e8e5e0;
                    font-size: 11px;
                    color: #a8a8a8;
                }
                .footer a { 
                    color: #8a8a8a; 
                    text-decoration: none; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">Julia Wójcik</div>
                <h1>${title}</h1>
                <p>${message}</p>
                <div class="contact">
                    <p class="contact-title">Potrzebujesz pomocy?</p>
                    <p>Instagram: <a href="https://www.instagram.com/juliawojcik_instruktor/">@juliawojcik_instruktor</a></p>
                    <p>TikTok: <a href="https://www.tiktok.com/@nailsbyjul_kawojcik">@nailsbyjul_kawojcik</a></p>
                </div>
                <div class="footer">
                    <p>Projekt i wykonanie: <a href="https://codingmaks.com">codingmaks.com</a></p>
                </div>
            </div>
        </body>
        </html>
    `;
}

