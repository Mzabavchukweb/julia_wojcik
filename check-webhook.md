# Diagnostyka Webhook Stripe - Automatyczna wysyłka e-booka

## Problem: Po zakupie przez Stripe nie działa automatyczna wysyłka e-booka

### Krok 1: Sprawdź konfigurację webhooka w Stripe Dashboard

1. Zaloguj się do [Stripe Dashboard](https://dashboard.stripe.com/)
2. Przejdź do: **Developers** → **Webhooks**
3. Sprawdź czy istnieje webhook z URL: `https://julia-wojcik.vercel.app/api/stripe-webhook`
4. Jeśli nie istnieje, kliknij **"Add endpoint"** i dodaj:
   - **Endpoint URL**: `https://julia-wojcik.vercel.app/api/stripe-webhook`
   - **Events to send**: Wybierz `checkout.session.completed`
   - Kliknij **"Add endpoint"**

### Krok 2: Sprawdź Webhook Signing Secret

1. W Stripe Dashboard → **Developers** → **Webhooks**
2. Kliknij na swój webhook endpoint
3. W sekcji **"Signing secret"** kliknij **"Reveal"**
4. Skopiuj secret (zaczyna się od `whsec_...`)
5. Sprawdź czy w Vercel Environment Variables jest ustawiony:
   - **STRIPE_WEBHOOK_SECRET** = `whsec_...` (ten sam secret z Stripe)

### Krok 3: Sprawdź zmienne środowiskowe w Vercel

W Vercel Dashboard → Project Settings → Environment Variables sprawdź czy są ustawione:

- ✅ **STRIPE_SECRET_KEY** = `sk_live_...` lub `sk_test_...`
- ✅ **STRIPE_WEBHOOK_SECRET** = `whsec_...` (z Stripe Dashboard)
- ✅ **RESEND_API_KEY** = `re_...`
- ✅ **EMAIL_FROM** = `Julia Wójcik <ebook@juliawojcikszkolenia.pl>` lub `onboarding@resend.dev` (dla testów)
- ✅ **TOKEN_SECRET** = (opcjonalne, jeśli nie ustawione używa STRIPE_WEBHOOK_SECRET)

### Krok 4: Sprawdź logi webhooka w Stripe

1. W Stripe Dashboard → **Developers** → **Webhooks**
2. Kliknij na swój webhook endpoint
3. Przejdź do zakładki **"Events"**
4. Sprawdź ostatnie eventy `checkout.session.completed`
5. Kliknij na event i sprawdź:
   - **Status**: Powinien być `200 OK` (sukces) lub `400/500` (błąd)
   - **Response**: Sprawdź odpowiedź z webhooka
   - **Request**: Sprawdź co zostało wysłane

### Krok 5: Sprawdź logi w Vercel

1. W Vercel Dashboard → Project → **Deployments**
2. Kliknij na najnowszy deployment
3. Przejdź do zakładki **"Functions"**
4. Kliknij na `api/stripe-webhook`
5. Sprawdź logi - szukaj błędów:
   - `❌ STRIPE_WEBHOOK_SECRET not set`
   - `❌ Webhook signature verification failed`
   - `❌ RESEND_API_KEY not configured`
   - `❌ Email service not configured`

### Krok 6: Test webhooka

Możesz przetestować webhook używając Stripe CLI lub przez Stripe Dashboard:

1. W Stripe Dashboard → **Developers** → **Webhooks**
2. Kliknij na swój webhook
3. Kliknij **"Send test webhook"**
4. Wybierz event: `checkout.session.completed`
5. Kliknij **"Send test webhook"**
6. Sprawdź czy otrzymałeś email

### Najczęstsze problemy:

1. **Webhook nie jest skonfigurowany** → Dodaj endpoint w Stripe Dashboard
2. **Nieprawidłowy STRIPE_WEBHOOK_SECRET** → Skopiuj secret z Stripe Dashboard i ustaw w Vercel
3. **Webhook nie otrzymuje eventów** → Sprawdź czy Payment Link używa tego samego konta Stripe
4. **Email nie jest wysyłany** → Sprawdź RESEND_API_KEY i EMAIL_FROM w Vercel
5. **Webhook zwraca błąd 400** → Sprawdź logi w Vercel - prawdopodobnie problem z weryfikacją podpisu

### Szybki test:

Wykonaj testowy zakup e-booka (300 PLN) i sprawdź:
1. Czy webhook otrzymał event w Stripe Dashboard
2. Czy webhook zwrócił status 200 w logach Stripe
3. Czy email został wysłany (sprawdź skrzynkę odbiorczą)
4. Czy w logach Vercel są błędy

