# 🚀 Quick Start - Automatyczna wysyłka ebooka

## Szybki start w 5 krokach

### 1️⃣ Umieść ebooka
```
ebooks/original-ebook.pdf
```

### 2️⃣ Zainstaluj zależności
```bash
npm install
```

### 3️⃣ Skonfiguruj Stripe Payment Link
- Utwórz produkt w Stripe
- Utwórz Payment Link
- **WAŻNE**: Dodaj metadata `product_type: ebook`
- Skopiuj URL do `assets/stripe-config.js`

### 4️⃣ Skonfiguruj zmienne środowiskowe

W Netlify/Vercel dodaj:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
EMAIL_SERVICE=resend
RESEND_API_KEY=re_...
EMAIL_FROM=Julia Wójcik <ebook@juliawojcikszkolenia.pl>
EBOOK_PATH=./ebooks/original-ebook.pdf
```

### 5️⃣ Skonfiguruj Webhook w Stripe
- URL: `https://twoja-domena.netlify.app/.netlify/functions/stripe-webhook-netlify`
- Events: `checkout.session.completed`, `payment_intent.succeeded`

## 📚 Pełna dokumentacja

Zobacz **[INSTRUKCJA_EBOOK.md](./INSTRUKCJA_EBOOK.md)** dla szczegółowej instrukcji.

## ✅ Co działa automatycznie?

- ✅ Watermark z emailem klienta na każdej stronie PDF
- ✅ Watermark z ID płatności i datą
- ✅ Automatyczna wysyłka na email po płatności
- ✅ Zabezpieczenie przed rozprzestrzenianiem

## 🆘 Problemy?

1. Sprawdź logi w Stripe Dashboard → Webhooks
2. Sprawdź logi funkcji (Netlify/Vercel)
3. Zobacz [INSTRUKCJA_EBOOK.md](./INSTRUKCJA_EBOOK.md) → Rozwiązywanie problemów

