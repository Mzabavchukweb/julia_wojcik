// Vercel Serverless Function - Resetuje czas premiery
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const premiereStartKey = 'premiere:banner:start:time';
        const bannerEndedKey = 'premiere:banner:ended';
        const notificationsSentKey = 'premiere:notifications:sent';
        
        // Usuń wszystkie klucze aby zresetować timer i powiadomienia
        await redis.del(premiereStartKey);
        await redis.del(bannerEndedKey);
        await redis.del(notificationsSentKey);
        
        // Ustaw nowy czas startowy na teraz
        const newStartTime = new Date().getTime();
        await redis.set(premiereStartKey, newStartTime.toString());
        
        console.log(`[PREMIERE] 🔄 Reset premiere time to: ${newStartTime}`);
        
        return res.status(200).json({
            success: true,
            message: 'Premiere time has been reset',
            newStartTime: newStartTime,
            currentTime: new Date().getTime()
        });
    } catch (error) {
        console.error('[PREMIERE] ❌ Reset error:', error);
        return res.status(500).json({ 
            error: 'Failed to reset premiere time',
            message: error.message 
        });
    }
}

