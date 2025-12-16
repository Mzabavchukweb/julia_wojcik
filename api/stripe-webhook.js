// Vercel Serverless Function - Webhook Stripe do automatycznej wysyłki e-booka
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');
const crypto = require('crypto');

const resend = new Resend(process.env.RESEND_API_KEY);

// Prosty in-memory store dla tokenów (w produkcji użyj Vercel KV lub bazy danych)
const tokenStore = new Map();

export default async function handler(req, res) {
    console.log('=== STRIPE WEBHOOK RECEIVED ===');
    console.log('HTTP Method:', req.method);
    console.log('Body type:', typeof req.body);
    console.log('Body length:', req.body?.length);
    
    // Tylko POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Stripe webhook signature verification
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

        // Vercel dostarcza raw body jako string dla POST (jeśli nie jest parsowany jako JSON)
        // Jeśli body jest obiektem, odtwórz string (nie idealne, ale może zadziałać)
        let body = req.body;
        
        if (typeof body === 'object' && body !== null) {
            console.warn('⚠️ Body is parsed as object, attempting to stringify');
            try {
                body = JSON.stringify(body);
            } catch (e) {
                return res.status(400).json({ 
                    error: 'Body was parsed as JSON before reaching function',
                    message: 'Stripe signature verification requires raw body string. Try using Vercel Edge Functions or configure bodyParser: false.'
                });
            }
        }
        
        // Upewnij się, że body jest stringiem
        if (typeof body !== 'string') {
            console.error('❌ Body is not a string:', typeof body);
            return res.status(400).json({ error: 'Invalid request body format' });
        }

        console.log('Body preview (first 200 chars):', body.substring(0, 200));

        let stripeEvent;
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
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
                expand: ['data.price.product']
            });

            console.log('Line items count:', lineItems.data.length);
            console.log('Line items:', JSON.stringify(lineItems.data, null, 2));

            // Sprawdź czy którykolwiek produkt jest e-bookiem
            let isEbookPurchase = false;
            
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
            
            // Metoda 2: Sprawdź metadata sesji checkout
            if (!isEbookPurchase && session.metadata?.product_type === 'ebook') {
                console.log('✅ Detected ebook by session metadata');
                isEbookPurchase = true;
            }
            
            // Metoda 3: Dla testów - jeśli kwota to 300 zł, traktuj jako ebook
            if (!isEbookPurchase) {
                const amountInPLN = session.amount_total / 100;
                if (session.currency === 'pln' && amountInPLN === 300) {
                    console.log(`✅ Detected ebook by amount (${amountInPLN} PLN)`);
                    isEbookPurchase = true;
                }
            }

            console.log('Is ebook purchase?', isEbookPurchase);
            console.log('Customer email:', session.customer_email);

            if (isEbookPurchase && session.customer_email) {
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
                    const baseUrl = process.env.VERCEL_URL 
                        ? `https://${process.env.VERCEL_URL}` 
                        : process.env.NEXT_PUBLIC_URL || 'https://juliawojcikszkolenia.pl';
                    const downloadUrl = `${baseUrl}/api/download-ebook?token=${token}`;
                    
                    console.log('Download URL:', downloadUrl);

                    // Sprawdź czy mamy Resend API Key
                    if (!process.env.RESEND_API_KEY) {
                        console.error('❌ RESEND_API_KEY not configured!');
                        return res.status(500).json({ error: 'Email service not configured' });
                    }
                    
                    // Wyślij email z linkiem do pobrania
                    console.log('Sending email to:', session.customer_email);
                    console.log('From:', process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>');
                    
                    const emailResult = await resend.emails.send({
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

                    console.log('✅ Email sent successfully:', JSON.stringify(emailResult, null, 2));

                    return res.status(200).json({ 
                        received: true,
                        emailSent: true,
                        emailId: emailResult.id || emailResult.data?.id,
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
                console.log('ℹ️ Not an ebook purchase or no customer email');
                console.log('  - isEbookPurchase:', isEbookPurchase);
                console.log('  - customerEmail:', session.customer_email);
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

