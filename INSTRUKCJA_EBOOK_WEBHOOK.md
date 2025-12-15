# 📧 Instrukcja - Automatyczna wysyłka e-booka po zakupie

## Jak działa system?

Po zakupie e-booka przez Stripe Payment Link:
1. Stripe wysyła webhook do naszej funkcji
2. Funkcja pobiera PDF e-booka
3. Automatycznie wysyła email z PDF do klienta

## 🚀 Konfiguracja krok po kroku

### 1. Przygotuj plik PDF

Umieść plik PDF z e-bookiem w folderze:
```
ebooks/original-ebook.pdf
```

### 2. Skonfiguruj zmienne środowiskowe w Netlify

W Netlify Dashboard → Site settings → Environment variables dodaj:

```
STRIPE_SECRET_KEY=sk_test_... (lub sk_live_... dla produkcji)
STRIPE_WEBHOOK_SECRET=whsec_... (z Stripe Dashboard → Webhooks)
RESEND_API_KEY=re_... (z resend.com)
EMAIL_FROM=Julia Wójcik <ebook@juliawojcikszkolenia.pl>
EBOOK_PATH=./ebooks/original-ebook.pdf
```

**Alternatywnie** (jeśli PDF jest w chmurze):
```
EBOOK_URL=https://twoja-domena.com/ebooks/original-ebook.pdf
```

**Jak uzyskać klucze:**

#### Stripe Secret Key:
1. Stripe Dashboard → Developers → API keys
2. Skopiuj **Secret key** (sk_test_... dla testów, sk_live_... dla produkcji)

#### Stripe Webhook Secret:
1. Stripe Dashboard → Developers → Webhooks
2. Kliknij "Add endpoint"
3. URL: `https://twoja-domena.netlify.app/.netlify/functions/stripe-webhook`
4. Events: wybierz `checkout.session.completed`
5. Po utworzeniu, kliknij na webhook i skopiuj **Signing secret** (whsec_...)

#### Resend API Key:
1. Zarejestruj się na [resend.com](https://resend.com)
2. Utwórz API Key
3. Skopiuj klucz (re_...)

### 3. Skonfiguruj produkt w Stripe

**WAŻNE:** Musisz dodać metadata do produktu w Stripe!

1. Stripe Dashboard → Products
2. Znajdź produkt e-booka (lub utwórz nowy)
3. Kliknij na produkt
4. W sekcji **Metadata** dodaj:
   - Key: `product_type`
   - Value: `ebook`
5. Zapisz

### 4. Zainstaluj zależności

Utwórz plik `package.json` w głównym folderze projektu:

```json
{
  "name": "julia-wojcik-szkolenia",
  "version": "1.0.0",
  "dependencies": {
    "stripe": "^14.0.0",
    "resend": "^3.0.0"
  }
}
```

Następnie w terminalu:
```bash
npm install
```

### 5. Wdróż na Netlify

1. Połącz repozytorium z Netlify
2. Netlify automatycznie wykryje funkcję w `netlify/functions/`
3. Po wdrożeniu, skonfiguruj webhook w Stripe (punkt 2)

### 6. Przetestuj

1. Użyj testowego Payment Link
2. Dokonaj testowej płatności (użyj testowej karty: 4242 4242 4242 4242)
3. Sprawdź czy email z PDF został wysłany

## 🔍 Sprawdzanie logów

### Netlify Functions Logs:
1. Netlify Dashboard → Functions
2. Kliknij na `stripe-webhook`
3. Zobacz logi w czasie rzeczywistym

### Stripe Webhook Logs:
1. Stripe Dashboard → Developers → Webhooks
2. Kliknij na webhook
3. Zobacz historię wywołań i odpowiedzi

## ⚠️ Rozwiązywanie problemów

### Email nie został wysłany
- Sprawdź logi w Netlify Functions
- Sprawdź czy `RESEND_API_KEY` jest poprawny
- Sprawdź czy `EMAIL_FROM` jest zweryfikowany w Resend

### Webhook nie działa
- Sprawdź czy `STRIPE_WEBHOOK_SECRET` jest poprawny
- Sprawdź logi w Stripe Dashboard → Webhooks
- Upewnij się, że URL webhook jest poprawny

### PDF nie został znaleziony
- Sprawdź czy plik `ebooks/original-ebook.pdf` istnieje
- Sprawdź czy ścieżka jest poprawna w kodzie

### Produkt nie jest rozpoznawany jako e-book
- Sprawdź czy produkt w Stripe ma metadata `product_type: ebook`
- Sprawdź logi funkcji, aby zobaczyć jakie produkty są w zamówieniu

## 📝 Alternatywa: Vercel

Jeśli używasz Vercel zamiast Netlify:

1. Utwórz folder `api/stripe-webhook.js`
2. Użyj tego samego kodu (Vercel używa podobnej struktury)
3. Skonfiguruj zmienne środowiskowe w Vercel Dashboard
4. URL webhook: `https://twoja-domena.vercel.app/api/stripe-webhook`

## ✅ Checklist przed uruchomieniem

- [ ] Plik PDF znajduje się w `ebooks/original-ebook.pdf`
- [ ] Wszystkie zmienne środowiskowe są ustawione w Netlify
- [ ] Produkt w Stripe ma metadata `product_type: ebook`
- [ ] Webhook jest skonfigurowany w Stripe
- [ ] Zależności są zainstalowane (`npm install`)
- [ ] Funkcja jest wdrożona na Netlify
- [ ] Testowa płatność działa i wysyła email

## 🎉 Gotowe!

Po skonfigurowaniu, każdy zakup e-booka automatycznie wyśle PDF na email klienta!

