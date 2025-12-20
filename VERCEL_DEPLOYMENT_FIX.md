# 🔧 Rozwiązywanie błędów deploymentu Vercel

## 📋 Najczęstsze przyczyny błędów

### 1. Problem z Vercel KV (opcjonalne, ale może powodować błędy)

**Rozwiązanie:**
- Vercel Dashboard → **Storage** → **KV**
- Utwórz nową bazę KV (jeśli nie masz)
- Kod ma fallback do pamięci, więc to nie powinno blokować deploymentu

### 2. Problem z zależnościami

**Sprawdź:**
- Czy wszystkie zależności są w `package.json` ✅
- Vercel automatycznie instaluje zależności z `package.json`

### 3. Problem z plikiem ebooka

**Sprawdź:**
- Czy plik `ebooks/original-ebook.pdf` istnieje w repo ✅
- Vercel musi mieć dostęp do tego pliku

### 4. Problem z konfiguracją funkcji

**Sprawdź `vercel.json`:**
```json
{
  "functions": {
    "api/stripe-webhook.js": {
      "maxDuration": 30,
      "bodyParser": false
    },
    "api/download-ebook.js": {
      "maxDuration": 30
    }
  }
}
```

## 🔍 Jak sprawdzić szczegóły błędu

1. **Vercel Dashboard:**
   - Przejdź do **Deployments**
   - Kliknij na failed deployment (czerwony)
   - Sprawdź **Build Logs** - tam będzie szczegółowy błąd

2. **Typowe błędy:**
   - `Module not found` - brakująca zależność
   - `Cannot find file` - brakujący plik
   - `Syntax error` - błąd w kodzie
   - `Environment variable not found` - brakująca zmienna (ale to nie powinno blokować builda)

## ✅ Szybkie rozwiązanie

### Opcja 1: Sprawdź Build Logs
1. Vercel Dashboard → **Deployments**
2. Kliknij na failed deployment
3. Sprawdź **Build Logs** - skopiuj błąd i wyślij mi

### Opcja 2: Sprawdź czy plik ebooka jest w repo
```bash
git ls-files | grep ebook
```

### Opcja 3: Sprawdź czy wszystkie pliki są w repo
```bash
git status
```

## 🚀 Alternatywne rozwiązanie

Jeśli problem jest z Vercel KV, możesz tymczasowo wyłączyć jego użycie:

1. W `api/stripe-webhook.js` i `api/download-ebook.js`
2. Zakomentuj import: `// import { kv } from '@vercel/kv';`
3. Kod użyje fallback do pamięci (działa, ale tokeny nie będą trwałe)

**UWAGA:** To nie jest zalecane dla produkcji, ale pozwoli sprawdzić czy problem jest z KV.

---

**Najważniejsze:** Sprawdź **Build Logs** w Vercel Dashboard - tam będzie dokładny błąd!

