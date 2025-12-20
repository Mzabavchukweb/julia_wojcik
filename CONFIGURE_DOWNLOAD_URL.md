# 🔗 Konfiguracja URL do pobrania ebooka

## Problem
Link do pobrania ebooka może wskazywać na deployment URL zamiast publicznego URL, co może wymagać logowania.

## Rozwiązanie

Kod używa teraz głównego publicznego URL: `https://julia-wojcik.vercel.app`

## Jeśli masz custom domain (np. juliawojcikszkolenia.pl)

Możesz dodać zmienną środowiskową w Vercel:

1. Vercel Dashboard → Project Settings → Environment Variables
2. Dodaj nową zmienną:
   - **Key:** `PUBLIC_URL`
   - **Value:** `https://juliawojcikszkolenia.pl` (lub twoja domena)
   - **Environment:** Production, Preview, Development (zaznacz wszystkie)
3. Zapisz i zrób Redeploy

## Priorytet URL:

1. `PUBLIC_URL` (jeśli jest ustawiony)
2. `NEXT_PUBLIC_URL` (jeśli jest ustawiony)
3. `https://julia-wojcik.vercel.app` (domyślny - publiczny, nie wymaga logowania)

## Weryfikacja

Endpoint `/api/download-ebook` jest **publiczny** i **nie wymaga logowania** - każdy z prawidłowym tokenem może pobrać ebook.

Test:
1. Otwórz link w trybie incognito (bez logowania)
2. Link powinien działać bezpośrednio

