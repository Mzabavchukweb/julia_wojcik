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
        const premiereEndKey = 'premiere:banner:end:time';
        const bannerEndedKey = 'premiere:banner:ended';
        
        // Jeśli to POST z markEnded, oznacz banner jako zakończony
        // Jeśli to POST z reset, zresetuj czas
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            
            // Reset czasu premiery
            if (body && body.reset === true) {
                const notificationsSentKey = 'premiere:notifications:sent';
                await redis.del(premiereStartKey);
                await redis.del(premiereEndKey);
                await redis.del(bannerEndedKey);
                await redis.del(notificationsSentKey); // Resetuj flagę powiadomień
                
                // Jeśli podano targetDate, ustaw startTime i endTime
                // Jeśli podano minutes, ustaw startTime tak, żeby timer pokazywał X minut
                let newStartTime = new Date().getTime();
                let newEndTime = null;
                
                if (body.targetDate) {
                    // Ustaw konkretną datę premiery
                    const targetDate = new Date(body.targetDate);
                    newEndTime = targetDate.getTime();
                    // startTime = teraz (czas rozpoczęcia odliczania)
                    newStartTime = new Date().getTime();
                    console.log(`[PREMIERE] 🔄 Reset premiere time to target date: ${targetDate.toISOString()}`);
                } else if (body.minutes && typeof body.minutes === 'number' && body.minutes > 0) {
                    // Timer pokazuje: endTime - teraz
                    // Więc endTime = teraz + X minut
                    const targetMinutes = body.minutes * 60 * 1000; // Docelowa liczba minut do pokazania
                    newStartTime = new Date().getTime();
                    newEndTime = newStartTime + targetMinutes;
                    console.log(`[PREMIERE] 🔄 Reset premiere time to show ${body.minutes} minutes on timer`);
                } else {
                    // Domyślnie: 1 minuta
                    newStartTime = new Date().getTime();
                    newEndTime = newStartTime + (1 * 60 * 1000);
                    console.log(`[PREMIERE] 🔄 Reset premiere time to now + 1 minute`);
                }
                
                await redis.set(premiereStartKey, newStartTime.toString());
                if (newEndTime) {
                    await redis.set(premiereEndKey, newEndTime.toString());
                }
                console.log(`[PREMIERE] ✅ Set premiere start time: ${newStartTime}, end time: ${newEndTime}`);
                return res.status(200).json({ 
                    message: 'Premiere time has been reset',
                    success: true,
                    newStartTime: newStartTime,
                    endTime: newEndTime,
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
        let endTime = await redis.get(premiereEndKey);
        
        if (!startTime) {
            // Jeśli nie ma, ustaw czas rozpoczęcia na teraz i zapisz
            startTime = new Date().getTime();
            endTime = startTime + (1 * 60 * 1000); // Domyślnie 1 minuta
            await redis.set(premiereStartKey, startTime.toString());
            await redis.set(premiereEndKey, endTime.toString());
            console.log(`[PREMIERE] ✅ Set global premiere start time: ${startTime}, end time: ${endTime}`);
        } else {
            startTime = parseInt(startTime);
            // Jeśli nie ma endTime, użyj starej logiki (startTime + 1 minuta) dla kompatybilności wstecznej
            if (!endTime) {
                endTime = startTime + (1 * 60 * 1000);
                await redis.set(premiereEndKey, endTime.toString());
                console.log(`[PREMIERE] ⚠️ No endTime found, using legacy calculation: ${endTime}`);
            } else {
                endTime = parseInt(endTime);
            }
            console.log(`[PREMIERE] ✅ Retrieved global premiere start time: ${startTime}, end time: ${endTime}`);
        }
        
        // Automatycznie sprawdź czy czas minął (nawet jeśli flaga nie jest ustawiona)
        const now = new Date().getTime();
        
        if (now >= endTime) {
            // Czas minął - automatycznie oznacz jako zakończony
            if (bannerEnded !== 'true') {
                await redis.set(bannerEndedKey, 'true');
                console.log(`[PREMIERE] ✅ Banner time expired automatically, marked as ended`);
            }
            return res.status(200).json({
                ended: true,
                startTime: startTime,
                endTime: endTime,
                currentTime: now,
                expiredBy: now - endTime
            });
        }
        
        // Banner jeszcze aktywny
        return res.status(200).json({
            startTime: startTime,
            endTime: endTime,
            ended: false,
            currentTime: now,
            timeRemaining: endTime - now
        });
    } catch (error) {
        console.error('[PREMIERE] ❌ Error:', error);
        return res.status(500).json({ 
            error: 'Failed to get premiere time',
            message: error.message 
        });
    }
}

