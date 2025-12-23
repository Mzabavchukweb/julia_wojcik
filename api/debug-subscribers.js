// Debug endpoint - sprawdza subskrybentów i konfigurację
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const subscribersListKey = 'newsletter:subscribers:list';
        const subscribersList = await redis.get(subscribersListKey);
        
        // Pobierz też stan bannera
        const startTime = await redis.get('premiere:banner:start:time');
        const bannerEnded = await redis.get('premiere:banner:ended');
        const notificationsSent = await redis.get('premiere:notifications:sent');
        
        // Parsuj subskrybentów
        let subscribers = [];
        if (subscribersList) {
            if (Array.isArray(subscribersList)) {
                subscribers = subscribersList;
            } else if (typeof subscribersList === 'string') {
                try {
                    subscribers = JSON.parse(subscribersList);
                } catch (e) {
                    subscribers = ['PARSE_ERROR: ' + subscribersList];
                }
            }
        }
        
        return res.status(200).json({
            subscribers: subscribers,
            subscribersCount: subscribers.length,
            subscribersRaw: {
                type: typeof subscribersList,
                value: subscribersList
            },
            bannerState: {
                startTime: startTime,
                startTimeDate: startTime ? new Date(Number(startTime)).toISOString() : null,
                bannerEnded: bannerEnded,
                notificationsSent: notificationsSent,
                currentTime: new Date().toISOString()
            },
            config: {
                resendConfigured: !!process.env.RESEND_API_KEY,
                emailFrom: process.env.EMAIL_FROM || 'NOT SET - using default',
                redisConfigured: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
            }
        });
    } catch (error) {
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}

