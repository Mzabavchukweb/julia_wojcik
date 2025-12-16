# 🔍 Sprawdzenie webhook - Krok po kroku

## Problem
Webhook ma 100% error rate - wszystkie próby dostarczenia zakończyły się niepowodzeniem.

## ✅ Co sprawdzić TERAZ:

### 1. Sprawdź czy funkcja jest wdrożona w Netlify

**Netlify Dashboard → Functions:**
- Czy widzisz funkcję `stripe-webhook`?
- Jeśli NIE widzisz → funkcja nie została wdrożona

**Jeśli funkcja nie jest widoczna:**
1. Netlify Dashboard → Deploys
2. Sprawdź czy ostatni deploy się powiódł
3. Jeśli nie, kliknij "Trigger deploy" → "Deploy site"

### 2. Sprawdź URL webhook

**Obecny URL w Stripe:**
```
https://juliawojcikszkolenia.pl/.netlify/functions/stripe-webhook
```

**Problem:** Custom domain może mieć problemy z routingiem do funkcji.

**Rozwiązanie - Użyj domeny Netlify:**

1. **Znajdź nazwę site w Netlify:**
   - Netlify Dashboard → Site settings → General
   - Zobacz "Site name" (np. `amazing-site-12345`)

2. **Zaktualizuj URL w Stripe:**
   - Stripe Dashboard → Webhooks → ebook-webhook
   - Kliknij na webhook (ebook-webhook)
   - Kliknij "Edit destination"
   - Zmień URL na: `https://TWOJA-NAZWA-SITE.netlify.app/.netlify/functions/stripe-webhook`
   - Zapisz

### 3. Przetestuj webhook

**W Stripe Dashboard → Webhooks → ebook-webhook:**
1. Kliknij "Send test event"
2. Wybierz `checkout.session.completed`
3. Kliknij "Send test webhook"
4. Sprawdź status - powinien być **200 OK**

### 4. Sprawdź logi

**Netlify Dashboard → Functions → stripe-webhook:**
- Kliknij na funkcję
- Zobacz logi - powinieneś zobaczyć: `=== STRIPE WEBHOOK RECEIVED ===`

**Stripe Dashboard → Webhooks → ebook-webhook → Event deliveries:**
- Kliknij na ostatni event
- Sprawdź Response - jaki jest dokładny błąd?

## 🚨 Najczęstsze przyczyny 100% error rate:

1. **Funkcja nie została wdrożona** → wymuś redeploy
2. **Nieprawidłowy URL** → użyj domeny `.netlify.app`
3. **Funkcja zwraca błąd** → sprawdź logi w Netlify
4. **Brak zmiennych środowiskowych** → sprawdź w Netlify Dashboard

## 📋 Checklist:

- [ ] Funkcja `stripe-webhook` jest widoczna w Netlify Dashboard → Functions
- [ ] Ostatni deploy w Netlify się powiódł
- [ ] URL webhook używa domeny `.netlify.app` (nie custom domain)
- [ ] Przetestowałem webhook przez "Send test event" w Stripe
- [ ] Sprawdziłem logi w Netlify Functions
- [ ] Sprawdziłem logi w Stripe Webhooks → Event deliveries

## 💡 Szybka naprawa:

**Jeśli funkcja jest wdrożona, ale nadal 404:**

1. **Zmień URL webhook na domenę Netlify:**
   ```
   https://TWOJA-NAZWA-SITE.netlify.app/.netlify/functions/stripe-webhook
   ```

2. **Przetestuj:**
   - Stripe → Webhooks → ebook-webhook → Send test event

3. **Jeśli działa na .netlify.app:**
   - Problem jest z custom domain
   - Możesz skonfigurować custom domain później, ale najpierw upewnij się, że funkcja działa

