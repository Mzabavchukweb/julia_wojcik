// Skrypt do ręcznego wysłania e-booka
// Użycie: RESEND_API_KEY=xxx TOKEN_SECRET=xxx PUBLIC_URL=xxx EMAIL_FROM=xxx node send-ebook-manual.js
import { Resend } from 'resend';
import crypto from 'crypto';

const email = 'zuziakuc1@gmail.com';

// Inicjalizuj Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!resend) {
    console.error('❌ RESEND_API_KEY nie jest ustawiony!');
    console.error('Ustaw zmienną środowiskową RESEND_API_KEY');
    process.exit(1);
}

async function sendEbook() {
    try {
        console.log('📧 Wysyłanie e-booka na:', email);
        
        // Generuj token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        const tokenPayload = {
            email: email,
            sessionId: 'manual-' + Date.now(),
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            downloadCount: 0,
            maxDownloads: 5
        };
        
        const payloadJson = JSON.stringify(tokenPayload);
        const payloadBase64 = Buffer.from(payloadJson).toString('base64url');
        const secret = process.env.TOKEN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'default-secret-change-in-production';
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(payloadBase64);
        const signature = hmac.digest('hex').substring(0, 32);
        const token = `${payloadBase64}.${signature}`;
        
        // URL do pobrania
        const baseUrl = process.env.PUBLIC_URL || 'https://juliawojcikszkolenia.pl';
        const encodedToken = encodeURIComponent(token);
        const downloadUrl = `${baseUrl}/api/download-ebook?token=${encodedToken}`;
        
        // Wyślij email
        const emailFrom = process.env.EMAIL_FROM || 'Julia Wójcik <ebook@juliawojcikszkolenia.pl>';
        
        console.log('📤 Wysyłanie emaila przez Resend...');
        
        const emailResult = await resend.emails.send({
            from: emailFrom,
            to: email,
            subject: 'Twój e-book jest gotowy do pobrania',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .button { display: inline-block; background: #212121; color: #fff !important; padding: 15px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Dziękuję za zakup!</h1>
                        <p>Twój e-book "Korekta bez skrótów" jest gotowy do pobrania.</p>
                        <a href="${downloadUrl}" class="button">POBIERZ E-BOOK</a>
                        <p>Link jest ważny przez 7 dni.</p>
                    </div>
                </body>
                </html>
            `
        });
        
        console.log('✅ Email wysłany pomyślnie!');
        console.log('📧 Email ID:', emailResult?.id);
        console.log('🔗 Link do pobrania:', downloadUrl);
        
    } catch (error) {
        console.error('❌ Błąd podczas wysyłania:', error);
        process.exit(1);
    }
}

sendEbook();

