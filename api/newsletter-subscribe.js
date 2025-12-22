// Vercel Serverless Function - Zapisywanie subskrybentów newslettera

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
        
        // Próbuj zapisać do Redis jeśli skonfigurowany
        let savedToRedis = false;
        
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            try {
                // Użyj fetch zamiast biblioteki Redis
                const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
                const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
                
                // Sprawdź czy email już istnieje
                const getResponse = await fetch(`${redisUrl}/get/newsletter:${emailLower}`, {
                    headers: { Authorization: `Bearer ${redisToken}` }
                });
                const getData = await getResponse.json();
                
                if (getData.result) {
                    console.log('📧 Subscriber already exists:', email);
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
                    source: 'premiere-splash'
                };
                
                await fetch(`${redisUrl}/set/newsletter:${emailLower}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${redisToken}` },
                    body: JSON.stringify(subscriberData)
                });
                
                // Pobierz listę subskrybentów
                const listResponse = await fetch(`${redisUrl}/get/newsletter:subscribers:list`, {
                    headers: { Authorization: `Bearer ${redisToken}` }
                });
                const listData = await listResponse.json();
                
                let subscribersList = [];
                if (listData.result) {
                    try {
                        subscribersList = JSON.parse(listData.result);
                    } catch (e) {
                        subscribersList = [];
                    }
                }
                
                if (!Array.isArray(subscribersList)) {
                    subscribersList = [];
                }
                
                // Dodaj email jeśli jeszcze nie ma
                if (!subscribersList.includes(emailLower)) {
                    subscribersList.push(emailLower);
                    await fetch(`${redisUrl}/set/newsletter:subscribers:list`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${redisToken}` },
                        body: JSON.stringify(subscribersList)
                    });
                }
                
                savedToRedis = true;
                console.log('✅ Newsletter subscription saved to Upstash Redis:', email);
                console.log('📊 Total subscribers:', subscribersList.length);
                
            } catch (redisError) {
                console.error('❌ Redis Error:', redisError);
            }
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
