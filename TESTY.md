# 🧪 Testy webhooka Stripe

## Test lokalny

Uruchom lokalny serwer, a potem test:

```bash
# Terminal 1: Uruchom serwer lokalny
npm run dev

# Terminal 2: Uruchom test
npm run test:webhook
```

Lub:

```bash
node test-webhook-local.js
```

## Test na Vercel (produkcja)

```bash
# Ustaw URL webhooka (opcjonalnie)
export VERCEL_WEBHOOK_URL=https://julia-wojcik.vercel.app/api/stripe-webhook

# Ustaw email testowy (opcjonalnie)
export TEST_EMAIL=juliajula08@icloud.com

# Uruchom test
npm run test:vercel
```

Lub:

```bash
node test-webhook-vercel.js
```

## Co testuje?

Testy sprawdzają:
1. ✅ Czy webhook endpoint odpowiada
2. ✅ Czy event `checkout.session.completed` jest przetwarzany
3. ✅ Czy token jest generowany
4. ✅ Czy email jest wysyłany (jeśli Resend jest skonfigurowany)
5. ✅ Czy download URL jest tworzony

## Oczekiwane wyniki

### Sukces:
```
✅ Webhook został przetworzony pomyślnie!
✅✅✅ SUKCES! ✅✅✅
📧 Email został wysłany!
🔗 Download URL: https://julia-wojcik.vercel.app/api/download-ebook?token=...
```

### Błędy:
- `400 Bad Request` - Problem z weryfikacją podpisu lub formatem body
- `500 Internal Server Error` - Błąd w kodzie funkcji
- `Email nie został wysłany` - Problem z Resend API Key lub konfiguracją

