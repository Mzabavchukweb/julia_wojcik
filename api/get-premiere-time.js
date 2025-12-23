// Vercel Serverless Function - Zwraca globalny czas rozpoczęcia odliczania
import { Redis } from '@upstash/redis';

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
        
        // Jeśli to POST z markEnded, oznacz banner jako zakończony
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
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
        let startTime = await redis.get(premiereStartKey);
        
        if (!startTime) {
            // Jeśli nie ma, ustaw czas rozpoczęcia na teraz i zapisz
            startTime = new Date().getTime();
            await redis.set(premiereStartKey, startTime.toString());
            console.log(`[PREMIERE] ✅ Set global premiere start time: ${startTime}`);
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

