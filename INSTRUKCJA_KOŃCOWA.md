# ✅ Instrukcja końcowa - System e-booka na Vercel

## 📋 Sprawdzenie przed uruchomieniem

### 1. Zmienne środowiskowe w Vercel

Upewnij się, że w **Vercel Dashboard → Project Settings → Environment Variables** masz ustawione:

```
STRIPE_SECRET_KEY=sk_test_... (lub sk_live_... dla produkcji)
STRIPE_WEBHOOK_SECRET=whsec_... (z Stripe Dashboard → Webhooks → Signing secret)
RESEND_API_KEY=re_... (z Resend Dashboard)
EMAIL_FROM=Julia Wójcik <ebook@juliawojcikszkolenia.pl>
EBOOK_PATH=./ebooks/original-ebook.pdf
```

**⚠️ WAŻNE:** Po dodaniu/zmianie zmiennych środowiskowych, **przebuduj projekt** w Vercel (Redeploy).

### 2. Konfiguracja Stripe Webhook

1. Otwórz **Stripe Dashboard** → **Developers** → **Webhooks**
2. Kliknij **Add endpoint** (lub edytuj istniejący)
3. **Endpoint URL:** `https://julia-wojcik.vercel.app/api/stripe-webhook`
   - ⚠️ Zamień `julia-wojcik` na swoją nazwę projektu Vercel!
4. **Events to send:** Wybierz `checkout.session.completed`
5. Kliknij **Add endpoint**
6. Skopiuj **Signing secret** (zaczyna się od `whsec_...`)
7. Wklej go jako `STRIPE_WEBHOOK_SECRET` w Vercel (patrz punkt 1)

### 3. Sprawdzenie Payment Link dla e-booka

W pliku `assets/stripe-config.js` sprawdź, czy Payment Link jest poprawny:

```javascript
const ebook = {
    paymentLink: 'https://buy.stripe.com/test_8x24gz1Wo2jy1XX4yz8IU01',
    // ...
};
```

**Dla produkcji:** Zamień `test_` na `live_` w Payment Link i użyj live keys w Stripe.

### 4. Testowanie systemu

#### Opcja A: Test przez Stripe Dashboard (najłatwiejsze)

1. Otwórz **Stripe Dashboard** → **Developers** → **Webhooks**
2. Kliknij na swój webhook endpoint
3. Kliknij **Send test webhook**
4. Wybierz event: `checkout.session.completed`
5. Kliknij **Send test webhook**
6. Sprawdź **Logs** w Vercel Dashboard, czy webhook został odebrany

#### Opcja B: Test przez prawdziwy zakup (testowy)

1. Otwórz Payment Link e-booka w przeglądarce
2. Użyj testowej karty: `4242 4242 4242 4242`
3. Wypełnij formularz (dowolna data wygaśnięcia w przyszłości, dowolny CVC)
4. Kliknij **Pay**
5. Sprawdź email - powinien przyjść link do pobrania e-booka

### 5. Sprawdzenie logów

**Vercel Dashboard:**
1. Otwórz projekt w Vercel
2. Kliknij **Functions** → `api/stripe-webhook`
3. Sprawdź **Logs** - powinny być widoczne szczegółowe logi

**Stripe Dashboard:**
1. Otwórz **Developers** → **Webhooks**
2. Kliknij na swój endpoint
3. Sprawdź **Recent deliveries** - powinny być widoczne próby dostarczenia webhooka

## 🔧 Rozwiązywanie problemów

### Problem: Webhook zwraca 400 Bad Request

**Przyczyna:** Błędna weryfikacja podpisu Stripe

**Rozwiązanie:**
1. Sprawdź, czy `STRIPE_WEBHOOK_SECRET` w Vercel jest identyczny z **Signing secret** w Stripe Dashboard
2. Upewnij się, że w `vercel.json` jest `"bodyParser": false` dla `api/stripe-webhook.js`
3. Sprawdź, czy webhook URL w Stripe jest poprawny (z `/api/stripe-webhook` na końcu)

