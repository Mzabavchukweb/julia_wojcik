/**
 * KONFIGURACJA STRIPE - Payment Links
 * 
 * ⚠️ WAŻNE - PRZED URUCHOMIENIEM PRODUKCYJNYM:
 * 1. Zamień klucz TESTOWY (pk_test_...) na LIVE (pk_live_...)
 *    Stripe Dashboard → Developers → API keys → Reveal live key
 * 
 * 2. Utwórz Payment Links dla szkoleń:
 *    - Stripe Dashboard → Products → Payment links → Create payment link
 *    - Dla każdego szkolenia utwórz osobny link
 *    - Skopiuj URL (format: https://buy.stripe.com/...)
 *    - Wklej poniżej zamiast 'YOUR_PAYMENT_LINK_URL_X'
 * 
 * 3. Ustaw zmienne środowiskowe w Vercel:
 *    - STRIPE_SECRET_KEY (sk_live_... dla produkcji)
 *    - STRIPE_WEBHOOK_SECRET (whsec_...)
 *    - RESEND_API_KEY (re_...)
 *    - EMAIL_FROM (Julia Wójcik <ebook@juliawojcikszkolenia.pl>)
 *    - EBOOK_PATH (./ebooks/original-ebook.pdf)
 */

// Klucz publiczny Stripe (obecnie TESTOWY - zamień na LIVE przed produkcją)
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SPWPwHvQAfHQpRpUHNaKsezd0bPrqfTS1veqzZrP6bcmQSKEOWfU4qDPWc4GEilBSodrnK8yxrnjNGArD5Mb8HD001l7jF61l';
// Tylko jedno szkolenie z Payment Link
const courses = [
    {
        id: 'course_1',
        name: 'Podstawowy Kurs Stylizacji Paznokci',
        price: 899,
        paymentLink: 'https://buy.stripe.com/3cI5kFa4P9bA6YT8a0eAg00',
        description: 'Kompleksowy kurs podstaw stylizacji paznokci. Idealny dla początkujących.',
        features: [
            '8 godzin praktycznych zajęć',
            'Materiały wliczone w cenę',
            'Certyfikat ukończenia',
            'Maksymalnie 6 osób w grupie',
            'Wsparcie po kursie'
        ]
    }
];

// Renderowanie kursów na stronie
document.addEventListener('DOMContentLoaded', function() {
    const coursesGrid = document.getElementById('courses-grid');
    
    if (coursesGrid) {
        courses.forEach(course => {
            const courseCard = createCourseCard(course);
            coursesGrid.appendChild(courseCard);
        });
    }
});

// Tworzenie karty kursu
function createCourseCard(course) {
    const card = document.createElement('div');
    card.className = 'course-card';
    
    const hasPaymentLink = course.paymentLink && !course.paymentLink.includes('YOUR_PAYMENT_LINK_URL');
    
    card.innerHTML = `
        <h3>${course.name}</h3>
        <div class="course-price">${course.price} zł</div>
        <p class="course-description">${course.description}</p>
        <ul class="course-features">
            ${course.features.map(feature => `<li>${feature}</li>`).join('')}
        </ul>
        ${hasPaymentLink 
            ? `<a href="${course.paymentLink}" target="_blank" class="btn btn-primary btn-buy">Kup teraz</a>`
            : `<button class="btn btn-primary btn-buy" onclick="contactAboutCourse('${course.name}')">Skontaktuj się</button>`
        }
    `;
    
    return card;
}

// Funkcja wywoływana, gdy Payment Link nie jest skonfigurowany
function contactAboutCourse(courseName) {
    const message = `Chciałabym dowiedzieć się więcej o kursie: ${courseName}`;
    window.location.href = `pages/kontakt.html?course=${encodeURIComponent(courseName)}&message=${encodeURIComponent(message)}`;
}

// Konfiguracja e-booka
const ebook = {
    id: 'ebook_1',
    name: 'E-book - Kompletny przewodnik po stylizacji paznokci',
    price: 279, // Cena przeceniona w złotych
    regularPrice: 349, // Cena regularna w złotych
    paymentLink: 'https://buy.stripe.com/3cI5kFa4P9bA6YT8a0eAg00',
    description: 'Kompleksowy przewodnik po stylizacji paznokci. Sprawdzone techniki, schematy i praktyczne wskazówki.',
    format: 'PDF',
    access: 'na zawsze',
    features: [
        'Sprawdzone techniki i schematy',
        'Praktyczne wskazówki i porady',
        'Ilustracje i przykłady',
        'Dostęp na zawsze',
        'Format PDF - idealny do czytania na telefonie, tablecie i laptopie',
        'Możliwość wydruku'
    ]
};

// Inicjalizacja e-booka na stronie ebook.html
document.addEventListener('DOMContentLoaded', function() {
    const ebookBuyBtn = document.getElementById('ebook-buy-btn');
    const ebookBuySection = document.getElementById('ebook-buy-section');
    const priceValue = document.querySelector('.price-value');
    
    if (ebookBuyBtn && ebookBuySection) {
        const hasPaymentLink = ebook.paymentLink && !ebook.paymentLink.includes('YOUR_EBOOK_PAYMENT_LINK_URL');
        
        if (hasPaymentLink) {
            // E-book jest dostępny do zakupu
            if (priceValue) {
                // Pokaż przecenę z przekreśloną regularną ceną
                const priceContainer = priceValue.closest('.ebook-price');
                if (priceContainer && ebook.regularPrice) {
                    priceValue.innerHTML = `<span class="price-regular" style="text-decoration: line-through; opacity: 0.6; margin-right: 8px;">${ebook.regularPrice} zł</span><span class="price-sale" style="color: #C5A572; font-weight: 600;">${ebook.price} zł</span>`;
                } else {
                priceValue.textContent = `${ebook.price} zł`;
                }
            }
            
            ebookBuyBtn.disabled = false;
            ebookBuyBtn.innerHTML = '<span>Kup teraz</span><span class="btn-arrow">→</span>';
            ebookBuyBtn.classList.remove('disabled');
            
            ebookBuyBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (ebook.paymentLink) {
                    // Otwórz w nowej karcie, żeby użytkownik mógł wrócić
                    window.open(ebook.paymentLink, '_blank');
                }
            });
        } else {
            // E-book nie jest jeszcze skonfigurowany
            if (priceValue) {
                priceValue.textContent = 'Wkrótce';
            }
            ebookBuyBtn.disabled = true;
            ebookBuyBtn.innerHTML = '<span>Dostępny wkrótce</span>';
        }
    }
});


