# Instrukcja konfiguracji Stripe

## Jak skonfigurować płatności za kursy?

### Krok 1: Utwórz produkty w Stripe

1. Zaloguj się do [Stripe Dashboard](https://dashboard.stripe.com)
2. Przejdź do sekcji **"Products"** w menu bocznym
3. Kliknij **"+ Add product"**

### Krok 2: Dodaj szczegóły kursu

Dla każdego kursu wypełnij:
- **Name**: Nazwa kursu (np. "Podstawowy Kurs Stylizacji Paznokci")
- **Description**: Opis kursu
- **Price**: Cena w PLN (np. 899 zł)
- **Billing**: One time

### Krok 3: Utwórz Payment Link

1. Po utworzeniu produktu, znajdź go na liście produktów
2. Kliknij na produkt
3. W sekcji **"Payment links"** kliknij **"Create payment link"**
4. Skonfiguruj opcje (możesz pozostawić domyślne)
5. Kliknij **"Create link"**
6. **Skopiuj URL** Payment Link (np. `https://buy.stripe.com/test_...`)

### Krok 4: Dodaj linki do pliku stripe-config.js

1. Otwórz plik `stripe-config.js`
2. Znajdź odpowiedni kurs w tablicy `courses`
3. Zastąp `YOUR_PAYMENT_LINK_URL_1`, `YOUR_PAYMENT_LINK_URL_2`, etc. rzeczywistymi linkami z Stripe

**Przykład:**

```javascript
{
    id: 'course_1',
    name: 'Podstawowy Kurs Stylizacji Paznokci',
    price: 899,
    paymentLink: 'https://buy.stripe.com/test_aBcDeFgHiJkLmNoPqRs', // Twój link
    // ...
}
```

### Krok 5: Przetestuj

1. Otwórz stronę `szkolenia.html` w przeglądarce
2. Kliknij "Kup teraz" przy dowolnym kursie
3. Powinieneś zostać przekierowany do Stripe Checkout

## Uwagi

- Używaj **test mode** w Stripe do testowania (klucze zaczynają się od `pk_test_` i `sk_test_`)
- Przed przejściem na produkcję, upewnij się, że używasz **live mode** (klucze zaczynają się od `pk_live_` i `sk_live_`)
- Payment Links działają bez potrzeby konfiguracji backendu - idealne dla statycznych stron!

## Pomoc

Jeśli masz problemy z konfiguracją, sprawdź:
- [Dokumentację Stripe Payment Links](https://stripe.com/docs/payments/payment-links)
- [Stripe Dashboard](https://dashboard.stripe.com)


