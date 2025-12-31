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
                const notificationsSentKey = 'premiere:notifications:sent';
                await redis.del(premiereStartKey);
                await redis.del(bannerEndedKey);
                await redis.del(notificationsSentKey); // Resetuj flagę powiadomień
                
                // Jeśli podano targetDate, ustaw startTime tak żeby banner zakończył się o tej dacie
                // Jeśli podano minutes, ustaw startTime tak, żeby timer pokazywał X minut
                let newStartTime = new Date().getTime();
                
                if (body.targetDate) {
                    // Ustaw konkretną datę premiery
                    // bannerEndTime = startTime + 1 minuta
                    // Więc startTime = targetDate - 1 minuta
                    const targetDate = new Date(body.targetDate);
                    const timerDuration = 1 * 60 * 1000; // 1 minuta
                    newStartTime = targetDate.getTime() - timerDuration;
                    console.log(`[PREMIERE] 🔄 Reset premiere time to target date: ${targetDate.toISOString()}`);
                } else if (body.minutes && typeof body.minutes === 'number' && body.minutes > 0) {
                    // Timer pokazuje: (startTime + 1 minuta) - teraz
                    // Więc dla X minut: X = (startTime + 1 minuta) - teraz
                    // startTime = teraz - 1 minuta + X minut = teraz - (1 - X) minuty
                    const timerDuration = 1 * 60 * 1000; // 1 minuta w milisekundach (domyślny czas trwania timera)
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
        
        // Sprawdź czy banner już się zakończył (flaga)
        let bannerEnded = await redis.get(bannerEndedKey);
        
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
        
        // Automatycznie sprawdź czy czas minął (nawet jeśli flaga nie jest ustawiona)
        startTime = parseInt(startTime);
        const bannerEndTime = startTime + (1 * 60 * 1000); // 1 minuta
        const now = new Date().getTime();
        
        if (now >= bannerEndTime) {
            // Czas minął - automatycznie oznacz jako zakończony
            if (bannerEnded !== 'true') {
                await redis.set(bannerEndedKey, 'true');
                console.log(`[PREMIERE] ✅ Banner time expired automatically, marked as ended`);
            }
            return res.status(200).json({
                ended: true,
                startTime: startTime,
                currentTime: now,
                expiredBy: now - bannerEndTime
            });
        }
        
        // Banner jeszcze aktywny
        return res.status(200).json({
            startTime: startTime,
            ended: false,
            currentTime: now,
            timeRemaining: bannerEndTime - now
        });
    } catch (error) {
        console.error('[PREMIERE] ❌ Error:', error);
        return res.status(500).json({ 
            error: 'Failed to get premiere time',
            message: error.message 
        });
    }
}

