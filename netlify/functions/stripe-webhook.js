// Netlify Function - Webhook Stripe do automatycznej wysyłki e-booka
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event, context) => {
    try {
    // Log incoming request for debugging
    console.log('Webhook received:', {
        method: event.httpMethod,
        hasBody: !!event.body,
        bodyType: typeof event.body,
        isBase64Encoded: event.isBase64Encoded,
        headers: Object.keys(event.headers || {})
    });

    // Netlify Functions - Stripe wymaga surowego body (string) do weryfikacji podpisu
    // WAŻNE: Netlify może parsować JSON, co psuje weryfikację podpisu
    // Musimy użyć surowego body jako stringa
    
    let body;
    
    // Sprawdź czy mamy rawBody (surowe body przed parsowaniem)
    if (event.rawBody) {
        body = event.rawBody;
        console.log('Using rawBody');
    } 
    // Jeśli body jest już stringiem, użyj go bezpośrednio
    else if (typeof event.body === 'string') {
        body = event.body;
        console.log('Using event.body as string');
    }
    // Jeśli body jest base64 encoded, dekodujemy
    else if (event.isBase64Encoded && typeof event.body === 'string') {
        body = Buffer.from(event.body, 'base64').toString('utf-8');
        console.log('Decoded base64 body');
    }
    // Jeśli body jest obiektem (Netlify sparsował JSON), to jest problem
    // Nie możemy użyć sparsowanego JSON do weryfikacji podpisu!
    else if (typeof event.body === 'object') {
        console.error('CRITICAL: Body is already parsed as object. Stripe signature verification will fail!');
        console.error('Netlify parsed the JSON before it reached the function.');
        console.error('Solution: Configure Netlify to pass raw body or use a different approach.');
        return {
            statusCode: 400,
            body: JSON.stringify({ 
                error: 'Body was parsed as JSON before reaching function',
                message: 'Netlify Functions parsed the request body. Stripe signature verification requires raw body.'
            })
        };
    }
    else {
        console.error('Unknown body format:', typeof event.body);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid request body format' })
        };
    }
    
    // Stripe webhook signature verification
    const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    
    if (!sig) {
        console.error('Missing Stripe signature header');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing Stripe signature' })
        };
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Webhook secret not configured' })
        };
    }

    let stripeEvent;
    try {
        stripeEvent = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
        console.log('Webhook verified successfully. Event type:', stripeEvent.type);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
        };
    }

    // Handle the event
    console.log('Processing event type:', stripeEvent.type);
    
    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        
        console.log('Checkout session completed:', {
            sessionId: session.id,
            customerEmail: session.customer_email,
            amountTotal: session.amount_total,
            currency: session.currency
        });
        
        // Sprawdź czy to zakup e-booka (sprawdź metadata produktu)
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
            expand: ['data.price.product']
        });

        console.log('Line items:', JSON.stringify(lineItems.data, null, 2));

        // Sprawdź czy którykolwiek produkt ma metadata product_type: 'ebook'
        // LUB sprawdź czy Payment Link zawiera "ebook" w nazwie/metadata
        let isEbookPurchase = false;
        
        // Metoda 1: Sprawdź metadata produktu
        isEbookPurchase = lineItems.data.some(item => {
            const product = item.price?.product;
            if (typeof product === 'object') {
                console.log('Product metadata:', product.metadata);
                if (product.metadata?.product_type === 'ebook') {
                    return true;
                }
                // Sprawdź też czy nazwa produktu zawiera "ebook" lub "e-book"
                if (product.name && (product.name.toLowerCase().includes('ebook') || product.name.toLowerCase().includes('e-book'))) {
                    return true;
                }
            }
            return false;
        });
        
        // Metoda 2: Sprawdź metadata sesji checkout
        if (!isEbookPurchase && session.metadata?.product_type === 'ebook') {
            isEbookPurchase = true;
        }
        
        // Metoda 3: Sprawdź czy Payment Link ID wskazuje na ebook (jeśli masz dedykowany link)
        if (!isEbookPurchase && session.payment_link) {
            // Możesz dodać sprawdzenie Payment Link metadata
            console.log('Payment Link ID:', session.payment_link);
        }
        
        // Metoda 4: Dla testów - jeśli kwota to 300 zł, traktuj jako ebook
        if (!isEbookPurchase && session.amount_total === 30000 && session.currency === 'pln') {
            console.log('Detected ebook purchase by amount (300 PLN)');
            isEbookPurchase = true;
        }

        console.log('Is ebook purchase?', isEbookPurchase);

        if (isEbookPurchase && session.customer_email) {
            try {
                // Generuj unikalny 64-znakowy token
                const token = crypto.randomBytes(32).toString('hex');
                
                // Oblicz datę wygaśnięcia (7 dni od teraz)
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);
                
                // Przygotuj dane do zapisania w Netlify Blobs
                const tokenData = {
                    email: session.customer_email,
                    sessionId: session.id,
                    createdAt: new Date().toISOString(),
                    expiresAt: expiresAt.toISOString(),
                    downloadCount: 0,
                    maxDownloads: 5
                };
                
                // Zapisz token w Netlify Blobs
                // Użyj context.netlify jeśli dostępne (automatyczne uwierzytelnianie w Netlify Functions)
                const store = getStore({
                    name: 'ebook-tokens',
                    ...(context.netlify ? { context: context.netlify } : {
                        siteID: process.env.NETLIFY_SITE_ID,
                        token: process.env.NETLIFY_BLOB_STORE_TOKEN
                    })
                });
                
                await store.set(token, JSON.stringify(tokenData));
                console.log('Token saved to Blobs:', token);
                
                // Utwórz URL do pobrania
                const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://juliawojcikszkolenia.pl';
                const downloadUrl = `${baseUrl}/.netlify/functions/download-ebook?token=${token}`;
                
                // Wyślij email z linkiem do pobrania
                const emailResult = await resend.emails.send({
                    from: process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>',
                    to: session.customer_email,
                    subject: 'Twój e-book od Julii Wójcik - Dziękujemy za zakup!',
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <style>
                                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                .header { background: linear-gradient(135deg, #C5A572 0%, #a89263 100%); color: white; padding: 30px; text-align: center; }
                                .content { background: #f9f8f6; padding: 30px; }
                                .button { display: inline-block; background: #212121; color: white; padding: 15px 30px; text-decoration: none; border-radius: 0; margin: 20px 0; }
                                .footer { text-align: center; padding: 20px; color: #6b6b6b; font-size: 12px; }
                                .info-box { background: #fff; border-left: 4px solid #C5A572; padding: 15px; margin: 20px 0; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>Dziękujemy za zakup!</h1>
                                </div>
                                <div class="content">
                                    <p>Witaj!</p>
                                    <p>Dziękujemy za zakup e-booka <strong>"Korekta bez skrótów"</strong>.</p>
                                    <p>Kliknij poniższy przycisk, aby pobrać Twój e-book w formacie PDF:</p>
                                    <div style="text-align: center;">
                                        <a href="${downloadUrl}" class="button">Pobierz e-book</a>
                                    </div>
                                    <div class="info-box">
                                        <p><strong>Ważne informacje:</strong></p>
                                        <ul>
                                            <li>Link jest ważny przez <strong>7 dni</strong> od zakupu</li>
                                            <li>Możesz pobrać e-book maksymalnie <strong>5 razy</strong></li>
                                            <li>Po pobraniu zapisz plik na swoim urządzeniu - będziesz mieć do niego dostęp na zawsze</li>
                                        </ul>
                                    </div>
                                    <p>Jeśli masz jakiekolwiek pytania, napisz do mnie na Instagramie <a href="https://www.instagram.com/juliawojcik_instruktor/">@juliawojcik_instruktor</a> lub na TikToku <a href="https://www.tiktok.com/@nailsbyjul_kawojcik">@nailsbyjul_kawojcik</a>.</p>
                                    <p>Życzę Ci owocnej pracy!</p>
                                    <p>Pozdrawiam,<br><strong>Julia Wójcik</strong></p>
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

                console.log('Email sent successfully with download link:', emailResult);

                return {
                    statusCode: 200,
                    body: JSON.stringify({ 
                        received: true,
                        emailSent: true,
                        emailId: emailResult.id,
                        tokenGenerated: true
                    })
                };
            } catch (error) {
                console.error('Error processing ebook purchase:', error);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ 
                        error: 'Failed to process ebook purchase',
                        message: error.message
                    })
                };
            }
        }
    }

    // Return a response to acknowledge receipt of the event
    console.log('Event processed, returning 200 OK');
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            received: true,
            eventType: stripeEvent?.type || 'unknown'
        })
    };
    } catch (error) {
        // Global error handler - upewnij się, że zawsze zwracamy odpowiedź
        console.error('Unexpected error in webhook handler:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};

