# 🚀 Instrukcja migracji do Vercel

## ✅ Co zostało zrobione:

1. ✅ Utworzono folder `api/` z funkcjami Vercel
2. ✅ Przekształcono funkcje na format Vercel
3. ✅ Utworzono plik konfiguracyjny `vercel.json`

## 📋 Krok po kroku - Wdrożenie na Vercel:

### Krok 1: Zarejestruj się na Vercel

1. Przejdź do: https://vercel.com
2. Kliknij **"Sign Up"**
3. Zaloguj się przez **GitHub** (najłatwiej)

### Krok 2: Połącz repozytorium

1. W Vercel Dashboard kliknij **"Add New Project"**
2. Wybierz repozytorium `julia_wojcik`
3. Vercel automatycznie wykryje projekt

### Krok 3: Konfiguracja projektu

**Build Settings:**
- **Framework Preset:** Other (lub zostaw puste)
- **Root Directory:** `.` (lub zostaw puste)
- **Build Command:** (zostaw puste - nie potrzebujesz build)
- **Output Directory:** `.` (lub zostaw puste)

**Funkcje:**
- Vercel automatycznie wykryje funkcje w folderze `api/`

### Krok 4: Dodaj zmienne środowiskowe

**Vercel Dashboard → Project Settings → Environment Variables:**

Dodaj te same zmienne co w Netlify:

| Zmienna | Wartość |
|---------|---------|
| `STRIPE_SECRET_KEY` | `sk_test_...` (lub `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (z Stripe Dashboard) |
| `RESEND_API_KEY` | `re_...` (z resend.com) |
| `EMAIL_FROM` | `Julia Wójcik <ebook@juliawojcikszkolenia.pl>` |
| `EBOOK_PATH` | `./ebooks/original-ebook.pdf` (opcjonalnie) |
| `EBOOK_URL` | (opcjonalnie, jeśli PDF jest w chmurze) |

**WAŻNE:** 
- Dodaj zmienne dla wszystkich środowisk: **Production**, **Preview**, **Development**
- Kliknij **"Save"** po dodaniu każdej zmiennej

### Krok 5: Wdróż projekt

1. Kliknij **"Deploy"**
2. Poczekaj aż deploy się zakończy (zwykle 1-2 minuty)
3. Po zakończeniu, zobaczysz URL projektu (np. `julia-wojcik-szkolenia.vercel.app`)

### Krok 6: Zaktualizuj URL webhook w Stripe

**Stripe Dashboard → Webhooks → ebook-webhook:**

1. Kliknij na webhook
2. Kliknij **"Edit destination"**
3. Zmień URL na:
   ```
   https://TWOJA-NAZWA.vercel.app/api/stripe-webhook
   ```
   (zamień `TWOJA-NAZWA` na nazwę z Vercel)
4. Zapisz

### Krok 7: Przetestuj webhook

**Stripe Dashboard → Webhooks → ebook-webhook:**

1. Kliknij **"Send test event"**
2. Wybierz `checkout.session.completed`
3. Kliknij **"Send test webhook"**
4. Sprawdź status - powinien być **200 OK** ✅

## 🔍 Sprawdzanie logów

### Vercel Dashboard:
1. Przejdź do: **Project → Functions**
2. Kliknij na `stripe-webhook` lub `download-ebook`
3. Zobacz logi w czasie rzeczywistym

### Stripe Dashboard:
1. **Webhooks → ebook-webhook → Event deliveries**
2. Kliknij na event
3. Zobacz Response - powinien być status **200**

## ⚠️ Ważne różnice między Netlify a Vercel:

### 1. Format funkcji:
- **Netlify:** `exports.handler = async function(event, context)`
- **Vercel:** `export default async function handler(req, res)`

### 2. URL funkcji:
- **Netlify:** `/.netlify/functions/stripe-webhook`
- **Vercel:** `/api/stripe-webhook`

### 3. Response:
- **Netlify:** `return { statusCode: 200, body: ... }`
- **Vercel:** `res.status(200).json(...)`

### 4. Query parameters:
- **Netlify:** `event.queryStringParameters.token`
- **Vercel:** `req.query.token`

### 5. Headers:
- **Netlify:** `event.headers['stripe-signature']`
- **Vercel:** `req.headers['stripe-signature']`

## 🎯 Co dalej?

Po wdrożeniu:
1. ✅ Przetestuj webhook w Stripe
2. ✅ Zrób testowy zakup e-booka
3. ✅ Sprawdź czy email został wysłany
4. ✅ Sprawdź czy link do pobrania działa

## 💡 Wskazówki:

- **Darmowy plan Vercel:** 100GB bandwidth/miesiąc, unlimited requests
- **Funkcje:** Automatycznie wykrywane w folderze `api/`
- **Deploy:** Automatyczny przy każdym push do GitHub
- **Logi:** Dostępne w Vercel Dashboard → Functions

## 🆘 Jeśli coś nie działa:

1. Sprawdź logi w Vercel Dashboard → Functions
2. Sprawdź logi w Stripe Dashboard → Webhooks
3. Sprawdź czy wszystkie zmienne środowiskowe są ustawione
4. Sprawdź czy URL webhook jest poprawny

Powodzenia! 🚀

