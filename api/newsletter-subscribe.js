// Vercel Serverless Function - Zapisywanie subskrybentów newslettera
import { Resend } from 'resend';

// Inicjalizuj Resend
let resend = null;
try {
    if (process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
        console.log('[INIT] ✅ Resend initialized for newsletter');
    } else {
        console.error('[INIT] ❌ RESEND_API_KEY not set');
    }
} catch (error) {
    console.error('[INIT] ❌ ERROR: Failed to initialize Resend:', error.message);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        // Zapisz email do zmiennej środowiskowej NEWSLETTER_SUBSCRIBERS
        // W produkcji powinno być w bazie danych (Vercel KV, Supabase, etc.)
        // Na razie używamy prostego rozwiązania - emaile są zapisywane przez FormSubmit
        // i można je później dodać do NEWSLETTER_SUBSCRIBERS w Vercel
        
        console.log('📧 Newsletter subscription:', email);
        console.log('📅 Subscription date:', new Date().toISOString());
        console.log('💡 To add this email to notifications, add it to NEWSLETTER_SUBSCRIBERS env var in Vercel');
        console.log('💡 Format: email1@example.com,email2@example.com,email3@example.com');

        // Zwróć sukces
        return res.status(200).json({ 
            success: true,
            message: 'Email zapisany pomyślnie. Otrzymasz powiadomienie o premierze!',
            email: email
        });

    } catch (error) {
        console.error('❌ Error in newsletter-subscribe:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
}

