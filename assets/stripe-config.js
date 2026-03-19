// Stripe Payment Configuration for Julia Wójcik
// Obsługa dwóch e-booków

document.addEventListener('DOMContentLoaded', function() {
    const ebookBuyBtn1 = document.getElementById('ebook-buy-btn');
    const ebookBuyBtn2 = document.getElementById('ebook-buy-btn-2');
    
    if (!ebookBuyBtn1 && !ebookBuyBtn2) return;
    
    // Pobierz linki płatności z serwera
    fetchPaymentLinks(ebookBuyBtn1, ebookBuyBtn2);
});

async function fetchPaymentLinks(btn1, btn2) {
    try {
        const response = await fetch('https://julia-wojcik.vercel.app/api/get-payment-link');
        const data = await response.json();
        
        if (data.ebooks && data.ebooks.length >= 2) {
            // Nowy format z dwoma e-bookami
            if (btn1) activateButton(btn1, data.ebooks[0].paymentLink);
            if (btn2) activateButton(btn2, data.ebooks[1].paymentLink);
        } else if (data.paymentLink) {
            // Fallback - stary format
            if (btn1) activateButton(btn1, data.paymentLink);
        }
    } catch (error) {
        console.error('Błąd pobierania linków:', error);
        setTimeout(() => fetchPaymentLinks(btn1, btn2), 3000);
    }
}

function activateButton(btn, paymentLink) {
    btn.disabled = false;
    btn.classList.remove('disabled');
    btn.style.pointerEvents = 'auto';
    btn.innerHTML = '<span>Kup teraz</span><span class="btn-arrow">→</span>';
    
    btn.onclick = function(e) {
        e.preventDefault();
        window.open(paymentLink, '_blank');
    };
}
