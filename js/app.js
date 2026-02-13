/* ============================================
   PyMaster - Main Application JavaScript
   ============================================ */

// ---- Theme Toggle (Dark / Light Mode) ----
function initTheme() {
  const saved = localStorage.getItem('pymaster-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pymaster-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ---- Mobile Navigation ----
function initMobileNav() {
  const toggle = document.querySelector('.mobile-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.textContent = links.classList.contains('open') ? '✕' : '☰';
  });

  // Close nav when a link is clicked
  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.textContent = '☰';
    });
  });
}

// ---- Active Nav Link ----
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

// ---- Accordion / Lessons Toggle ----
function initAccordions() {
  document.querySelectorAll('.lesson-header').forEach(header => {
    header.addEventListener('click', () => {
      const lesson = header.parentElement;
      const isOpen = lesson.classList.contains('open');

      // Optionally close others (remove this block for multi-open)
      // document.querySelectorAll('.lesson.open').forEach(l => l.classList.remove('open'));

      lesson.classList.toggle('open', !isOpen);
    });
  });
}

// ---- Tabs ----
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    const buttons = tabGroup.querySelectorAll('.tab-btn');
    const parent = tabGroup.parentElement;
    const contents = parent.querySelectorAll('.tab-content');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        buttons.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const el = parent.querySelector(`#${target}`);
        if (el) el.classList.add('active');
      });
    });
  });
}

// ---- Practice Questions Toggle ----
function initPracticeQuestions() {
  document.querySelectorAll('.practice-question').forEach(q => {
    q.addEventListener('click', () => {
      q.classList.toggle('show-answer');
    });
  });
}

// ---- Copy Code Button ----
function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const codeBlock = btn.closest('.code-block');
      const code = codeBlock.querySelector('code').textContent;

      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '✓ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 2000);
      }).catch(() => {
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });
  });
}

// ---- Scroll Reveal Animation ----
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ---- Navbar scroll effect ----
function initNavScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.style.boxShadow = 'var(--shadow-md)';
    } else {
      navbar.style.boxShadow = 'none';
    }
  });
}

// ---- Smooth Scroll for anchor links ----
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ---- Initialize Everything ----
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileNav();
  setActiveNav();
  initAccordions();
  initTabs();
  initPracticeQuestions();
  initCopyButtons();
  initScrollReveal();
  initNavScroll();
  initSmoothScroll();
});
