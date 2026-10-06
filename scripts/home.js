(() => {
  const doc = document.documentElement;
  doc.classList.add('js');
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-nav');
  const themeBtn = document.querySelector('.theme-toggle');

  const setTheme = (mode) => {
    doc.setAttribute('data-theme', mode);
    try { localStorage.setItem('as-theme', mode); } catch (_) {}
  };

  const saved = (() => {
    try { return localStorage.getItem('as-theme'); } catch (_) { return null; }
  })();
  if (saved === 'light' || saved === 'dark') setTheme(saved);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
  else setTheme('dark');

  themeBtn?.addEventListener('click', () => {
    const next = doc.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next);
  });

  // ===== Menu mobile =====
  // Estado único (isOpen) + classes: cada toque inverte o estado e o CSS
  // sempre termina num estado definido, mesmo com toques rápidos seguidos.
  const mq = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
  const isMobile = () => (mq ? mq.matches : window.innerWidth <= 760);
  let isOpen = false;
  let overlay = null;
  if (toggle && nav) {
    overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
  }
  const focusables = () => [toggle, ...(nav ? nav.querySelectorAll('a[href], button:not([disabled])') : [])].filter(Boolean);

  const setMenu = (open, opts = {}) => {
    open = Boolean(open) && isMobile();
    isOpen = open;
    nav?.classList.toggle('open', open);
    nav?.classList.remove('active');
    toggle?.classList.toggle('open', open);
    toggle?.classList.toggle('active', open);
    overlay?.classList.toggle('open', open);
    doc.classList.toggle('menu-open', open);
    document.body.classList.toggle('menu-open', open);
    toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle?.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    if (open) {
      const first = nav?.querySelector('a[href]');
      try { first?.focus({ preventScroll: true }); } catch (_) { first?.focus(); }
    } else if (opts.returnFocus) {
      try { toggle?.focus({ preventScroll: true }); } catch (_) { toggle?.focus(); }
    }
  };
  const closeMenu = (opts) => { if (isOpen) setMenu(false, opts); };

  toggle?.addEventListener('click', (e) => {
    e.preventDefault();
    setMenu(!isOpen, { returnFocus: true });
  });
  overlay?.addEventListener('click', () => closeMenu({ returnFocus: true }));
  nav?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => closeMenu()));

  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      closeMenu({ returnFocus: true });
    } else if (e.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!items.includes(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });

  const onViewport = () => { if (!isMobile()) closeMenu(); };
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', onViewport);
    else if (mq.addListener) mq.addListener(onViewport);
  }
  window.addEventListener('resize', onViewport, { passive: true });
  window.addEventListener('pageshow', () => setMenu(false));
  setMenu(false);

  const onScroll = () => {
    header?.classList.toggle('scrolled', window.scrollY > 12);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }
})();
