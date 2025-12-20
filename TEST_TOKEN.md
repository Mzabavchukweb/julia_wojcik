# 🧪 Test Tokenu

## Problem
Użytkownik widzi "Token nieważny" podczas próby pobrania ebooka.

## Status
✅ **Link działa** - test curl zwraca HTTP 200 i PDF

## Możliwe przyczyny błędu:

1. **Różny secret** między webhookiem a downloadem
   - Webhook używa: `process.env.TOKEN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'default-secret-change-in-production'`
   - Download używa: `process.env.TOKEN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'default-secret-change-in-production'`
   - ✅ Oba używają tego samego - OK

2. **URL encoding** w emailu
   - Token jest URL-encoded w emailu: `encodeURIComponent(token)`
   - Download automatycznie dekoduje: `req.query.token` (Vercel automatycznie dekoduje)
   - ✅ Powinno działać

3. **Logi w Vercel** - sprawdź:
   - Vercel Dashboard → Project → Logs
   - Szukaj: `Token decode/verification failed`
   - Sprawdź dokładny błąd

## Test ręczny:

Uruchom nowy test i użyj linku:
```bash
cd ~/Desktop/Wójcik
npm run test:vercel
```

Kopiuj link z outputu i otwórz w przeglądarce (lub curl).

## Jeśli nadal nie działa:

Sprawdź logi Vercel - szczegółowe logowanie pokaże dokładny błąd:
- Czy token jest poprawnie otrzymany?
- Czy podpis się zgadza?
- Czy base64url decode działa?

