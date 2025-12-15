// Netlify Function - Pobieranie e-booka przez token
const { getStore } = require('@netlify/blobs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

exports.handler = async (event, context) => {
    try {
        // Pobierz token z query string
        const token = event.queryStringParameters?.token;
        
        if (!token) {
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
                        <title>Błąd - Brak tokenu</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
                                margin: 0;
                                padding: 20px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                min-height: 100vh;
                            }
                            .container {
                                background: white;
                                border-radius: 10px;
                                padding: 40px;
                                max-width: 500px;
                                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                                text-align: center;
                            }
                            h1 { color: #d32f2f; margin-bottom: 20px; }
                            p { color: #666; line-height: 1.6; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>❌ Błąd dostępu</h1>
                            <p>Brak tokenu dostępu. Link do pobrania jest nieprawidłowy.</p>
                            <p>Jeśli otrzymałeś ten link w emailu, upewnij się, że skopiowałeś go w całości.</p>
                        </div>
                    </body>
                    </html>
                `
            };
        }

        // Pobierz store z Netlify Blobs
        // Użyj context.netlify jeśli dostępne (automatyczne uwierzytelnianie w Netlify Functions)
        const store = getStore({
            name: 'ebook-tokens',
            ...(context.netlify ? { context: context.netlify } : {
                siteID: process.env.NETLIFY_SITE_ID,
                token: process.env.NETLIFY_BLOB_STORE_TOKEN
            })
        });

        // Pobierz dane tokenu z Blobs
        const tokenData = await store.get(token);
        
        if (!tokenData) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8'
                },
                body: `
                    <!DOCTYPE html>
                    <html lang="pl">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Token nieważny</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
                                margin: 0;
                                padding: 20px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                min-height: 100vh;
                            }
                            .container {
                                background: white;
                                border-radius: 10px;
                                padding: 40px;
                                max-width: 500px;
                                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                                text-align: center;
                            }
                            h1 { color: #d32f2f; margin-bottom: 20px; }
                            p { color: #666; line-height: 1.6; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>❌ Token nieważny</h1>
                            <p>Ten link do pobrania jest nieważny lub wygasł.</p>
                            <p>Linki są ważne przez 7 dni od zakupu. Jeśli minęło więcej czasu, skontaktuj się z nami.</p>
                        </div>
                    </body>
                    </html>
                `
            };
        }

        // Parsuj dane tokenu
        const data = JSON.parse(tokenData);
        const { email, expiresAt, downloadCount, maxDownloads } = data;

        // Sprawdź datę ważności (7 dni)
        const now = new Date();
        const expiryDate = new Date(expiresAt);
        
        if (now > expiryDate) {
            return {
                statusCode: 410,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8'
                },
                body: `
                    <!DOCTYPE html>
                    <html lang="pl">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Link wygasł</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
                                margin: 0;
                                padding: 20px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                min-height: 100vh;
                            }
                            .container {
                                background: white;
                                border-radius: 10px;
                                padding: 40px;
                                max-width: 500px;
                                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                                text-align: center;
                            }
                            h1 { color: #d32f2f; margin-bottom: 20px; }
                            p { color: #666; line-height: 1.6; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>⏰ Link wygasł</h1>
                            <p>Ten link do pobrania wygasł. Linki są ważne przez 7 dni od zakupu.</p>
                            <p>Jeśli potrzebujesz nowego linku, skontaktuj się z nami na Instagramie <a href="https://www.instagram.com/juliawojcik_instruktor/">@juliawojcik_instruktor</a>.</p>
                        </div>
                    </body>
                    </html>
                `
            };
        }

        // Sprawdź limit pobrań (5 razy)
        if (downloadCount >= maxDownloads) {
            return {
                statusCode: 429,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8'
                },
                body: `
                    <!DOCTYPE html>
                    <html lang="pl">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Limit pobrań wyczerpany</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
                                margin: 0;
                                padding: 20px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                min-height: 100vh;
                            }
                            .container {
                                background: white;
                                border-radius: 10px;
                                padding: 40px;
                                max-width: 500px;
                                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                                text-align: center;
                            }
                            h1 { color: #d32f2f; margin-bottom: 20px; }
                            p { color: #666; line-height: 1.6; }
                            a { color: #C5A572; text-decoration: none; }
                            a:hover { text-decoration: underline; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>📥 Limit pobrań wyczerpany</h1>
                            <p>Osiągnąłeś maksymalną liczbę pobrań (${maxDownloads}).</p>
                            <p>Jeśli potrzebujesz nowego linku, skontaktuj się z nami na Instagramie <a href="https://www.instagram.com/juliawojcik_instruktor/">@juliawojcik_instruktor</a> lub na TikToku <a href="https://www.tiktok.com/@nailsbyjul_kawojcik">@nailsbyjul_kawojcik</a>.</p>
                        </div>
                    </body>
                    </html>
                `
            };
        }

        // Zwiększ licznik pobrań
        const updatedData = {
            ...data,
            downloadCount: downloadCount + 1,
            lastDownloadAt: new Date().toISOString()
        };
        await store.set(token, JSON.stringify(updatedData));

        // Pobierz plik PDF
        let pdfBuffer;
        
        // Opcja 1: Z lokalnego pliku (dla Netlify)
        if (process.env.EBOOK_PATH) {
            const ebookPath = path.join(process.cwd(), process.env.EBOOK_PATH);
            if (fs.existsSync(ebookPath)) {
                pdfBuffer = fs.readFileSync(ebookPath);
            }
        }
        
        // Opcja 2: Z URL (jeśli PDF jest w chmurze)
        if (!pdfBuffer && process.env.EBOOK_URL) {
            const https = require('https');
            const http = require('http');
            const url = require('url');
            
            pdfBuffer = await new Promise((resolve, reject) => {
                const parsedUrl = url.parse(process.env.EBOOK_URL);
                const client = parsedUrl.protocol === 'https:' ? https : http;
                
                client.get(process.env.EBOOK_URL, (res) => {
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                    res.on('error', reject);
                }).on('error', reject);
            });
        }
        
        // Opcja 3: Domyślna ścieżka
        if (!pdfBuffer) {
            const possiblePaths = [
                path.join(process.cwd(), 'ebooks', 'original-ebook.pdf'),
                path.join(__dirname, '..', '..', 'ebooks', 'original-ebook.pdf')
            ];
            
            for (const ebookPath of possiblePaths) {
                if (fs.existsSync(ebookPath)) {
                    pdfBuffer = fs.readFileSync(ebookPath);
                    break;
                }
            }
        }
        
        if (!pdfBuffer) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8'
                },
                body: `
                    <!DOCTYPE html>
                    <html lang="pl">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Błąd serwera</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
                                margin: 0;
                                padding: 20px;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                min-height: 100vh;
                            }
                            .container {
                                background: white;
                                border-radius: 10px;
                                padding: 40px;
                                max-width: 500px;
                                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                                text-align: center;
                            }
                            h1 { color: #d32f2f; margin-bottom: 20px; }
                            p { color: #666; line-height: 1.6; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>⚠️ Błąd serwera</h1>
                            <p>Nie udało się pobrać pliku e-booka. Skontaktuj się z nami, a pomożemy rozwiązać problem.</p>
                        </div>
                    </body>
                    </html>
                `
            };
        }

        // Zwróć plik PDF
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="E-book-Korekta-bez-skrotow-Julia-Wojcik.pdf"`,
                'Content-Length': pdfBuffer.length.toString()
            },
            body: pdfBuffer.toString('base64'),
            isBase64Encoded: true
        };

    } catch (error) {
        console.error('Error in download-ebook:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html; charset=utf-8'
            },
            body: `
                <!DOCTYPE html>
                <html lang="pl">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Błąd</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                            background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
                            margin: 0;
                            padding: 20px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                        }
                        .container {
                            background: white;
                            border-radius: 10px;
                            padding: 40px;
                            max-width: 500px;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                            text-align: center;
                        }
                        h1 { color: #d32f2f; margin-bottom: 20px; }
                        p { color: #666; line-height: 1.6; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>⚠️ Wystąpił błąd</h1>
                        <p>Wystąpił nieoczekiwany błąd podczas pobierania e-booka. Spróbuj ponownie później.</p>
                    </div>
                </body>
                </html>
            `
        };
    }
};

