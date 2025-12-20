// Vercel Serverless Function - Pobieranie e-booka przez token
console.log('[INIT] Loading download-ebook.js module...');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

        // Pobierz dane tokenu z store
        console.log('🔍 Looking for token:', token.substring(0, 16) + '...');
        console.log('Vercel KV available:', !!kv);
        
        const tokenString = await getToken(token);
        
        if (!tokenString) {
            console.error('❌ Token not found in store');
            console.error('Token (first 16 chars):', token.substring(0, 16));
            console.error('This could mean:');
            console.error('  1. Token was not saved during purchase');
            console.error('  2. Vercel KV is not configured/working');
            console.error('  3. Token expired or was deleted');
            return res.status(404).send(errorPage('Token nieważny', 'Ten link do pobrania jest nieważny lub wygasł.<br>Linki są ważne przez 7 dni od zakupu.<br><br>Jeśli właśnie dokonałeś zakupu, poczekaj chwilę i spróbuj ponownie.'));
        }
        
        console.log('✅ Token found in store');

        const tokenData = JSON.parse(tokenString);
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

        // Zwiększ licznik pobrań
        try {
            const updatedData = {
                ...tokenData,
                downloadCount: downloadCount + 1,
                lastDownloadAt: new Date().toISOString()
            };
            await updateToken(token, updatedData);
            console.log('✅ Download count updated to:', downloadCount + 1);
        } catch (updateError) {
            console.error('❌ Could not update download count:', updateError.message, updateError.stack);
        }

        console.log('✅ Returning PDF file');
        
        // Zwróć plik PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="E-book-Korekta-bez-skrotow-Julia-Wojcik.pdf"');
        res.setHeader('Content-Length', pdfBuffer.length.toString());
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(pdfBuffer);

    } catch (error) {
        console.error('❌ Error in download-ebook:', error);
        console.error('Stack:', error.stack);
        return res.status(500).send(errorPage('Błąd', 'Wystąpił nieoczekiwany błąd podczas pobierania e-booka.<br>Spróbuj ponownie później lub skontaktuj się z nami.'));
    }
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

