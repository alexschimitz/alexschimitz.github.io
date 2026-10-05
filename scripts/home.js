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

  const setMenu = (open) => {
    nav?.classList.toggle('open', open);
    nav?.classList.toggle('active', open);
    toggle?.classList.toggle('open', open);
    toggle?.classList.toggle('active', open);
    toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  const closeMenu = () => setMenu(false);

  toggle?.addEventListener('click', () => {
    const open = !(nav?.classList.contains('open') || nav?.classList.contains('active'));
    setMenu(open);
  });

  nav?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

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
