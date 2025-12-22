// Vercel Serverless Function - Zapisywanie subskrybentów newslettera
console.log('[INIT] Loading newsletter-subscribe.js module...');

import { Redis } from '@upstash/redis';

console.log('[INIT] ✅ Module newsletter-subscribe.js loaded successfully');

export default async function handler(req, res) {
    console.log('[NEWSLETTER] Request received:', req.method, req.url);
    console.log('[NEWSLETTER] Request body:', req.body);
    console.log('[NEWSLETTER] Request headers:', req.headers);
    
    // Sprawdź metodę na początku
    if (req.method !== 'POST') {
        console.log('[NEWSLETTER] Method not allowed:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // CORS headers dla preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({});
    }
    
    // Inicjalizuj Redis w handlerze (automatycznie używa zmiennych środowiskowych)
    let redis = null;
    try {
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            redis = new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL,
                token: process.env.UPSTASH_REDIS_REST_TOKEN,
            });
            console.log('[NEWSLETTER] ✅ Redis initialized');
        } else {
            console.log('[NEWSLETTER] ⚠️ Redis not configured - using fallback');
        }
    } catch (redisInitError) {
        console.error('[NEWSLETTER] ❌ Redis initialization error:', redisInitError);
    }

    try {
        // Parsuj body - może być string lub już obiekt
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                console.error('[NEWSLETTER] Error parsing body:', e);
            }
        }
        
        const { email } = body || {};

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        const emailLower = email.toLowerCase().trim();
        
        try {
            // Sprawdź czy Upstash Redis jest skonfigurowany
            if (!redis || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
                throw new Error('Upstash Redis not configured');
            }

            // Sprawdź czy już istnieje
            const subscriberKey = `newsletter:${emailLower}`;
            const existing = await redis.get(subscriberKey);
            
            if (existing) {
                console.log('📧 Subscriber already exists:', email);
                return res.status(200).json({ 
                    success: true,
                    message: 'Email już jest zapisany. Otrzymasz powiadomienie o premierze!',
                    email: email
                });
            }

            // Zapisz dane subskrybenta
            const subscriberData = {
                email: emailLower,
                subscribedAt: new Date().toISOString(),
                source: 'premiere-splash'
            };
            await redis.set(subscriberKey, subscriberData);
            
            // Dodaj do listy wszystkich subskrybentów
            const subscribersListKey = 'newsletter:subscribers:list';
            let subscribersList = await redis.get(subscribersListKey);
            
            if (!Array.isArray(subscribersList)) {
                subscribersList = [];
            }
            
            // Dodaj email jeśli jeszcze nie ma
            if (!subscribersList.includes(emailLower)) {
                subscribersList.push(emailLower);
                await redis.set(subscribersListKey, subscribersList);
            }

            console.log('✅ Newsletter subscription saved automatically to Upstash Redis:', email);
            console.log('📅 Subscription date:', subscriberData.subscribedAt);
            console.log('📊 Total subscribers:', subscribersList.length);

            return res.status(200).json({ 
                success: true,
                message: 'Email zapisany pomyślnie. Otrzymasz powiadomienie o premierze!',
                email: email
            });

        } catch (redisError) {
            console.error('❌ Redis Error:', redisError);
            console.error('💡 Make sure Upstash Redis is configured in Vercel Environment Variables');
            console.error('💡 Get free Redis at: https://console.upstash.com/');
            
            // Fallback: zwróć sukces (email i tak jest zapisywany przez FormSubmit)
            return res.status(200).json({ 
                success: true,
                message: 'Email zapisany pomyślnie. Otrzymasz powiadomienie o premierze!',
                email: email,
                warning: 'Redis storage not available - email recorded via FormSubmit. Configure Upstash Redis for automatic storage.'
            });
        }

    } catch (error) {
        console.error('❌ Error in newsletter-subscribe:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
}

