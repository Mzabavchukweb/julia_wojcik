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
        // Jeśli to POST z reset, zresetuj czas
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            
            // Reset czasu premiery
            if (body && body.reset === true) {
                await redis.del(premiereStartKey);
                await redis.del(bannerEndedKey);
                
                // Jeśli podano minutes, ustaw startTime tak, żeby timer pokazywał X minut
                // Timer pokazuje: (startTime + 4 minuty) - teraz
                // Więc dla X minut: X = (startTime + 4 minuty) - teraz
                // startTime = teraz - 4 minuty + X minut = teraz - (4 - X) minuty
                let newStartTime = new Date().getTime();
                if (body.minutes && typeof body.minutes === 'number' && body.minutes > 0) {
                    const timerDuration = 4 * 60 * 1000; // 4 minuty w milisekundach (domyślny czas trwania timera)
                    const targetMinutes = body.minutes * 60 * 1000; // Docelowa liczba minut do pokazania
                    newStartTime = newStartTime - timerDuration + targetMinutes;
                    console.log(`[PREMIERE] 🔄 Reset premiere time to show ${body.minutes} minutes on timer`);
                } else {
                    console.log(`[PREMIERE] 🔄 Reset premiere time to now`);
                }
                
                await redis.set(premiereStartKey, newStartTime.toString());
                console.log(`[PREMIERE] ✅ Set premiere start time: ${newStartTime}`);
                return res.status(200).json({ 
                    message: 'Premiere time has been reset',
                    success: true,
                    newStartTime: newStartTime,
                    currentTime: new Date().getTime()
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

