// Vercel Serverless Function - Ustawia timer na konkretną liczbę minut
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
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
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const minutes = body?.minutes || 1;
        
        const premiereStartKey = 'premiere:banner:start:time';
        const bannerEndedKey = 'premiere:banner:ended';
        
        // Usuń flagę zakończenia
        await redis.del(bannerEndedKey);
        
        // Oblicz startTime tak, żeby timer pokazywał X minut
        // Timer pokazuje: (startTime + 4 minuty) - teraz
        // Dla X minut: X = (startTime + 4 minuty) - teraz
        // startTime = teraz - 4 minuty + X minut = teraz - (4 - X) minuty
        const now = new Date().getTime();
        const timerDuration = 4 * 60 * 1000; // 4 minuty
        const targetMinutes = minutes * 60 * 1000;
        const newStartTime = now - timerDuration + targetMinutes;
        
        await redis.set(premiereStartKey, newStartTime.toString());
        
        console.log(`[TIMER] ✅ Set timer to ${minutes} minutes. startTime=${newStartTime}, now=${now}`);
        
        return res.status(200).json({
            success: true,
            message: `Timer set to ${minutes} minutes`,
            startTime: newStartTime,
            currentTime: now,
            minutes: minutes
        });
    } catch (error) {
        console.error('[TIMER] ❌ Error:', error);
        return res.status(500).json({ 
            error: 'Failed to set timer',
            message: error.message 
        });
    }
}

