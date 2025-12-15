// Konfiguracja Stripe - Payment Links (działa na statycznych stronach bez backendu)
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SPWPwHvQAfHQpRpUHNaKsezd0bPrqfTS1veqzZrP6bcmQSKEOWfU4qDPWc4GEilBSodrnK8yxrnjNGArD5Mb8HD001l7jF61l';

const courses = [
    {
        id: 'course_1',
        name: 'Podstawowy Kurs Stylizacji Paznokci',
        price: 899,
        paymentLink: 'YOUR_PAYMENT_LINK_URL_1', // Zastąp linkiem Payment Link ze Stripe
        description: 'Kompleksowy kurs podstaw stylizacji paznokci. Idealny dla początkujących.',
        features: [
            '8 godzin praktycznych zajęć',
            'Materiały wliczone w cenę',
            'Certyfikat ukończenia',
            'Maksymalnie 6 osób w grupie',
            'Wsparcie po kursie'
        ]
    },
    {
        id: 'course_2',
        name: 'Zaawansowany Kurs Korekty i Perfekcyjnego Kwadratu',
        price: 1299,
        paymentLink: 'YOUR_PAYMENT_LINK_URL_2', // Zastąp linkiem Payment Link ze Stripe
        description: 'Skup się na perfekcyjnym kwadracie i profesjonalnej korekcie - moim koniku!',
        features: [
            '10 godzin intensywnych zajęć',
            'Praca nad detalami',
            'Analiza błędów',
            'Indywidualne podejście',
            'Materiały premium wliczone',
            'Certyfikat zaawansowany'
        ]
    },
    {
        id: 'course_3',
        name: 'Kurs Master - Pełna Metamorfoza',
        price: 1999,
        paymentLink: 'YOUR_PAYMENT_LINK_URL_3', // Zastąp linkiem Payment Link ze Stripe
        description: 'Najbardziej kompleksowy kurs. Twórz metamorfozy nie do poznania!',
        features: [
            '16 godzin szkolenia',
            'Wszystkie techniki i schematy',
            'Opcja powtórki gratis',
            'Premium materiały',
            'Maksymalnie 4 osoby w grupie',
            'Certyfikat Master',
            'Dożywotnie wsparcie'
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
    price: 300, // Cena w złotych
    priceId: 'price_1Seg6hHvQAfHQpRp8iXtRfi9', // Price ID z Stripe
    paymentLink: null, // Używamy Price ID zamiast Payment Link
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
        // Sprawdź czy mamy Price ID lub Payment Link
        const hasPriceId = ebook.priceId && ebook.priceId.startsWith('price_');
        const hasPaymentLink = ebook.paymentLink && !ebook.paymentLink.includes('YOUR_EBOOK_PAYMENT_LINK_URL');
        
        if (hasPriceId || hasPaymentLink) {
            // E-book jest dostępny do zakupu
            if (priceValue) {
                priceValue.textContent = `${ebook.price} zł`;
            }
            
            ebookBuyBtn.disabled = false;
            ebookBuyBtn.innerHTML = '<span>Kup teraz</span><span class="btn-arrow">→</span>';
            ebookBuyBtn.classList.remove('disabled');
            
            ebookBuyBtn.addEventListener('click', function(e) {
                e.preventDefault();
                
                if (hasPriceId) {
                    // Użyj Stripe Checkout z Price ID
                    if (typeof Stripe !== 'undefined') {
                        const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
                        stripe.redirectToCheckout({
                            lineItems: [{
                                price: ebook.priceId,
                                quantity: 1,
                            }],
                            mode: 'payment',
                            successUrl: window.location.origin + '/pages/ebook.html?success=true',
                            cancelUrl: window.location.origin + '/pages/ebook.html?canceled=true',
                        }).then(function (result) {
                            if (result.error) {
                                alert(result.error.message);
                            }
                        });
                    } else {
                        // Fallback: użyj Payment Link jeśli dostępny
                        if (hasPaymentLink) {
                            window.open(ebook.paymentLink, '_blank');
                        }
                    }
                } else if (hasPaymentLink) {
                    // Otwórz Payment Link w nowej karcie
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


