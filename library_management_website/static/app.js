document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (menu && nav) menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
  document.querySelectorAll('.flash-close').forEach(button => button.addEventListener('click', () => button.closest('.flash').remove()));
  document.querySelectorAll('.book-cover-image').forEach(image => image.addEventListener('error', () => {
    image.parentElement.classList.remove('has-cover');
    image.remove();
  }, { once: true }));
  document.querySelectorAll('form[data-confirm]').forEach(form => form.addEventListener('submit', event => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  }));
});
