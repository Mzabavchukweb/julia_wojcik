// Test webhooka Stripe - lokalny test
import http from 'http';
import crypto from 'crypto';

const WEBHOOK_URL = 'http://localhost:7090/api/stripe-webhook';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

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
            customer_email: 'zabavchukmaks21@gmail.com',
            metadata: {
                product_type: 'ebook'
            }
        }
    },
    livemode: false,
    pending_webhooks: 1,
    type: 'checkout.session.completed'
};

// Funkcja do generowania podpisu Stripe (uproszczona wersja dla testów)
function generateStripeSignature(payload, secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
        .createHmac('sha256', secret.replace('whsec_', ''))
        .update(signedPayload, 'utf8')
        .digest('hex');
    return `t=${timestamp},v1=${signature}`;
}

// Funkcja do wysłania testowego webhooka
function sendTestWebhook(event, signature) {
    const payload = JSON.stringify(event);
    const url = new URL(WEBHOOK_URL);
    
    const options = {
        hostname: url.hostname,
        port: url.port || 7090,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'stripe-signature': signature,
            'X-Test-Event': 'true' // Flaga do pominięcia weryfikacji podpisu
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
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
    console.log('🧪 Test webhooka Stripe');
    console.log('='.repeat(60));
    console.log(`URL: ${WEBHOOK_URL}`);
    console.log(`Event type: ${testEvent.type}`);
    console.log(`Customer email: ${testEvent.data.object.customer_email}`);
    console.log(`Amount: ${testEvent.data.object.amount_total / 100} ${testEvent.data.object.currency.toUpperCase()}`);
    console.log('='.repeat(60));
    console.log('');

    try {
        // Test 1: Wysyłka z flagą testową (pominięcie weryfikacji podpisu)
        console.log('📤 Test 1: Wysyłka z X-Test-Event header (pomija weryfikację podpisu)...');
        const result1 = await sendTestWebhook(testEvent, 'test-signature');
        console.log(`Status: ${result1.statusCode}`);
        console.log(`Response: ${result1.body.substring(0, 200)}...`);
        console.log('');

        if (result1.statusCode === 200) {
            console.log('✅ Test 1 PASSED - Webhook został przetworzony');
            try {
                const response = JSON.parse(result1.body);
                if (response.emailSent) {
                    console.log('✅ Email został wysłany!');
                    console.log(`📧 Download URL: ${response.downloadUrl || 'N/A'}`);
                } else {
                    console.log('⚠️ Email nie został wysłany');
                    console.log(`Reason: ${response.error || response.warning || 'Unknown'}`);
                }
            } catch (e) {
                console.log('⚠️ Nie można sparsować odpowiedzi jako JSON');
            }
        } else {
            console.log(`❌ Test 1 FAILED - Status: ${result1.statusCode}`);
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

