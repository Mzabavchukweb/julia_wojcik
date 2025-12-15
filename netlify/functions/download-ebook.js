// Netlify Function - Pobieranie e-booka przez token
const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
    console.log('=== DOWNLOAD EBOOK REQUEST ===');
    console.log('Query params:', event.queryStringParameters);

    try {
        // Pobierz token z query string
        const token = event.queryStringParameters?.token;
        
        if (!token) {
            return errorPage('Brak tokenu', 'Brak tokenu dostępu. Link do pobrania jest nieprawidłowy.<br>Jeśli otrzymałeś ten link w emailu, upewnij się, że skopiowałeś go w całości.');
        }

        // Spróbuj pobrać dane tokenu z Netlify Blobs
        let tokenData = null;
        let store = null;
        
        try {
            const { getStore } = require('@netlify/blobs');
            store = getStore('ebook-tokens');
            const tokenString = await store.get(token);
            if (tokenString) {
                tokenData = JSON.parse(tokenString);
                console.log('✅ Token found in Blobs');
            }
        } catch (blobError) {
            console.warn('⚠️ Netlify Blobs error:', blobError.message);
        }
        
        if (!tokenData) {
            console.log('❌ Token not found');
            return errorPage('Token nieważny', 'Ten link do pobrania jest nieważny lub wygasł.<br>Linki są ważne przez 7 dni od zakupu.');
        }

        const { email, expiresAt, downloadCount, maxDownloads } = tokenData;
        console.log('Token data:', { email, expiresAt, downloadCount, maxDownloads });

        // Sprawdź datę ważności (7 dni)
        const now = new Date();
        const expiryDate = new Date(expiresAt);
        
        if (now > expiryDate) {
            console.log('❌ Token expired');
            return errorPage('Link wygasł', 'Ten link do pobrania wygasł. Linki są ważne przez 7 dni od zakupu.<br>Jeśli potrzebujesz nowego linku, skontaktuj się ze mną na Instagramie.');
        }

        // Sprawdź limit pobrań (5 razy)
        if (downloadCount >= maxDownloads) {
            console.log('❌ Download limit reached');
            return errorPage('Limit pobrań', `Osiągnąłeś maksymalną liczbę pobrań (${maxDownloads}).<br>Jeśli potrzebujesz nowego linku, skontaktuj się ze mną na Instagramie.`);
        }

        // Znajdź plik PDF
        let pdfBuffer = null;
        let pdfPath = null;
        
        // Możliwe ścieżki do pliku PDF
        const possiblePaths = [
            path.join(process.cwd(), 'ebooks', 'original-ebook.pdf'),
            path.join(__dirname, '..', '..', 'ebooks', 'original-ebook.pdf'),
            '/var/task/ebooks/original-ebook.pdf',
            process.env.EBOOK_PATH ? path.join(process.cwd(), process.env.EBOOK_PATH) : null
        ].filter(Boolean);
        
        console.log('Looking for PDF in paths:', possiblePaths);
        
        for (const ebookPath of possiblePaths) {
            console.log('Checking path:', ebookPath);
            if (fs.existsSync(ebookPath)) {
                pdfBuffer = fs.readFileSync(ebookPath);
                pdfPath = ebookPath;
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
            // Wylistuj pliki w bieżącym katalogu dla debugowania
            try {
                const cwd = process.cwd();
                console.log('Current working directory:', cwd);
                if (fs.existsSync(cwd)) {
                    const files = fs.readdirSync(cwd);
                    console.log('Files in CWD:', files);
                }
                const ebooksDir = path.join(cwd, 'ebooks');
                if (fs.existsSync(ebooksDir)) {
                    const ebookFiles = fs.readdirSync(ebooksDir);
                    console.log('Files in ebooks dir:', ebookFiles);
                            }
            } catch (e) {
                console.log('Could not list directory:', e.message);
            }
            
            return errorPage('Błąd serwera', 'Nie udało się pobrać pliku e-booka.<br>Skontaktuj się z nami, a pomożemy rozwiązać problem.');
        }

        // Zwiększ licznik pobrań
        try {
            if (store) {
                const updatedData = {
                    ...tokenData,
                    downloadCount: downloadCount + 1,
                    lastDownloadAt: new Date().toISOString()
                };
                await store.set(token, JSON.stringify(updatedData));
                console.log('✅ Download count updated to:', downloadCount + 1);
            }
        } catch (updateError) {
            console.warn('⚠️ Could not update download count:', updateError.message);
            // Kontynuuj mimo błędu
        }

        console.log('✅ Returning PDF file');

        // Zwróć plik PDF
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="E-book-Korekta-bez-skrotow-Julia-Wojcik.pdf"',
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
            body: pdfBuffer.toString('base64'),
            isBase64Encoded: true
        };

    } catch (error) {
        console.error('❌ Error in download-ebook:', error);
        console.error('Stack:', error.stack);
        return errorPage('Błąd', 'Wystąpił nieoczekiwany błąd podczas pobierania e-booka.<br>Spróbuj ponownie później lub skontaktuj się z nami.');
    }
};

function errorPage(title, message) {
        return {
        statusCode: 400,
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            },
            body: `
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
            `
        };
    }
