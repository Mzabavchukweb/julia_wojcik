// Test webhook bezpośrednio - bez Stripe CLI
// Uruchom: node test-webhook-direct.js

import https from 'https';

// Testowy event checkout.session.completed
// Format zgodny z Stripe API
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
      amount_total: 30000, // 300 PLN w groszach
      currency: 'pln',
      customer_email: 'zabavchukmaks21@gmail.com',
      payment_status: 'paid',
      status: 'complete',
      metadata: {
        product_type: 'ebook'
      }
    }
  }
};

// Wyślij do webhooka
const postData = JSON.stringify(testEvent);

const options = {
  hostname: 'julia-wojcik.vercel.app',
  port: 443,
  path: '/api/stripe-webhook?test=true', // Użyj query parameter jako backup
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    // Dla testów - pomiń weryfikację podpisu (tylko do testów!)
    'X-Test-Event': 'true',
    'User-Agent': 'Test-Webhook-Script'
  }
};

console.log('🚀 Wysyłam testowy event do webhooka...');
console.log('URL:', `https://${options.hostname}${options.path}`);

const req = https.request(options, (res) => {
  console.log(`\n📥 Status: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n✅ Odpowiedź:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Błąd:', error);
});

req.write(postData);
req.end();

