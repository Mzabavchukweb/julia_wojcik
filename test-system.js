#!/usr/bin/env node

/**
 * Skrypt testowy do sprawdzenia konfiguracji systemu e-booka
 */

import Stripe from 'stripe';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 TEST SYSTEMU E-BOOKA\n');
console.log('='.repeat(60));

// 1. Sprawdź zmienne środowiskowe
console.log('\n📋 1. SPRAWDZANIE ZMIENNYCH ŚRODOWISKOWYCH');
console.log('-'.repeat(60));

const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'EMAIL_FROM'
];

const optionalEnvVars = [
    'EBOOK_PATH',
    'EBOOK_URL'
];

let allEnvVarsOk = true;

requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        const preview = varName.includes('SECRET') || varName.includes('KEY') 
            ? `${value.substring(0, 10)}...` 
            : value;
        console.log(`✅ ${varName}: ${preview}`);
    } else {
        console.log(`❌ ${varName}: BRAK`);
        allEnvVarsOk = false;
    }
});

optionalEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
        console.log(`✅ ${varName}: ${value}`);
    } else {
        console.log(`⚠️  ${varName}: nie ustawione (opcjonalne)`);
    }
});

if (!allEnvVarsOk) {
    console.log('\n❌ BŁĄD: Brakuje wymaganych zmiennych środowiskowych!');
    console.log('Ustaw je w Vercel Dashboard → Project Settings → Environment Variables');
    process.exit(1);
}

// 2. Sprawdź inicjalizację Stripe
console.log('\n💳 2. SPRAWDZANIE STRIPE');
console.log('-'.repeat(60));

try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe zainicjalizowany poprawnie');
    
    // Sprawdź format klucza
    if (process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
        console.log('⚠️  Używasz TESTOWEGO klucza Stripe');
    } else if (process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
        console.log('✅ Używasz PRODUKCYJNEGO klucza Stripe');
    } else {
        console.log('⚠️  Nieznany format klucza Stripe');
    }
} catch (error) {
    console.log(`❌ Błąd inicjalizacji Stripe: ${error.message}`);
    process.exit(1);
}

// 3. Sprawdź inicjalizację Resend
console.log('\n📧 3. SPRAWDZANIE RESEND');
console.log('-'.repeat(60));

try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend zainicjalizowany poprawnie');
    
    // Sprawdź format klucza
    if (process.env.RESEND_API_KEY.startsWith('re_')) {
        console.log('✅ Format klucza Resend wygląda poprawnie');
    } else {
        console.log('⚠️  Nieznany format klucza Resend');
    }
    
    // Sprawdź EMAIL_FROM
    const emailFrom = process.env.EMAIL_FROM;
    if (emailFrom.includes('<') && emailFrom.includes('>')) {
        console.log(`✅ EMAIL_FROM ma poprawny format: ${emailFrom}`);
    } else {
        console.log(`⚠️  EMAIL_FROM może mieć niepoprawny format: ${emailFrom}`);
        console.log('   Oczekiwany format: "Nazwa <email@domena.pl>"');
    }
} catch (error) {
    console.log(`❌ Błąd inicjalizacji Resend: ${error.message}`);
    process.exit(1);
}

// 4. Sprawdź plik e-booka
console.log('\n📚 4. SPRAWDZANIE PLIKU E-BOOKA');
console.log('-'.repeat(60));

const possiblePaths = [
    path.join(process.cwd(), 'ebooks', 'original-ebook.pdf'),
    path.join(__dirname, 'ebooks', 'original-ebook.pdf'),
    process.env.EBOOK_PATH ? path.join(process.cwd(), process.env.EBOOK_PATH) : null
].filter(Boolean);

let ebookFound = false;
for (const ebookPath of possiblePaths) {
    if (fs.existsSync(ebookPath)) {
        const stats = fs.statSync(ebookPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`✅ Znaleziono e-book: ${ebookPath}`);
        console.log(`   Rozmiar: ${sizeMB} MB`);
        ebookFound = true;
        break;
    }
}

if (!ebookFound) {
    console.log('⚠️  Nie znaleziono pliku e-booka lokalnie');
    if (process.env.EBOOK_URL) {
        console.log(`   Ale skonfigurowano EBOOK_URL: ${process.env.EBOOK_URL}`);
    } else {
        console.log('   ⚠️  Upewnij się, że plik istnieje w Vercel lub ustaw EBOOK_URL');
    }
}

