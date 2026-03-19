/**
 * KONFIGURACJA STRIPE - Payment Links + System Premiery
 * 
 * PREMIERA: 19 marca 2026, godz. 19:00 CET
 * - Przed premierą: przycisk zablokowany, countdown timer
 * - Po premierze: przycisk aktywny, cena 299 zł
 * - Payment link pobierany z serwera (nie widoczny w kodzie źródłowym!)
 */

// Klucz publiczny Stripe (obecnie TESTOWY - zamień na LIVE przed produkcją)
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SPWPwHvQAfHQpRpUHNaKsezd0bPrqfTS1veqzZrP6bcmQSKEOWfU4qDPWc4GEilBSodrnK8yxrnjNGArD5Mb8HD001l7jF61l';

// Konfiguracja kursów (bez zmian)
const courses = [
    {
        id: 'course_1',
        name: 'Podstawowy Kurs Stylizacji Paznokci',
        price: 899,
        paymentLink: 'https://buy.stripe.com/fZucN7el587w3MH8a0eAg02',
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

// ===== SYSTEM PREMIERY E-BOOKA =====

// Konfiguracja e-booka (BEZ payment link - pobierany z serwera!)
const ebook = {
    id: 'ebook_1',
    name: 'E-book - Podstawy hybrydowe ze wzmocnieniem',
    price: 299,
    description: 'Kompleksowy przewodnik po stylizacji paznokci.',
    format: 'PDF',
    access: 'na zawsze'
};

// Czas premiery: 19 marca 2026, godz. 19:00 CET (UTC+1)
const PREMIERE_TIME = new Date('2026-03-19T18:00:00.000Z').getTime();

// Inicjalizacja systemu premiery na stronie ebook.html
document.addEventListener('DOMContentLoaded', function() {
    const ebookBuyBtn = document.getElementById('ebook-buy-btn');
    const ebookBuySection = document.getElementById('ebook-buy-section');
    const countdownSection = document.getElementById('premiere-countdown');
    const priceValue = document.querySelector('.price-value');
    
    if (!ebookBuyBtn || !ebookBuySection) return;
    
    // Sprawdź status premiery z serwera
    checkPremiereStatus(ebookBuyBtn, ebookBuySection, countdownSection, priceValue);
});

async function checkPremiereStatus(buyBtn, buySection, countdownSection, priceValue) {
    try {
        const response = await fetch('/api/get-payment-link');
        const data = await response.json();
        
        if (data.locked) {
            // PRZED PREMIERĄ
            showPremiereCountdown(buyBtn, buySection, countdownSection, priceValue, data);
        } else {
            // PO PREMIERZE
            activateBuyButton(buyBtn, priceValue, data);
            if (countdownSection) {
                countdownSection.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Błąd sprawdzania premiery:', error);
        // W razie błędu - fallback na sprawdzenie czasu lokalnego
        const now = Date.now();
        if (now < PREMIERE_TIME) {
            showPremiereCountdown(buyBtn, buySection, countdownSection, priceValue, {
                premiereTime: PREMIERE_TIME,
                serverTime: now,
                timeRemaining: PREMIERE_TIME - now
            });
        } else {
            // Spróbuj ponownie po 3 sekundach
            setTimeout(() => checkPremiereStatus(buyBtn, buySection, countdownSection, priceValue), 3000);
        }
    }
}

function showPremiereCountdown(buyBtn, buySection, countdownSection, priceValue, data) {
    // Zablokuj przycisk
    buyBtn.disabled = true;
    buyBtn.innerHTML = '<span>Premiera o 19:00</span>';
    buyBtn.classList.add('disabled');
    buyBtn.style.pointerEvents = 'none';
    buyBtn.onclick = function(e) { e.preventDefault(); return false; };
    
    // Ustaw cenę
    if (priceValue) {
        priceValue.innerHTML = '<span style="color: #C5A572; font-weight: 600;">299 zł</span>';
    }
    
    // Pokaż countdown
    if (countdownSection) {
        countdownSection.style.display = 'block';
    }
    
    // Użyj czasu serwera do korekcji
    const serverOffset = data.serverTime ? (Date.now() - data.serverTime) : 0;
    const premiereTime = data.premiereTime || PREMIERE_TIME;
    
    // Start countdown
    updateCountdown(premiereTime, serverOffset);
    
    const countdownInterval = setInterval(() => {
        const remaining = updateCountdown(premiereTime, serverOffset);
        
        if (remaining <= 0) {
            clearInterval(countdownInterval);
            // Pobierz link z serwera po premierze
            fetchAndActivate(buyBtn, priceValue, countdownSection);
        }
    }, 1000);
}

function updateCountdown(premiereTime, serverOffset) {
    const now = Date.now() - serverOffset;
    const remaining = premiereTime - now;
    
    const hoursEl = document.getElementById('countdown-hours');
    const minutesEl = document.getElementById('countdown-minutes');
    const secondsEl = document.getElementById('countdown-seconds');
    
    if (remaining <= 0) {
        if (hoursEl) hoursEl.textContent = '00';
        if (minutesEl) minutesEl.textContent = '00';
        if (secondsEl) secondsEl.textContent = '00';
        return 0;
    }
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    
    return remaining;
}

async function fetchAndActivate(buyBtn, priceValue, countdownSection) {
    try {
        const response = await fetch('/api/get-payment-link');
        const data = await response.json();
        
        if (!data.locked && data.paymentLink) {
            activateBuyButton(buyBtn, priceValue, data);
            if (countdownSection) {
                countdownSection.style.display = 'none';
            }
        } else {
            // Jeśli serwer nadal mówi locked, spróbuj za 2 sekundy
            setTimeout(() => fetchAndActivate(buyBtn, priceValue, countdownSection), 2000);
        }
    } catch (error) {
        console.error('Błąd pobierania linku:', error);
        setTimeout(() => fetchAndActivate(buyBtn, priceValue, countdownSection), 3000);
    }
}

function activateBuyButton(buyBtn, priceValue, data) {
    const price = data.price || 299;
    
    // Ustaw cenę
    if (priceValue) {
        priceValue.innerHTML = `<span style="color: #C5A572; font-weight: 600;">${price} zł</span>`;
    }
    
    // Aktywuj przycisk
    buyBtn.disabled = false;
    buyBtn.innerHTML = '<span>Kup teraz</span><span class="btn-arrow">→</span>';
    buyBtn.classList.remove('disabled');
    buyBtn.style.pointerEvents = 'auto';
    buyBtn.onclick = null;
    
    if (data.paymentLink) {
        buyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.open(data.paymentLink, '_blank');
        });
    }
}
