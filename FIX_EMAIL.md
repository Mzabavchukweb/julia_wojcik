# 🔧 Naprawa problemu z emailami

## Problem
Email został wysłany, ale nie dotarł do skrzynki.

## Przyczyna
Prawdopodobnie problem z DNS records w Resend (SPF/MX są pending), co powoduje że Gmail odrzuca emaile.

## Szybkie rozwiązanie (dla testów)

### Opcja 1: Użyj domeny Resend (działa od razu)

W Vercel Dashboard → Environment Variables, zmień:

```
EMAIL_FROM=onboarding@resend.dev
```

**Uwaga:** Email będzie miał w nagłówku "via resend.dev", ale będzie działał od razu.

### Opcja 2: Poczekaj na propagację DNS

Jeśli chcesz użyć `ebook@juliawojcikszkolenia.pl`:
1. Sprawdź w Resend Dashboard → Domains
2. Poczekaj aż SPF i MX records będą "Verified" (może trwać kilka godzin)
3. Po weryfikacji emaile będą działać poprawnie

## Stałe rozwiązanie (produkcja)

### 1. Zweryfikuj domenę w Resend

1. Resend Dashboard → **Domains**
2. Sprawdź status DNS records:
   - ✅ DKIM: Verified (już jest!)
   - ⏳ SPF: Pending → poczekaj aż będzie Verified
   - ⏳ MX: Pending → poczekaj aż będzie Verified

### 2. Po weryfikacji DNS

Zmień `EMAIL_FROM` z powrotem na:
```
EMAIL_FROM=Julia Wójcik <ebook@juliawojcikszkolenia.pl>
```

### 3. Sprawdź logi w Resend

W Resend Dashboard → **Logs** sprawdź:
- Status emaila
- Jeśli "Bounced" - sprawdź "Reason"
- Jeśli "Failed" - sprawdź błąd

## Test

Po zmianie `EMAIL_FROM`:
```bash
npm run test:vercel
```

Sprawdź czy email dotarł na `zabavchukmaks21@gmail.com`.

