// Netlify Function - Webhook Stripe do automatycznej wysyłki e-booka
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');

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
                // Pobierz PDF e-booka
                let pdfBuffer;
                
                // Opcja 1: Z lokalnego pliku (dla Netlify/Vercel)
                if (process.env.EBOOK_PATH) {
                    const fs = require('fs');
                    const path = require('path');
                    const ebookPath = path.join(process.cwd(), process.env.EBOOK_PATH);
                    
                    if (fs.existsSync(ebookPath)) {
                        pdfBuffer = fs.readFileSync(ebookPath);
                    } else {
                        console.error('E-book PDF not found at:', ebookPath);
                    }
                }
                
                // Opcja 2: Z URL (jeśli PDF jest w chmurze)
                if (!pdfBuffer && process.env.EBOOK_URL) {
                    const https = require('https');
                    const http = require('http');
                    const url = require('url');
                    
                    pdfBuffer = await new Promise((resolve, reject) => {
                        const parsedUrl = url.parse(process.env.EBOOK_URL);
                        const client = parsedUrl.protocol === 'https:' ? https : http;
                        
                        client.get(process.env.EBOOK_URL, (res) => {
                            const chunks = [];
                            res.on('data', (chunk) => chunks.push(chunk));
                            res.on('end', () => resolve(Buffer.concat(chunks)));
                            res.on('error', reject);
                        }).on('error', reject);
                    });
                }
                
                // Opcja 3: Domyślna ścieżka (ebooks/original-ebook.pdf)
                if (!pdfBuffer) {
                    const fs = require('fs');
                    const path = require('path');
                    
                    // Spróbuj kilka możliwych ścieżek
                    const possiblePaths = [
                        path.join(process.cwd(), 'ebooks', 'original-ebook.pdf'),
                        path.join(process.cwd(), 'PRACUJ (1).pdf'),
                        path.join(__dirname, '..', '..', 'ebooks', 'original-ebook.pdf'),
                        path.join(__dirname, '..', '..', 'PRACUJ (1).pdf')
                    ];
                    
                    for (const ebookPath of possiblePaths) {
                        if (fs.existsSync(ebookPath)) {
                            pdfBuffer = fs.readFileSync(ebookPath);
                            console.log('Found PDF at:', ebookPath);
                            break;
                        }
                    }
                }
                
                if (!pdfBuffer) {
                    console.error('E-book PDF not found. Check EBOOK_PATH or EBOOK_URL environment variables.');
                    return {
                        statusCode: 500,
                        body: JSON.stringify({ error: 'E-book file not found' })
                    };
                }

                // Wyślij email z PDF
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
                                    <p>W załączniku znajdziesz Twój e-book w formacie PDF. Możesz go pobrać i zapisać na swoim urządzeniu.</p>
                                    <p><strong>Dostęp masz na zawsze</strong> - możesz wracać do treści i schematów tak często, jak tylko potrzebujesz.</p>
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
                    `,
                    attachments: [
                        {
                            filename: 'E-book-Korekta-bez-skrotow-Julia-Wojcik.pdf',
                            content: pdfBuffer
                        }
                    ]
                });

                console.log('Email sent successfully:', emailResult);

                return {
                    statusCode: 200,
                    body: JSON.stringify({ 
                        received: true,
                        emailSent: true,
                        emailId: emailResult.id
                    })
                };
            } catch (error) {
                console.error('Error sending email:', error);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ 
                        error: 'Failed to send email',
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

