// Vercel Serverless Function - Wysyłanie powiadomień o premierze e-booka
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';

// Inicjalizuj Redis (automatycznie używa zmiennych środowiskowych)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Inicjalizuj Resend
let resend = null;
try {
    if (process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
        console.log('[INIT] ✅ Resend initialized for premiere notifications');
    } else {
        console.error('[INIT] ❌ RESEND_API_KEY not set');
    }
} catch (error) {
    console.error('[INIT] ❌ ERROR: Failed to initialize Resend:', error.message);
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Tylko GET (Vercel cron jobs używają GET) lub POST (dla ręcznego wywołania)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Sprawdź czy to wywołanie z cron job (Vercel dodaje header) lub ręczne z auth
    // Vercel cron jobs mogą używać różnych headerów - sprawdź wszystkie możliwe
    const userAgent = req.headers['user-agent'] || '';
    const xVercelCron = req.headers['x-vercel-cron'];
    const xVercelSignature = req.headers['x-vercel-signature'];
    const authorization = req.headers['authorization'];
    
    // Wykryj cron job na podstawie różnych sygnałów
    const isCronJob = userAgent.includes('vercel-cron') || 
                      userAgent.includes('cron') ||
                      xVercelCron === '1' ||
                      !!xVercelSignature ||
                      // Jeśli nie ma authorization i to GET request, prawdopodobnie to cron job
                      (req.method === 'GET' && !authorization && !req.query?.manual);
    
    console.log('[PREMIERE] Cron detection:', {
        userAgent,
        xVercelCron,
        xVercelSignature: xVercelSignature ? 'present' : 'missing',
        method: req.method,
        isCronJob
    });
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET || 'premiere-secret-change-in-production';
    
    try {
        console.log('[PREMIERE] ========================================');
        console.log('[PREMIERE] Processing notification request...');
        console.log('[PREMIERE] Request info:', {
            method: req.method,
            isCronJob,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
        });
        console.log('[PREMIERE] Service status:', {
            resendInitialized: !!resend,
            redisConfigured: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
            emailFrom: process.env.EMAIL_FROM || 'default'
        });
        
        // Sprawdź czy czas bannera się zakończył (dla wszystkich żądań - cron job lub frontend)
        const premiereStartKey = 'premiere:banner:start:time';
        const bannerEndedKey = 'premiere:banner:ended';
        const notificationsSentKey = 'premiere:notifications:sent';
        
        const startTime = await redis.get(premiereStartKey);
        const bannerEnded = await redis.get(bannerEndedKey);
        const notificationsSent = await redis.get(notificationsSentKey);
        
        console.log('[PREMIERE] Redis state:', { startTime, bannerEnded, notificationsSent });
        
        // Jeśli powiadomienia już zostały wysłane, nie rób nic
        if (notificationsSent === 'true') {
            console.log('[PREMIERE] Powiadomienia już wysłane - pomijam');
            return res.status(200).json({ 
                message: 'Notifications already sent',
                alreadySent: true
            });
        }
        
        // Sprawdź czy czas się zakończył
        if (startTime !== null && startTime !== undefined) {
            // Konwertuj na liczbę - może być string lub number z Redis
            const startTimeNum = typeof startTime === 'number' ? startTime : Number(startTime);
            
            if (isNaN(startTimeNum)) {
                console.error('[PREMIERE] ❌ Invalid startTime format:', startTime, typeof startTime);
                return res.status(200).json({ 
                    message: 'Invalid startTime format',
                    error: true,
                    startTimeValue: startTime,
                    startTimeType: typeof startTime
                });
            }
            
            const bannerEndTime = startTimeNum + (2 * 60 * 1000); // 2 minuty
            const now = Date.now();
            const distance = bannerEndTime - now;
            
            console.log('[PREMIERE] Time check:', { 
                startTimeRaw: startTime,
                startTimeType: typeof startTime,
                startTimeNum,
                bannerEndTime,
                now,
                distance,
                distanceSeconds: Math.floor(distance / 1000)
            });
            
            if (distance > 0) {
                // Czas jeszcze nie minął - nie wysyłaj powiadomień
                console.log(`[PREMIERE] Czas jeszcze nie minął - pozostało ${Math.floor(distance / 60000)} minut i ${Math.floor((distance % 60000) / 1000)} sekund`);
                return res.status(200).json({ 
                    message: 'Banner time not ended yet',
                    timeRemaining: distance,
                    timeRemainingMinutes: Math.floor(distance / 60000),
                    timeRemainingSeconds: Math.floor((distance % 60000) / 1000)
                });
            }
            
            // Czas minął - oznacz banner jako zakończony (jeśli jeszcze nie został oznaczony)
            if (bannerEnded !== 'true') {
                await redis.set(bannerEndedKey, 'true');
                console.log('[PREMIERE] ✅ Banner time ended - marked as ended, proceeding with notifications');
            } else {
                console.log('[PREMIERE] Banner already marked as ended, proceeding with notifications');
            }
            
            // WAŻNE: Kontynuuj dalej do wysyłania powiadomień (nie zwracaj tutaj!)
            console.log('[PREMIERE] ⏰ Czas minął - przechodzę do wysyłania powiadomień');
        } else {
            // Brak czasu start - nie ma aktywnego bannera
            console.log('[PREMIERE] No active banner - no start time found');
            return res.status(200).json({ 
                message: 'No active banner',
                noBanner: true
            });
        }

        // Ustaw flagę PRZED wysyłaniem (atomowo) - zapobiega podwójnym wysyłkom
        // Użyj SETNX - ustaw tylko jeśli nie istnieje
        console.log('[PREMIERE] Próba ustawienia flagi notificationsSent...');
        try {
            const setResult = await redis.set(notificationsSentKey, 'true', { ex: 86400, nx: true });
            console.log('[PREMIERE] Set result:', setResult);
            if (setResult === null || setResult === 0 || setResult === false) {
                // Ktoś inny już ustawił flagę między GET a SET - sprawdź ponownie
                const doubleCheck = await redis.get(notificationsSentKey);
                if (doubleCheck === 'true') {
                    console.log('📧 Powiadomienia już zostały wysłane (race condition detected) - pomijam wysyłkę');
                    return res.status(200).json({ 
                        success: true,
                        message: 'Notifications already sent',
                        alreadySent: true
                    });
                }
            }
        } catch (setError) {
            // Jeśli SETNX nie działa, użyj zwykłego SET (fallback)
            console.warn('⚠️ SETNX failed, using regular SET:', setError.message);
            await redis.set(notificationsSentKey, 'true', { ex: 86400 });
        }
        
        // Flaga została ustawiona - możemy wysłać powiadomienia
        console.log('📧 Flaga ustawiona - rozpoczynam wysyłanie powiadomień');

        // Pobierz listę subskrybentów z Upstash Redis (automatyczne)
        let subscribers = [];
        try {
            if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
                const subscribersListKey = 'newsletter:subscribers:list';
                const subscribersList = await redis.get(subscribersListKey);
                
                console.log('[PREMIERE] Raw subscribers list from Redis:', {
                    type: typeof subscribersList,
                    value: subscribersList,
                    isArray: Array.isArray(subscribersList),
                    stringified: JSON.stringify(subscribersList)
                });
                
                // Obsłuż różne formaty danych z Redis
                if (subscribersList) {
                    if (Array.isArray(subscribersList)) {
                        // Jeśli to już tablica (biblioteka @upstash/redis automatycznie parsuje JSON)
                        subscribers = subscribersList.filter(Boolean);
                        console.log('[PREMIERE] ✅ Parsed as array directly:', subscribers);
                    } else if (typeof subscribersList === 'string') {
                        // Jeśli to JSON string, sparsuj
                        try {
                            const parsed = JSON.parse(subscribersList);
                            if (Array.isArray(parsed)) {
                                subscribers = parsed.filter(Boolean);
                                console.log('[PREMIERE] ✅ Parsed JSON string to array:', subscribers);
                            } else {
                                console.warn('[PREMIERE] ⚠️ Parsed JSON is not an array:', typeof parsed, parsed);
                            }
                        } catch (e) {
                            console.warn('[PREMIERE] ❌ Failed to parse subscribers list as JSON:', e.message);
                            console.warn('[PREMIERE] Raw value that failed to parse:', subscribersList);
                        }
                    } else if (typeof subscribersList === 'object') {
                        // Może być obiekt z innymi właściwościami
                        console.warn('[PREMIERE] ⚠️ Subscribers list is an object (not array):', subscribersList);
                    }
                    
                    if (subscribers.length > 0) {
                        console.log(`[PREMIERE] ✅ Found ${subscribers.length} subscribers in Upstash Redis:`, subscribers);
                    } else {
                        console.log('[PREMIERE] ⚠️ Subscribers list is empty or invalid format');
                    }
                } else {
                    console.log('[PREMIERE] ⚠️ No subscribers list found in Redis (value is null/undefined)');
                }
                
                // Fallback: użyj zmiennej środowiskowej jeśli Redis jest pusty
                if (subscribers.length === 0 && process.env.NEWSLETTER_SUBSCRIBERS) {
                    subscribers = process.env.NEWSLETTER_SUBSCRIBERS
                        .split(',')
                        .map(e => e.trim().toLowerCase())
                        .filter(Boolean);
                    console.log(`[PREMIERE] ⚠️ Redis empty, using NEWSLETTER_SUBSCRIBERS env var: ${subscribers.length} subscribers`);
                }
            } else {
                throw new Error('Upstash Redis not configured - missing env vars');
            }
        } catch (redisError) {
            console.error('[PREMIERE] ❌ Redis Error:', redisError.message);
            console.error('[PREMIERE] ❌ Redis Error Stack:', redisError.stack);
            // Fallback: użyj zmiennej środowiskowej
            if (process.env.NEWSLETTER_SUBSCRIBERS) {
                subscribers = process.env.NEWSLETTER_SUBSCRIBERS
                    .split(',')
                    .map(e => e.trim().toLowerCase())
                    .filter(Boolean);
                console.log(`[PREMIERE] ⚠️ Using NEWSLETTER_SUBSCRIBERS fallback: ${subscribers.length} subscribers`);
            } else {
                console.log('[PREMIERE] ⚠️ Redis not available and NEWSLETTER_SUBSCRIBERS not set');
            }
        }

        if (subscribers.length === 0) {
            console.log('⚠️ No subscribers found');
            return res.status(200).json({ 
                message: 'No subscribers to notify',
                count: 0
            });
        }

        const emailFrom = process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>';
        const ebookPageUrl = 'https://juliawojcikszkolenia.pl/pages/ebook.html';

        let successCount = 0;
        let errorCount = 0;

        // Wyślij email do każdego subskrybenta
        for (const subscriberEmail of subscribers) {
            try {
                if (!resend) {
                    throw new Error('Resend not initialized');
                }

                // Personalizacja - wyciągnij imię z emaila
                let greeting = 'Cześć';
                try {
                    const emailName = subscriberEmail.split('@')[0].replace(/[0-9._-]/g, ' ').trim();
                    if (emailName.length > 2 && emailName.length < 20) {
                        const capitalizedName = emailName.charAt(0).toUpperCase() + emailName.slice(1).toLowerCase();
                        greeting = `Cześć ${capitalizedName}`;
                    }
                } catch (nameError) {
                    // Użyj domyślnego powitania
                }

                const emailResult = await resend.emails.send({
                    from: emailFrom,
                    to: subscriberEmail,
                    subject: 'E-book jest już dostępny',
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <!--[if mso]>
                            <style type="text/css">
                                body, table, td {font-family: Arial, sans-serif !important;}
                            </style>
                            <![endif]-->
                            <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400&family=Roboto+Condensed:wght@400;500&display=swap" rel="stylesheet">
                            <style>
                                body { 
                                    font-family: 'Roboto Condensed', 'Avenir Next Condensed', Arial, sans-serif; 
                                    line-height: 1.8; 
                                    color: #6b6b6b; 
                                    margin: 0; 
                                    padding: 0; 
                                    background: #f3f1ee;
                                    -webkit-font-smoothing: antialiased;
                                }
                                .wrapper {
                                    background: #f3f1ee;
                                    padding: 40px 20px;
                                }
                                .container { 
                                    max-width: 600px; 
                                    margin: 0 auto; 
                                    background: #ffffff;
                                    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                                }
                                .logo-section {
                                    background: #ffffff;
                                    padding: 40px 40px 0 40px;
                                    text-align: center;
                                }
                                .logo {
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    font-size: 18px;
                                    font-weight: 400;
                                    text-transform: uppercase;
                                    letter-spacing: 0.15em;
                                    color: #212121;
                                    margin: 0;
                                }
                                .gold-line {
                                    width: 60px;
                                    height: 2px;
                                    background: #C5A572;
                                    margin: 24px auto 0 auto;
                                }
                                .header { 
                                    background: #ffffff; 
                                    padding: 32px 40px 40px 40px; 
                                    text-align: center; 
                                }
                                .header h1 { 
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    margin: 0; 
                                    font-size: 32px; 
                                    font-weight: 400;
                                    text-transform: uppercase;
                                    letter-spacing: 0.06em;
                                    color: #212121;
                                    line-height: 1.2;
                                }
                                .header-subtitle {
                                    font-size: 15px;
                                    color: #8a8a8a;
                                    margin-top: 12px;
                                }
                                .content { 
                                    background: #ffffff; 
                                    padding: 0 40px 48px 40px; 
                                }
                                .content p {
                                    margin: 0 0 20px 0;
                                    color: #6b6b6b;
                                    font-size: 16px;
                                }
                                .button-wrapper {
                                    text-align: center;
                                    margin: 36px 0;
                                }
                                .button { 
                                    display: inline-block; 
                                    background: #212121; 
                                    color: #ffffff !important; 
                                    padding: 18px 42px; 
                                    text-decoration: none; 
                                    font-family: 'Roboto Condensed', Arial, sans-serif;
                                    font-weight: 500; 
                                    font-size: 14px;
                                    text-transform: uppercase;
                                    letter-spacing: 0.1em;
                                }
                                .button-arrow {
                                    margin-left: 12px;
                                    font-size: 16px;
                                }
                                .info-box { 
                                    background: #f9f8f6; 
                                    border-left: 3px solid #C5A572; 
                                    padding: 24px; 
                                    margin: 32px 0; 
                                }
                                .info-box-title {
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    font-size: 16px;
                                    font-weight: 400;
                                    text-transform: uppercase;
                                    letter-spacing: 0.05em;
                                    color: #212121;
                                    margin: 0 0 16px 0;
                                }
                                .info-box ul {
                                    margin: 0;
                                    padding-left: 20px;
                                    color: #6b6b6b;
                                }
                                .info-box li {
                                    margin-bottom: 10px;
                                    font-size: 15px;
                                }
                                .contact-section {
                                    margin-top: 36px;
                                    padding-top: 28px;
                                    border-top: 1px solid #e8e5e0;
                                    text-align: center;
                                }
                                .contact-title {
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    font-size: 14px;
                                    text-transform: uppercase;
                                    letter-spacing: 0.05em;
                                    color: #212121;
                                    margin: 0 0 20px 0;
                                }
                                .social-links {
                                    margin: 0;
                                    padding: 0;
                                }
                                .social-link {
                                    display: inline-block;
                                    margin: 0 12px;
                                    padding: 12px 24px;
                                    background: #f9f8f6;
                                    color: #212121 !important;
                                    text-decoration: none;
                                    font-size: 13px;
                                    font-weight: 500;
                                    letter-spacing: 0.05em;
                                }
                                .social-icon {
                                    width: 16px;
                                    height: 16px;
                                    vertical-align: middle;
                                    margin-right: 8px;
                                }
                                .signature {
                                    margin-top: 40px;
                                    text-align: center;
                                }
                                .signature p {
                                    margin: 0 0 4px 0;
                                    color: #6b6b6b;
                                }
                                .signature-name {
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    font-size: 20px;
                                    color: #212121;
                                    text-transform: uppercase;
                                    letter-spacing: 0.08em;
                                    margin-top: 16px !important;
                                }
                                .footer { 
                                    text-align: center; 
                                    padding: 32px 40px; 
                                    background: #212121;
                                }
                                .footer-brand {
                                    font-family: 'Instrument Serif', Georgia, serif;
                                    font-size: 14px;
                                    text-transform: uppercase;
                                    letter-spacing: 0.12em;
                                    color: #ffffff;
                                    margin: 0 0 8px 0;
                                }
                                .footer p {
                                    margin: 0 0 6px 0;
                                    color: #8a8a8a;
                                    font-size: 12px;
                                }
                                .footer a { 
                                    color: #C5A572; 
                                    text-decoration: none;
                                }
                                .footer-gold-line {
                                    width: 40px;
                                    height: 1px;
                                    background: #C5A572;
                                    margin: 16px auto;
                                }
                                .credits {
                                    margin-top: 20px;
                                    padding-top: 16px;
                                    border-top: 1px solid #3a3a3a;
                                    font-size: 10px;
                                    color: #555555;
                                }
                                .credits a {
                                    color: #6b6b6b;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="wrapper">
                            <div class="container">
                                    <!-- Logo Section -->
                                    <div class="logo-section">
                                        <p class="logo">Julia Wójcik</p>
                                        <div class="gold-line"></div>
                                    </div>
                                    
                                    <!-- Header -->
                                <div class="header">
                                        <h1>E-book już dostępny</h1>
                                        <p class="header-subtitle">Korekta bez skrótów</p>
                                    </div>
                                    
                                    <!-- Content -->
                                    <div class="content">
                                        <p>${greeting}!</p>
                                        <p>Dziękuję, że zapisałaś się na powiadomienie o moim e-booku <strong style="color: #212121;">Korekta bez skrótów</strong>.</p>
                                        <p>Właśnie udostępniłam go na stronie — kliknij poniższy przycisk, aby zobaczyć szczegóły i zakupić:</p>
                                        
                                        <div class="button-wrapper">
                                            <a href="${ebookPageUrl}" class="button" style="color: #ffffff !important;">
                                                ZOBACZ E-BOOK<span class="button-arrow">→</span>
                                            </a>
                                        </div>
                                        
                                    <div class="info-box">
                                            <p class="info-box-title">Co znajdziesz w e-booku</p>
                                            <ul>
                                                <li>Wszystko na temat ściągania masy</li>
                                                <li>Korektę na krótkich paznokciach</li>
                                                <li>Obszerną korektę na kształt kwadrat</li>
                                                <li>Zmianę kształtu bez użycia form</li>
                                                <li>Sposoby na podniesienie wolnego brzegu</li>
                                                <li><strong style="color: #212121;">GRATIS:</strong> korekta na kształt migdał</li>
                                        </ul>
                                    </div>
                                        
                                        <!-- Contact Section with Social Icons -->
                                        <div class="contact-section">
                                            <p class="contact-title">Masz pytania? Napisz do mnie</p>
                                            <div class="social-links">
                                                <a href="https://www.instagram.com/juliawojcik_instruktor/" class="social-link" style="color: #212121 !important;">
                                                    <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                                                    Instagram
                                                </a>
                                                <a href="https://www.tiktok.com/@nailsbyjul_kawojcik" class="social-link" style="color: #212121 !important;">
                                                    <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                                                    TikTok
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <!-- Signature -->
                                        <div class="signature">
                                    <p>Pozdrawiam serdecznie,</p>
                                            <p class="signature-name">Julia Wójcik</p>
                                        </div>
                                </div>
                                    
                                    <!-- Footer -->
                                <div class="footer">
                                        <p class="footer-brand">Julia Wójcik</p>
                                        <div class="footer-gold-line"></div>
                                        <p>Profesjonalna Stylizacja Paznokci</p>
                                        <p>Szczecin · <a href="https://juliawojcikszkolenia.pl">juliawojcikszkolenia.pl</a></p>
                                        <div class="credits">
                                            <p>Projekt i wykonanie: <a href="https://codingmaks.com">codingmaks.com</a></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                });

                console.log(`📧 Resend response for ${subscriberEmail}:`, JSON.stringify(emailResult));
                
                if (emailResult && emailResult.id && !emailResult.error) {
                    successCount++;
                    console.log(`✅ Email sent to: ${subscriberEmail}, ID: ${emailResult.id}`);
                } else {
                    errorCount++;
                    console.error(`❌ Failed to send to: ${subscriberEmail}`, JSON.stringify(emailResult));
                }
            } catch (emailError) {
                errorCount++;
                console.error(`❌ Error sending to ${subscriberEmail}:`, emailError.message);
            }
        }

        // Oznacz w Redis, że powiadomienia zostały wysłane (zapobiegaj podwójnym wysyłkom)
        if (successCount > 0) {
            // Flaga już została ustawiona na początku (SETNX) - nie trzeba ponownie ustawiać
            console.log('✅ Notifications sent successfully (flag was set at start)');
        }

        return res.status(200).json({ 
            success: true,
            message: 'Premiere notifications sent',
            total: subscribers.length,
            successCount: successCount,
            errorCount: errorCount,
            subscribersSent: subscribers,
            emailFrom: process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>'
        });

    } catch (error) {
        console.error('❌ Error in send-premiere-notification:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
}

