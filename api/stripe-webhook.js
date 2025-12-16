// Vercel Serverless Function - Webhook Stripe do automatycznej wysyłki e-booka
import Stripe from 'stripe';
import { Resend } from 'resend';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Inicjalizuj Resend tylko jeśli klucz jest dostępny
let resend = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
} else {
    console.warn('⚠️ RESEND_API_KEY not set - email sending will be disabled');
}

// Prosty in-memory store dla tokenów (w produkcji użyj Vercel KV lub bazy danych)
const tokenStore = new Map();

// Konfiguracja dla Vercel - wyłącz parsowanie body (potrzebne dla Stripe webhook)
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    console.log('=== STRIPE WEBHOOK RECEIVED ===');
    console.log('HTTP Method:', req.method);
    console.log('Body type:', typeof req.body);
    console.log('Body length:', req.body?.length);
    console.log('URL:', req.url);
    console.log('Query:', req.query);
    console.log('Headers:', Object.keys(req.headers || {}));
    
    // Tylko POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // TRYB TESTOWY - pomiń weryfikację podpisu jeśli header X-Test-Event jest ustawiony
        // Sprawdź header (może być lowercase przez Vercel) lub query parameter lub URL
        const testHeader = req.headers['x-test-event'] || req.headers['X-Test-Event'];
        const testQuery = req.query?.test === 'true';
        const testInUrl = req.url && req.url.includes('test=true');
        const isTestEvent = testHeader === 'true' || testQuery || testInUrl;
        
        console.log('🔍 Test mode check:', {
            'x-test-event header': testHeader,
            'test query param': testQuery,
            'test in URL': testInUrl,
            'isTestEvent': isTestEvent,
            'URL': req.url
        });
        
        let stripeEvent;
        
        if (isTestEvent) {
            // Tryb testowy - użyj body bezpośrednio jako event
            console.log('⚠️ TEST MODE - Skipping signature verification');
            let body = req.body;
            
            if (typeof body === 'object' && body !== null) {
                stripeEvent = body;
            } else if (typeof body === 'string') {
                stripeEvent = JSON.parse(body);
            } else {
                return res.status(400).json({ error: 'Invalid test event format' });
            }
            
            console.log('✅ Test event accepted. Event type:', stripeEvent.type);
        } else {
            // Normalny tryb - wymagaj weryfikacji podpisu
            const sig = req.headers['stripe-signature'];
            
            if (!sig) {
                console.error('❌ Missing Stripe signature header');
                console.error('Available headers:', Object.keys(req.headers || {}));
                return res.status(400).json({ error: 'Missing Stripe signature' });
            }

            if (!process.env.STRIPE_WEBHOOK_SECRET) {
                console.error('❌ Missing STRIPE_WEBHOOK_SECRET environment variable');
                return res.status(500).json({ error: 'Webhook secret not configured' });
            }

            // Vercel z bodyParser: false dostarcza raw body jako Buffer lub string
            let body = req.body;
            
            // Konwertuj Buffer na string jeśli potrzeba
            if (Buffer.isBuffer(body)) {
                body = body.toString('utf8');
                console.log('✅ Converted Buffer to string');
            } else if (typeof body === 'object' && body !== null) {
                // Jeśli nadal jest obiektem (nie powinno się zdarzyć z bodyParser: false)
                console.warn('⚠️ Body is still an object, attempting to stringify');
                try {
                    body = JSON.stringify(body);
                } catch (e) {
                    return res.status(400).json({ 
                        error: 'Body was parsed as JSON before reaching function',
                        message: 'Stripe signature verification requires raw body string. Check vercel.json bodyParser setting.'
                    });
                }
            }
            
            // Upewnij się, że body jest stringiem
            if (typeof body !== 'string') {
                console.error('❌ Body is not a string:', typeof body, body);
                return res.status(400).json({ error: 'Invalid request body format' });
            }

            console.log('Body preview (first 200 chars):', body.substring(0, 200));

            try {
                stripeEvent = stripe.webhooks.constructEvent(
                    body,
                    sig,
                    process.env.STRIPE_WEBHOOK_SECRET
                );
                console.log('✅ Webhook verified successfully. Event type:', stripeEvent.type);
            } catch (err) {
                console.error('❌ Webhook signature verification failed:', err.message);
                return res.status(400).json({ 
                    error: `Webhook Error: ${err.message}`,
                    hint: 'Check if STRIPE_WEBHOOK_SECRET matches the webhook signing secret in Stripe Dashboard'
                });
            }
        }

        // Handle the event
        console.log('Processing event type:', stripeEvent.type);
        
        if (stripeEvent.type === 'checkout.session.completed') {
            const session = stripeEvent.data.object;
            
            console.log('Checkout session completed:', {
                sessionId: session.id,
                customerEmail: session.customer_email,
                amountTotal: session.amount_total,
                currency: session.currency,
                paymentLink: session.payment_link
            });
            
            // Sprawdź czy to zakup e-booka
            let isEbookPurchase = false;
            let lineItems = { data: [] };
            
            // Dla testowych eventów (session.id zaczyna się od 'cs_test_') pomiń wywołanie API
            const isTestSession = session.id && session.id.startsWith('cs_test_');
            
            if (!isTestSession) {
                try {
                    lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
                        expand: ['data.price.product']
                    });
                    console.log('Line items count:', lineItems.data.length);
                    console.log('Line items:', JSON.stringify(lineItems.data, null, 2));

                    // Metoda 1: Sprawdź metadata produktu
                    isEbookPurchase = lineItems.data.some(item => {
                        const product = item.price?.product;
                        if (typeof product === 'object') {
                            console.log('Product name:', product.name);
                            console.log('Product metadata:', product.metadata);
                            
                            // Sprawdź metadata
                            if (product.metadata?.product_type === 'ebook') {
                                console.log('✅ Detected ebook by product metadata');
                                return true;
                            }
                            // Sprawdź nazwę produktu
                            if (product.name && (
                                product.name.toLowerCase().includes('ebook') || 
                                product.name.toLowerCase().includes('e-book') ||
                                product.name.toLowerCase().includes('korekta')
                            )) {
                                console.log('✅ Detected ebook by product name');
                                return true;
                            }
                        }
                        return false;
                    });
                } catch (error) {
                    console.warn('⚠️ Could not fetch line items:', error.message);
                }
            } else {
                console.log('⚠️ Test session detected - skipping line items fetch');
            }
            
            // Metoda 2: Sprawdź metadata sesji checkout
            if (!isEbookPurchase && session.metadata?.product_type === 'ebook') {
                console.log('✅ Detected ebook by session metadata');
                isEbookPurchase = true;
            }
            
            // Metoda 3: Jeśli kwota to 300 zł, traktuj jako ebook (główna metoda dla ebooka)
            if (!isEbookPurchase) {
                const amountInPLN = session.amount_total ? (session.amount_total / 100) : 0;
                console.log(`🔍 Checking amount: ${amountInPLN} PLN, currency: ${session.currency}`);
                if (session.currency === 'pln' && amountInPLN === 300) {
                    console.log(`✅ Detected ebook by amount (${amountInPLN} PLN)`);
                    isEbookPurchase = true;
                } else {
                    console.log(`❌ Amount doesn't match: ${amountInPLN} PLN (expected 300 PLN)`);
                }
            }

            console.log('📊 Purchase detection summary:', {
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
                console.log('✅ Ebook purchase detected - processing...');
                try {
                    // Generuj unikalny 64-znakowy token
                    const token = crypto.randomBytes(32).toString('hex');
                    
                    // Oblicz datę wygaśnięcia (7 dni od teraz)
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 7);
                    
                    // Dane tokenu
                    const tokenData = {
                        email: session.customer_email,
                        sessionId: session.id,
                        createdAt: new Date().toISOString(),
                        expiresAt: expiresAt.toISOString(),
                        downloadCount: 0,
                        maxDownloads: 5
                    };
                    
                    // Zapisz token w pamięci (w produkcji użyj Vercel KV lub bazy danych)
                    tokenStore.set(token, JSON.stringify(tokenData));
                    console.log('✅ Token saved:', token.substring(0, 16) + '...');
                    
                    // Utwórz URL do pobrania
                    // VERCEL_URL może być bez https://, więc sprawdź
                    let baseUrl = 'https://julia-wojcik.vercel.app';
                    if (process.env.VERCEL_URL && !process.env.VERCEL_URL.startsWith('http')) {
                        baseUrl = `https://${process.env.VERCEL_URL}`;
                    } else if (process.env.VERCEL_URL) {
                        baseUrl = process.env.VERCEL_URL;
                    } else if (process.env.NEXT_PUBLIC_URL) {
                        baseUrl = process.env.NEXT_PUBLIC_URL;
                    }
                    const downloadUrl = `${baseUrl}/api/download-ebook?token=${token}`;
                    
                    console.log('🌐 Base URL:', baseUrl);
                    console.log('📥 Download URL:', downloadUrl);

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
                            subject: 'Twój e-book od Julii Wójcik - Dziękujemy za zakup! 📚',
                        html: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <style>
                                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                                    .container { max-width: 600px; margin: 0 auto; }
                                    .header { background: linear-gradient(135deg, #C5A572 0%, #a89263 100%); color: white; padding: 30px; text-align: center; }
                                    .header h1 { margin: 0; font-size: 24px; }
                                    .content { background: #f9f8f6; padding: 30px; }
                                    .button { display: inline-block; background: #212121; color: white !important; padding: 15px 30px; text-decoration: none; font-weight: bold; margin: 20px 0; border-radius: 4px; }
                                    .button:hover { background: #333; }
                                    .footer { text-align: center; padding: 20px; color: #6b6b6b; font-size: 12px; background: #f0f0f0; }
                                    .info-box { background: #fff; border-left: 4px solid #C5A572; padding: 15px; margin: 20px 0; }
                                    a { color: #C5A572; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        <h1>🎉 Dziękujemy za zakup!</h1>
                                    </div>
                                    <div class="content">
                                        <p>Cześć!</p>
                                        <p>Dziękuję za zakup e-booka <strong>"Korekta bez skrótów"</strong>. Cieszę się, że zdecydowałaś się na tę inwestycję w swój rozwój!</p>
                                        <p>Kliknij poniższy przycisk, aby pobrać Twój e-book w formacie PDF:</p>
                                        <div style="text-align: center;">
                                            <a href="${downloadUrl}" class="button" style="color: white !important;">📥 Pobierz e-book</a>
                                        </div>
                                        <div class="info-box">
                                            <p><strong>⏰ Ważne informacje:</strong></p>
                                            <ul style="margin: 10px 0; padding-left: 20px;">
                                                <li>Link jest ważny przez <strong>7 dni</strong> od zakupu</li>
                                                <li>Możesz pobrać e-book maksymalnie <strong>5 razy</strong></li>
                                                <li>Po pobraniu zapisz plik na swoim urządzeniu</li>
                                            </ul>
                                        </div>
                                        <p>Jeśli masz jakiekolwiek pytania lub problemy z pobraniem, napisz do mnie:</p>
                                        <ul style="list-style: none; padding: 0;">
                                            <li>📸 Instagram: <a href="https://www.instagram.com/juliawojcik_instruktor/">@juliawojcik_instruktor</a></li>
                                            <li>🎵 TikTok: <a href="https://www.tiktok.com/@nailsbyjul_kawojcik">@nailsbyjul_kawojcik</a></li>
                                        </ul>
                                        <p>Życzę Ci owocnej pracy z e-bookiem!</p>
                                        <p>Pozdrawiam serdecznie,<br><strong>Julia Wójcik</strong></p>
                                    </div>
                                    <div class="footer">
                                        <p>Julia Wójcik - Profesjonalna Stylizacja Paznokci</p>
                                        <p>Szczecin | <a href="https://juliawojcikszkolenia.pl">juliawojcikszkolenia.pl</a></p>
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
                        console.error('❌ Failed to send email:', emailError);
                        console.error('Email error name:', emailError.name);
                        console.error('Email error message:', emailError.message);
                        console.error('Email error code:', emailError.code || 'N/A');
                        console.error('Email error stack:', emailError.stack);
                        console.error('Full error object:', JSON.stringify(emailError, Object.getOwnPropertyNames(emailError), 2));
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
                    console.error('❌ Error processing ebook purchase:', error);
                    console.error('Error details:', error.message);
                    console.error('Error stack:', error.stack);
                    return res.status(500).json({ 
                        error: 'Failed to process ebook purchase',
                        message: error.message
                    });
                }
            } else {
                console.log('⚠️ Not an ebook purchase or no customer email');
                console.log('  - isEbookPurchase:', isEbookPurchase);
                console.log('  - customerEmail:', session.customer_email);
                console.log('  - amountTotal:', session.amount_total);
                console.log('  - currency:', session.currency);
                console.log('  - metadata:', session.metadata);
                
                // Zwróć sukces nawet jeśli to nie ebook - Stripe wymaga 200 OK
                return res.status(200).json({ 
                    received: true,
                    eventType: stripeEvent?.type || 'unknown',
                    processed: false,
                    reason: isEbookPurchase ? 'No customer email' : 'Not an ebook purchase'
                });
            }
        }

        // Return success for other events
        console.log('✅ Event processed successfully');
        return res.status(200).json({ 
            received: true,
            eventType: stripeEvent?.type || 'unknown'
        });

    } catch (error) {
        console.error('❌ Unexpected error in webhook handler:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
}

