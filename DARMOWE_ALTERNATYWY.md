# 🆓 Darmowe alternatywy dla Netlify

## ✅ Najlepsze opcje (darmowe):

### 1. **Vercel** ⭐ NAJŁATWIEJSZE (polecam!)
- **Darmowy plan:** 100GB bandwidth/miesiąc, unlimited requests
- **Funkcje serverless:** Tak (podobne do Netlify)
- **Migracja:** Bardzo łatwa - prawie identyczny kod
- **Limit:** Generous free tier
- **Link:** https://vercel.com

**Jak migrować:**
- Utwórz konto na Vercel
- Połącz repozytorium GitHub
- Vercel automatycznie wykryje funkcje
- Funkcje w `api/` zamiast `netlify/functions/`

### 2. **Cloudflare Workers** ⭐ NAJWIĘCEJ DARMOWE
- **Darmowy plan:** 100,000 requests/dzień (3M/miesiąc!)
- **Funkcje serverless:** Tak (Workers)
- **Migracja:** Wymaga małych zmian w kodzie
- **Limit:** Bardzo generosne
- **Link:** https://workers.cloudflare.com

### 3. **Railway**
- **Darmowy plan:** $5 kredytów/miesiąc
- **Funkcje serverless:** Tak (Node.js)
- **Migracja:** Średnia trudność
- **Link:** https://railway.app

### 4. **Render**
- **Darmowy plan:** Unlimited static sites, ograniczone funkcje
- **Funkcje serverless:** Tak (Web Services)
- **Migracja:** Średnia trudność
- **Link:** https://render.com

## 🚀 Szybka migracja do Vercel (najłatwiejsze)

### Krok 1: Przygotuj strukturę

Vercel używa folderu `api/` zamiast `netlify/functions/`:

```bash
# Utwórz folder api
mkdir api

# Skopiuj funkcje
cp netlify/functions/stripe-webhook.js api/stripe-webhook.js
cp netlify/functions/download-ebook.js api/download-ebook.js
```

### Krok 2: Zmień eksport w funkcjach

Vercel używa innego formatu. Zmień w `api/stripe-webhook.js`:

**Z:**
```javascript
exports.handler = async function(event, context) {
```

**Na:**
```javascript
export default async function handler(req, res) {
    // req.body zamiast event.body
    // req.headers zamiast event.headers
    // res.status(200).json() zamiast return { statusCode: 200, body: ... }
}
```

### Krok 3: Wdróż na Vercel

1. Zarejestruj się na https://vercel.com
2. Połącz repozytorium GitHub
3. Vercel automatycznie wykryje projekt
4. Dodaj zmienne środowiskowe (takie same jak w Netlify)
5. Deploy!

### Krok 4: Zaktualizuj URL webhook w Stripe

**Nowy URL:**
```
https://TWOJA-NAZWA.vercel.app/api/stripe-webhook
```

## 🔧 Szybka migracja do Cloudflare Workers

### Krok 1: Utwórz projekt

```bash
npm create cloudflare@latest
```

### Krok 2: Przenieś funkcje

Cloudflare Workers używa innego formatu, ale można łatwo zaadaptować kod.

### Krok 3: Wdróż

```bash
npx wrangler deploy
```

## 📊 Porównanie darmowych planów

| Platforma | Requests/miesiąc | Bandwidth | Funkcje | Łatwość migracji |
|-----------|------------------|-----------|---------|------------------|
| **Vercel** | Unlimited | 100GB | ✅ | ⭐⭐⭐⭐⭐ |
| **Cloudflare** | 3M | Unlimited | ✅ | ⭐⭐⭐ |
| **Railway** | $5 kredytów | - | ✅ | ⭐⭐⭐⭐ |
| **Render** | Ograniczone | - | ✅ | ⭐⭐⭐ |

## 💡 Moja rekomendacja

**Dla Ciebie najlepsze będzie Vercel**, bo:
1. ✅ Najłatwiejsza migracja (prawie identyczny kod)
2. ✅ Generous free tier
3. ✅ Automatyczne deploy z GitHub
4. ✅ Dobre wsparcie dla Stripe webhooks
5. ✅ Szybkie i niezawodne

## 🚀 Chcesz, żebym pomógł z migracją?

Mogę:
1. Przekształcić funkcje na format Vercel
2. Utworzyć plik konfiguracyjny `vercel.json`
3. Pokazać dokładne kroki migracji

Powiedz tylko, którą platformę wybierasz! 🎯

