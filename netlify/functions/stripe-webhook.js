// Netlify Function - Webhook Stripe do automatycznej wysyłki e-booka
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event, context) => {
    // Stripe webhook signature verification
    const sig = event.headers['stripe-signature'];
    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(
            event.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
        };
    }

    // Handle the event
    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        
        // Sprawdź czy to zakup e-booka (sprawdź metadata produktu)
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
            expand: ['data.price.product']
        });

        // Sprawdź czy którykolwiek produkt ma metadata product_type: 'ebook'
        const isEbookPurchase = lineItems.data.some(item => {
            const product = item.price?.product;
            if (typeof product === 'object' && product.metadata?.product_type === 'ebook') {
                return true;
            }
            return false;
        });

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
    return {
        statusCode: 200,
        body: JSON.stringify({ received: true })
    };
};

