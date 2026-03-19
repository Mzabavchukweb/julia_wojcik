// Vercel Serverless Function - Zwraca payment links dla obu e-booków

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('[PAYMENT-LINK] ✅ Returning payment links');
        return res.status(200).json({
            locked: false,
            ebooks: [
                {
                    id: 'sekret-czystej-skory',
                    name: 'Sekret czystej skóry',
                    price: 299,
                    paymentLink: 'https://buy.stripe.com/14AbJ31yj4Vk1Ez75WeAg03'
                },
                {
                    id: 'korekta-bez-skrotow',
                    name: 'Korekta bez skrótów',
                    price: 350,
                    paymentLink: 'https://buy.stripe.com/00waEZ7WHbjIgzt75WeAg05'
                }
            ],
            // Backward compatibility
            paymentLink: 'https://buy.stripe.com/14AbJ31yj4Vk1Ez75WeAg03',
            price: 299
        });
        
    } catch (error) {
        console.error('[PAYMENT-LINK] ❌ Error:', error);
        return res.status(500).json({ 
            error: 'Failed to get payment link',
            message: error.message 
        });
    }
}
