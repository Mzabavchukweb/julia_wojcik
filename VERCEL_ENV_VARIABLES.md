# 🔐 Zmienne środowiskowe dla Vercel - Instrukcja

## 📍 Jak dodać zmienne środowiskowe w Vercel

1. W Vercel Dashboard → Projekt "julia-wojcik" → **Settings**
2. W lewym sidebarze kliknij **"Environment Variables"**
3. Dodaj każdą zmienną osobno klikając **"Add New"**

## ✅ Lista zmiennych do dodania

### 1. STRIPE_SECRET_KEY
```
Key: STRIPE_SECRET_KEY
Value: sk_test_... (twój klucz z Stripe Dashboard → Developers → API keys)
Environment: Production, Preview, Development (zaznacz wszystkie)
```

### 2. STRIPE_WEBHOOK_SECRET
```
Key: STRIPE_WEBHOOK_SECRET
Value: whsec_... (z Stripe Dashboard → Developers → Webhooks → Signing secret)
Environment: Production, Preview, Development (zaznacz wszystkie)
```

### 3. RESEND_API_KEY
```
Key: RESEND_API_KEY
Value: re_MQttk8b3_EvhEckNG26mPQtdEZ3xhn1PE
Environment: Production, Preview, Development (zaznacz wszystkie)
```

### 4. EMAIL_FROM
```
Key: EMAIL_FROM
Value: Julia Wójcik <ebook@juliawojcikszkolenia.pl>
Environment: Production, Preview, Development (zaznacz wszystkie)
```

### 5. EBOOK_PATH (opcjonalne)
```
Key: EBOOK_PATH
Value: ./ebooks/original-ebook.pdf
Environment: Production, Preview, Development (zaznacz wszystkie)
```

## ⚠️ WAŻNE - Po dodaniu zmiennych

**MUSISZ PRZEBUDOWAĆ PROJEKT!**

1. Przejdź do **Deployments**
2. Znajdź najnowszy deployment
3. Kliknij **"..."** (trzy kropki) → **"Redeploy"**
4. Wybierz **"Use existing Build Cache"** → **"Redeploy"**

## 🔍 Gdzie znaleźć klucze Stripe?

### STRIPE_SECRET_KEY:
- Stripe Dashboard → **Developers** → **API keys**
- Jeśli używasz testów: `sk_test_...`
- Jeśli używasz produkcji: `sk_live_...` (uwaga: po przejściu na live!)

### STRIPE_WEBHOOK_SECRET:
1. Stripe Dashboard → **Developers** → **Webhooks**
2. Kliknij na swój webhook endpoint (lub utwórz nowy)
3. **Endpoint URL:** `https://julia-wojcik.vercel.app/api/stripe-webhook`
4. **Events:** Wybierz `checkout.session.completed`
5. Skopiuj **"Signing secret"** (zaczyna się od `whsec_...`)

## ✅ Sprawdzenie po konfiguracji

Po dodaniu wszystkich zmiennych i redeploy:

1. **Test przez Stripe Dashboard:**
   - Stripe Dashboard → **Developers** → **Webhooks**
   - Kliknij na webhook endpoint
   - **"Send test webhook"** → `checkout.session.completed`
   - Sprawdź logi w Vercel → **Logs**

2. **Test przez prawdziwy zakup (testowy):**
   - Otwórz Payment Link: https://buy.stripe.com/test_8x24gz1Wo2jy1XX4yz8IU01
   - Użyj testowej karty: `4242 4242 4242 4242`
   - Email: `juliajula08@icloud.com` (lub inny testowy)
   - Po zakupie sprawdź email - powinien przyjść link do pobrania ebooka

---

**Gotowe! 🎉** Po skonfigurowaniu wszystkich zmiennych i redeploy, system będzie automatycznie wysyłał emaile z linkiem do pobrania ebooka po zakupie.

