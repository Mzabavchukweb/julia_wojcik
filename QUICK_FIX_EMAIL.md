# ⚡ SZYBKA NAPRAWA - Email

## Problem
Domena `juliawojcikszkolenia.pl` nie jest zweryfikowana w Resend.

Błąd: `"The juliawojcikszkolenia.pl domain is not verified"`

## Rozwiązanie (5 minut)

### Krok 1: Zmień EMAIL_FROM w Vercel

1. Otwórz: https://vercel.com/dashboard
2. Projekt: `julia-wojcik` → **Settings** → **Environment Variables**
3. Znajdź `EMAIL_FROM`
4. Zmień wartość na: `onboarding@resend.dev`
5. **Zapisz**
6. **Redeploy** projektu (Deployments → najnowszy → "..." → Redeploy)

### Krok 2: Przetestuj

```bash
npm run test:vercel
```

Email powinien dotrzeć na `zabavchukmaks21@gmail.com` ✅

## Później (dla produkcji)

Po zweryfikowaniu domeny w Resend, zmień z powrotem na:
```
Julia Wójcik <ebook@juliawojcikszkolenia.pl>
```

---

**To rozwiązuje problem natychmiast!** 🎉