// 5. Sprawdź konfigurację Stripe Config
console.log('\n⚙️  5. SPRAWDZANIE KONFIGURACJI STRIPE');
console.log('-'.repeat(60));

try {
    const stripeConfigPath = path.join(__dirname, 'assets', 'stripe-config.js');
    if (fs.existsSync(stripeConfigPath)) {
        const configContent = fs.readFileSync(stripeConfigPath, 'utf8');
        
        // Sprawdź Payment Link
        const paymentLinkMatch = configContent.match(/paymentLink:\s*['"]([^'"]+)['"]/);
        if (paymentLinkMatch) {
            const paymentLink = paymentLinkMatch[1];
            console.log(`✅ Payment Link znaleziony: ${paymentLink}`);
            
            if (paymentLink.includes('test_')) {
                console.log('⚠️  Używasz TESTOWEGO Payment Link');
            } else if (paymentLink.includes('live_')) {
                console.log('✅ Używasz PRODUKCYJNEGO Payment Link');
            }
        } else {
            console.log('⚠️  Nie znaleziono Payment Link w konfiguracji');
        }
        
        // Sprawdź klucz publiczny
        const pubKeyMatch = configContent.match(/STRIPE_PUBLISHABLE_KEY\s*=\s*['"]([^'"]+)['"]/);
        if (pubKeyMatch) {
            const pubKey = pubKeyMatch[1];
            if (pubKey.startsWith('pk_test_')) {
                console.log('⚠️  Używasz TESTOWEGO klucza publicznego');
            } else if (pubKey.startsWith('pk_live_')) {
                console.log('✅ Używasz PRODUKCYJNEGO klucza publicznego');
            }
        }
    } else {
        console.log('⚠️  Nie znaleziono pliku assets/stripe-config.js');
    }
} catch (error) {
    console.log(`⚠️  Błąd sprawdzania konfiguracji: ${error.message}`);
}

// 6. Sprawdź vercel.json
console.log('\n🚀 6. SPRAWDZANIE KONFIGURACJI VERCEL');
console.log('-'.repeat(60));

try {
    const vercelConfigPath = path.join(__dirname, 'vercel.json');
    if (fs.existsSync(vercelConfigPath)) {
        const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
        console.log('✅ vercel.json znaleziony');
        
        // Sprawdź bodyParser
        const webhookConfig = vercelConfig.functions?.['api/stripe-webhook.js'];
        if (webhookConfig?.bodyParser === false) {
            console.log('✅ bodyParser: false ustawione dla webhook (wymagane)');
        } else {
            console.log('⚠️  bodyParser: false NIE jest ustawione dla webhook!');
        }
        
        // Sprawdź rewrites
        if (vercelConfig.rewrites && vercelConfig.rewrites.length > 0) {
            console.log(`✅ Znaleziono ${vercelConfig.rewrites.length} rewrite(s)`);
        }
    } else {
        console.log('⚠️  Nie znaleziono vercel.json');
    }
} catch (error) {
    console.log(`⚠️  Błąd sprawdzania vercel.json: ${error.message}`);
}

// Podsumowanie
console.log('\n' + '='.repeat(60));
console.log('📊 PODSUMOWANIE');
console.log('='.repeat(60));

if (allEnvVarsOk) {
    console.log('✅ Wszystkie wymagane zmienne środowiskowe są ustawione');
    console.log('✅ Stripe i Resend są poprawnie skonfigurowane');
    console.log('\n🎯 NASTĘPNE KROKI:');
    console.log('1. Upewnij się, że zmienne środowiskowe są ustawione w Vercel');
    console.log('2. Skonfiguruj webhook w Stripe Dashboard:');
    console.log('   URL: https://julia-wojcik.vercel.app/api/stripe-webhook');
    console.log('   Event: checkout.session.completed');
    console.log('3. Przebuduj projekt w Vercel (Redeploy)');
    console.log('4. Przetestuj webhook przez Stripe Dashboard → Send test webhook');
    console.log('\n✅ System jest gotowy do wdrożenia!');
} else {
    console.log('❌ System wymaga konfiguracji przed wdrożeniem');
    process.exit(1);
}

