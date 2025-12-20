# 🔍 Debugowanie webhooka Stripe

## Problem
Wszystkie 17 deliveries webhooka się nie powiodły (Failed 17).

## Co sprawdzić:

### 1. W Stripe Dashboard - szczegóły błędu:
1. Stripe Dashboard → Developers → Webhooks
2. Kliknij na webhook endpoint "charismatic-triumph"
3. Przejdź do zakładki **"Event deliveries"**
4. Kliknij na jeden z failed deliveries
5. Zobacz **Response** - jaki jest kod błędu i wiadomość?

### 2. W Vercel - sprawdź logi:
1. Vercel Dashboard → Projekt "julia-wojcik" → **Logs**
2. Filtry:
   - Timeline: "Last 24 hours"
   - Console Level: wszystkie (Info, Warning, Error)
3. Szukaj wpisów z `STRIPE WEBHOOK RECEIVED`

### 3. Możliwe przyczyny błędów:

#### A) Błąd weryfikacji podpisu (400 Bad Request)
- **Przyczyna:** `STRIPE_WEBHOOK_SECRET` w Vercel nie pasuje do tego w Stripe
- **Rozwiązanie:** Skopiuj nowy Signing Secret z Stripe i zaktualizuj w Vercel

#### B) Błąd 500 Internal Server Error
- **Przyczyna:** Błąd w kodzie funkcji
- **Rozwiązanie:** Sprawdź logi w Vercel - tam będzie szczegółowy błąd

#### C) Timeout
- **Przyczyna:** Funkcja działa zbyt długo
- **Rozwiązanie:** Sprawdź czy `maxDuration` jest wystarczający (obecnie 30s)

### 4. Test webhooka:

W Stripe Dashboard:
1. Webhooks → Twój endpoint → **"Send test events"**
2. Wybierz event: `checkout.session.completed`
3. Kliknij "Send test event"
4. Sprawdź logi w Vercel

## Najważniejsze:
**Zobacz Response w failed deliveries w Stripe Dashboard** - to pokaże dokładny błąd!

