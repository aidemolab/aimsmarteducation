// Shared header: mobile menu button and the "Subjects" dropdown.
// Loaded in <head> on every page (no defer) so the "js-nav" class is set
// before first paint; without JavaScript the menu simply stays open.
// No network requests, no storage.
document.documentElement.classList.add('js-nav');

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const menuButton = header.querySelector('.menu-toggle');
  const subButton = header.querySelector('.subnav-toggle');
  const subMenu = subButton && document.getElementById(subButton.getAttribute('aria-controls'));
  const subItem = subButton && subButton.closest('.has-subnav');
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

  menuButton?.addEventListener('click', () => setMenu(!isOpen(menuButton)));
  subButton?.addEventListener('click', () => setSub(!isOpen(subButton)));

  // Escape closes the dropdown first, then the menu, and returns focus.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (isOpen(subButton)) {
      setSub(false);
      subButton.focus();
    } else if (isOpen(menuButton) && !desktop.matches) {
      setMenu(false);
      menuButton.focus();
    }
  });

  // Click or tap outside the header closes everything.
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
});
