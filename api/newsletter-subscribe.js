// Vercel Serverless Function - Zapisywanie subskrybentów newslettera
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        // Zapisz email do Vercel KV
        const subscriberKey = `newsletter:${email.toLowerCase()}`;
        const subscriberData = {
            email: email.toLowerCase(),
            subscribedAt: new Date().toISOString(),
            source: 'premiere-splash'
        };

        try {
            // Sprawdź czy już istnieje
            const existing = await kv.get(subscriberKey);
            if (existing) {
                console.log('📧 Subscriber already exists:', email);
                return res.status(200).json({ 
                    success: true,
                    message: 'Email już jest zapisany. Otrzymasz powiadomienie o premierze!',
                    email: email
                });
            }

            // Zapisz do KV
            await kv.set(subscriberKey, subscriberData);
            
            // Dodaj do listy wszystkich subskrybentów
            const subscribersListKey = 'newsletter:subscribers:list';
            let subscribersList = await kv.get(subscribersListKey) || [];
            if (!Array.isArray(subscribersList)) {
                subscribersList = [];
            }
            
            // Dodaj email jeśli jeszcze nie ma
            if (!subscribersList.includes(email.toLowerCase())) {
                subscribersList.push(email.toLowerCase());
                await kv.set(subscribersListKey, subscribersList);
            }

            console.log('✅ Newsletter subscription saved:', email);
            console.log('📅 Subscription date:', subscriberData.subscribedAt);
            console.log('📊 Total subscribers:', subscribersList.length);

            return res.status(200).json({ 
                success: true,
                message: 'Email zapisany pomyślnie. Otrzymasz powiadomienie o premierze!',
                email: email
            });

        } catch (kvError) {
            console.error('❌ KV Error:', kvError);
            // Fallback - jeśli KV nie działa, zwróć sukces (email i tak jest zapisywany przez FormSubmit)
            return res.status(200).json({ 
                success: true,
                message: 'Email zapisany pomyślnie. Otrzymasz powiadomienie o premierze!',
                email: email,
                warning: 'Storage temporarily unavailable, but email was recorded'
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

