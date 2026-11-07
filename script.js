(() => {
  'use strict';
  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // A short intro for the first visit in a tab, never a blocking loading screen.
  const intro = qs('#intro');
  let introTimer;
  function finishIntro() {
    if (!root.classList.contains('intro-ready')) return;
    intro.classList.add('out');
    root.classList.remove('intro-ready');
    try { sessionStorage.setItem('zulkar-intro-seen', '1'); } catch (error) {}
    window.clearTimeout(introTimer);
    window.setTimeout(() => intro.classList.remove('out'), 700);
  }
  if (root.classList.contains('intro-ready')) {
    introTimer = window.setTimeout(finishIntro, 2850);
    qs('#skipIntro').addEventListener('click', finishIntro);
  }

  // Mobile navigation and reduced-click anchor navigation.
  const header = qs('#siteHeader');
  const menu = qs('#mainNav');
  const menuToggle = qs('#menuToggle');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('nav-open', open);
  }
  menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
  qsa('a', menu).forEach(anchor => anchor.addEventListener('click', () => setMenu(false)));
  window.addEventListener('resize', () => { if (window.innerWidth > 900) setMenu(false); }, { passive: true });

  // Tiny reading-progress indicator. CSS handles the visual change.
  const progress = qs('#progress');
  let scrollScheduled = false;
  function updateScroll() {
    header.classList.toggle('scrolled', window.scrollY > 24);
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    progress.style.width = `${Math.min(100, Math.max(0, window.scrollY / max * 100))}%`;
    scrollScheduled = false;
  }
  window.addEventListener('scroll', () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(updateScroll);
  }, { passive: true });
  updateScroll();

  // Reveal sections once only. Accessibility: display immediately with reduced motion.
  const revealItems = qsa('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('seen');
          revealObserver.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -30px 0px', threshold: .055 });
    revealItems.forEach(item => revealObserver.observe(item));
  } else revealItems.forEach(item => item.classList.add('seen'));

  // Filterable image gallery. Every thumbnail opens the actual supplied photo.
  const galleryGrid = qs('#galleryGrid');
  const galleryItems = qsa('.gallery-item', galleryGrid);
  const filterButtons = qsa('.filter');
  function applyFilter(category) {
    filterButtons.forEach(button => {
      const selected = button.dataset.filter === category;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    galleryItems.forEach(item => { item.hidden = category !== 'all' && item.dataset.category !== category; });
  }
  filterButtons.forEach(button => button.addEventListener('click', () => applyFilter(button.dataset.filter)));

  const imageDialog = qs('#imageDialog');
  const lightboxImage = qs('#lightboxImage');
  const lightboxCaption = qs('#lightboxCaption');
  const lightboxCounter = qs('#lightboxCounter');
  let currentPhotos = [];
  let photoIndex = 0;
  function visiblePhotos() { return galleryItems.filter(item => !item.hidden); }
  function displayPhoto(index) {
    if (!currentPhotos.length) return;
    photoIndex = (index + currentPhotos.length) % currentPhotos.length;
    const item = currentPhotos[photoIndex];
    const thumb = qs('img', item);
    lightboxImage.src = thumb.dataset.full || thumb.src;
    lightboxImage.alt = thumb.alt;
    lightboxCaption.textContent = qs('strong', item)?.textContent || 'A moment along the way';
    lightboxCounter.textContent = `${String(photoIndex + 1).padStart(2, '0')} / ${String(currentPhotos.length).padStart(2, '0')}`;
  }
  function openPhoto(item) {
    if (item.hidden) applyFilter('all');
    currentPhotos = visiblePhotos();
    photoIndex = Math.max(0, currentPhotos.indexOf(item));
    displayPhoto(photoIndex);
    imageDialog.showModal();
  }
  galleryItems.forEach(item => item.addEventListener('click', () => openPhoto(item)));
  qsa('.campus-photo[data-open-photo]').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.dataset.openPhoto;
      const item = galleryItems.find(el => qs('img', el)?.dataset.full?.endsWith('/' + name + '.webp'));
      if (item) openPhoto(item);
    });
  });
  qsa('.image-trigger[data-gallery-index]').forEach(button => {
    button.addEventListener('click', () => {
      const item = galleryItems.find(el => el.dataset.galleryIndex === button.dataset.galleryIndex);
      if (item) openPhoto(item);
    });
  });
  qs('#galleryPrev').addEventListener('click', () => displayPhoto(photoIndex - 1));
  qs('#galleryNext').addEventListener('click', () => displayPhoto(photoIndex + 1));
  qs('#imageClose').addEventListener('click', () => imageDialog.close());
  imageDialog.addEventListener('click', event => { if (event.target === imageDialog) imageDialog.close(); });

  // Videos are never downloaded on initial page load. Only create a source when clicked.
  const videoDialog = qs('#videoDialog');
  const videoPlayer = qs('#videoPlayer');
  const videoTitle = qs('#videoTitle');
  const videoDescription = qs('#videoDescription');
  qsa('.video-trigger').forEach(button => {
    button.addEventListener('click', () => {
      videoTitle.textContent = button.dataset.title || 'Video';
      videoDescription.textContent = button.dataset.description || '';
      videoPlayer.src = button.dataset.video;
      videoDialog.showModal();
      videoPlayer.play().catch(() => { /* Controls allow manual playback. */ });
    });
  });
  function closeVideo() {
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    videoDialog.close();
  }
  qs('#videoClose').addEventListener('click', closeVideo);
  videoDialog.addEventListener('click', event => { if (event.target === videoDialog) closeVideo(); });
  videoDialog.addEventListener('close', () => {
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      finishIntro();
      if (menu.classList.contains('open')) setMenu(false);
    }
    if (imageDialog.open) {
      if (event.key === 'ArrowRight') displayPhoto(photoIndex + 1);
      else if (event.key === 'ArrowLeft') displayPhoto(photoIndex - 1);
    }
  });
})();
