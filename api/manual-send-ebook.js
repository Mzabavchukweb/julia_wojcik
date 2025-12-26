// Ręczne wysłanie e-booka - użyj jeśli webhook nie zadziałał
import { Resend } from 'resend';
import crypto from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { email, sessionId } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        if (!resend) {
            return res.status(500).json({ error: 'Resend not configured' });
        }
        
        // Generuj token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        const tokenPayload = {
            email: email,
            sessionId: sessionId || 'manual-' + Date.now(),
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
        
        return res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            email: email,
            downloadUrl: downloadUrl,
            emailId: emailResult?.id
        });
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}

