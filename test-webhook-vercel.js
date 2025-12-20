// Test webhooka Stripe - test na Vercel (produkcja)
import https from 'https';
import http from 'http';

const WEBHOOK_URL = process.env.VERCEL_WEBHOOK_URL || 'https://julia-wojcik.vercel.app/api/stripe-webhook';

// Przykładowy event Stripe checkout.session.completed
const testEvent = {
    id: 'evt_test_' + Date.now(),
    object: 'event',
    api_version: '2025-10-29.clover',
    created: Math.floor(Date.now() / 1000),
    data: {
        object: {
            id: 'cs_test_' + Date.now(),
            object: 'checkout.session',
            amount_total: 30000, // 300 PLN
            currency: 'pln',
            customer_email: process.env.TEST_EMAIL || 'zabavchukmaks21@gmail.com',
            metadata: {
                product_type: 'ebook'
            }
        }
    },
    livemode: false,
    pending_webhooks: 1,
    type: 'checkout.session.completed'
};

// Funkcja do wysłania testowego webhooka
function sendTestWebhook(event, useTestHeader = true) {
    const payload = JSON.stringify(event);
    const url = new URL(WEBHOOK_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...(useTestHeader ? { 'X-Test-Event': 'true' } : {})
        }
    };

    return new Promise((resolve, reject) => {
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(payload);
        req.end();
    });
}

// Główna funkcja testowa
async function runTest() {
    console.log('🧪 Test webhooka Stripe na Vercel');
    console.log('='.repeat(60));
    console.log(`URL: ${WEBHOOK_URL}`);
    console.log(`Event type: ${testEvent.type}`);
    console.log(`Customer email: ${testEvent.data.object.customer_email}`);
    console.log(`Amount: ${testEvent.data.object.amount_total / 100} ${testEvent.data.object.currency.toUpperCase()}`);
    console.log('='.repeat(60));
    console.log('');

    try {
        // Test z flagą testową (pomija weryfikację podpisu)
        console.log('📤 Wysyłanie testowego webhooka (z X-Test-Event header)...');
        const result = await sendTestWebhook(testEvent, true);
        
        console.log(`Status Code: ${result.statusCode}`);
        console.log('');
        console.log('Response Body:');
        console.log(result.body);
        console.log('');

        if (result.statusCode === 200) {
            console.log('✅ Webhook został przetworzony pomyślnie!');
            try {
                const response = JSON.parse(result.body);
                if (response.emailSent) {
                    console.log('');
                    console.log('✅✅✅ SUKCES! ✅✅✅');
                    console.log('📧 Email został wysłany!');
                    console.log(`🔗 Download URL: ${response.downloadUrl || 'N/A'}`);
                    console.log(`📬 Email ID: ${response.emailId || 'N/A'}`);
                } else {
                    console.log('⚠️ Email nie został wysłany');
                    console.log(`Przyczyna: ${response.error || response.warning || 'Unknown'}`);
                    if (response.downloadUrl) {
                        console.log(`🔗 Download URL jest dostępny: ${response.downloadUrl}`);
                    }
                }
            } catch (e) {
                console.log('⚠️ Odpowiedź nie jest JSON (może być błąd HTML)');
            }
        } else {
            console.log(`❌ Webhook zwrócił błąd - Status: ${result.statusCode}`);
        }

    } catch (error) {
        console.error('❌ Błąd podczas testu:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Uruchom test
runTest().then(() => {
    console.log('');
    console.log('✅ Test zakończony');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Błąd:', error);
    process.exit(1);
});

