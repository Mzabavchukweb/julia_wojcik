# Instrukcja: Netlify Dev - Lokalne środowisko deweloperskie

## Problem: "Project has been paused"

Twój projekt na Netlify został wstrzymany, ponieważ przekroczył limity darmowego planu (build minutes, bandwidth, etc.).

### Rozwiązania:

1. **Poczekaj do nowego cyklu rozliczeniowego** (projekty wznowią się automatycznie)
2. **Włącz auto-recharge** (dla planów płatnych) - Netlify Dashboard → Usage & billing → Configure auto recharge
3. **Zaktualizuj plan** na wyższy - Netlify Dashboard → Usage & billing → Change plan

**Uwaga:** Wstrzymany projekt nie blokuje lokalnego rozwoju! Możesz używać `netlify dev` do testowania funkcji lokalnie.

---

## Krok 1: Zaloguj się do Netlify CLI

```bash
netlify login
```

Lub użyj skryptu npm:
```bash
npm run netlify:login
```

To otworzy przeglądarkę, gdzie zalogujesz się do Netlify.

---

## Krok 2: Połącz projekt z Netlify (jeśli jeszcze nie jest połączony)

```bash
netlify link
```

Wybierz istniejący projekt lub utwórz nowy.

---

## Krok 3: Uruchom lokalne środowisko deweloperskie

```bash
netlify dev
```

Lub użyj skryptu npm:
```bash
npm run dev
```

### Co robi `netlify dev`:

- ✅ Uruchamia lokalny serwer deweloperski
- ✅ Emuluje Netlify Functions lokalnie
- ✅ Emuluje Netlify Blobs lokalnie (w pamięci)
- ✅ Przekierowuje zmienne środowiskowe z Netlify
- ✅ Umożliwia debugowanie z pełnymi logami błędów

### Domyślny port:

- **Frontend:** http://localhost:8888
- **Functions:** http://localhost:8888/.netlify/functions/

---

## Krok 4: Testowanie funkcji lokalnie

### Test webhook Stripe:

1. Użyj narzędzia do testowania webhooków (np. Stripe CLI lub ngrok)
2. Webhook będzie dostępny pod: `http://localhost:8888/.netlify/functions/stripe-webhook`

### Test pobierania e-booka:

1. Wygeneruj token (przez webhook lub ręcznie)
2. Otwórz: `http://localhost:8888/.netlify/functions/download-ebook?token=TWÓJ_TOKEN`

---

## Zmienne środowiskowe

Upewnij się, że masz ustawione wszystkie wymagane zmienne środowiskowe:

### W Netlify Dashboard:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EBOOK_PATH` (opcjonalnie)
- `EBOOK_URL` (opcjonalnie)

### Lokalnie (plik `.env`):

Utwórz plik `.env` w katalogu głównym projektu:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
EMAIL_FROM=Julia Wójcik <ebook@juliawojcikszkolenia.pl>
EBOOK_PATH=./ebooks/original-ebook.pdf
```

**Uwaga:** Plik `.env` powinien być w `.gitignore` (nie commituj go do repozytorium!)

---

## Debugowanie

### Logi funkcji:

Wszystkie `console.log()` i `console.error()` będą widoczne w terminalu, gdzie uruchomiono `netlify dev`.

### Sprawdzanie statusu projektu:

```bash
netlify status
```

Lub:
```bash
npm run netlify:status
```

---

## Ważne uwagi

1. **Netlify Blobs lokalnie:** W trybie dev, Blobs są przechowywane w pamięci - dane znikną po zakończeniu `netlify dev`

2. **Functions API v2:** Upewnij się, że używasz Functions API v2 (już zaimplementowane w kodzie)

3. **Plik PDF:** Upewnij się, że plik `ebooks/original-ebook.pdf` istnieje lokalnie

4. **Porty:** Jeśli port 8888 jest zajęty, Netlify automatycznie użyje innego portu

---

## Rozwiązywanie problemów

### Błąd: "MissingBlobsEnvironmentError"
- Upewnij się, że używasz Functions API v2
- Sprawdź, czy `context.netlify` jest dostępne

### Błąd: "Function not found"
- Sprawdź, czy pliki funkcji są w `netlify/functions/`
- Sprawdź, czy używasz `export default` (v2 API)

### Błąd: "PDF not found"
- Sprawdź ścieżkę do pliku PDF
- Ustaw zmienną środowiskową `EBOOK_PATH`

---

## Przydatne komendy

```bash
# Zaloguj się
netlify login

# Sprawdź status
netlify status

# Połącz projekt
netlify link

# Uruchom dev server
netlify dev

# Zobacz logi z produkcji
netlify functions:list
netlify functions:invoke stripe-webhook

# Otwórz dashboard Netlify
netlify open
```

---

## Dokumentacja

- [Netlify Dev Documentation](https://docs.netlify.com/cli/get-started/)
- [Netlify Functions v2](https://docs.netlify.com/functions/overview/)
- [Netlify Blobs](https://docs.netlify.com/storage/blobs/overview/)

