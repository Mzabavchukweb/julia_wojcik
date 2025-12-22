// Vercel Serverless Function - Wysyłanie powiadomień o premierze e-booka
import { Resend } from 'resend';

// Inicjalizuj Resend
let resend = null;
try {
    if (process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
        console.log('[INIT] ✅ Resend initialized for premiere notifications');
    } else {
        console.error('[INIT] ❌ RESEND_API_KEY not set');
    }
} catch (error) {
    console.error('[INIT] ❌ ERROR: Failed to initialize Resend:', error.message);
}

export default async function handler(req, res) {
    // Tylko GET (Vercel cron jobs używają GET) lub POST (dla ręcznego wywołania)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Sprawdź czy to wywołanie z cron job (Vercel dodaje header) lub ręczne z auth
    const isCronJob = req.headers['user-agent']?.includes('vercel-cron') || 
                      req.headers['x-vercel-cron'] === '1';
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET || 'premiere-secret-change-in-production';
    
    // Jeśli to nie cron job, wymagaj autoryzacji
    if (!isCronJob && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const premiereDate = new Date('2025-12-30T00:00:00').getTime();
        const now = new Date().getTime();

        // Sprawdź czy premiera już minęła
        if (now < premiereDate) {
            return res.status(200).json({ 
                message: 'Premiera jeszcze nie minęła',
                premiereDate: new Date(premiereDate).toISOString(),
                currentDate: new Date().toISOString()
            });
        }

        // Lista emaili subskrybentów - w produkcji powinno być z bazy danych
        // Na razie użyjemy zmiennej środowiskowej lub można dodać Vercel KV
        const subscribers = process.env.NEWSLETTER_SUBSCRIBERS 
            ? process.env.NEWSLETTER_SUBSCRIBERS.split(',').map(e => e.trim())
            : [];

        if (subscribers.length === 0) {
            console.log('⚠️ No subscribers found');
            return res.status(200).json({ 
                message: 'No subscribers to notify',
                count: 0
            });
        }

        const emailFrom = process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>';
        const ebookUrl = process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_URL || 'https://julia-wojcik.vercel.app';
        const ebookPageUrl = `${ebookUrl}/pages/ebook.html`;

        let successCount = 0;
        let errorCount = 0;

        // Wyślij email do każdego subskrybenta
        for (const subscriberEmail of subscribers) {
            try {
                if (!resend) {
                    throw new Error('Resend not initialized');
                }

                const emailResult = await resend.emails.send({
                    from: emailFrom,
                    to: subscriberEmail,
                    subject: '🎉 E-book jest już dostępny!',
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400&family=Roboto+Condensed:wght@400;500&display=swap" rel="stylesheet">
                            <style>
                                body { 
                                    font-family: 'Roboto Condensed', Arial, sans-serif; 
                                    line-height: 1.8; 
                                    color: #6b6b6b; 
                                    margin: 0; 
                                    padding: 0; 
                                    background: #f3f1ee;
                                }
                                .wrapper {
                                    background: #f3f1ee;
                                    padding: 40px 20px;
                                }
                                .container { 
                                    max-width: 600px; 
                                    margin: 0 auto; 
                                    background: #ffffff;
                                    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                                }
                                .logo-section {
                                    background: #ffffff;
                                    padding: 40px 40px 0 40px;
                                    text-align: center;
                                }
                                .logo {
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    font-size: 18px;
                                    font-weight: 400;
                                    text-transform: uppercase;
                                    letter-spacing: 0.15em;
                                    color: #212121;
                                    margin: 0;
                                }
                                .gold-line {
                                    width: 60px;
                                    height: 2px;
                                    background: #C5A572;
                                    margin: 24px auto 0 auto;
                                }
                                .header { 
                                    background: #ffffff; 
                                    padding: 32px 40px 40px 40px; 
                                    text-align: center; 
                                }
                                .header h1 { 
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    margin: 0; 
                                    font-size: 32px; 
                                    font-weight: 400;
                                    text-transform: uppercase;
                                    letter-spacing: 0.06em;
                                    color: #212121;
                                    line-height: 1.2;
                                }
                                .content { 
                                    background: #ffffff; 
                                    padding: 0 40px 48px 40px; 
                                }
                                .content p {
                                    margin: 0 0 20px 0;
                                    color: #6b6b6b;
                                    font-size: 16px;
                                }
                                .button-wrapper {
                                    text-align: center;
                                    margin: 36px 0;
                                }
                                .button { 
                                    display: inline-block; 
                                    background: #212121; 
                                    color: #ffffff !important; 
                                    padding: 18px 42px; 
                                    text-decoration: none; 
                                    font-family: 'Roboto Condensed', Arial, sans-serif;
                                    font-weight: 500; 
                                    font-size: 14px;
                                    text-transform: uppercase;
                                    letter-spacing: 0.1em;
                                }
                                .button-arrow {
                                    margin-left: 12px;
                                    font-size: 16px;
                                }
                                .footer { 
                                    text-align: center; 
                                    padding: 32px 40px; 
                                    background: #212121;
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
                                    color: #8a8a8a;
                                    font-size: 12px;
                                }
                                .footer a { 
                                    color: #C5A572; 
                                    text-decoration: none;
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
                                        <h1>🎉 E-book już dostępny!</h1>
                                    </div>
                                    
                                    <div class="content">
                                        <p>Cześć!</p>
                                        <p>Dziękuję za zapisanie się do newslettera! Mam dla Ciebie wspaniałą wiadomość — <strong style="color: #212121;">e-book "Korekta bez skrótów" jest już dostępny do zakupu!</strong></p>
                                        <p>To kompleksowy przewodnik po stylizacji paznokci, który pomoże Ci pracować pewniej, szybciej i czyściej.</p>
                                        
                                        <div class="button-wrapper">
                                            <a href="${ebookPageUrl}" class="button" style="color: #ffffff !important;">
                                                ZOBACZ E-BOOK<span class="button-arrow">→</span>
                                            </a>
                                        </div>
                                        
                                        <p>W e-booku znajdziesz m.in.:</p>
                                        <ul style="color: #6b6b6b; padding-left: 20px;">
                                            <li>Wszystko na temat ściągania masy</li>
                                            <li>Korektę na krótkich paznokciach</li>
                                            <li>Obszerną korektę na kształt kwadrat</li>
                                            <li>Zmianę kształtu bez użycia form</li>
                                            <li>Sposoby na podniesienie wolnego brzegu</li>
                                            <li>Schematy pracy, które skracają czas stylizacji</li>
                                            <li><strong>GRATIS: korekta na kształt migdał</strong></li>
                                        </ul>
                                        
                                        <p style="margin-top: 30px;">Cena: <strong style="color: #212121;">300 zł</strong></p>
                                        <p>Dostęp na zawsze — bez limitu czasu.</p>
                                    </div>
                                    
                                    <div class="footer">
                                        <p class="footer-brand">Julia Wójcik</p>
                                        <p>Profesjonalna Stylizacja Paznokci</p>
                                        <p>Szczecin · <a href="https://juliawojcikszkolenia.pl">juliawojcikszkolenia.pl</a></p>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                });

                if (emailResult && !emailResult.error) {
                    successCount++;
                    console.log(`✅ Email sent to: ${subscriberEmail}`);
                } else {
                    errorCount++;
                    console.error(`❌ Failed to send to: ${subscriberEmail}`, emailResult?.error);
                }
            } catch (emailError) {
                errorCount++;
                console.error(`❌ Error sending to ${subscriberEmail}:`, emailError.message);
            }
        }

        return res.status(200).json({ 
            success: true,
            message: 'Premiere notifications sent',
            total: subscribers.length,
            successCount: successCount,
            errorCount: errorCount
        });

    } catch (error) {
        console.error('❌ Error in send-premiere-notification:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
}

