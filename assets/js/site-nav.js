// Shared header: mobile menu button, the "Subjects" dropdown and the
// accessibility panel. Loaded in <head> on every page (no defer) so the
// "js-nav" class and the student's accessibility settings are applied before
// first paint; without JavaScript the menu simply stays open.
// No network requests. The accessibility settings (and nothing else) are kept
// in this browser's local storage so they apply on every page; they are never
// sent anywhere.
(() => {
  const html = document.documentElement;
  html.classList.add('js-nav');

  // ---- Accessibility settings: applied at once, before the page paints ----
  const KEY = 'aim-a11y';
  const DEFAULTS = { size: 0, contrast: false, dyslexia: false, reduceMotion: false, captions: true };
  const load = () => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
  };
  const save = (s) => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: settings last for this page only */ }
  };
  let settings = load();
  const apply = () => {
    html.classList.toggle('a11y-size-1', settings.size === 1);
    html.classList.toggle('a11y-size-2', settings.size === 2);
    html.classList.toggle('a11y-contrast', !!settings.contrast);
    html.classList.toggle('a11y-dyslexia', !!settings.dyslexia);
    html.classList.toggle('a11y-reduce-motion', !!settings.reduceMotion);
    html.classList.toggle('a11y-captions-off', !settings.captions);
  };
  apply();

  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const menuButton = header.querySelector('.menu-toggle');
    const subButton = header.querySelector('.subnav-toggle');
    const subMenu = subButton && document.getElementById(subButton.getAttribute('aria-controls'));
    const subItem = subButton && subButton.closest('.has-subnav');
    const a11yButton = header.querySelector('.a11y-toggle');
    const a11yPanel = a11yButton && document.getElementById(a11yButton.getAttribute('aria-controls'));
    const desktop = window.matchMedia('(min-width: 960px)');

    const isOpen = (button) => button && button.getAttribute('aria-expanded') === 'true';

    function setMenu(open) {
      if (!menuButton) return;
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.querySelector('.menu-label').textContent = open ? 'Close' : 'Menu';
      header.classList.toggle('menu-open', open);
      if (!open) setSub(false);
    }

    function setSub(open) {
      if (!subButton || !subMenu) return;
      subButton.setAttribute('aria-expanded', String(open));
      subMenu.classList.toggle('is-open', open);
    }

    function setA11y(open) {
      if (!a11yButton || !a11yPanel) return;
      a11yButton.setAttribute('aria-expanded', String(open));
      a11yPanel.hidden = !open;
      if (open) a11yPanel.querySelector('button')?.focus();
    }

    menuButton?.addEventListener('click', () => setMenu(!isOpen(menuButton)));
    subButton?.addEventListener('click', () => setSub(!isOpen(subButton)));
    a11yButton?.addEventListener('click', () => setA11y(!isOpen(a11yButton)));

    // Escape closes the dropdown first, then the accessibility panel, then the menu.
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (isOpen(subButton)) {
        setSub(false);
        subButton.focus();
      } else if (isOpen(a11yButton)) {
        setA11y(false);
        a11yButton.focus();
      } else if (isOpen(menuButton) && !desktop.matches) {
        setMenu(false);
        menuButton.focus();
      }
    });

    // Click or tap outside the header closes the menus (the accessibility
    // panel stays open until closed, so settings can be tried on the page).
    document.addEventListener('click', (event) => {
      if (header.contains(event.target)) return;
      setSub(false);
      if (!desktop.matches) setMenu(false);
    });

    // On desktop, tabbing out of the dropdown closes it.
    subItem?.addEventListener('focusout', (event) => {
      if (desktop.matches && !subItem.contains(event.relatedTarget)) setSub(false);
    });

    desktop.addEventListener('change', () => setMenu(false));

    if (!a11yPanel) return;

    // ---- Accessibility panel ----
    const sizeButtons = [...a11yPanel.querySelectorAll('[data-a11y-size]')];
    const switches = [...a11yPanel.querySelectorAll('[data-a11y]')];
    const sync = () => {
      sizeButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.a11ySize) === settings.size)));
      switches.forEach((b) => b.setAttribute('aria-pressed', String(!!settings[b.dataset.a11y])));
    };
    const change = (patch) => {
      settings = { ...settings, ...patch };
      apply();
      sync();
      save(settings);
      document.dispatchEvent(new CustomEvent('aim-a11y-change', { detail: { ...settings } }));
    };
    sizeButtons.forEach((b) => b.addEventListener('click', () => change({ size: Number(b.dataset.a11ySize) })));
    switches.forEach((b) => b.addEventListener('click', () => change({ [b.dataset.a11y]: !settings[b.dataset.a11y] })));
    a11yPanel.querySelector('[data-a11y-close]')?.addEventListener('click', () => { setA11y(false); a11yButton.focus(); });
    a11yPanel.querySelector('[data-a11y-reset]')?.addEventListener('click', () => {
      change({ ...DEFAULTS });
      try { localStorage.removeItem(KEY); } catch { /* fine */ }
    });
    sync();

    // Read aloud: the selected text, or the page's main content. Uses only
    // voices on this device (localService), so no text leaves the browser.
    const status = a11yPanel.querySelector('[data-a11y-read-status]');
    const readBtn = a11yPanel.querySelector('[data-a11y-read]');
    const stopBtn = a11yPanel.querySelector('[data-a11y-stop]');
    const synth = window.speechSynthesis;
    const localVoice = () => {
      const voices = synth ? synth.getVoices().filter((v) => v.localService) : [];
      return voices.find((v) => v.lang === 'en-GB') || voices.find((v) => v.lang?.startsWith('en')) || null;
    };
    let lastSelection = '';
    document.addEventListener('selectionchange', () => {
      const text = String(window.getSelection() || '').trim();
      if (text && !a11yPanel.contains(window.getSelection().anchorNode)) lastSelection = text;
    });
    readBtn?.addEventListener('click', () => {
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        status.textContent = 'Read aloud is not available in this browser.';
        return;
      }
      const voice = localVoice();
      if (!voice) {
        status.textContent = 'This browser has no voice installed on the device, so read aloud is not available here.';
        return;
      }
      const main = document.getElementById('main');
      const text = (lastSelection || main?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12000);
      if (!text) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.95;
      u.onend = () => { status.textContent = 'Finished reading.'; };
      synth.speak(u);
      status.textContent = lastSelection ? 'Reading your selected text…' : 'Reading the page… Select some text first to hear just that part.';
      lastSelection = '';
    });
    stopBtn?.addEventListener('click', () => {
      synth?.cancel();
      status.textContent = 'Stopped.';
    });
  });
})();
