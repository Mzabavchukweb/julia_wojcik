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
                    subscribers = subscribersList;
                    console.log(`✅ Found ${subscribers.length} subscribers in Upstash Redis (automatic)`);
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
                    subject: 'Informacja od Julii Wójcik',
                    text: `${greeting}!

Dziękuję, że zapisałaś się na powiadomienie o moim e-booku "Korekta bez skrótów".

Właśnie udostępniłam go na stronie - możesz go zobaczyć tutaj:
${ebookPageUrl}

Jeśli masz jakiekolwiek pytania, odpisz na tego maila - chętnie odpowiem.

Pozdrawiam serdecznie,
Julia Wójcik

--
Julia Wójcik
Profesjonalna Stylizacja Paznokci
Szczecin
juliawojcikszkolenia.pl`,
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                        </head>
                        <body style="font-family: Georgia, serif; font-size: 16px; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <p>${greeting}!</p>
                            
                            <p>Dziękuję, że zapisałaś się na powiadomienie o moim e-booku "Korekta bez skrótów".</p>
                            
                            <p>Właśnie udostępniłam go na stronie - możesz go zobaczyć tutaj:<br>
                            <a href="${ebookPageUrl}" style="color: #8B4513;">${ebookPageUrl}</a></p>
                            
                            <p>Jeśli masz jakiekolwiek pytania, odpisz na tego maila - chętnie odpowiem.</p>
                            
                            <p>Pozdrawiam serdecznie,<br>
                            <strong>Julia Wójcik</strong></p>
                            
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                            
                            <p style="font-size: 14px; color: #666;">
                                Julia Wójcik<br>
                                Profesjonalna Stylizacja Paznokci<br>
                                Szczecin<br>
                                <a href="https://juliawojcikszkolenia.pl" style="color: #8B4513;">juliawojcikszkolenia.pl</a>
                            </p>
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

