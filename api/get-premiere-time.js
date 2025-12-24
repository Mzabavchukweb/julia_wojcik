// Vercel Serverless Function - Zwraca globalny czas rozpoczęcia odliczania
import { Redis } from '@upstash/redis';
import { Resend } from 'resend';

// Inicjalizuj Redis
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const premiereStartKey = 'premiere:banner:start:time';
        const bannerEndedKey = 'premiere:banner:ended';
        const notificationsSentKey = 'premiere:notifications:sent';
        
        // Debug mode - zwraca pełne informacje diagnostyczne
        if (req.query?.debug === 'true') {
            const subscribersList = await redis.get('newsletter:subscribers:list');
            let subscribers = [];
            
            if (Array.isArray(subscribersList)) {
                subscribers = subscribersList;
            } else if (typeof subscribersList === 'string') {
                try { subscribers = JSON.parse(subscribersList); } catch(e) {}
            }
            
            // Test wysyłki email
            let emailTest = null;
            const testEmailAddr = req.query?.testEmail;
            
            if (testEmailAddr && process.env.RESEND_API_KEY) {
                try {
                    const resend = new Resend(process.env.RESEND_API_KEY);
                    const emailFrom = process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>';
                    
                    emailTest = await resend.emails.send({
                        from: emailFrom,
                        to: testEmailAddr,
                        subject: 'TEST - E-book powiadomienie',
                        html: '<h1>Test</h1><p>Testowy email z systemu powiadomień. Czas: ' + new Date().toISOString() + '</p>'
                    });
                } catch (emailError) {
                    emailTest = { error: emailError.message, statusCode: emailError.statusCode };
                }
            }
            
            return res.status(200).json({
                debug: true,
                subscribers: subscribers,
                subscribersCount: subscribers.length,
                subscribersRaw: { type: typeof subscribersList, value: subscribersList },
                bannerState: {
                    startTime: await redis.get(premiereStartKey),
                    bannerEnded: await redis.get(bannerEndedKey),
                    notificationsSent: await redis.get(notificationsSentKey)
                },
                config: {
                    resendApiKey: process.env.RESEND_API_KEY ? 'SET (' + process.env.RESEND_API_KEY.substring(0,8) + '...)' : 'NOT SET',
                    emailFrom: process.env.EMAIL_FROM || 'NOT SET (default used)',
                    redisConfigured: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
                },
                emailTest: emailTest
            });
        }
        
        // Jeśli to POST z markEnded lub reset
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            
            // RESET - usuń wszystkie flagi i ustaw nowy czas rozpoczęcia
            if (body && body.reset === true) {
                await redis.del(bannerEndedKey);
                await redis.del(premiereStartKey);
                await redis.del(notificationsSentKey);
                const newStartTime = new Date().getTime();
                await redis.set(premiereStartKey, newStartTime.toString());
                console.log(`[PREMIERE] 🔄 RESET - New start time: ${newStartTime}`);
                return res.status(200).json({ 
                    message: 'Banner reset successfully',
                    startTime: newStartTime,
                    ended: false,
                    currentTime: newStartTime
                });
            }
            
            if (body && body.markEnded === true) {
                await redis.set(bannerEndedKey, 'true');
                console.log(`[PREMIERE] ✅ Marked banner as ended globally`);
                return res.status(200).json({ 
                    message: 'Banner marked as ended',
                    ended: true 
                });
            }
        }
        
        // Sprawdź czy banner już się zakończył
        const bannerEnded = await redis.get(bannerEndedKey);
        if (bannerEnded === 'true') {
            return res.status(200).json({
                ended: true,
                currentTime: new Date().getTime()
            });
        }
        
        // Sprawdź czy czas rozpoczęcia już istnieje w Redis
        // Użyj GET - jeśli nie istnieje, ustaw tylko raz (SETNX nie działa tutaj, bo potrzebujemy GET)
        let startTime = await redis.get(premiereStartKey);
        
        if (!startTime) {
            // Jeśli nie ma, ustaw czas rozpoczęcia na teraz i zapisz (tylko raz!)
            startTime = new Date().getTime();
            // Użyj SET z NX (only if not exists) aby zapobiec nadpisaniu przez równoczesne żądania
            const setResult = await redis.set(premiereStartKey, startTime.toString(), { ex: 86400, nx: true });
            if (setResult === null || setResult === 0) {
                // Ktoś inny już ustawił - pobierz wartość
                startTime = await redis.get(premiereStartKey);
                console.log(`[PREMIERE] ✅ Retrieved global premiere start time (set by another request): ${startTime}`);
            } else {
                console.log(`[PREMIERE] ✅ Set global premiere start time: ${startTime}`);
            }
        } else {
            console.log(`[PREMIERE] ✅ Retrieved global premiere start time: ${startTime}`);
        }
        
        return res.status(200).json({
            startTime: parseInt(startTime),
            ended: false,
            currentTime: new Date().getTime()
        });
    } catch (error) {
        console.error('[PREMIERE] ❌ Error:', error);
        return res.status(500).json({ 
            error: 'Failed to get premiere time',
            message: error.message 
        });
    }
}

