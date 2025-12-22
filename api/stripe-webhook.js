// Vercel Serverless Function - Webhook Stripe do automatycznej wysyłki e-booka
console.log('[INIT] Loading stripe-webhook.js module...');

import Stripe from 'stripe';
import { Resend } from 'resend';
import crypto from 'crypto';
import getRawBody from 'raw-body';

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

// Konfiguracja Vercel - wyłącz parsowanie body (wymagane dla Stripe webhook)
// Używamy Node.js runtime (nie Edge) bo potrzebujemy pełnej biblioteki Stripe
export const config = {
    api: {
        bodyParser: false,
    },
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

            // Odczytaj raw body - Vercel z bodyParser: false powinien dostarczyć body jako string
            // Jeśli nie, próbuj użyć raw-body library
            let body;
            
            // Metoda 1: Sprawdź czy req.body jest już stringiem (preferowane)
            if (typeof req.body === 'string') {
                body = req.body;
                console.log(`[${requestId}] ✅ Body is string, length:`, body.length);
            } 
            // Metoda 2: Sprawdź czy req.body jest Bufferem
            else if (Buffer.isBuffer(req.body)) {
                body = req.body.toString('utf8');
                console.log(`[${requestId}] ✅ Body is Buffer, converted to string, length:`, body.length);
            }
            // Metoda 3: Spróbuj użyć raw-body library (jeśli req jest streamem)
            else if (req.readable && typeof req.on === 'function') {
                try {
                    const rawBuffer = await getRawBody(req, {
                        length: req.headers['content-length'],
                        limit: '10mb',
                    });
                    body = rawBuffer.toString('utf8');
                    console.log(`[${requestId}] ✅ Body read using raw-body, length:`, body.length);
                } catch (rawBodyError) {
                    console.error(`[${requestId}] ❌ raw-body failed:`, rawBodyError.message);
                    return res.status(400).json({ 
                        error: 'Failed to read request body',
                        requestId: requestId,
                        hint: 'Request body could not be read as raw string',
                        rawBodyError: rawBodyError.message
                    });
                }
            }
            // Metoda 4: Ostatnia deska ratunku - jeśli body zostało sparsowane jako object
            else if (req.body && typeof req.body === 'object') {
                // Użyj JSON.stringify bez spacji (kompaktowy format) - może nie zadziałać!
                body = JSON.stringify(req.body);
                console.log(`[${requestId}] ⚠️ WARNING: Body was parsed as object, using JSON.stringify`);
                console.log(`[${requestId}] ⚠️ WARNING: Signature verification will likely FAIL because parsed JSON may differ from original`);
            }
            // Błąd - nie można odczytać body
            else {
                console.error(`[${requestId}] ❌ ERROR: Cannot determine body type:`, typeof req.body);
                return res.status(400).json({ 
                    error: 'Invalid request body format',
                    requestId: requestId,
                    bodyType: typeof req.body,
                    hint: 'Ensure bodyParser is set to false in Vercel config'
                });
        }

            console.log(`[${requestId}] Body preview (first 200 chars):`, body.substring(0, 200));

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
            
            // Pobierz email z różnych źródeł (Stripe może zapisać go w różnych polach)
            let customerEmail = session.customer_email 
                || session.customer_details?.email 
                || null;
            
            // Jeśli nadal brak emaila, spróbuj pobrać z customer object
            if (!customerEmail && session.customer && stripe) {
                try {
                    console.log(`[${requestId}] 🔍 Fetching customer email from customer object: ${session.customer}`);
                    const customer = await stripe.customers.retrieve(session.customer);
                    if (customer && !customer.deleted) {
                        customerEmail = customer.email;
                        console.log(`[${requestId}] ✅ Got email from customer object: ${customerEmail}`);
                    }
                } catch (customerError) {
                    console.warn(`[${requestId}] ⚠️ Could not fetch customer:`, customerError.message);
                }
            }
            
            console.log(`[${requestId}] 💳 Checkout session completed:`, {
                sessionId: session.id,
                customerEmail: customerEmail,
                customerEmailSource: session.customer_email ? 'session.customer_email' : 
                                    session.customer_details?.email ? 'session.customer_details.email' : 
                                    session.customer ? 'customer object' : 'none',
                amountTotal: session.amount_total,
                currency: session.currency,
                paymentLink: session.payment_link,
                sessionCustomerEmail: session.customer_email,
                sessionCustomerDetailsEmail: session.customer_details?.email,
                sessionCustomer: session.customer,
                fullSessionData: JSON.stringify(session, null, 2)
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
                customerEmail: customerEmail,
                amountTotal: session.amount_total,
                currency: session.currency,
                amountInPLN: session.amount_total ? (session.amount_total / 100) : 'N/A',
                sessionId: session.id,
                metadata: session.metadata,
                lineItemsCount: lineItems?.data?.length || 0
            });

            if (isEbookPurchase && customerEmail) {
                console.log(`[${requestId}] ✅ Ebook purchase detected - processing...`);
                try {
                    // Generuj zakodowany token (zawiera dane w samym tokenie - nie potrzebujemy storage!)
                    // To rozwiązuje problem z Vercel KV - token jest samowystarczalny
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dni ważności
                    
                    // Dane do zakodowania w tokenie
                    const tokenPayload = {
                        email: customerEmail,
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
                    let emailFrom = process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>';
                    
                    // Automatyczna poprawka: jeśli używa onboarding@resend.dev, zamień na zweryfikowaną domenę
                    if (emailFrom.includes('onboarding@resend.dev')) {
                        console.warn(`[${requestId}] ⚠️ WARNING: EMAIL_FROM uses test domain onboarding@resend.dev`);
                        console.warn(`[${requestId}] ⚠️ Auto-fixing to use verified domain: juliawojcikszkolenia.pl`);
                        emailFrom = 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>';
                        console.warn(`[${requestId}] ⚠️ Please update EMAIL_FROM in Vercel to: ${emailFrom}`);
                    }
                    
                    console.log('📧 Preparing to send email...');
                    console.log('  To:', customerEmail);
                    console.log('  Email type:', typeof customerEmail);
                    console.log('  Email length:', customerEmail?.length);
                    console.log('  Email validation:', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail || ''));
                    console.log('  From (EMAIL_FROM env var):', process.env.EMAIL_FROM || 'NOT SET - using default');
                    console.log('  From (will be used):', emailFrom);
                    console.log('  Resend API Key present:', !!process.env.RESEND_API_KEY);
                    console.log('  Resend instance:', resend ? 'initialized' : 'not initialized');
                    
                    // Walidacja emaila przed wysyłką
                    if (!customerEmail || typeof customerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
                        console.error(`[${requestId}] ❌ ERROR: Invalid email address:`, customerEmail);
                        return res.status(400).json({ 
                            error: 'Invalid customer email',
                            customerEmail: customerEmail,
                            requestId: requestId
                        });
                    }
                    
                    // Wyciągnij imię z emaila lub użyj domyślnego powitania
                    const customerName = session.customer_details?.name || '';
                    let greeting = 'Cześć';
                    if (customerName) {
                        // Jeśli mamy pełne imię z Stripe
                        const firstName = customerName.split(' ')[0];
                        greeting = `Cześć ${firstName}`;
                    } else if (customerEmail) {
                        // Spróbuj wyciągnąć imię z emaila (przed @, bez cyfr)
                        const emailName = customerEmail.split('@')[0].replace(/[0-9._-]/g, ' ').trim();
                        if (emailName.length > 2 && emailName.length < 20) {
                            const capitalizedName = emailName.charAt(0).toUpperCase() + emailName.slice(1).toLowerCase();
                            greeting = `Cześć ${capitalizedName}`;
                        }
                    }
                    
                    // Loguj dokładnie jaki email będzie użyty do wysyłki
                    console.log(`[${requestId}] 📧 Sending email to: "${customerEmail}"`);
                    console.log(`[${requestId}] 📧 Email will be sent using Resend API`);
                    
                    let emailResult;
                    try {
                        emailResult = await resend.emails.send({
                        from: emailFrom,
                        to: customerEmail,
                        subject: 'Twój e-book jest gotowy do pobrania',
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
                                        transition: all 0.3s ease;
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
                                            <h1>Dziękuję za zakup</h1>
                                            <p class="header-subtitle">Twój e-book jest gotowy do pobrania</p>
                                        </div>
                                        
                                        <!-- Content -->
                                        <div class="content">
                                            <p>${greeting}!</p>
                                            <p>Dziękuję za zakup e-booka <strong style="color: #212121;">Korekta bez skrótów</strong>. Cieszę się, że zdecydowałaś się na tę inwestycję w swój rozwój.</p>
                                            <p>Kliknij poniższy przycisk, aby pobrać Twój e-book w formacie PDF:</p>
                                            
                                            <div class="button-wrapper">
                                                <a href="${downloadUrl}" class="button" style="color: #ffffff !important;">
                                                    POBIERZ E-BOOK<span class="button-arrow">→</span>
                                                </a>
                                            </div>
                                            
                                        <div class="info-box">
                                                <p class="info-box-title">Ważne informacje</p>
                                                <ul>
                                                    <li>Link jest ważny przez <strong style="color: #212121;">7 dni</strong> od zakupu</li>
                                                    <li>Możesz pobrać e-book maksymalnie <strong style="color: #212121;">5 razy</strong></li>
                                                <li>Po pobraniu zapisz plik na swoim urządzeniu</li>
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
                                        <p>Życzę Ci owocnej pracy z e-bookiem!</p>
                                                <p style="margin-top: 16px;">Pozdrawiam serdecznie,</p>
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
                    
                    // Sprawdź czy email został wysłany poprawnie
                    if (emailResult?.error) {
                        console.error(`[${requestId}] ❌ ERROR: Resend returned an error`);
                        console.error(`[${requestId}] Error status:`, emailResult.error.statusCode);
                        console.error(`[${requestId}] Error name:`, emailResult.error.name);
                        console.error(`[${requestId}] Error message:`, emailResult.error.message);
                        console.error(`[${requestId}] Email to:`, customerEmail);
                        console.error(`[${requestId}] Email from:`, process.env.EMAIL_FROM || 'NOT SET');
                        
                        // Sprawdź czy to błąd związany z weryfikacją domeny
                        const isDomainError = emailResult.error.message?.includes('verify a domain') || 
                                            emailResult.error.message?.includes('testing emails to your own email');
                        
                        if (isDomainError) {
                            console.error(`[${requestId}] ⚠️ DOMAIN VERIFICATION REQUIRED`);
                            console.error(`[${requestId}] ⚠️ You need to verify your domain in Resend to send emails to all recipients`);
                            console.error(`[${requestId}] ⚠️ Go to: https://resend.com/domains`);
                            console.error(`[${requestId}] ⚠️ Current FROM address:`, process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>');
                            console.error(`[${requestId}] ⚠️ After verifying domain, update EMAIL_FROM to use your verified domain`);
                        }
                        
                        // Kontynuuj - token jest zapisany, użytkownik może pobrać przez link
                        return res.status(200).json({ 
                            received: true,
                            emailSent: false,
                            emailError: emailResult.error.message,
                            errorCode: emailResult.error.statusCode,
                            errorName: emailResult.error.name,
                            tokenGenerated: true,
                            downloadUrl: downloadUrl,
                            warning: 'Email could not be sent, but download link is available',
                            domainVerificationRequired: isDomainError,
                            hint: isDomainError ? 'Verify your domain at https://resend.com/domains and update EMAIL_FROM environment variable' : undefined
                        });
                    }
                    
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
                        console.error(`[${requestId}] Email to:`, customerEmail);
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
                console.log(`[${requestId}]   - customerEmail:`, customerEmail);
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

