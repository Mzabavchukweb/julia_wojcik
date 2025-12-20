# 📚 Konfiguracja systemu wysyłki e-booka

## ✅ Krok 1: Utworzenie Payment Link dla e-booka w Stripe

1. Otwórz **Stripe Dashboard** → **Products** → **Payment links**
2. Kliknij **Create payment link**
3. Wybierz lub utwórz produkt:
   - **Name:** `E-book - Korekta bez skrótów` (lub inna nazwa)
   - **Price:** `300.00 PLN`
   - **Description:** `E-book PDF - Kompletny przewodnik po stylizacji paznokci`
4. W sekcji **Metadata** (opcjonalne, ale zalecane):
   - Dodaj klucz: `product_type`
   - Wartość: `ebook`
5. Kliknij **Create payment link**
6. Skopiuj URL (format: `https://buy.stripe.com/test_...` lub `https://buy.stripe.com/live_...`)
7. Wklej URL do pliku `assets/stripe-config.js` w linii 88:
   ```javascript
   paymentLink: 'https://buy.stripe.com/test_TWOJ_LINK_TUTAJ',
   ```

## ✅ Krok 2: Konfiguracja Webhook w Stripe

1. Otwórz **Stripe Dashboard** → **Developers** → **Webhooks**
2. Kliknij **Add endpoint** (lub edytuj istniejący)
3. **Endpoint URL:** `https://TWOJA_NAZWA_PROJEKTU.vercel.app/api/stripe-webhook`
   - ⚠️ Zamień `TWOJA_NAZWA_PROJEKTU` na rzeczywistą nazwę projektu w Vercel!
4. **Events to send:** Wybierz `checkout.session.completed`
5. Kliknij **Add endpoint**
6. Skopiuj **Signing secret** (zaczyna się od `whsec_...`)
7. Wklej go jako `STRIPE_WEBHOOK_SECRET` w Vercel (patrz Krok 3)

## ✅ Krok 3: Zmienne środowiskowe w Vercel

W **Vercel Dashboard** → **Project Settings** → **Environment Variables** ustaw:

```
STRIPE_SECRET_KEY=sk_test_... (lub sk_live_... dla produkcji)
STRIPE_WEBHOOK_SECRET=whsec_... (z Stripe Dashboard)
RESEND_API_KEY=re_... (z Resend Dashboard)
EMAIL_FROM=Julia Wójcik <ebook@juliawojcikszkolenia.pl>
EBOOK_PATH=./ebooks/original-ebook.pdf
```

**⚠️ WAŻNE:** Po dodaniu/zmianie zmiennych środowiskowych, **przebuduj projekt** w Vercel (Redeploy).

## ✅ Krok 4: Konfiguracja Resend (wysyłka emaili)

