// Vercel Serverless Function - Zwraca payment link

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
        const PAYMENT_LINK = 'https://buy.stripe.com/fZucN7el587w3MH8a0eAg02';
        
        console.log('[PAYMENT-LINK] ✅ Returning payment link');
        return res.status(200).json({
            locked: false,
            paymentLink: PAYMENT_LINK,
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
