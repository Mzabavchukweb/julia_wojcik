// Test endpoint - wysyła testowy email i zwraca pełną odpowiedź
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        // Sprawdź Redis
        let subscribers = [];
        let redisStatus = 'not configured';
        
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            const redis = new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL,
                token: process.env.UPSTASH_REDIS_REST_TOKEN,
            });
            
            const subscribersList = await redis.get('newsletter:subscribers:list');
            redisStatus = 'connected';
            
            if (Array.isArray(subscribersList)) {
                subscribers = subscribersList;
            } else if (typeof subscribersList === 'string') {
                try {
                    subscribers = JSON.parse(subscribersList);
                } catch (e) {
                    subscribers = [];
                }
            }
        }
        
        // Sprawdź Resend
        let resendStatus = 'not configured';
        let emailResult = null;
        
        if (process.env.RESEND_API_KEY) {
            resendStatus = 'configured';
            
            const resend = new Resend(process.env.RESEND_API_KEY);
            const emailFrom = process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>';
            
            // Wyślij testowy email do pierwszego subskrybenta
            const testEmail = subscribers[0] || req.query.email;
            
            if (testEmail) {
                try {
                    emailResult = await resend.emails.send({
                        from: emailFrom,
                        to: testEmail,
                        subject: 'Test - E-book powiadomienie',
                        html: `
                            <h1>Test powiadomienia</h1>
                            <p>To jest testowy email wysłany z systemu powiadomień.</p>
                            <p>Czas: ${new Date().toISOString()}</p>
                        `
                    });
                    resendStatus = 'email sent';
                } catch (emailError) {
                    resendStatus = 'email error';
                    emailResult = {
                        error: emailError.message,
                        statusCode: emailError.statusCode,
                        name: emailError.name
                    };
                }
            } else {
                resendStatus = 'no email to send to';
            }
        }
        
        return res.status(200).json({
            status: 'ok',
            redis: {
                status: redisStatus,
                subscribersCount: subscribers.length,
                subscribers: subscribers
            },
            resend: {
                status: resendStatus,
                apiKeySet: !!process.env.RESEND_API_KEY,
                apiKeyPrefix: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.substring(0, 8) + '...' : null,
                emailFrom: process.env.EMAIL_FROM || 'DEFAULT: Julia Wójcik <ebook@juliawojcikszkolenia.pl>',
                emailResult: emailResult
            },
            banner: {
                startTimeKey: 'premiere:banner:start:time',
                endedKey: 'premiere:banner:ended',
                notificationsSentKey: 'premiere:notifications:sent'
            }
        });
        
    } catch (error) {
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}

