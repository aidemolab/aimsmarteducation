// Home page hero: the live 3D showcase. The poster shows first; the iframe
// starts loading only after the page itself has loaded, so the 3D never holds
// up the page. When the showcase posts { type: 'aim-showcase-ready' } (from our
// own origin and our own iframe) the poster fades out. If it never arrives
// (for example no WebGL), the poster stays. No network requests beyond the
// site's own files.

const card = document.getElementById('hero-stage');
const frame = card?.querySelector('.stage-frame');

if (card && frame) {
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
    if (e.data?.type !== 'aim-showcase-ready') return;
    card.classList.add('is-live');
    clearBadges();
    new ResizeObserver(clearBadges).observe(card);
  });

  // Keep the "Live 3D" label clear of the showcase's badges, which can wrap
  // to two rows on narrow screens. Same-origin, so the frame can be measured.
  function clearBadges() {
    try {
      const doc = frame.contentDocument;
      const tops = [...doc.querySelectorAll('.aim-badges > *')].map((b) => b.getBoundingClientRect().top);
      if (!tops.length) return;
      card.style.setProperty('--badges-clear', `${Math.round(doc.documentElement.clientHeight - Math.min(...tops) + 8)}px`);
    } catch { /* keep the CSS default */ }
  }

  const start = () => { frame.src = frame.dataset.src; };
  const whenIdle = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 200));
  if (document.readyState === 'complete') whenIdle();
  else addEventListener('load', whenIdle, { once: true });
}
