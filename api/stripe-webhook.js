// Vercel Serverless Function - Webhook Stripe do automatycznej wysyłki e-booka
console.log('[INIT] Loading stripe-webhook.js module...');

import Stripe from 'stripe';
import { Resend } from 'resend';
import crypto from 'crypto';

// Import Vercel KV - jeśli nie jest dostępny, kod użyje fallback w funkcjach
let kv = null;
try {
    const kvModule = await import('@vercel/kv');
    kv = kvModule.kv;
    console.log('[INIT] ✅ Vercel KV loaded');
} catch (error) {
    console.error('[INIT] ⚠️ Vercel KV not available (will use memory fallback):', error.message, error.stack);
    kv = null;
}

// Inicjalizuj Stripe tylko jeśli klucz jest dostępny
let stripe = null;
try {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        console.log('[INIT] ✅ Stripe initialized');
    } else {
        console.error('[INIT] ❌ STRIPE_SECRET_KEY not set - webhook verification will fail');
    }
} catch (error) {
    console.error('[INIT] ❌ ERROR: Failed to initialize Stripe:', error.message, error.stack);
}

// Inicjalizuj Resend tylko jeśli klucz jest dostępny
let resend = null;
try {
    if (process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
        console.log('[INIT] ✅ Resend initialized');
    } else {
        console.error('[INIT] ❌ RESEND_API_KEY not set - email sending will be disabled');
    }
} catch (error) {
    console.error('[INIT] ❌ ERROR: Failed to initialize Resend:', error.message, error.stack);
}

console.log('[INIT] ✅ Module stripe-webhook.js loaded successfully');

// Funkcja do zapisywania tokenu (używa Vercel KV lub fallback do pamięci)
async function saveToken(token, tokenData) {
    try {
        if (kv) {
            // Użyj Vercel KV z TTL 7 dni (604800 sekund)
            await kv.set(`token:${token}`, JSON.stringify(tokenData), { ex: 604800 });
            console.log('✅ Token saved to Vercel KV');
            return true;
        }
    } catch (error) {
        console.error('❌ Vercel KV not available, using fallback:', error.message, error.stack);
    }
    
    // Fallback do pamięci (tylko dla testów lokalnych)
    if (typeof global !== 'undefined' && !global.tokenStore) {
        global.tokenStore = new Map();
    }
    if (global?.tokenStore) {
        global.tokenStore.set(token, JSON.stringify(tokenData));
        console.log('✅ Token saved to memory (fallback)');
        return true;
    }
    
    return false;
}

// Funkcja do pobierania tokenu
async function getToken(token) {
    try {
        if (kv) {
            const data = await kv.get(`token:${token}`);
            if (data) {
                return typeof data === 'string' ? data : JSON.stringify(data);
            }
        }
    } catch (error) {
        console.error('❌ Vercel KV error, trying fallback:', error.message, error.stack);
    }
    
    // Fallback do pamięci
    if (global?.tokenStore) {
        return global.tokenStore.get(token);
    }
    
    return null;
}

// Funkcja do aktualizacji tokenu
async function updateToken(token, tokenData) {
    try {
        if (kv) {
            await kv.set(`token:${token}`, JSON.stringify(tokenData), { ex: 604800 });
            return true;
        }
    } catch (error) {
        console.error('❌ Vercel KV update error:', error.message, error.stack);
    }
    
    // Fallback
    if (global?.tokenStore) {
        global.tokenStore.set(token, JSON.stringify(tokenData));
        return true;
    }
    
    return false;
}

// Konfiguracja Vercel - wyłącz parsowanie body (wymagane dla Stripe webhook)
// Uwaga: W nowszych wersjach Vercel, bodyParser jest wyłączony domyślnie dla POST z content-type application/json
export const config = {
    api: {
        bodyParser: false,
    },
    // Edge runtime może lepiej obsługiwać raw body, ale może nie wspierać wszystkich bibliotek
    // runtime: 'edge',
};

