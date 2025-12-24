// Vercel Serverless Function - Zapisywanie subskrybentów newslettera
import { Redis } from '@upstash/redis';

// Inicjalizuj Redis (automatycznie używa zmiennych środowiskowych)
let redis = null;
try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        console.log('[NEWSLETTER] ✅ Redis initialized');
    }
} catch (error) {
    console.error('[NEWSLETTER] ❌ Failed to initialize Redis:', error.message);
}

export default async function handler(req, res) {
    console.log('[NEWSLETTER] Request received:', req.method);
    
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
        // Parsuj body
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
        
        // Zapisz do Redis jeśli skonfigurowany
        let savedToRedis = false;
        
        if (redis) {
            try {
                const subscriberKey = `newsletter:${emailLower}`;
                const subscribersListKey = 'newsletter:subscribers:list';
                
                // Pobierz aktualną listę subskrybentów PRZED sprawdzeniem
                let subscribersList = await redis.get(subscribersListKey);
                
                // Obsłuż różne formaty danych
                if (!subscribersList) {
                    subscribersList = [];
                } else if (typeof subscribersList === 'string') {
                    // Jeśli to JSON string, sparsuj
                    try {
                        subscribersList = JSON.parse(subscribersList);
                    } catch (e) {
                        console.warn('[NEWSLETTER] Failed to parse subscribers list, starting fresh');
                        subscribersList = [];
                    }
                }
                
                if (!Array.isArray(subscribersList)) {
                    subscribersList = [];
                }
                
                // Usuń duplikaty z listy przed sprawdzeniem
                subscribersList = [...new Set(subscribersList.map(e => e.toLowerCase().trim()))];
                
                // Sprawdź czy email już istnieje w liście LUB jako klucz
                const existingInList = subscribersList.includes(emailLower);
                const existingSubscriber = await redis.get(subscriberKey);
                
                if (existingInList || existingSubscriber) {
                    console.log('📧 Subscriber already exists:', email);
                    // Upewnij się że lista nie ma duplikatów
                    if (existingInList) {
                        // Email już jest w liście - zapisz listę bez duplikatów
                        await redis.set(subscribersListKey, subscribersList);
                    } else if (existingSubscriber) {
                        // Email jest jako klucz ale nie w liście - dodaj do listy
                        subscribersList.push(emailLower);
                        subscribersList = [...new Set(subscribersList)]; // Usuń duplikaty
                        await redis.set(subscribersListKey, subscribersList);
                        console.log('[NEWSLETTER] ✅ Fixed: Added existing subscriber to list');
                    }
                    return res.status(200).json({ 
                        success: true,
                        message: 'Email już jest zapisany. Otrzymasz powiadomienie o premierze!',
                        email: email
                    });
                }
                
                // Zapisz subskrybenta
                const subscriberData = {
                    email: emailLower,
                    subscribedAt: new Date().toISOString(),
                    source: body.source || 'premiere-splash'
                };
                
                await redis.set(subscriberKey, subscriberData);
                
                // Dodaj email do listy (już sprawdziliśmy że nie ma)
                subscribersList.push(emailLower);
                // Usuń duplikaty przed zapisaniem
                subscribersList = [...new Set(subscribersList.map(e => e.toLowerCase().trim()))];
                
                // Zapisz zaktualizowaną listę - używamy set() z biblioteki @upstash/redis
                // która automatycznie serializuje tablice do JSON
                await redis.set(subscribersListKey, subscribersList);
                
                console.log('[NEWSLETTER] ✅ Added email to list:', emailLower);
                console.log('[NEWSLETTER] 📊 Updated subscribers list length:', subscribersList.length);
                
                savedToRedis = true;
                console.log('✅ Newsletter subscription saved to Upstash Redis:', email);
                console.log('📊 Total subscribers:', subscribersList.length);
                
            } catch (redisError) {
                console.error('❌ Redis Error:', redisError);
                // Nie zwracaj błędu - spróbuj fallback
            }
        } else {
            console.warn('⚠️ Redis not initialized');
        }

        return res.status(200).json({ 
            success: true,
            message: 'Email zapisany pomyślnie. Otrzymasz powiadomienie o premierze!',
            email: email,
            savedToRedis: savedToRedis
        });

    } catch (error) {
        console.error('❌ Error in newsletter-subscribe:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
}
