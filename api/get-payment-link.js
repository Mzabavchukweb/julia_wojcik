// Vercel Serverless Function - Zwraca payment link TYLKO po czasie premiery
// Zabezpieczenie: link nigdy nie trafia do kodu źródłowego strony przed premierą

export default async function handler(req, res) {
    // CORS headers
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
        // Czas premiery: 19 marca 2026, godz. 19:00 CET (UTC+1)
        // CET = UTC+1, więc 19:00 CET = 18:00 UTC
        const PREMIERE_TIME = new Date('2026-03-19T18:00:00.000Z').getTime();
        
        // Czas serwera
        const now = Date.now();
        const timeRemaining = PREMIERE_TIME - now;
        
        console.log(`[PAYMENT-LINK] Current time: ${new Date(now).toISOString()}`);
        console.log(`[PAYMENT-LINK] Premiere time: ${new Date(PREMIERE_TIME).toISOString()}`);
        console.log(`[PAYMENT-LINK] Time remaining: ${timeRemaining}ms (${Math.round(timeRemaining / 1000 / 60)} min)`);
        
        if (timeRemaining > 0) {
            // PRZED PREMIERĄ - nie ujawniaj linku!
            console.log('[PAYMENT-LINK] ⏳ Before premiere - link locked');
            return res.status(200).json({
                locked: true,
                premiereTime: PREMIERE_TIME,
                serverTime: now,
                timeRemaining: timeRemaining,
                price: 299,
                message: 'Już wkrótce'
            });
        }
        
        // PO PREMIERZE - zwróć link
        const PAYMENT_LINK = 'https://buy.stripe.com/fZucN7el587w3MH8a0eAg02';
        
        console.log('[PAYMENT-LINK] ✅ After premiere - link unlocked');
        return res.status(200).json({
            locked: false,
            paymentLink: PAYMENT_LINK,
            premiereTime: PREMIERE_TIME,
            serverTime: now,
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
