# 🔍 Sprawdzanie Vercel KV

## Problem
Token jest generowany, ale nie można go odczytać podczas pobierania ebooka.

## Przyczyna
Prawdopodobnie Vercel KV nie jest włączone/skonfigurowane.

## Sprawdź czy Vercel KV jest włączone

1. Vercel Dashboard → Projekt "julia-wojcik"
2. Przejdź do **Storage**
3. Sprawdź czy jest **KV** database

## Jeśli NIE ma KV:

### Opcja 1: Utwórz Vercel KV (ZALECANE)

1. Vercel Dashboard → **Storage** → **Create Database**
2. Wybierz **KV**
3. Nadaj nazwę (np. "julia-wojcik-kv")
4. Wybierz region (np. "Washington, D.C. (iad1)")
5. Kliknij **Create**
6. **Przebuduj projekt** (Redeploy)

### Opcja 2: Użyj alternatywnego rozwiązania

Jeśli nie chcesz używać Vercel KV, mogę przygotować rozwiązanie używające:
- Upstash Redis (bezpłatna alternatywa)
- Lub prostszy system bez trwałego storage (token w URL + email verification)

## Sprawdź logi w Vercel

1. Vercel Dashboard → Projekt → **Logs**
2. Filtry: Timeline "Last hour", wszystkie poziomy
3. Szukaj:
   - `Token saved to Vercel KV` ✅ (jeśli widzisz to, KV działa)
   - `Vercel KV not available` ❌ (jeśli widzisz to, KV nie działa)
   - `Token verification: Can read token back` ✅ (jeśli widzisz to, wszystko OK)

## Najszybsze rozwiązanie:

**Utwórz Vercel KV database** - to zajmie 2 minuty i rozwiąże problem.

