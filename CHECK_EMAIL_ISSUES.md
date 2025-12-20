# 🔍 Sprawdzanie problemów z emailami

## Email został wysłany ale nie dotarł

### 1. Sprawdź folder SPAM
- Gmail: Sprawdź folder "Spam" i "Ważne"
- Czasami pierwsze emaile trafiają do SPAM

### 2. Sprawdź logi w Resend Dashboard

1. Zaloguj się do Resend Dashboard: https://resend.com
2. Przejdź do **Logs** (w lewym menu)
3. Sprawdź ostatnie emaile:
   - Status: "Delivered" ✅ (dostarczony)
   - Status: "Bounced" ❌ (odrzucony)
   - Status: "Failed" ❌ (błąd)
   - Status: "Pending" ⏳ (w trakcie)

### 3. Sprawdź DNS records w Resend

Z wcześniejszych screenshotów widziałem że:
- ✅ **DKIM: Verified** (dobre!)
- ⏳ **SPF: Pending** (może być problem)
- ⏳ **MX: Pending** (może być problem)

Jeśli SPF i MX są pending, emaile mogą być odrzucane przez dostawców poczty.

### 4. Sprawdź konfigurację EMAIL_FROM

W Vercel Environment Variables sprawdź:
```
EMAIL_FROM=Julia Wójcik <ebook@juliawojcikszkolenia.pl>
```

**Ważne:** 
- Domena `juliawojcikszkolenia.pl` musi być zweryfikowana w Resend
- SPF i MX records muszą być skonfigurowane

### 5. Możliwe rozwiązania

#### A) Użyj domeny Resend do testów (temp)
Zmień `EMAIL_FROM` na:
```
EMAIL_FROM=onboarding@resend.dev
```
To jest domena testowa Resend - powinna działać od razu.

#### B) Użyj innego emaila jako FROM
Możesz użyć swojego Gmail, ale może trafić do SPAM.

#### C) Poczekaj na propagację DNS
Jeśli DNS records są pending, poczekaj kilka godzin - czasami to trwa.

### 6. Test email bezpośrednio przez Resend

W Resend Dashboard:
1. Przejdź do **Emails**
2. Kliknij **Send Email** (test)
3. Wyślij email na `zabavchukmaks21@gmail.com`
4. Sprawdź czy dotarł

### 7. Sprawdź czy email został odrzucony przez Gmail

W Resend Logs sprawdź:
- Jeśli status to "Bounced" - Gmail odrzucił email
- Sprawdź "Reason" w logach Resend

## Najszybsze rozwiązanie (dla testów):

Zmień `EMAIL_FROM` w Vercel na domenę Resend:
```
EMAIL_FROM=onboarding@resend.dev
```

To powinno działać od razu, ale wiadomość może mieć informację "via resend.dev".

