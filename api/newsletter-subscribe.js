// Vercel Serverless Function - Zapisywanie subskrybentów newslettera
import { Redis } from '@upstash/redis';

// Inicjalizuj Redis (automatycznie używa zmiennych środowiskowych)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        const emailLower = email.toLowerCase().trim();
        
        try {
            // Sprawdź czy Upstash Redis jest skonfigurowany
            if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
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

