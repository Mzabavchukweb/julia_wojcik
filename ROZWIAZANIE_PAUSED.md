# 🚨 Problem: Netlify Project Paused

## Problem
Twój projekt w Netlify jest **wstrzymany** z powodu przekroczenia limitu kredytów. To dlatego webhook zwraca 404 - funkcje nie działają, gdy projekt jest wstrzymany.

## ✅ Rozwiązania

### Opcja 1: Upgrade planu (NAJSZYBSZE)
1. W Netlify Dashboard kliknij **"Upgrade team"** (w czerwonym bannerze)
2. Wybierz plan płatny
3. Projekt zostanie automatycznie wznowiony
4. Funkcje zaczną działać natychmiast

### Opcja 2: Włącz auto-recharge (jeśli masz plan płatny)
1. Netlify Dashboard → **Usage & billing**
2. Kliknij **"Configure auto recharge"**
3. Ustaw limit i włącz auto-recharge
4. Projekt zostanie wznowiony

### Opcja 3: Poczekaj do nowego miesiąca
- Projekty wznawiają się automatycznie na początku nowego cyklu rozliczeniowego
- Limity resetują się co miesiąc

## 📋 Po wznowieniu projektu

### 1. Zaktualizuj URL webhook w Stripe

**Twój Netlify subdomain:**
```
julia-wojcik-szkolenia.netlify.app
```

**URL webhook w Stripe powinien być:**
```
https://julia-wojcik-szkolenia.netlify.app/.netlify/functions/stripe-webhook
```

**Jak zaktualizować:**
1. Stripe Dashboard → Webhooks → ebook-webhook
2. Kliknij na webhook
3. Kliknij "Edit destination"
4. Zmień URL na: `https://julia-wojcik-szkolenia.netlify.app/.netlify/functions/stripe-webhook`
5. Zapisz

### 2. Sprawdź czy funkcja jest wdrożona

**Netlify Dashboard → Functions:**
- Powinieneś zobaczyć funkcję `stripe-webhook`
- Jeśli nie widzisz, wymuś redeploy:
  - Deploys → "Trigger deploy" → "Deploy site"

### 3. Przetestuj webhook

**Stripe Dashboard → Webhooks → ebook-webhook:**
1. Kliknij "Send test event"
2. Wybierz `checkout.session.completed`
3. Kliknij "Send test webhook"
4. Sprawdź status - powinien być **200 OK**

## ⚠️ Ważne

- **Funkcje nie działają, gdy projekt jest wstrzymany**
- **Webhook będzie zwracał 404, dopóki projekt nie zostanie wznowiony**
- **Po wznowieniu, funkcje zaczną działać automatycznie**

## 💡 Alternatywa (tylko do testów)

Możesz użyć **Netlify Dev** do testowania lokalnie, nawet gdy projekt jest wstrzymany:

```bash
netlify dev
```

To uruchomi lokalny serwer z funkcjami, ale to tylko do testów lokalnych - nie rozwiąże problemu z produkcją.

