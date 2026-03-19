// Stripe Payment Configuration for Julia Wójcik
// Prosty system zakupu e-booka - bez countdownu

// PREMIERE_TIME is no longer used - e-book is available immediately

// Konfiguracja e-booka
const ebook = {
    id: 'ebook_1',
    name: 'E-book - Sekret czystej skóry',
    price: 299,
    description: 'Kompleksowy przewodnik po stylizacji paznokci.',
    format: 'PDF',
    access: 'lifetime'
};

document.addEventListener('DOMContentLoaded', function() {
    const ebookBuyBtn = document.getElementById('ebook-buy-btn');
    const priceValue = document.querySelector('.price-value');
    
    if (!ebookBuyBtn) return;
    
    // Pobierz link płatności z serwera i aktywuj przycisk
    fetchPaymentLink(ebookBuyBtn, priceValue);
});

async function fetchPaymentLink(buyBtn, priceValue) {
    try {
        const response = await fetch('https://julia-wojcik.vercel.app/api/get-payment-link');
        const data = await response.json();
        
        if (data.paymentLink) {
            activateBuyButton(buyBtn, priceValue, data);
        }
    } catch (error) {
        console.error('Błąd pobierania linku:', error);
        // Retry po 3 sekundach
        setTimeout(() => fetchPaymentLink(buyBtn, priceValue), 3000);
    }
}

function activateBuyButton(buyBtn, priceValue, data) {
    const price = data.price || 299;
    
    if (priceValue) {
        priceValue.innerHTML = `<span style="color: #C5A572; font-weight: 600;">${price} zł</span>`;
    }
    
    buyBtn.disabled = false;
    buyBtn.classList.remove('disabled');
    buyBtn.style.pointerEvents = 'auto';
    buyBtn.innerHTML = '<span>Kup teraz</span><span class="btn-arrow">→</span>';
    
    buyBtn.onclick = function(e) {
        e.preventDefault();
        window.open(data.paymentLink, '_blank');
    };
}
