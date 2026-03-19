// Vercel Serverless Function - Pobieranie e-booka przez token
console.log('[INIT] Loading download-ebook.js module...');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('[INIT] ✅ Module download-ebook.js loaded successfully');

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

        // Wybierz odpowiedni plik PDF na podstawie ebookId w tokenie
        const ebookId = tokenData.ebookId || 'sekret-czystej-skory';
        let ebookFile, ebookName, ebookDownloadName;
        
        if (ebookId === 'korekta-bez-skrotow') {
            ebookFile = 'E-book-Korekta-bez-skrotow-Julia-Wojcik.pdf';
            ebookName = 'Korekta bez skrótów';
            ebookDownloadName = 'Korekta-bez-skrotow-Julia-Wojcik.pdf';
        } else {
            ebookFile = 'PODSTAWY HYBRYDOWE ZE WZMOCNIENIEM.pdf';
            ebookName = 'Sekret czystej skóry';
            ebookDownloadName = 'Sekret-czystej-skory-Julia-Wojcik.pdf';
        }
        
        const ebookPath = path.join(process.cwd(), 'ebooks', ebookFile);
        console.log('📄 Loading PDF from:', ebookPath);
        
        let pdfBuffer = null;
        
        if (fs.existsSync(ebookPath)) {
            pdfBuffer = fs.readFileSync(ebookPath);
            console.log('✅ PDF loaded, size:', pdfBuffer.length, 'bytes');
        } else {
            console.error('❌ PDF file not found at:', ebookPath);
            return res.status(500).send(errorPage('Błąd serwera', 'Nie udało się pobrać pliku e-booka.<br><br>Skontaktuj się z nami, a pomożemy rozwiązać problem.<br><br>Email: juliajula08@icloud.com'));
        }

        // Zwiększ licznik pobrań w tokenie (dla informacji, ale nie zapisujemy - token jest read-only)
        tokenData.downloadCount = downloadCount + 1;
        tokenData.lastDownloadAt = new Date().toISOString();
        console.log('✅ Download count:', downloadCount + 1, 'of', maxDownloads);

        // Sprawdź czy to request do pobrania pliku bezpośrednio
        if (req.query?.download === 'true') {
            console.log('✅ Returning PDF file directly');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${ebookDownloadName}"`);
        res.setHeader('Content-Length', pdfBuffer.length.toString());
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.send(pdfBuffer);
        }
        
        // Pokaż stronę HTML z przyciskiem do pobrania (ładuje się natychmiast!)
        console.log('✅ Returning HTML page with download button');
        
        // Utwórz URL do bezpośredniego pobrania (ten sam token + download=true)
        const downloadDirectUrl = `${req.url}${req.url.includes('?') ? '&' : '?'}download=true`;
        
        return res.send(downloadPage(downloadDirectUrl, downloadCount + 1, maxDownloads));

    } catch (error) {
        console.error('❌ Error in download-ebook:', error);
        console.error('Stack:', error.stack);
        return res.status(500).send(errorPage('Błąd', 'Wystąpił nieoczekiwany błąd podczas pobierania e-booka.<br>Spróbuj ponownie później lub skontaktuj się z nami.'));
    }
}

function downloadPage(downloadUrl, downloadCount, maxDownloads) {
    return `
        <!DOCTYPE html>
        <html lang="pl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pobierz e-book - Julia Wójcik</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400&family=Roboto+Condensed:wght@400;500&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: 'Roboto Condensed', Arial, sans-serif;
                    background: #f3f1ee;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    color: #6b6b6b;
                    line-height: 1.8;
                    -webkit-font-smoothing: antialiased;
                }
                .wrapper {
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 24px 16px;
                }
                .container {
                    background: #ffffff;
                    max-width: 500px;
                    width: 100%;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                }
                .logo-section {
                    padding: 40px 32px 0 32px;
                    text-align: center;
                }
                .logo {
                    font-family: 'Instrument Serif', Georgia, serif;
                    font-size: 16px;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    color: #212121;
                    font-weight: 400;
                }
                .gold-line {
                    width: 50px;
                    height: 2px;
                    background: #C5A572;
                    margin: 20px auto 0 auto;
                }
                .header {
                    padding: 28px 32px 0 32px;
                    text-align: center;
                }
                h1 {
                    font-family: 'Instrument Serif', Georgia, serif;
                    color: #212121;
                    font-size: 26px;
                    font-weight: 400;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    line-height: 1.2;
                    margin-bottom: 8px;
                }
                .subtitle {
                    color: #8a8a8a;
                    font-size: 14px;
                }
                .content {
                    padding: 32px;
                    text-align: center;
                }
                .download-button {
                    display: inline-block;
                    background: #212121;
                    color: #ffffff !important;
                    padding: 16px 36px;
                    text-decoration: none;
                    font-family: 'Roboto Condensed', Arial, sans-serif;
                    font-weight: 500;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-bottom: 28px;
                    transition: all 0.3s ease;
                }
                .download-button:hover {
                    background: #2d2d2d;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(197, 165, 114, 0.3);
                }
                .download-button:active {
                    transform: translateY(0);
                }
                .button-arrow {
                    margin-left: 10px;
                }
                .info {
                    background: #f9f8f6;
                    border-left: 3px solid #C5A572;
                    padding: 20px;
                    text-align: left;
                }
                .info-title {
                    font-family: 'Instrument Serif', Georgia, serif;
                    color: #212121;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 10px;
                    font-weight: 400;
                }
                .info-text {
                    color: #6b6b6b;
                    font-size: 13px;
                    line-height: 1.7;
                }
                .footer {
                    background: #212121;
                    padding: 28px 32px;
                    text-align: center;
                }
                .footer-brand {
                    font-family: 'Instrument Serif', Georgia, serif;
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    color: #ffffff;
                    margin-bottom: 6px;
                }
                .footer-gold-line {
                    width: 30px;
                    height: 1px;
                    background: #C5A572;
                    margin: 12px auto;
                }
                .footer p {
                    color: #8a8a8a;
                    font-size: 11px;
                    margin-bottom: 4px;
                }
                .footer a {
                    color: #C5A572;
                    text-decoration: none;
                }
                .credits {
                    margin-top: 16px;
                    padding-top: 12px;
                    border-top: 1px solid #3a3a3a;
                    font-size: 9px;
                    color: #555;
                }
                .credits a { color: #6b6b6b; }
                
                @media (max-width: 480px) {
                    .wrapper { padding: 16px 12px; }
                    .logo-section { padding: 32px 24px 0 24px; }
                    .header { padding: 24px 24px 0 24px; }
                    h1 { font-size: 22px; }
                    .content { padding: 28px 24px; }
                    .download-button { padding: 14px 28px; font-size: 12px; }
                    .footer { padding: 24px; }
                }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="logo-section">
                        <p class="logo">Julia Wójcik</p>
                        <div class="gold-line"></div>
                    </div>
                    
                    <div class="header">
                        <h1>Dziękuję za zakup</h1>
                        <p class="subtitle">Twój e-book jest gotowy do pobrania</p>
                    </div>
                    
                    <div class="content">
                        <a href="${downloadUrl}" class="download-button">
                            POBIERZ E-BOOK<span class="button-arrow">→</span>
                        </a>
                        
                        <div class="info">
                            <p class="info-title">Informacje</p>
                            <p class="info-text">
                                Plik: ${ebookName} (PDF)<br>
                                Pobranie: ${downloadCount} z ${maxDownloads}<br>
                                Link ważny przez 7 dni
                            </p>
                        </div>
                    </div>
                    
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
            </div>
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