1. Zarejestruj się na [Resend.com](https://resend.com)
2. Przejdź do **API Keys** → **Create API Key**
3. Skopiuj klucz API (zaczyna się od `re_...`)
4. Wklej jako `RESEND_API_KEY` w Vercel (patrz Krok 3)
5. W **Domains** dodaj i zweryfikuj domenę `juliawojcikszkolenia.pl`
6. Ustaw `EMAIL_FROM` w formacie: `Julia Wójcik <ebook@juliawojcikszkolenia.pl>`

## ✅ Krok 5: Testowanie systemu

### Opcja A: Test przez Stripe Dashboard (najłatwiejsze)

1. Otwórz **Stripe Dashboard** → **Developers** → **Webhooks**
2. Kliknij na swój webhook endpoint
3. Kliknij **Send test webhook**
4. Wybierz event: `checkout.session.completed`
5. W **Test data** ustaw:
   ```json
   {
     "customer_email": "test@example.com",
     "amount_total": 30000,
     "currency": "pln",
     "metadata": {
       "product_type": "ebook"
     }
   }
   ```
6. Kliknij **Send test webhook**
7. Sprawdź **Logs** w Vercel Dashboard, czy webhook został odebrany

### Opcja B: Test przez prawdziwy zakup (testowy)

1. Otwórz Payment Link e-booka w przeglądarce
2. Użyj testowej karty: `4242 4242 4242 4242`
3. Wypełnij formularz:
   - Data wygaśnięcia: dowolna data w przyszłości (np. 12/25)
   - CVC: dowolny 3-cyfrowy kod (np. 123)
   - Email: Twój prawdziwy email (żeby sprawdzić czy przychodzi)
4. Kliknij **Pay**
5. Sprawdź email - powinien przyjść link do pobrania e-booka

## 🔍 Jak system wykrywa zakup e-booka?

System wykrywa zakup e-booka na 3 sposoby (w kolejności sprawdzania):

1. **Metadata produktu:** Jeśli produkt ma `metadata.product_type === 'ebook'`
2. **Nazwa produktu:** Jeśli nazwa zawiera 'ebook', 'e-book' lub 'korekta'
3. **Kwota:** Jeśli kwota to **300 PLN** (30000 groszy) - **GŁÓWNA METODA**

## 📊 Sprawdzanie logów

### Vercel Dashboard:
1. Otwórz projekt w Vercel
2. Kliknij **Functions** → `api/stripe-webhook`
3. Sprawdź **Logs** - powinny być widoczne szczegółowe logi z wykrywaniem zakupu

### Stripe Dashboard:
1. Otwórz **Developers** → **Webhooks**
2. Kliknij na swój endpoint
3. Sprawdź **Recent deliveries** - powinny być widoczne próby dostarczenia webhooka

### Resend Dashboard:
1. Otwórz **Logs**
2. Sprawdź czy emaile są wysyłane poprawnie

## ❌ Rozwiązywanie problemów

### Problem: Email nie przychodzi po zakupie

**Sprawdź:**
1. Czy `RESEND_API_KEY` jest ustawiony w Vercel
2. Czy `EMAIL_FROM` jest w formacie: `Nazwa <email@domena.pl>`
3. Czy domena jest zweryfikowana w Resend
4. Sprawdź logi w Vercel - powinny pokazać błąd wysyłki emaila
5. Sprawdź folder SPAM w skrzynce email

### Problem: Webhook nie wykrywa zakupu e-booka

**Sprawdź:**
1. Czy kwota w Payment Link to **300 PLN** (30000 groszy)
2. Czy waluta to **PLN**
3. Sprawdź logi w Vercel - powinny pokazać, dlaczego zakup nie został rozpoznany
4. Upewnij się, że w Payment Link jest ustawione `metadata.product_type = 'ebook'` (opcjonalne)

### Problem: Link do pobrania nie działa

**Sprawdź:**
1. Czy Vercel KV jest włączony (jeśli używasz)
2. Sprawdź logi - powinny pokazać, czy token został zapisany
3. Link jest ważny **7 dni** i można pobrać **5 razy**

## ✅ Checklist przed uruchomieniem

- [ ] Payment Link dla e-booka utworzony w Stripe (300 PLN)
- [ ] Payment Link wklejony do `assets/stripe-config.js`
- [ ] Webhook skonfigurowany w Stripe Dashboard
- [ ] URL webhook w Stripe jest poprawny (`/api/stripe-webhook`)
- [ ] `STRIPE_WEBHOOK_SECRET` w Vercel = Signing secret z Stripe
- [ ] Wszystkie zmienne środowiskowe ustawione w Vercel
- [ ] Resend API Key skonfigurowany
- [ ] Domena email zweryfikowana w Resend
- [ ] Plik `ebooks/original-ebook.pdf` istnieje
- [ ] Projekt przebudowany w Vercel po zmianach
- [ ] Test webhook wykonany (przez Stripe Dashboard lub prawdziwy zakup)

---

**Gotowe! 🎉** Po zakupie e-booka, klient automatycznie otrzyma email z linkiem do pobrania.

