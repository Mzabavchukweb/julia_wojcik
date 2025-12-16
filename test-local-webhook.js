// Test webhook lokalnie
import http from 'http';

const testEvent = {
  id: 'evt_test_webhook_' + Date.now(),
  object: 'event',
  api_version: '2025-10-29.clover',
  created: Math.floor(Date.now() / 1000),
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_' + Date.now(),
      object: 'checkout.session',
      amount_total: 30000,
      currency: 'pln',
      customer_email: 'zabavchukmaks21@gmail.com',
      payment_status: 'paid',
      status: 'complete',
      metadata: { product_type: 'ebook' }
    }
  }
};

const postData = JSON.stringify(testEvent);
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/stripe-webhook?test=true',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-Test-Event': 'true'
  }
};

console.log('🚀 Test lokalny webhook na http://localhost:3000/api/stripe-webhook?test=true');

const req = http.request(options, (res) => {
  console.log(`\n📥 Status: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      console.log('✅ Odpowiedź:', JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log('✅ Odpowiedź:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Błąd:', error.message);
});

req.write(postData);
req.end();
