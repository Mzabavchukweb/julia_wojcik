# 📚 Folder na e-booki

## Plik PDF z e-bookiem

Plik: `original-ebook.pdf` ✅ (znaleziony i przeniesiony z głównego folderu)

**Ważne:**
- Plik jest już w tym folderze
- Nazwa pliku: `original-ebook.pdf`
- Plik będzie automatycznie wysyłany klientom po zakupie przez Stripe

## Jak dodać plik?

1. Umieść swój plik PDF w tym folderze
2. Zmień nazwę na `original-ebook.pdf`
3. Wdróż na Netlify/Vercel

## Alternatywa: Przechowywanie w chmurze

Jeśli plik PDF jest zbyt duży lub chcesz użyć zewnętrznego storage:

1. Prześlij PDF do S3, Cloudinary lub innego storage
2. Zaktualizuj funkcję `stripe-webhook.js` aby pobierała PDF z URL zamiast z lokalnego pliku
3. Dodaj URL do zmiennych środowiskowych: `EBOOK_URL=https://...`

