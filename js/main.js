/* ============================================================
   MARKETING WITH KIMANI – Main JavaScript
   Scroll reveal, navbar scroll effect, mobile menu, form
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ── NAVBAR SCROLL EFFECT ────────────────────────────────────
  const navbar = document.getElementById('navbar');
  if (navbar) {
    const onScroll = () => {
      if (window.scrollY > 60) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run on load
  }

  // ── HAMBURGER MOBILE MENU ──────────────────────────────────
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('open');
      mobileNav.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // close on link click
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // ── SCROLL REVEAL ─────────────────────────────────────────
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length > 0) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

    revealEls.forEach(el => revealObserver.observe(el));
  }

  // ── SMOOTH ANCHOR SCROLLING ────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const navH = navbar ? navbar.offsetHeight : 0;
        const top = target.getBoundingClientRect().top + window.scrollY - navH - 20;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ── CONTACT FORM HANDLING ──────────────────────────────────
  const form = document.getElementById('contactForm');
  if (form) {
    // Input focus highlight
    form.querySelectorAll('input, textarea, select').forEach(field => {
      field.addEventListener('focus', () => {
        field.style.borderColor = 'var(--clr-accent)';
        field.style.boxShadow = '0 0 0 3px rgba(200,242,48,0.12)';
      });
      field.addEventListener('blur', () => {
        field.style.borderColor = 'var(--clr-border)';
        field.style.boxShadow = 'none';
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const msg = document.getElementById('formMsg');
      
      const formData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        organization: document.getElementById('organization') ? document.getElementById('organization').value : '',
        interest: document.getElementById('interest') ? document.getElementById('interest').value : '',
        message: document.getElementById('message') ? document.getElementById('message').value : ''
      };

      // Loading state
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Submitting...';

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
          btn.style.display = 'none';
          if (msg) {
            msg.style.display = 'block';
            msg.style.textContent = data.message || "Thank you. I'll be in touch shortly.";
            msg.style.animation = 'fadeInUp 0.5s ease';
          }
          form.reset();
        } else {
          alert('Submission failed: ' + (data.error || 'Unknown error'));
          btn.disabled = false;
          btn.textContent = originalText;
        }
      } catch (error) {
        console.error('Form error:', error);
        alert('Could not connect to the server. Please try again later.');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  }

  // ── HERO PARALLAX ON SCROLL ────────────────────────────────
  const heroBg = document.getElementById('heroImage');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      if (scrolled < window.innerHeight) {
        heroBg.style.transform = `translateY(${scrolled * 0.25}px)`;
      }
    }, { passive: true });
  }

  // ── NUMBER COUNTER ANIMATION ───────────────────────────────
  const counters = document.querySelectorAll('.hero-stat-num');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        // Store original HTML once for suffix extraction
        const originalHTML = el.innerHTML;
        // Extract the numeric part (leading digits/decimal)
        const numMatch = originalHTML.match(/^[\d.]+/);
        if (!numMatch) { counterObserver.unobserve(el); return; }
        const num = parseFloat(numMatch[0]);
        // Suffix = everything after the number (spans, symbols, ordinals)
        const suffixStart = numMatch[0].length;
        const suffix = originalHTML.slice(suffixStart);
        if (!isNaN(num) && num > 0) {
          let start = 0;
          const duration = 1400;
          const totalFrames = duration / 16;
          const step = num / totalFrames;
          const timer = setInterval(() => {
            start = Math.min(start + step, num);
            const display = Number.isInteger(num) ? Math.floor(start) : start.toFixed(1);
            el.innerHTML = display + suffix;
            if (start >= num) {
              el.innerHTML = num + suffix; // ensure exact final value
              clearInterval(timer);
            }
          }, 16);
        }
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => counterObserver.observe(c));

  // ── ACTIVE NAV HIGHLIGHTING ────────────────────────────────
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-menu a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // ── ADD PAGE TRANSITION CLASS ──────────────────────────────
  document.body.classList.add('page-transition');

});
