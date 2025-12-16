# 🔧 Szybka naprawa błędu 404 - Webhook

## Problem
Stripe zwraca 404: "The request /.netlify/functions/stripe-webhook was not found on this server."

## ✅ Rozwiązanie krok po kroku

### Krok 1: Sprawdź URL webhook w Stripe

W **Stripe Dashboard → Webhooks → ebook-webhook**:

**OPCJA A - Użyj domeny Netlify (ZALECANE dla testów):**
```
https://TWOJA-NAZWA-SITE.netlify.app/.netlify/functions/stripe-webhook
```

**Jak znaleźć nazwę site:**
1. Netlify Dashboard → Site settings → General
2. Zobacz "Site name" (np. `amazing-site-12345`)
3. URL będzie: `https://amazing-site-12345.netlify.app/.netlify/functions/stripe-webhook`

**OPCJA B - Użyj custom domain (jeśli jest skonfigurowany):**
```
https://juliawojcikszkolenia.pl/.netlify/functions/stripe-webhook
```

**WAŻNE:**
- Upewnij się, że używasz **HTTPS** (nie HTTP)
- Sprawdź czy nie ma dodatkowych znaków na końcu URL
- Po zmianie URL, kliknij **"Send test event"** w Stripe

### Krok 2: Wymuś redeploy w Netlify

**Metoda A - Przez Netlify Dashboard (NAJSZYBSZA):**
1. Przejdź do: **Netlify Dashboard → Deploys**
2. Kliknij **"Trigger deploy" → "Deploy site"**
3. Poczekaj aż deploy się zakończy (zwykle 1-2 minuty)
4. Sprawdź czy w **Functions** widzisz `stripe-webhook`

**Metoda B - Przez Git (już zrobione):**
```bash
git commit --allow-empty -m "Trigger Netlify redeploy"
git push origin main
```

### Krok 3: Sprawdź czy funkcja jest wdrożona

**Netlify Dashboard → Functions:**
- Powinieneś zobaczyć listę funkcji
- Jeśli widzisz `stripe-webhook` - ✅ funkcja jest wdrożona
- Jeśli NIE widzisz - ❌ funkcja nie została wdrożona

**Jeśli funkcja nie jest widoczna:**
1. Sprawdź **Deploys** - czy ostatni deploy się powiódł?
2. Sprawdź **Build logs** - czy są jakieś błędy?
3. Sprawdź czy plik `netlify/functions/stripe-webhook.js` jest w repozytorium

### Krok 4: Przetestuj webhook

**W Stripe Dashboard → Webhooks → ebook-webhook:**
1. Kliknij **"Send test event"**
2. Wybierz `checkout.session.completed`
3. Kliknij **"Send test webhook"**
4. Sprawdź status - powinien być **200 OK** (nie 404)

### Krok 5: Sprawdź logi

**Netlify Dashboard → Functions → stripe-webhook:**
- Kliknij na funkcję
- Zobacz logi - powinieneś zobaczyć: `=== STRIPE WEBHOOK RECEIVED ===`

**Stripe Dashboard → Webhooks → ebook-webhook → Event deliveries:**
- Kliknij na ostatni event
- Sprawdź **Response** - powinien być status **200** z JSON odpowiedzią

## 🔍 Najczęstsze przyczyny 404

1. **Funkcja nie została wdrożona** - wymuś redeploy
2. **Nieprawidłowy URL** - użyj domeny `.netlify.app` zamiast custom domain
3. **Funkcja nie jest w Git** - sprawdź czy plik jest w repozytorium
4. **Błąd w build** - sprawdź build logs w Netlify

## ✅ Checklist

- [ ] URL webhook w Stripe jest poprawny (sprawdź czy kończy się na `/.netlify/functions/stripe-webhook`)
- [ ] Używasz HTTPS (nie HTTP)
- [ ] Funkcja `stripe-webhook` jest widoczna w Netlify Dashboard → Functions
- [ ] Ostatni deploy w Netlify się powiódł
- [ ] Plik `netlify/functions/stripe-webhook.js` jest w repozytorium Git
- [ ] Przetestowałeś webhook przez "Send test event" w Stripe

## 🚨 Jeśli nadal nie działa

Sprawdź:
1. **Netlify Dashboard → Site settings → Functions:**
   - Czy "Functions directory" to `netlify/functions`?
   
2. **Netlify Dashboard → Deploys:**
   - Czy ostatni deploy się powiódł?
   - Czy są jakieś błędy w build logs?

3. **Stripe Dashboard → Webhooks:**
   - Jaki jest dokładny URL webhook?
   - Czy webhook jest "Active"?

Wyślij te informacje, a pomogę dalej!