### Problem: Email nie przychodzi

**Przyczyna:** Błąd w konfiguracji Resend lub brak klucza API

**Rozwiązanie:**
1. Sprawdź, czy `RESEND_API_KEY` jest ustawiony w Vercel
2. Sprawdź, czy `EMAIL_FROM` jest w formacie: `Nazwa <email@domena.pl>`
3. Sprawdź logi w Vercel - powinny pokazać błąd wysyłki emaila
4. Sprawdź **Resend Dashboard** → **Logs** - czy są błędy

### Problem: E-book nie jest wykrywany jako zakup e-booka

**Przyczyna:** Webhook nie rozpoznaje zakupu e-booka

**Rozwiązanie:**
1. Sprawdź, czy kwota w Payment Link to **300 PLN** (30000 groszy)
2. Sprawdź logi w Vercel - powinny pokazać, dlaczego zakup nie został rozpoznany
3. Upewnij się, że w Payment Link jest ustawione `metadata.product_type = 'ebook'` (opcjonalne)

### Problem: Link do pobrania nie działa

**Przyczyna:** Token nie został zapisany lub wygasł

**Rozwiązanie:**
1. Sprawdź, czy Vercel KV jest włączony (jeśli używasz)
2. Sprawdź logi - powinny pokazać, czy token został zapisany
3. Link jest ważny **7 dni** i można pobrać **5 razy**

## 📝 Struktura projektu

```
Wójcik/
├── api/
│   ├── stripe-webhook.js      # Webhook Stripe (wysyłka emaila)
│   └── download-ebook.js       # Pobieranie e-booka przez token
├── assets/
│   └── stripe-config.js        # Konfiguracja Payment Links
├── ebooks/
│   └── original-ebook.pdf     # Plik e-booka
├── vercel.json                 # Konfiguracja Vercel
└── package.json                # Zależności
```

## 🚀 Przejście na produkcję

1. **Stripe:**
   - Zamień klucze testowe (`pk_test_...`, `sk_test_...`) na live (`pk_live_...`, `sk_live_...`)
   - Utwórz nowy Payment Link dla produkcji
   - Zaktualizuj `STRIPE_PUBLISHABLE_KEY` w `assets/stripe-config.js`

2. **Vercel:**
   - Dodaj zmienne środowiskowe dla produkcji
   - Upewnij się, że domena jest podpięta (opcjonalne)

3. **Resend:**
   - Upewnij się, że domena email jest zweryfikowana w Resend
   - Zaktualizuj `EMAIL_FROM` na produkcyjny adres

4. **Webhook:**
   - Zaktualizuj URL webhook w Stripe na produkcyjny
   - Skopiuj nowy **Signing secret** i zaktualizuj `STRIPE_WEBHOOK_SECRET` w Vercel

## ✅ Checklist przed uruchomieniem

- [ ] Wszystkie zmienne środowiskowe ustawione w Vercel
- [ ] Webhook skonfigurowany w Stripe Dashboard
- [ ] URL webhook w Stripe jest poprawny
- [ ] `STRIPE_WEBHOOK_SECRET` w Vercel = Signing secret z Stripe
- [ ] Payment Link dla e-booka jest poprawny
- [ ] Plik `ebooks/original-ebook.pdf` istnieje
- [ ] Projekt przebudowany w Vercel po zmianach
- [ ] Test webhook wykonany (przez Stripe Dashboard lub prawdziwy zakup)

## 📞 Wsparcie

Jeśli coś nie działa:
1. Sprawdź logi w Vercel Dashboard → Functions → Logs
2. Sprawdź logi w Stripe Dashboard → Webhooks → Recent deliveries
3. Sprawdź logi w Resend Dashboard → Logs (jeśli email nie przychodzi)

---

**Gotowe! 🎉** System powinien teraz działać. Po zakupie e-booka, klient automatycznie otrzyma email z linkiem do pobrania.

