# 🔧 Rozwiązanie błędu 404 - Webhook nie znaleziony

## Problem
Stripe zwraca błąd 404: "The request /.netlify/functions/stripe-webhook was not found on this server."

## Przyczyny i rozwiązania

### 1. ✅ Sprawdź czy funkcja jest wdrożona w Netlify

**W Netlify Dashboard:**
1. Przejdź do: **Site settings → Functions**
2. Sprawdź czy widzisz funkcję `stripe-webhook`
3. Jeśli NIE widzisz funkcji:
   - Przejdź do: **Deploys**
   - Sprawdź czy ostatni deploy się powiódł
   - Jeśli nie, kliknij **"Trigger deploy" → "Deploy site"**

### 2. ✅ Sprawdź konfigurację w Netlify Dashboard

**Site settings → Build & deploy:**
- **Base directory:** (zostaw puste lub ustaw na `/`)
- **Build command:** (zostaw puste - nie potrzebujesz build command)
- **Publish directory:** `.` (lub zostaw puste)

**Site settings → Functions:**
- **Functions directory:** `netlify/functions` (powinno być automatycznie wykryte)

### 3. ✅ Wymuś redeploy

**Opcja A - Przez Netlify Dashboard:**
1. Przejdź do: **Deploys**
2. Kliknij **"Trigger deploy" → "Deploy site"**
3. Poczekaj aż deploy się zakończy

**Opcja B - Przez Git:**
```bash
# Zrób małą zmianę w pliku (np. dodaj komentarz)
git commit --allow-empty -m "Trigger Netlify deploy"
git push origin main
```

### 4. ✅ Sprawdź czy URL webhook jest poprawny

W **Stripe Dashboard → Webhooks → ebook-webhook**:

**URL powinien być:**
```
https://juliawojcikszkolenia.pl/.netlify/functions/stripe-webhook
```

**LUB jeśli używasz domeny Netlify:**
```
https://TWOJA-NAZWA.netlify.app/.netlify/functions/stripe-webhook
```

**WAŻNE:** 
- Upewnij się, że używasz **HTTPS** (nie HTTP)
- Upewnij się, że URL kończy się na `/.netlify/functions/stripe-webhook`
- Sprawdź czy nie ma dodatkowych znaków na końcu

### 5. ✅ Sprawdź logi w Netlify

**Netlify Dashboard → Functions → stripe-webhook:**
- Kliknij na funkcję
- Zobacz logi - czy są jakieś błędy?
- Jeśli funkcja nie istnieje, zobaczysz komunikat "Function not found"

### 6. ✅ Sprawdź czy plik funkcji jest w repozytorium

Upewnij się, że plik `netlify/functions/stripe-webhook.js` jest w repozytorium Git:

```bash
git ls-files | grep stripe-webhook
```

Jeśli nie widzisz pliku, dodaj go:
```bash
git add netlify/functions/stripe-webhook.js
git commit -m "Add stripe-webhook function"
git push origin main
```

### 7. ✅ Sprawdź konfigurację netlify.toml

Upewnij się, że w `netlify.toml` jest:
```toml
[build]
  functions = "netlify/functions"
```

### 8. ✅ Test lokalny (opcjonalnie)

Przetestuj funkcję lokalnie:

```bash
npm run dev
# lub
netlify dev
```

Następnie w przeglądarce otwórz:
```
http://localhost:8888/.netlify/functions/stripe-webhook
```

Powinieneś zobaczyć błąd "Method not allowed" (bo to GET, a funkcja wymaga POST), ale to potwierdza, że funkcja działa.

### 9. ✅ Sprawdź czy Netlify ma dostęp do repozytorium

**Netlify Dashboard → Site settings → Build & deploy → Continuous Deployment:**
- Sprawdź czy repozytorium jest połączone
- Sprawdź czy branch to `main` (lub `master`)

## Najczęstsze rozwiązania

1. **Wymuś redeploy** - to rozwiązuje 90% problemów
2. **Sprawdź URL webhook** - upewnij się, że jest poprawny
3. **Sprawdź czy funkcja jest w Git** - upewnij się, że plik jest w repozytorium

## Po naprawie

Po naprawieniu problemu:
1. W **Stripe Dashboard → Webhooks → ebook-webhook**
2. Kliknij **"Send test event"**
3. Wybierz `checkout.session.completed`
4. Sprawdź czy teraz działa (powinien być status 200)

## Jeśli nadal nie działa

Sprawdź:
1. Czy w Netlify Dashboard widzisz funkcję `stripe-webhook`?
2. Jaki jest dokładny URL webhook w Stripe?
3. Czy ostatni deploy w Netlify się powiódł?

Wyślij te informacje, a pomogę dalej!