export default async function handler(req, res) {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('='.repeat(80));
    console.log(`🚀 [${requestId}] STRIPE WEBHOOK RECEIVED`);
    console.log('='.repeat(80));
    console.log(`[${requestId}] HTTP Method:`, req.method);
    console.log(`[${requestId}] URL:`, req.url);
    console.log(`[${requestId}] Query:`, JSON.stringify(req.query || {}));
    console.log(`[${requestId}] Body type:`, typeof req.body);
    console.log(`[${requestId}] Body length:`, req.body?.length);
    console.log(`[${requestId}] Body is Buffer:`, Buffer.isBuffer(req.body));
    console.log(`[${requestId}] Body is Readable:`, req.readable);
    console.log(`[${requestId}] Has rawBody:`, !!req.rawBody);
    console.log(`[${requestId}] req keys:`, Object.keys(req).filter(k => k.includes('body') || k.includes('raw')));
    console.log(`[${requestId}] Headers count:`, Object.keys(req.headers || {}).length);
    console.log(`[${requestId}] Stripe signature present:`, !!(req.headers['stripe-signature'] || req.headers['Stripe-Signature']));
    console.log(`[${requestId}] Environment check:`, {
        STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        EMAIL_FROM: !!process.env.EMAIL_FROM
    });
    
    // Tylko POST
    if (req.method !== 'POST') {
        console.error(`[${requestId}] ❌ ERROR: Method not allowed:`, req.method);
        return res.status(405).json({ 
            error: 'Method not allowed',
            method: req.method,
            requestId: requestId
        });
    }

    try {
        // TRYB TESTOWY - pomiń weryfikację podpisu jeśli header X-Test-Event jest ustawiony
        // Sprawdź header (może być lowercase przez Vercel) lub query parameter lub URL
        const testHeader = req.headers['x-test-event'] || req.headers['X-Test-Event'];
        const testQuery = req.query?.test === 'true';
        const testInUrl = req.url && req.url.includes('test=true');
        const isTestEvent = testHeader === 'true' || testQuery || testInUrl;
        
        console.log(`[${requestId}] 🔍 Test mode check:`, {
            'x-test-event header': testHeader,
            'test query param': testQuery,
            'test in URL': testInUrl,
            'isTestEvent': isTestEvent,
            'URL': req.url
        });
        
        let stripeEvent;
        
        if (isTestEvent) {
            // Tryb testowy - użyj body bezpośrednio jako event
            console.log(`[${requestId}] ⚠️ TEST MODE - Skipping signature verification`);
            let body = req.body;
            
            try {
                if (typeof body === 'object' && body !== null) {
                    stripeEvent = body;
                    console.log(`[${requestId}] ✅ Test event parsed from object`);
                } else if (typeof body === 'string') {
                    stripeEvent = JSON.parse(body);
                    console.log(`[${requestId}] ✅ Test event parsed from string`);
                } else {
                    console.error(`[${requestId}] ❌ ERROR: Invalid test event format. Body type:`, typeof body);
                    return res.status(400).json({ 
                        error: 'Invalid test event format',
                        bodyType: typeof body,
                        requestId: requestId
                    });
                }
                
                console.log(`[${requestId}] ✅ Test event accepted. Event type:`, stripeEvent?.type);
            } catch (parseError) {
                console.error(`[${requestId}] ❌ ERROR parsing test event:`, parseError.message);
                console.error(`[${requestId}] Parse error stack:`, parseError.stack);
                return res.status(400).json({ 
                    error: 'Failed to parse test event',
                    message: parseError.message,
                    requestId: requestId
                });
            }
        } else {
            // Normalny tryb - wymagaj weryfikacji podpisu
            const sig = req.headers['stripe-signature'];
        
            if (!sig) {
                console.error(`[${requestId}] ❌ ERROR: Missing Stripe signature header`);
                console.error(`[${requestId}] Available headers:`, Object.keys(req.headers || {}));
                console.error(`[${requestId}] All headers:`, JSON.stringify(req.headers, null, 2));
                return res.status(400).json({ 
                    error: 'Missing Stripe signature',
                    requestId: requestId,
                    availableHeaders: Object.keys(req.headers || {})
                });
            }

            if (!stripe) {
                console.error(`[${requestId}] ❌ ERROR: Stripe not initialized - STRIPE_SECRET_KEY not set`);
                console.error(`[${requestId}] Environment variables check:`, {
                    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'SET (hidden)' : 'NOT SET'
                });
                return res.status(500).json({ 
                    error: 'Stripe not configured',
                    requestId: requestId,
                    hint: 'STRIPE_SECRET_KEY environment variable is missing'
                });
            }

            if (!process.env.STRIPE_WEBHOOK_SECRET) {
                console.error(`[${requestId}] ❌ ERROR: Missing STRIPE_WEBHOOK_SECRET environment variable`);
                return res.status(500).json({ 
                    error: 'Webhook secret not configured',
                    requestId: requestId,
                    hint: 'STRIPE_WEBHOOK_SECRET environment variable is missing'
                });
            }

            // NAJPROSTSZE ROZWIĄZANIE: Vercel z bodyParser: false powinien dostarczyć body jako string
            // Jeśli body jest obiektem (sparsowane), użyj JSON.stringify - Stripe powinien to zaakceptować
            let body;
            
            if (typeof req.body === 'string') {
                body = req.body;
                console.log(`[${requestId}] ✅ Body is string, length:`, body.length);
            } else if (Buffer.isBuffer(req.body)) {
                body = req.body.toString('utf8');
                console.log(`[${requestId}] ✅ Body is Buffer, converted to string, length:`, body.length);
            } else if (req.body && typeof req.body === 'object') {
                // Body zostało sparsowane - użyj JSON.stringify
                // Uwaga: To może nie zadziałać z podpisem Stripe, ale spróbujmy
                body = JSON.stringify(req.body);
                console.log(`[${requestId}] ⚠️ Body was object, stringified, length:`, body.length);
                console.log(`[${requestId}] ⚠️ WARNING: Signature verification may fail if body was parsed`);
            } else {
                console.error(`[${requestId}] ❌ ERROR: Cannot determine body type:`, typeof req.body);
                return res.status(400).json({ 
                    error: 'Invalid request body format',
                    requestId: requestId,
                    bodyType: typeof req.body
                });
            }
            console.log('Body preview (first 200 chars):', body.substring(0, 200));

            try {
                console.log(`[${requestId}] 🔐 Attempting webhook signature verification...`);
                console.log(`[${requestId}] Body length:`, body.length);
                console.log(`[${requestId}] Signature:`, sig.substring(0, 20) + '...');
                console.log(`[${requestId}] Webhook secret present:`, !!process.env.STRIPE_WEBHOOK_SECRET);
                
                stripeEvent = stripe.webhooks.constructEvent(
                    body,
                    sig,
                    process.env.STRIPE_WEBHOOK_SECRET
                );
                console.log(`[${requestId}] ✅ Webhook verified successfully. Event type:`, stripeEvent.type);
            } catch (err) {
                console.error(`[${requestId}] ❌ ERROR: Webhook signature verification failed`);
                console.error(`[${requestId}] Error name:`, err.name);
                console.error(`[${requestId}] Error message:`, err.message);
                console.error(`[${requestId}] Error stack:`, err.stack);
                console.error(`[${requestId}] Body preview:`, body.substring(0, 200));
                console.error(`[${requestId}] Signature preview:`, sig.substring(0, 50));
            return res.status(400).json({ 
                error: `Webhook Error: ${err.message}`,
                    errorName: err.name,
                    requestId: requestId,
                hint: 'Check if STRIPE_WEBHOOK_SECRET matches the webhook signing secret in Stripe Dashboard'
            });
            }
        }

        // Handle the event
        console.log(`[${requestId}] 📦 Processing event type:`, stripeEvent?.type);
        
        if (stripeEvent?.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            
            console.log(`[${requestId}] 💳 Checkout session completed:`, {
                sessionId: session.id,
                customerEmail: session.customer_email,
                amountTotal: session.amount_total,
                currency: session.currency,
                paymentLink: session.payment_link
            });
            
            // Sprawdź czy to zakup e-booka
            let isEbookPurchase = false;
            let lineItems = { data: [] };
            
            // Spróbuj pobrać line items (dla wszystkich sesji, nie tylko live)
            if (stripe && session.id) {
                try {
                    console.log(`[${requestId}] 🔍 Fetching line items for session: ${session.id}`);
                    lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
                        expand: ['data.price.product']
                    });
                    console.log(`[${requestId}] ✅ Line items fetched. Count:`, lineItems.data.length);
                    console.log(`[${requestId}] Line items:`, JSON.stringify(lineItems.data, null, 2));
            
                    // Metoda 1: Sprawdź metadata produktu i nazwę
                    isEbookPurchase = lineItems.data.some(item => {
                        const product = item.price?.product;
                        if (typeof product === 'object') {
                            console.log(`[${requestId}] Product name:`, product.name);
                            console.log(`[${requestId}] Product metadata:`, product.metadata);
                            
                            // Sprawdź metadata
                            if (product.metadata?.product_type === 'ebook') {
                                console.log(`[${requestId}] ✅ Detected ebook by product metadata`);
                                return true;
                            }
                            // Sprawdź nazwę produktu
                            if (product.name && (
                                product.name.toLowerCase().includes('ebook') || 
                                product.name.toLowerCase().includes('e-book') ||
                                product.name.toLowerCase().includes('korekta')
                            )) {
                                console.log(`[${requestId}] ✅ Detected ebook by product name: "${product.name}"`);
                                return true;
                            }
                        }
                        return false;
                    });
                } catch (error) {
                    console.warn(`[${requestId}] ⚠️ Could not fetch line items:`, error.message);
                    console.warn(`[${requestId}] Will use fallback detection methods`);
                }
            } else {
                console.log(`[${requestId}] ⚠️ Cannot fetch line items - Stripe not initialized or no session ID`);
            }
            
            // Metoda 2: Sprawdź metadata sesji checkout
            if (!isEbookPurchase && session.metadata?.product_type === 'ebook') {
                console.log(`[${requestId}] ✅ Detected ebook by session metadata`);
                isEbookPurchase = true;
            }
            
            // Metoda 3: Jeśli kwota to 300 zł, traktuj jako ebook (główna metoda dla ebooka)
            if (!isEbookPurchase) {
                const amountInPLN = session.amount_total ? (session.amount_total / 100) : 0;
                console.log(`[${requestId}] 🔍 Checking amount: ${amountInPLN} PLN, currency: ${session.currency}`);
                if (session.currency === 'pln' && amountInPLN === 300) {
                    console.log(`[${requestId}] ✅ Detected ebook by amount (${amountInPLN} PLN)`);
                    isEbookPurchase = true;
                } else {
                    console.log(`[${requestId}] ❌ Amount doesn't match: ${amountInPLN} PLN (expected 300 PLN)`);
                }
            }

            console.log(`[${requestId}] 📊 Purchase detection summary:`, {
                isEbookPurchase,
                customerEmail: session.customer_email,
                amountTotal: session.amount_total,
                currency: session.currency,
                amountInPLN: session.amount_total ? (session.amount_total / 100) : 'N/A',
                sessionId: session.id,
                metadata: session.metadata,
                lineItemsCount: lineItems?.data?.length || 0
            });

            if (isEbookPurchase && session.customer_email) {
                console.log(`[${requestId}] ✅ Ebook purchase detected - processing...`);
                try {
                    // Generuj zakodowany token (zawiera dane w samym tokenie - nie potrzebujemy storage!)
                    // To rozwiązuje problem z Vercel KV - token jest samowystarczalny
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dni ważności
                    
                    // Dane do zakodowania w tokenie
                    const tokenPayload = {
                        email: session.customer_email,
                        sessionId: session.id,
                        createdAt: new Date().toISOString(),
                        expiresAt: expiresAt.toISOString(),
                        downloadCount: 0,
                        maxDownloads: 5
                    };
                    
                    // Zakoduj dane w base64 + dodaj podpis HMAC dla bezpieczeństwa
                    const payloadJson = JSON.stringify(tokenPayload);
                    const payloadBase64 = Buffer.from(payloadJson).toString('base64url');
                    
                    // Utwórz podpis HMAC (SHA256) dla bezpieczeństwa
                    const secret = process.env.TOKEN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'default-secret-change-in-production';
                    const hmac = crypto.createHmac('sha256', secret);
                    hmac.update(payloadBase64);
                    const signature = hmac.digest('hex').substring(0, 32);
                    
                    // Token = payload + podpis (odzielone kropką)
                    const token = `${payloadBase64}.${signature}`;
                    
                    console.log(`[${requestId}] ✅ Token generated (self-contained, no storage needed):`, token.substring(0, 50) + '...');
                    console.log(`[${requestId}] Token contains:`, { email: tokenPayload.email, expiresAt: tokenPayload.expiresAt });
                    
                    // Token jest gotowy - nie potrzebujemy zapisywać go do storage!
                    
                    // Utwórz URL do pobrania - użyj publicznego URL (nie deployment URL)
                    // Priority: 1. PUBLIC_URL (custom), 2. NEXT_PUBLIC_URL, 3. Główny Vercel URL
                    let baseUrl = 'https://julia-wojcik.vercel.app'; // Główny publiczny URL projektu
                    
                    // Użyj custom URL jeśli jest skonfigurowany
                    if (process.env.PUBLIC_URL) {
                        baseUrl = process.env.PUBLIC_URL;
                    } else if (process.env.NEXT_PUBLIC_URL) {
                        baseUrl = process.env.NEXT_PUBLIC_URL;
                    }
                    // NIE używamy VERCEL_URL - to jest deployment URL który może wymagać logowania
                    
                    // Zakoduj token w URL dla bezpieczeństwa (URL encoding)
                    const encodedToken = encodeURIComponent(token);
                    const downloadUrl = `${baseUrl}/api/download-ebook?token=${encodedToken}`;
                    
                    console.log('🌐 Base URL:', baseUrl);
                    console.log('📥 Download URL:', downloadUrl);
                    console.log('🔑 Token (raw, first 50 chars):', token.substring(0, 50));
                    console.log('🔑 Token (encoded, first 50 chars):', encodedToken.substring(0, 50));

                    // Sprawdź czy mamy Resend API Key
                    if (!process.env.RESEND_API_KEY || !resend) {
                        console.error('❌ RESEND_API_KEY not configured!');
                        console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('RESEND') || k.includes('EMAIL')));
                        console.error('Resend instance:', resend ? 'exists' : 'null');
                        // Zwróć sukces ale z informacją że email nie został wysłany
                        return res.status(200).json({ 
                            received: true,
                            emailSent: false,
                            error: 'Email service not configured',
                            tokenGenerated: true,
                            downloadUrl: downloadUrl,
                            hint: 'Set RESEND_API_KEY in Vercel environment variables. Download link is still available.'
                        });
                    }
                    
                    // Wyślij email z linkiem do pobrania
                    console.log('📧 Preparing to send email...');
                    console.log('  To:', session.customer_email);
                    console.log('  From:', process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>');
                    console.log('  Resend API Key present:', !!process.env.RESEND_API_KEY);
                    console.log('  Resend instance:', resend ? 'initialized' : 'not initialized');
                    
                    let emailResult;
                    try {
                        emailResult = await resend.emails.send({
                        from: process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>',
                        to: session.customer_email,
                        subject: 'Twój e-book od Julii Wójcik - Dziękuję za zakup',
                        html: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <style>
                                    body { 
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; 
                                        line-height: 1.7; 
                                        color: #212121; 
                                        margin: 0; 
                                        padding: 0; 
                                        background: #f9f8f6;
                                    }
                                    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
                                    .header { 
                                        background: #C5A572; 
                                        color: white; 
                                        padding: 40px 30px; 
                                        text-align: center; 
                                    }
                                    .header h1 { 
                                        margin: 0; 
                                        font-size: 26px; 
                                        font-weight: 600;
                                        letter-spacing: 0.5px;
                                    }
                                    .content { 
                                        background: #ffffff; 
                                        padding: 40px 30px; 
                                    }
                                    .content p {
                                        margin: 0 0 16px 0;
                                        color: #333;
                                    }
                                    .button { 
                                        display: inline-block; 
                                        background: #212121; 
                                        color: white !important; 
                                        padding: 16px 36px; 
                                        text-decoration: none; 
                                        font-weight: 600; 
                                        font-size: 15px;
                                        margin: 24px 0; 
                                        letter-spacing: 0.5px;
                                    }
                                    .button:hover { background: #333; }
                                    .info-box { 
                                        background: #f9f8f6; 
                                        border-left: 3px solid #C5A572; 
                                        padding: 20px; 
                                        margin: 28px 0; 
                                    }
                                    .info-box p {
                                        margin: 0 0 12px 0;
                                        font-weight: 600;
                                        color: #212121;
                                    }
                                    .info-box ul {
                                        margin: 0;
                                        padding-left: 20px;
                                        color: #555;
                                    }
                                    .info-box li {
                                        margin-bottom: 8px;
                                    }
                                    .contact-box {
                                        margin-top: 28px;
                                        padding-top: 20px;
                                        border-top: 1px solid #eee;
                                    }
                                    .contact-box p {
                                        margin: 0 0 8px 0;
                                        color: #555;
                                    }
                                    .contact-box a { 
                                        color: #C5A572; 
                                        text-decoration: none;
                                        font-weight: 500;
                                    }
                                    .contact-box a:hover {
                                        text-decoration: underline;
                                    }
                                    .signature {
                                        margin-top: 32px;
                                    }
                                    .signature p {
                                        margin: 0;
                                    }
                                    .footer { 
                                        text-align: center; 
                                        padding: 24px 30px; 
                                        color: #999; 
                                        font-size: 13px; 
                                        background: #f9f8f6;
                                        border-top: 1px solid #eee;
                                    }
                                    .footer p {
                                        margin: 0 0 8px 0;
                                    }
                                    .footer a { 
                                        color: #C5A572; 
                                        text-decoration: none;
                                    }
                                    .credits {
                                        margin-top: 16px;
                                        padding-top: 16px;
                                        border-top: 1px solid #e5e5e5;
                                        font-size: 11px;
                                        color: #bbb;
                                    }
                                    .credits a {
                                        color: #999;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        <h1>Dziękuję za zakup</h1>
                                    </div>
                                    <div class="content">
                                        <p>Cześć!</p>
                                        <p>Dziękuję za zakup e-booka <strong>„Korekta bez skrótów"</strong>. Cieszę się, że zdecydowałaś się na tę inwestycję w swój rozwój.</p>
                                        <p>Kliknij poniższy przycisk, aby pobrać Twój e-book w formacie PDF:</p>
                                        <div style="text-align: center;">
                                            <a href="${downloadUrl}" class="button" style="color: white !important;">Pobierz e-book</a>
                                        </div>
                                        <div class="info-box">
                                            <p>Ważne informacje:</p>
                                            <ul>
                                                <li>Link jest ważny przez <strong>7 dni</strong> od zakupu</li>
                                                <li>Możesz pobrać e-book maksymalnie <strong>5 razy</strong></li>
                                                <li>Po pobraniu zapisz plik na swoim urządzeniu</li>
                                            </ul>
                                        </div>
                                        <div class="contact-box">
                                            <p>Jeśli masz jakiekolwiek pytania lub problemy z pobraniem, napisz do mnie:</p>
                                            <p>Instagram: <a href="https://www.instagram.com/juliawojcik_instruktor/">@juliawojcik_instruktor</a></p>
                                            <p>TikTok: <a href="https://www.tiktok.com/@nailsbyjul_kawojcik">@nailsbyjul_kawojcik</a></p>
                                        </div>
                                        <div class="signature">
                                            <p>Życzę Ci owocnej pracy z e-bookiem!</p>
                                            <p style="margin-top: 16px;">Pozdrawiam serdecznie,</p>
                                            <p><strong>Julia Wójcik</strong></p>
                                        </div>
                                    </div>
                                    <div class="footer">
                                        <p><strong>Julia Wójcik</strong> — Profesjonalna Stylizacja Paznokci</p>
                                        <p>Szczecin | <a href="https://juliawojcikszkolenia.pl">juliawojcikszkolenia.pl</a></p>
                                        <div class="credits">
                                            <p>Projekt i wykonanie: <a href="https://codingmaks.com">codingmaks.com</a></p>
                                        </div>
                                    </div>
                                </div>
                            </body>
                            </html>
                        `
                    });
                        console.log('✅ Email sent successfully!');
                        console.log('Email result:', JSON.stringify(emailResult, null, 2));
                        console.log('Email ID:', emailResult?.id || emailResult?.data?.id || 'N/A');
                        console.log('Email status:', emailResult?.data ? 'sent' : 'unknown');
                    } catch (emailError) {
                        console.error(`[${requestId}] ❌ ERROR: Failed to send email`);
                        console.error(`[${requestId}] Email error name:`, emailError.name);
                        console.error(`[${requestId}] Email error message:`, emailError.message);
                        console.error(`[${requestId}] Email error code:`, emailError.code || 'N/A');
                        console.error(`[${requestId}] Email error stack:`, emailError.stack);
                        console.error(`[${requestId}] Email to:`, session.customer_email);
                        console.error(`[${requestId}] Email from:`, process.env.EMAIL_FROM || 'NOT SET');
                        console.error(`[${requestId}] Resend API Key present:`, !!process.env.RESEND_API_KEY);
                        console.error(`[${requestId}] Full error object:`, JSON.stringify(emailError, Object.getOwnPropertyNames(emailError), 2));
                        // Kontynuuj - token jest zapisany, użytkownik może pobrać przez link
                        // Ale zwróć błąd żeby wiedzieć że email nie został wysłany
                        return res.status(200).json({ 
                            received: true,
                            emailSent: false,
                            emailError: emailError.message,
                            tokenGenerated: true,
                            downloadUrl: downloadUrl,
                            warning: 'Email could not be sent, but download link is available'
                        });
                    }

                    return res.status(200).json({ 
                        received: true,
                        emailSent: true,
                        emailId: emailResult?.id || emailResult?.data?.id,
                        tokenGenerated: true,
                        downloadUrl: downloadUrl
                    });
                } catch (error) {
                    console.error(`[${requestId}] ❌ ERROR: Error processing ebook purchase`);
                    console.error(`[${requestId}] Error name:`, error.name);
                    console.error(`[${requestId}] Error message:`, error.message);
                    console.error(`[${requestId}] Error stack:`, error.stack);
                    console.error(`[${requestId}] Error code:`, error.code || 'N/A');
                    console.error(`[${requestId}] Full error:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                    const duration = Date.now() - startTime;
                    console.error(`[${requestId}] ⏱️ Request duration:`, duration, 'ms');
                    return res.status(500).json({ 
                        error: 'Failed to process ebook purchase',
                        message: error.message,
                        errorName: error.name,
                        requestId: requestId,
                        duration: duration
                    });
                }
            } else {
                console.log(`[${requestId}] ⚠️ Not an ebook purchase or no customer email`);
                console.log(`[${requestId}]   - isEbookPurchase:`, isEbookPurchase);
                console.log(`[${requestId}]   - customerEmail:`, session.customer_email);
                console.log(`[${requestId}]   - amountTotal:`, session.amount_total);
                console.log(`[${requestId}]   - currency:`, session.currency);
                console.log(`[${requestId}]   - metadata:`, session.metadata);
                
                // Zwróć sukces nawet jeśli to nie ebook - Stripe wymaga 200 OK
                const duration = Date.now() - startTime;
                console.log(`[${requestId}] ✅ Request completed in ${duration}ms`);
                return res.status(200).json({ 
                    received: true,
                    eventType: stripeEvent?.type || 'unknown',
                    processed: false,
                    reason: isEbookPurchase ? 'No customer email' : 'Not an ebook purchase',
                    requestId: requestId,
                    duration: duration
                });
            }
        }

        // Return success for other events
        const duration = Date.now() - startTime;
        console.log(`[${requestId}] ✅ Event processed successfully in ${duration}ms`);
        return res.status(200).json({ 
            received: true,
            eventType: stripeEvent?.type || 'unknown',
            requestId: requestId,
            duration: duration
        });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('='.repeat(80));
        console.error(`[${requestId}] ❌❌❌ CRITICAL ERROR in webhook handler ❌❌❌`);
        console.error('='.repeat(80));
        console.error(`[${requestId}] Error name:`, error.name);
        console.error(`[${requestId}] Error message:`, error.message);
        console.error(`[${requestId}] Error stack:`, error.stack);
        console.error(`[${requestId}] Error code:`, error.code || 'N/A');
        console.error(`[${requestId}] Request duration:`, duration, 'ms');
        console.error(`[${requestId}] Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        console.error(`[${requestId}] Res object type:`, typeof res);
        console.error(`[${requestId}] Res object:`, res ? Object.keys(res) : 'null/undefined');
        console.error('='.repeat(80));
        
        if (res && typeof res.status === 'function') {
            return res.status(500).json({ 
                error: 'Internal server error',
                message: error.message,
                errorName: error.name,
                requestId: requestId,
                duration: duration
            });
        } else {
            console.error(`[${requestId}] ❌ CRITICAL: res object is invalid!`);
            throw error; // Rethrow jeśli nie możemy wysłać response
        }
    }
}

