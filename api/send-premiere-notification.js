// Vercel Serverless Function - Wysyłanie powiadomień o premierze e-booka
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';

// Inicjalizuj Redis (automatycznie używa zmiennych środowiskowych)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Tylko GET (Vercel cron jobs używają GET) lub POST (dla ręcznego wywołania)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Sprawdź czy to wywołanie z cron job (Vercel dodaje header) lub ręczne z auth
    const isCronJob = req.headers['user-agent']?.includes('vercel-cron') || 
                      req.headers['x-vercel-cron'] === '1' ||
                      req.headers['x-vercel-signature']; // Vercel cron signature
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET || 'premiere-secret-change-in-production';
    
    // TEST MODE: Wyłączono sprawdzanie autoryzacji i daty premiery
    // Dla produkcji odkomentuj poniższe linie:
    // const premiereDate = new Date('2025-12-30T00:00:00').getTime();
    // const now = new Date().getTime();
    // if (now < premiereDate) {
    //     return res.status(200).json({ message: 'Premiera jeszcze nie minęła' });
    // }

    try {
        console.log('[PREMIERE] Processing notification request...');

        // Pobierz listę subskrybentów z Upstash Redis (automatyczne)
        let subscribers = [];
        try {
            if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
                const subscribersListKey = 'newsletter:subscribers:list';
                const subscribersList = await redis.get(subscribersListKey);
                
                if (Array.isArray(subscribersList) && subscribersList.length > 0) {
                    // Usuń duplikaty z listy przed wysyłką
                    subscribers = [...new Set(subscribersList.map(e => e.toLowerCase().trim()))];
                    console.log(`✅ Found ${subscribersList.length} subscribers in Upstash Redis (automatic), ${subscribers.length} unique after deduplication`);
                } else {
                    // Fallback: użyj zmiennej środowiskowej jeśli Redis jest pusty
                    if (process.env.NEWSLETTER_SUBSCRIBERS) {
                        subscribers = process.env.NEWSLETTER_SUBSCRIBERS
                            .split(',')
                            .map(e => e.trim().toLowerCase())
                            .filter(Boolean);
                        console.log(`⚠️ Redis empty, using NEWSLETTER_SUBSCRIBERS env var: ${subscribers.length} subscribers`);
                    } else {
                        console.log('⚠️ No subscribers found in Redis or NEWSLETTER_SUBSCRIBERS');
                    }
                }
            } else {
                throw new Error('Upstash Redis not configured');
            }
        } catch (redisError) {
            console.error('❌ Redis Error:', redisError);
            // Fallback: użyj zmiennej środowiskowej
            if (process.env.NEWSLETTER_SUBSCRIBERS) {
                subscribers = process.env.NEWSLETTER_SUBSCRIBERS
                    .split(',')
                    .map(e => e.trim().toLowerCase())
                    .filter(Boolean);
                console.log(`⚠️ Using NEWSLETTER_SUBSCRIBERS fallback: ${subscribers.length} subscribers`);
            } else {
                console.log('⚠️ Redis not available and NEWSLETTER_SUBSCRIBERS not set');
            }
        }

        if (subscribers.length === 0) {
            console.log('⚠️ No subscribers found');
            return res.status(200).json({ 
                message: 'No subscribers to notify',
                count: 0
            });
        }

        const emailFrom = process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>';
        const ebookPageUrl = 'https://juliawojcikszkolenia.pl/pages/ebook.html';

        let successCount = 0;
        let errorCount = 0;

        // Sprawdź które emaile już zostały wysłane (zapobiegaj duplikatom)
        const sentEmailsKey = 'newsletter:premiere:sent';
        let sentEmails = [];
        try {
            const sentEmailsData = await redis.get(sentEmailsKey);
            if (Array.isArray(sentEmailsData)) {
                sentEmails = sentEmailsData.map(e => e.toLowerCase().trim());
            } else if (typeof sentEmailsData === 'string') {
                try {
                    sentEmails = JSON.parse(sentEmailsData).map(e => e.toLowerCase().trim());
                } catch (e) {
                    sentEmails = [];
                }
            }
        } catch (e) {
            console.warn('[PREMIERE] Could not get sent emails list, starting fresh');
            sentEmails = [];
        }

        // Filtruj tylko te emaile, które jeszcze nie otrzymały powiadomienia
        const emailsToSend = subscribers.filter(email => !sentEmails.includes(email.toLowerCase().trim()));
        
        if (emailsToSend.length === 0) {
            console.log('✅ All subscribers have already been notified');
            return res.status(200).json({ 
                success: true,
                message: 'All subscribers have already been notified',
                total: subscribers.length,
                alreadySent: subscribers.length,
                sentNow: 0
            });
        }

        console.log(`📧 Sending to ${emailsToSend.length} new subscribers (${subscribers.length - emailsToSend.length} already notified)`);

        // Wyślij email do każdego subskrybenta
        for (const subscriberEmail of emailsToSend) {
            try {
                if (!resend) {
                    throw new Error('Resend not initialized');
                }

                // Personalizacja - wyciągnij imię z emaila
                let greeting = 'Cześć';
                try {
                    const emailName = subscriberEmail.split('@')[0].replace(/[0-9._-]/g, ' ').trim();
                    if (emailName.length > 2 && emailName.length < 20) {
                        const capitalizedName = emailName.charAt(0).toUpperCase() + emailName.slice(1).toLowerCase();
                        greeting = `Cześć ${capitalizedName}`;
                    }
                } catch (nameError) {
                    // Użyj domyślnego powitania
                }

                const emailResult = await resend.emails.send({
                    from: emailFrom,
                    to: subscriberEmail,
                    subject: 'E-book jest już dostępny',
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <!--[if mso]>
                            <style type="text/css">
                                body, table, td {font-family: Arial, sans-serif !important;}
                            </style>
                            <![endif]-->
                            <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400&family=Roboto+Condensed:wght@400;500&display=swap" rel="stylesheet">
                            <style>
                                body { 
                                    font-family: 'Roboto Condensed', 'Avenir Next Condensed', Arial, sans-serif; 
                                    line-height: 1.8; 
                                    color: #6b6b6b; 
                                    margin: 0; 
                                    padding: 0; 
                                    background: #f3f1ee;
                                    -webkit-font-smoothing: antialiased;
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
                                .header-subtitle {
                                    font-size: 15px;
                                    color: #8a8a8a;
                                    margin-top: 12px;
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
                                .info-box { 
                                    background: #f9f8f6; 
                                    border-left: 3px solid #C5A572; 
                                    padding: 24px; 
                                    margin: 32px 0; 
                                }
                                .info-box-title {
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    font-size: 16px;
                                    font-weight: 400;
                                    text-transform: uppercase;
                                    letter-spacing: 0.05em;
                                    color: #212121;
                                    margin: 0 0 16px 0;
                                }
                                .info-box ul {
                                    margin: 0;
                                    padding-left: 20px;
                                    color: #6b6b6b;
                                }
                                .info-box li {
                                    margin-bottom: 10px;
                                    font-size: 15px;
                                }
                                .contact-section {
                                    margin-top: 36px;
                                    padding-top: 28px;
                                    border-top: 1px solid #e8e5e0;
                                    text-align: center;
                                }
                                .contact-title {
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    font-size: 14px;
                                    text-transform: uppercase;
                                    letter-spacing: 0.05em;
                                    color: #212121;
                                    margin: 0 0 20px 0;
                                }
                                .social-links {
                                    margin: 0;
                                    padding: 0;
                                }
                                .social-link {
                                    display: inline-block;
                                    margin: 0 12px;
                                    padding: 12px 24px;
                                    background: #f9f8f6;
                                    color: #212121 !important;
                                    text-decoration: none;
                                    font-size: 13px;
                                    font-weight: 500;
                                    letter-spacing: 0.05em;
                                }
                                .social-icon {
                                    width: 16px;
                                    height: 16px;
                                    vertical-align: middle;
                                    margin-right: 8px;
                                }
                                .signature {
                                    margin-top: 40px;
                                    text-align: center;
                                }
                                .signature p {
                                    margin: 0 0 4px 0;
                                    color: #6b6b6b;
                                }
                                .signature-name {
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    font-size: 20px;
                                    color: #212121;
                                    text-transform: uppercase;
                                    letter-spacing: 0.08em;
                                    margin-top: 16px !important;
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
                            <div class="wrapper">
                            <div class="container">
                                    <!-- Logo Section -->
                                    <div class="logo-section">
                                        <p class="logo">Julia Wójcik</p>
                                        <div class="gold-line"></div>
                                    </div>
                                    
                                    <!-- Header -->
                                <div class="header">
                                        <h1>E-book już dostępny</h1>
                                        <p class="header-subtitle">Korekta bez skrótów</p>
                                    </div>
                                    
                                    <!-- Content -->
                                    <div class="content">
                                        <p>${greeting}!</p>
                                        <p>Dziękuję, że zapisałaś się na powiadomienie o moim e-booku <strong style="color: #212121;">Korekta bez skrótów</strong>.</p>
                                        <p>Właśnie udostępniłam go na stronie — kliknij poniższy przycisk, aby zobaczyć szczegóły i zakupić:</p>
                                        
                                        <div class="button-wrapper">
                                            <a href="${ebookPageUrl}" class="button" style="color: #ffffff !important;">
                                                ZOBACZ E-BOOK<span class="button-arrow">→</span>
                                            </a>
                                        </div>
                                        
                                    <div class="info-box">
                                            <p class="info-box-title">Co znajdziesz w e-booku</p>
                                            <ul>
                                                <li>Wszystko na temat ściągania masy</li>
                                                <li>Korektę na krótkich paznokciach</li>
                                                <li>Obszerną korektę na kształt kwadrat</li>
                                                <li>Zmianę kształtu bez użycia form</li>
                                                <li>Sposoby na podniesienie wolnego brzegu</li>
                                                <li><strong style="color: #212121;">GRATIS:</strong> korekta na kształt migdał</li>
                                        </ul>
                                    </div>
                                        
                                        <!-- Contact Section with Social Icons -->
                                        <div class="contact-section">
                                            <p class="contact-title">Masz pytania? Napisz do mnie</p>
                                            <div class="social-links">
                                                <a href="https://www.instagram.com/juliawojcik_instruktor/" class="social-link" style="color: #212121 !important;">
                                                    <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                                                    Instagram
                                                </a>
                                                <a href="https://www.tiktok.com/@nailsbyjul_kawojcik" class="social-link" style="color: #212121 !important;">
                                                    <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                                                    TikTok
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <!-- Signature -->
                                        <div class="signature">
                                    <p>Pozdrawiam serdecznie,</p>
                                            <p class="signature-name">Julia Wójcik</p>
                                        </div>
                                </div>
                                    
                                    <!-- Footer -->
                                <div class="footer">
                                        <p class="footer-brand">Julia Wójcik</p>
                                        <div class="footer-gold-line"></div>
                                        <p>Profesjonalna Stylizacja Paznokci</p>
                                        <p>Szczecin · <a href="https://juliawojcikszkolenia.pl">juliawojcikszkolenia.pl</a></p>
                                        <div class="credits">
                                            <p>Projekt i wykonanie: <a href="https://codingmaks.com">codingmaks.com</a></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                });

                if (emailResult && !emailResult.error) {
                    successCount++;
                    // Oznacz email jako wysłany
                    sentEmails.push(subscriberEmail.toLowerCase().trim());
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

        // Zapisz listę wysłanych emaili do Redis (tylko te które zostały wysłane pomyślnie)
        if (successCount > 0) {
            try {
                // Usuń duplikaty przed zapisaniem
                const uniqueSentEmails = [...new Set(sentEmails)];
                await redis.set(sentEmailsKey, uniqueSentEmails);
                console.log(`💾 Saved ${uniqueSentEmails.length} sent emails to Redis`);
            } catch (saveError) {
                console.error('❌ Failed to save sent emails list:', saveError);
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

