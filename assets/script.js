// Advanced Scroll Animations and Interactions
document.addEventListener('DOMContentLoaded', function() {
    // ===== PREMIERE SPLASH BANNER =====
    const premiereSplash = document.getElementById('premiere-splash');
    const mainContent = document.getElementById('main-content');
    
    // Ustaw odliczanie na 4 minuty od teraz (sztywno)
    const nowForBanner = new Date().getTime();
    const bannerFourMinutesFromNow = nowForBanner + (4 * 60 * 1000); // 4 minuty w milisekundach
    const bannerEndTime = bannerFourMinutesFromNow;
    
    // Funkcja aktualizująca odliczanie bannera
    function updatePremiereCountdown() {
        const now = new Date().getTime();
        const distance = bannerEndTime - now;
        
        if (distance < 0) {
            // 4 minuty minęły - ukryj banner
            if (premiereSplash) {
                premiereSplash.classList.add('hidden');
                setTimeout(() => {
                    premiereSplash.style.display = 'none';
                }, 800);
            }
            if (mainContent) {
                mainContent.style.display = 'block';
            }
            return;
        }
        
        // Oblicz minuty i sekundy
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        // Zaktualizuj wyświetlane wartości
        const minutesEl = document.getElementById('premiere-minutes');
        const secondsEl = document.getElementById('premiere-seconds');
        
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
        
        // Dni i godziny zawsze 00 dla 4 minut
        const daysEl = document.getElementById('premiere-days');
        const hoursEl = document.getElementById('premiere-hours');
        if (daysEl) daysEl.textContent = '00';
        if (hoursEl) hoursEl.textContent = '00';
    }
    
    // Zawsze pokaż banner na 4 minuty (bez localStorage)
    if (premiereSplash) {
        // Pokaż banner i ukryj główną treść
        premiereSplash.style.display = 'flex';
        if (mainContent) {
            mainContent.style.display = 'none';
        }
        
        // Zaktualizuj odliczanie co sekundę
        updatePremiereCountdown();
        const premiereInterval = setInterval(() => {
            updatePremiereCountdown();
            const now = new Date().getTime();
            if (bannerEndTime - now < 0) {
                clearInterval(premiereInterval);
            }
        }, 1000);
    } else {
        // Jeśli nie ma bannera, upewnij się że main-content jest widoczny
        if (mainContent) {
            mainContent.style.display = 'block';
        }
    }
    // ===== NAVIGATION =====
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            const isExpanded = navMenu.classList.contains('active');
            navMenu.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
            mobileMenuToggle.setAttribute('aria-expanded', !isExpanded ? 'true' : 'false');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });
    }

    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;
    
    if (navbar) {
        window.addEventListener('scroll', function() {
            const currentScroll = window.pageYOffset;
            
            if (currentScroll > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }

            // Hide/show navbar on scroll
            if (currentScroll > lastScroll && currentScroll > 200) {
                navbar.classList.add('hidden');
            } else {
                navbar.classList.remove('hidden');
            }
            
            lastScroll = currentScroll;
        });
    }

    // ===== TITLE ANIMATIONS =====
    function animateTitleWords(element) {
        const words = element.querySelectorAll('.title-word');
        words.forEach((word, index) => {
            setTimeout(() => {
                word.classList.add('visible');
            }, index * 100);
        });
    }

    function animateTitleLines(element) {
        const lines = element.querySelectorAll('.title-line');
        lines.forEach((line, index) => {
            setTimeout(() => {
                line.classList.add('visible');
            }, index * 150);
        });
    }

    // ===== INTERSECTION OBSERVER =====
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px 0px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;

                // Handle title words
                if (element.classList.contains('hero-title') || 
                    element.classList.contains('intro-title') || 
                    element.classList.contains('features-title') || 
                    element.classList.contains('gallery-title') ||
                    element.classList.contains('testimonials-title') ||
                    element.classList.contains('faq-title')) {
                    animateTitleWords(element);
                }

                // Handle title lines
                if (element.classList.contains('hero-title')) {
                    animateTitleLines(element);
                }

                // Add visible class for CSS animations
                element.classList.add('visible');

                // Stop observing once animated
                observer.unobserve(element);
            }
        });
    }, observerOptions);
    
    // Funkcja do sprawdzania, czy element jest już widoczny na początku
    function checkInitialVisibility() {
        const elementsToCheck = document.querySelectorAll('.section-label, .section-subtitle, .intro-title, .features-title, .gallery-title, .testimonials-title, .intro-image-wrapper, .intro-content, .intro-lead, .intro-paragraphs, .intro-highlight, .feature-card, .students-gallery-item, .portfolio-item, .testimonial-item, .ebook-cta-content');
        
        elementsToCheck.forEach(el => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            
            if (isVisible && !el.classList.contains('visible')) {
                // Jeśli element jest widoczny, pokaż go od razu
                if (el.classList.contains('intro-title') || 
                    el.classList.contains('features-title') || 
                    el.classList.contains('gallery-title') ||
                    el.classList.contains('testimonials-title')) {
                    animateTitleWords(el);
                }
                el.classList.add('visible');
            }
        });
    }
    
    // Sprawdź widoczność natychmiast i po krótkim opóźnieniu
    checkInitialVisibility();
    setTimeout(checkInitialVisibility, 100);

    // Observe all elements that need animation
    const elementsToObserve = [
        '.hero-label',
        '.hero-subtitle',
        '.hero-buttons',
        '.hero-scroll-indicator',
        '.section-label',
        '.section-subtitle',
        '.hero-title',
        '.intro-title',
        '.features-title',
        '.gallery-title',
        '.intro-image-wrapper',
        '.intro-content',
        '.intro-lead',
        '.intro-paragraphs',
        '.intro-highlight',
        '.feature-card',
        '.gallery-item',
        '.page-header h1',
        '.page-subtitle',
        '.intro-text',
        '.feature-item',
        '.timeline-item',
        '.about-header',
        '.about-image',
        '.about-text',
        '.contact-info',
        '.contact-item',
        '.contact-form-wrapper',
        '.course-card',
        '.course-offer-card',
        '.ebook-intro',
        '.ebook-purchase-section',
        '.ebook-cta-content',
        '.students-gallery-item',
        '.cta-wrapper',
        '.portfolio-item',
        '.testimonial-item',
        '.testimonials-title',
        '.faq-title',
        '.faq-list'
    ];

    elementsToObserve.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            observer.observe(el);
        });
    });

    // Additional observer for staggered timeline animations
    const timelineObserver = new IntersectionObserver(function(entries) {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 200);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.timeline-item').forEach(el => {
        timelineObserver.observe(el);
    });

    // Staggered animations for contact items
    const contactObserver = new IntersectionObserver(function(entries) {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, index * 150);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.contact-item').forEach(el => {
        contactObserver.observe(el);
    });

    // ===== PARALLAX EFFECT =====
    function parallaxScroll() {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('[data-scroll-speed]');
        
        parallaxElements.forEach(element => {
            const speed = parseFloat(element.getAttribute('data-scroll-speed')) || 0;
            const yPos = -(scrolled * speed);
            element.style.transform = `translate3d(0, ${yPos}px, 0)`;
        });
    }

    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                parallaxScroll();
                ticking = false;
            });
            ticking = true;
        }
    });

    // ===== GALLERY INTERACTIONS =====
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach((item, index) => {
        item.addEventListener('mouseenter', function() {
            // Subtle stagger effect on hover
            setTimeout(() => {
                this.classList.add('hovered');
            }, index * 50);
        });

        item.addEventListener('mouseleave', function() {
            this.classList.remove('hovered');
        });
    });

    // ===== LIGHTBOX FOR GALLERY =====
    const portfolioItems = document.querySelectorAll('.portfolio-item, .gallery-item, .students-gallery-item');
    let currentLightboxIndex = 0;
    let lightboxImages = [];

    // Create lightbox HTML if it doesn't exist
    if (!document.querySelector('.lightbox')) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <button class="lightbox-close" aria-label="Zamknij">×</button>
            <button class="lightbox-prev" aria-label="Poprzednie zdjęcie">‹</button>
            <button class="lightbox-next" aria-label="Następne zdjęcie">›</button>
            <div class="lightbox-content">
                <img id="lightbox-image" src="" alt="">
                <div class="lightbox-caption"></div>
            </div>
        `;
        document.body.appendChild(lightbox);
    }

    const lightbox = document.querySelector('.lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxCaption = document.querySelector('.lightbox-caption');
    const lightboxClose = document.querySelector('.lightbox-close');
    const lightboxPrev = document.querySelector('.lightbox-prev');
    const lightboxNext = document.querySelector('.lightbox-next');

    // Collect all images
    function collectLightboxImages() {
        lightboxImages = [];
        portfolioItems.forEach(item => {
            const img = item.querySelector('img');
            if (img && img.src) {
                lightboxImages.push({
                    src: img.src,
                    alt: img.alt || 'Zdjęcie z galerii'
                });
            }
        });
    }

    // Open lightbox
    function openLightbox(index) {
        if (lightboxImages.length === 0) return;
        currentLightboxIndex = index;
        updateLightboxImage();
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Close lightbox
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Update lightbox image
    function updateLightboxImage() {
        if (lightboxImages.length === 0) return;
        const image = lightboxImages[currentLightboxIndex];
        lightboxImage.src = image.src;
        lightboxImage.alt = image.alt;
        lightboxCaption.textContent = image.alt;
    }

    // Navigate lightbox
    function nextImage() {
        if (lightboxImages.length === 0) return;
        currentLightboxIndex = (currentLightboxIndex + 1) % lightboxImages.length;
        updateLightboxImage();
    }

    function prevImage() {
        if (lightboxImages.length === 0) return;
        currentLightboxIndex = (currentLightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
        updateLightboxImage();
    }

    // Initialize lightbox
    collectLightboxImages();

    // Add click handlers
    portfolioItems.forEach((item, index) => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const img = this.querySelector('img');
            if (img) {
                collectLightboxImages();
                const clickedIndex = Array.from(portfolioItems).indexOf(this);
                openLightbox(clickedIndex >= 0 ? clickedIndex : index);
            }
        });
    });

    // Flaga do uniknięcia podwójnego wywołania (touchend + click)
    let lastTouchEnd = 0;
    
    function handleLightboxButton(action) {
        const now = Date.now();
        // Ignoruj jeśli ostatni touchend był mniej niż 300ms temu
        if (now - lastTouchEnd < 300) return;
        action();
    }
    
    // Lightbox controls - click events
    if (lightboxClose) {
        lightboxClose.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleLightboxButton(closeLightbox);
        });
        // Touch event dla mobile
        lightboxClose.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            lastTouchEnd = Date.now();
            closeLightbox();
        }, { passive: false });
    }

    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleLightboxButton(prevImage);
        });
        // Touch event dla mobile
        lightboxPrev.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            lastTouchEnd = Date.now();
            prevImage();
        }, { passive: false });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleLightboxButton(nextImage);
        });
        // Touch event dla mobile
        lightboxNext.addEventListener('touchend', function(e) {
            e.preventDefault();
            e.stopPropagation();
            lastTouchEnd = Date.now();
            nextImage();
        }, { passive: false });
    }

    // Swipe gestures na mobile (tylko na obrazku/tle, nie na przyciskach)
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    let isSwiping = false;
    
    lightbox.addEventListener('touchstart', function(e) {
        // Nie uruchamiaj swipe na przyciskach
        if (e.target.closest('.lightbox-prev') || 
            e.target.closest('.lightbox-next') || 
            e.target.closest('.lightbox-close')) {
            isSwiping = false;
            return;
        }
        isSwiping = true;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    lightbox.addEventListener('touchend', function(e) {
        if (!isSwiping) return;
        
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
        isSwiping = false;
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;
        
        // Tylko poziomy swipe (nie pionowy)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > swipeThreshold) {
            if (diffX > 0) {
                // Swipe left - next
                nextImage();
            } else {
                // Swipe right - prev
                prevImage();
            }
        }
    }

    // Close on background click
    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (!lightbox.classList.contains('active')) return;

        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowRight') {
            nextImage();
        } else if (e.key === 'ArrowLeft') {
            prevImage();
        }
    });

    // ===== BUTTON INTERACTIONS =====
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
        });

        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });

        // Ripple effect
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // ===== CONTACT FORM =====
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const courseParam = urlParams.get('course');
        const messageParam = urlParams.get('message');
        
        if (courseParam) {
            const messageField = document.getElementById('message');
            if (messageField) {
                const courseName = decodeURIComponent(courseParam);
                messageField.value = `Dzień dobry,\n\nInteresuje mnie szkolenie: ${courseName}\n\nProszę o więcej informacji.\n\nPozdrawiam`;
            }
        } else if (messageParam) {
            const messageField = document.getElementById('message');
            if (messageField) {
                messageField.value = decodeURIComponent(messageParam);
            }
        }

        // Real-time validation
        const nameInput = contactForm.querySelector('#name');
        const emailInput = contactForm.querySelector('#email');
        const phoneInput = contactForm.querySelector('#phone');
        const messageInput = contactForm.querySelector('#message');
        const submitBtn = contactForm.querySelector('button[type="submit"]');

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // Phone validation (Polish format)
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;

        function validateField(input, validator, errorMsg) {
            const value = input.value.trim();
            const isValid = validator(value);
            
            if (value && !isValid) {
                input.setCustomValidity(errorMsg);
                input.classList.add('error');
                return false;
            } else {
                input.setCustomValidity('');
                input.classList.remove('error');
                return true;
            }
        }

        function updateSubmitButton() {
            const nameValid = nameInput.value.trim().length >= 2;
            const emailValid = emailRegex.test(emailInput.value.trim());
            const messageValid = messageInput.value.trim().length >= 10;
            const phoneValid = !phoneInput.value.trim() || phoneRegex.test(phoneInput.value.trim());

            submitBtn.disabled = !(nameValid && emailValid && messageValid && phoneValid);
        }

        if (nameInput) {
            nameInput.addEventListener('input', function() {
                validateField(this, (val) => val.length >= 2, 'Imię i nazwisko musi mieć co najmniej 2 znaki');
                updateSubmitButton();
            });
        }

        if (emailInput) {
            emailInput.addEventListener('input', function() {
                validateField(this, (val) => emailRegex.test(val), 'Proszę podać poprawny adres email');
                updateSubmitButton();
            });
        }

        if (phoneInput) {
            phoneInput.addEventListener('input', function() {
                if (this.value.trim()) {
                    validateField(this, (val) => phoneRegex.test(val), 'Proszę podać poprawny numer telefonu');
                } else {
                    this.setCustomValidity('');
                    this.classList.remove('error');
                }
                updateSubmitButton();
            });
        }

        if (messageInput) {
            messageInput.addEventListener('input', function() {
                validateField(this, (val) => val.length >= 10, 'Wiadomość musi mieć co najmniej 10 znaków');
                updateSubmitButton();
            });
        }
        
        // Check for success message from FormSubmit
        if (urlParams.get('success') === 'true') {
            const formMessage = document.getElementById('form-message');
            if (formMessage) {
                formMessage.textContent = 'Dziękuję za wiadomość! Odpowiem najszybciej jak to możliwe.';
                formMessage.classList.remove('error');
                formMessage.classList.add('success');
                formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
        
        // FormSubmit handles submission, we just validate
        contactForm.addEventListener('submit', function(e) {
            // Let FormSubmit handle the submission
            // We only validate before submit
            const nameValid = nameInput.value.trim().length >= 2;
            const emailValid = emailRegex.test(emailInput.value.trim());
            const messageValid = messageInput.value.trim().length >= 10;
            const phoneValid = !phoneInput.value.trim() || phoneRegex.test(phoneInput.value.trim());
            
            if (!(nameValid && emailValid && messageValid && phoneValid)) {
                e.preventDefault();
                return false;
            }
            
            // Show loading state
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Wysyłanie...</span>';
            
            // FormSubmit will handle the rest and redirect
        });
    }

    // ===== SMOOTH SCROLL =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const offsetTop = target.offsetTop - 100;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // ===== INITIAL ANIMATIONS =====
    // Trigger hero animations on load
    setTimeout(() => {
        const heroLabel = document.querySelector('.hero-label');
        const heroSubtitle = document.querySelector('.hero-subtitle');
        const heroButtons = document.querySelector('.hero-buttons');
        const heroScrollIndicator = document.querySelector('.hero-scroll-indicator');
        const heroTitle = document.querySelector('.hero-title');

        if (heroLabel) heroLabel.classList.add('visible');
        if (heroTitle) {
            animateTitleLines(heroTitle);
            animateTitleWords(heroTitle);
        }
        setTimeout(() => {
            if (heroSubtitle) heroSubtitle.classList.add('visible');
        }, 400);
        setTimeout(() => {
            if (heroButtons) heroButtons.classList.add('visible');
        }, 600);
        setTimeout(() => {
            if (heroScrollIndicator) heroScrollIndicator.classList.add('visible');
        }, 800);
    }, 100);

    // Animate page header on load
    setTimeout(() => {
        const pageHeader = document.querySelector('.page-header h1');
        const pageSubtitle = document.querySelector('.page-subtitle');
        
        if (pageHeader) {
            pageHeader.classList.add('visible');
        }
        if (pageSubtitle) {
            setTimeout(() => {
                pageSubtitle.classList.add('visible');
            }, 300);
        }
    }, 200);

    // Animate title words on all pages
    setTimeout(() => {
        document.querySelectorAll('.intro-title, .features-title, .gallery-title').forEach(title => {
            if (title) {
                animateTitleWords(title);
            }
        });
    }, 300);

    // ===== SCROLL PROGRESS BAR =====
    const scrollProgress = document.querySelector('.scroll-progress');
    if (scrollProgress) {
        window.addEventListener('scroll', function() {
            const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (window.pageYOffset / windowHeight) * 100;
            scrollProgress.style.width = scrolled + '%';
        }, { passive: true });
    }

    // ===== COUNTER ANIMATION =====
    function animateCounter(element) {
        const target = parseInt(element.getAttribute('data-target'));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const counter = setInterval(() => {
            current += step;
            if (current >= target) {
                element.textContent = target + (target === 100 ? '%' : target === 200 ? '+' : '');
                clearInterval(counter);
            } else {
                element.textContent = Math.floor(current) + (target === 100 ? '%' : target === 200 ? '+' : '');
            }
        }, 16);
    }

    const statsObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumber = entry.target.querySelector('.stat-number');
                if (statNumber && !statNumber.hasAttribute('data-animated')) {
                    statNumber.setAttribute('data-animated', 'true');
                    animateCounter(statNumber);
                }
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('.stat-item').forEach(item => {
        statsObserver.observe(item);
    });

    // ===== NEWSLETTER FORM =====
    // Check for success message from FormSubmit
    const newsletterUrlParams = new URLSearchParams(window.location.search);
    if (newsletterUrlParams.get('newsletter') === 'success') {
        const newsletterMessage = document.getElementById('newsletter-message');
        if (newsletterMessage) {
            newsletterMessage.textContent = 'Dziękuję za zapisanie się do newslettera!';
            newsletterMessage.classList.remove('error');
            newsletterMessage.classList.add('success');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    // ===== PREMIERE NEWSLETTER FORM =====
    const premiereNewsletterForm = document.getElementById('premiere-newsletter-form');
    if (premiereNewsletterForm) {
        premiereNewsletterForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('premiere-newsletter-email').value.trim();
            const messageEl = document.getElementById('premiere-newsletter-message');
            
            if (!email) {
                if (messageEl) {
                    messageEl.textContent = 'Proszę podać adres email';
                    messageEl.classList.remove('success');
                    messageEl.classList.add('error');
                }
                return;
            }
            
            try {
                const response = await fetch('https://julia-wojcik.vercel.app/api/newsletter-subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email, source: 'premiere-splash' })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    if (messageEl) {
                        messageEl.textContent = 'Dziękuję za zapisanie się do newslettera!';
                        messageEl.classList.remove('error');
                        messageEl.classList.add('success');
                    }
                    premiereNewsletterForm.reset();
                } else {
                    throw new Error(result.error || 'Błąd podczas zapisywania');
                }
            } catch (error) {
                console.error('❌ Error subscribing to newsletter:', error);
                if (messageEl) {
                    messageEl.textContent = 'Wystąpił błąd. Spróbuj ponownie.';
                    messageEl.classList.remove('success');
                    messageEl.classList.add('error');
                }
            }
        });
    }
    
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        // FormSubmit handles submission, we just show loading state
        newsletterForm.addEventListener('submit', function(e) {
            const newsletterMessage = document.getElementById('newsletter-message');
            const submitBtn = newsletterForm.querySelector('button[type="submit"]');
            
            // Show loading state
            if (submitBtn) {
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Wysyłanie...</span>';
            }
            
            // FormSubmit will handle the rest and redirect
        });
    }

    // ===== SCROLL TO TOP =====
    const scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.className = 'scroll-to-top';
    scrollToTopBtn.setAttribute('aria-label', 'Przewiń do góry strony');
    scrollToTopBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>';
    document.body.appendChild(scrollToTopBtn);

    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    });

    scrollToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // ===== COOKIE CONSENT =====
    const cookieConsent = document.getElementById('cookieConsent');
    const acceptCookies = document.getElementById('acceptCookies');
    const declineCookies = document.getElementById('declineCookies');

    if (cookieConsent && !localStorage.getItem('cookieConsent')) {
        setTimeout(() => {
            cookieConsent.classList.add('show');
        }, 1000);
    }

    if (acceptCookies) {
        acceptCookies.addEventListener('click', function() {
            localStorage.setItem('cookieConsent', 'accepted');
            cookieConsent.classList.remove('show');
            setTimeout(() => {
                cookieConsent.style.display = 'none';
            }, 400);
        });
    }

    if (declineCookies) {
        declineCookies.addEventListener('click', function() {
            localStorage.setItem('cookieConsent', 'declined');
            cookieConsent.classList.remove('show');
            setTimeout(() => {
                cookieConsent.style.display = 'none';
            }, 400);
        });
    }

    // ===== LANGUAGE SWITCHER =====
    let currentLang = localStorage.getItem('preferredLanguage') || 'pl';
    
    // Function to translate the page
    function translatePage(lang) {
        if (!window.translations || !window.translations[lang]) {
            console.warn('Translations not loaded for language:', lang);
            return;
        }
        
        const t = window.translations[lang];
        
        // Update all elements with data-translate attribute
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            if (t[key]) {
                if (element.tagName === 'INPUT' && element.type === 'email') {
                    element.placeholder = t[key];
                } else if (element.tagName === 'INPUT' && element.type === 'text') {
                    element.value = t[key];
                } else if (element.hasAttribute('data-translate-html')) {
                    element.innerHTML = t[key];
                } else {
                    element.textContent = t[key];
                }
            }
        });
        
        // Update aria-label attributes
        document.querySelectorAll('[data-aria-label-translate]').forEach(element => {
            const key = element.getAttribute('data-aria-label-translate');
            if (t[key]) {
                element.setAttribute('aria-label', t[key]);
            }
        });
        
        // Update lang attribute on html element
        document.documentElement.setAttribute('lang', lang);
        
        // Update meta tags
        const metaLang = document.querySelector('meta[name="language"]');
        if (metaLang) {
            metaLang.setAttribute('content', lang === 'pl' ? 'Polish' : 'English');
        }
        
        const ogLocale = document.querySelector('meta[property="og:locale"]');
        if (ogLocale) {
            ogLocale.setAttribute('content', lang === 'pl' ? 'pl_PL' : 'en_US');
        }
        
        currentLang = lang;
        localStorage.setItem('preferredLanguage', lang);
    }
    
    const langButtons = document.querySelectorAll('.lang-btn');
    langButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const lang = this.getAttribute('data-lang');
            
            // Remove active from all
            langButtons.forEach(b => b.classList.remove('active'));
            // Add active to clicked
            this.classList.add('active');
            
            // Translate the page
            translatePage(lang);
        });
    });

    // Load saved language preference and translate
    const savedLang = localStorage.getItem('preferredLanguage') || 'pl';
    langButtons.forEach(btn => {
        if (btn.getAttribute('data-lang') === savedLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Translate page on load if translations are available
    if (window.translations && window.translations[savedLang]) {
        translatePage(savedLang);
    }

    // ===== PERFORMANCE OPTIMIZATION =====
    // Use passive event listeners for scroll
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = window.requestAnimationFrame(function() {
            // Scroll-based logic here
        });
    }, { passive: true });



    // ===== ENHANCED SMOOTH SCROLL =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const offsetTop = target.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ===== FAQ ACCORDION =====
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', function() {
                const isActive = item.classList.contains('active');
                
                // Close all other items
                faqItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('active');
                    }
                });
                
                // Toggle current item
                item.classList.toggle('active', !isActive);
            });
        }
    });

    // ===== TESTIMONIALS CAROUSEL =====
    const testimonialsTrack = document.querySelector('.testimonials-track');
    const testimonialItems = document.querySelectorAll('.testimonial-item');
    const prevBtn = document.querySelector('.testimonial-nav-prev');
    const nextBtn = document.querySelector('.testimonial-nav-next');
    
    if (testimonialsTrack && testimonialItems.length > 0) {
        let currentIndex = 0;
        const itemsCount = testimonialItems.length;
        
        function getItemsPerView() {
            return window.innerWidth >= 768 ? 2 : 1;
        }
        
        function getMaxIndex() {
            return itemsCount - getItemsPerView();
        }
        
        function updateCarousel() {
            if (testimonialItems.length === 0) return;
            
            const itemsPerView = getItemsPerView();
            const carousel = testimonialsTrack.parentElement;
            const carouselWidth = carousel ? carousel.offsetWidth : testimonialsTrack.offsetWidth;
            const itemWidth = (carouselWidth - (itemsPerView - 1) * 32) / itemsPerView;
            const gap = 32; // 2rem in pixels
            const translateX = -(currentIndex * (itemWidth + gap));
            testimonialsTrack.style.transform = `translateX(${translateX}px)`;
            
            // Update button states
            if (prevBtn) {
                prevBtn.style.opacity = currentIndex === 0 ? '0.5' : '1';
                prevBtn.style.pointerEvents = currentIndex === 0 ? 'none' : 'auto';
            }
            
            if (nextBtn) {
                const maxIndex = getMaxIndex();
                nextBtn.style.opacity = currentIndex >= maxIndex ? '0.5' : '1';
                nextBtn.style.pointerEvents = currentIndex >= maxIndex ? 'none' : 'auto';
            }
        }
        
        function goToNext() {
            const maxIndex = getMaxIndex();
            if (currentIndex < maxIndex) {
                currentIndex++;
                updateCarousel();
            }
        }
        
        function goToPrev() {
            if (currentIndex > 0) {
                currentIndex--;
                updateCarousel();
            }
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', goToNext);
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', goToPrev);
        }
        
        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                const maxIndex = getMaxIndex();
                if (currentIndex > maxIndex) {
                    currentIndex = Math.max(0, maxIndex);
                }
                updateCarousel();
            }, 250);
        });
        
        // Initialize after a short delay to ensure layout is calculated
        setTimeout(updateCarousel, 100);
        
        // Touch/swipe support
        let startX = 0;
        let isDragging = false;
        
        testimonialsTrack.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            isDragging = true;
        }, { passive: true });
        
        testimonialsTrack.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            // Allow native scrolling
        }, { passive: true });
        
        testimonialsTrack.addEventListener('touchend', function(e) {
            if (!isDragging) return;
            isDragging = false;
            const endX = e.changedTouches[0].clientX;
            const diff = startX - endX;
            
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    goToNext();
                } else {
                    goToPrev();
                }
            }
        });
    }

    // ===== COUNTDOWN TIMER =====
    // Ustaw odliczanie na 4 minuty od teraz (dla innych sekcji countdown na innych stronach)
    const nowForPremiere = new Date().getTime();
    const ebookFourMinutesFromNow = nowForPremiere + (4 * 60 * 1000); // 4 minuty w milisekundach
    const ebookPremiereDate = ebookFourMinutesFromNow;
    
    function updateCountdown(timerId, premiereId, daysId, hoursId, minutesId, secondsId) {
        const now = new Date().getTime();
        const distance = ebookPremiereDate - now;
        
        const countdownTimer = document.getElementById(timerId);
        const countdownPremiere = document.getElementById(premiereId);
        
        if (distance < 0) {
            // Premiera już minęła - pokaż informację o premierze
            if (countdownTimer) countdownTimer.style.display = 'none';
            if (countdownPremiere) countdownPremiere.style.display = 'block';
            return;
        }
        
        // Oblicz dni, godziny, minuty, sekundy
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        // Zaktualizuj wyświetlane wartości
        const daysEl = document.getElementById(daysId);
        const hoursEl = document.getElementById(hoursId);
        const minutesEl = document.getElementById(minutesId);
        const secondsEl = document.getElementById(secondsId);
        
        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    }
    
    // Timer na stronie ebook.html
    const countdownTimer = document.getElementById('countdown-timer');
    const countdownPremiere = document.getElementById('countdown-premiere');
    
    if (countdownTimer) {
        updateCountdown('countdown-timer', 'countdown-premiere', 'days', 'hours', 'minutes', 'seconds');
        const countdownInterval = setInterval(() => {
            updateCountdown('countdown-timer', 'countdown-premiere', 'days', 'hours', 'minutes', 'seconds');
        }, 1000);
        
        // Sprawdź czy premiera już minęła przy załadowaniu strony
        const now = new Date().getTime();
        if (ebookPremiereDate - now < 0) {
            if (countdownTimer) countdownTimer.style.display = 'none';
            if (countdownPremiere) countdownPremiere.style.display = 'block';
            clearInterval(countdownInterval);
        }
    }
    
    // Timer na stronie głównej (index.html)
    const countdownTimerHome = document.getElementById('countdown-timer-home');
    const countdownPremiereHome = document.getElementById('countdown-premiere-home');
    
    if (countdownTimerHome) {
        updateCountdown('countdown-timer-home', 'countdown-premiere-home', 'days-home', 'hours-home', 'minutes-home', 'seconds-home');
        const countdownIntervalHome = setInterval(() => {
            updateCountdown('countdown-timer-home', 'countdown-premiere-home', 'days-home', 'hours-home', 'minutes-home', 'seconds-home');
        }, 1000);
        
        // Sprawdź czy premiera już minęła przy załadowaniu strony
        const now = new Date().getTime();
        if (ebookPremiereDate - now < 0) {
            if (countdownTimerHome) countdownTimerHome.style.display = 'none';
            if (countdownPremiereHome) countdownPremiereHome.style.display = 'block';
            clearInterval(countdownIntervalHome);
        }
    }
});

// ===== ADD RIPPLE STYLES =====
const style = document.createElement('style');
style.textContent = `
    .btn {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
