// Vercel Serverless Function - Zapisywanie subskrybentów newslettera
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
        
        // Pobierz aktualną listę subskrybentów z zmiennej środowiskowej
        let subscribers = [];
        if (process.env.NEWSLETTER_SUBSCRIBERS) {
            subscribers = process.env.NEWSLETTER_SUBSCRIBERS
                .split(',')
                .map(e => e.trim().toLowerCase())
                .filter(Boolean);
        }

        // Sprawdź czy email już istnieje
        if (subscribers.includes(emailLower)) {
            console.log('📧 Subscriber already exists:', email);
            return res.status(200).json({ 
                success: true,
                message: 'Email już jest zapisany. Otrzymasz powiadomienie o premierze!',
                email: email
            });
        }

        // Dodaj nowy email do listy
        subscribers.push(emailLower);
        const updatedList = subscribers.join(',');

        console.log('✅ Newsletter subscription received:', email);
        console.log('📅 Subscription date:', new Date().toISOString());
        console.log('📊 Total subscribers:', subscribers.length);
        console.log('💡 IMPORTANT: Add this email to NEWSLETTER_SUBSCRIBERS env var in Vercel:');
        console.log('💡 Current list:', updatedList);
        console.log('💡 Format: email1@example.com,email2@example.com,email3@example.com');

        // Zwróć sukces - email jest zapisywany przez FormSubmit
        // Użytkownik musi ręcznie dodać email do NEWSLETTER_SUBSCRIBERS w Vercel
        return res.status(200).json({ 
            success: true,
            message: 'Email zapisany pomyślnie. Otrzymasz powiadomienie o premierze!',
            email: email,
            note: 'Email został zapisany. Dodaj go do NEWSLETTER_SUBSCRIBERS w Vercel Dashboard.'
        });

    } catch (error) {
        console.error('❌ Error in newsletter-subscribe:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
}

