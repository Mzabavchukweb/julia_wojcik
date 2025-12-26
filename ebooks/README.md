# 📚 Folder na e-booki

## ⚠️ WAŻNE - Konfiguracja e-booka

**Problem:** Plik lokalny `original-ebook.pdf` ma tylko 456 bajtów - to jest pusty/testowy plik!

**Rozwiązanie:** Użyj zmiennej środowiskowej `EBOOK_URL` w Vercel.

## Jak skonfigurować prawdziwy e-book?

### Opcja 1: Przechowywanie w chmurze (ZALECANE)

1. **Prześlij PDF do chmury:**
   - **Cloudinary** (darmowe): https://cloudinary.com
   - **AWS S3** (płatne)
   - **Google Cloud Storage** (płatne)
   - **Vercel Blob Storage** (płatne)

2. **Uzyskaj publiczny URL do pliku PDF**

3. **Dodaj do Vercel Environment Variables:**
   - Idź do: Vercel Dashboard → Project → Settings → Environment Variables
   - Dodaj: `EBOOK_URL` = `https://twoj-url-do-pdf.pdf`
   - Wybierz: All Environments (Production, Preview, Development)
   - Kliknij: Save

4. **Redeploy projekt** (Vercel automatycznie użyje nowej zmiennej)

### Opcja 2: Lokalny plik (nie działa w Vercel)

⚠️ **UWAGA:** Vercel Serverless Functions nie mają dostępu do plików statycznych w runtime!

Jeśli chcesz użyć lokalnego pliku:
1. Umieść **prawdziwy** plik PDF w folderze `ebooks/`
2. Nazwa: `original-ebook.pdf`
3. Plik musi mieć **minimum 1KB** (obecny ma tylko 456 bajtów - za mały!)

## Weryfikacja

Po konfiguracji sprawdź logi w Vercel:
- Vercel Dashboard → Deployments → Functions → `download-ebook` → Logs
- Powinno być: `✅ Fetched PDF from URL, size: [rozmiar] bytes`

## Aktualny stan

- ❌ Lokalny plik: `original-ebook.pdf` (456 bajtów - za mały!)
- ✅ Kod obsługuje `EBOOK_URL` (priorytet 1)
- ✅ Kod sprawdza rozmiar pliku (minimum 1KB)
- ✅ Kod weryfikuje magic bytes PDF (`%PDF`)

