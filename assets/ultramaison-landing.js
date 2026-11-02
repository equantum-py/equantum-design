/* Ultra Maison — Fase 4: "Más vendidos". Reemplaza la cuadrícula por el orden "Más vendidos" de Shopify
 * (Todos los productos ?sort_by=best-selling, vía Section Rendering API). Si falla, queda la cuadrícula
 * del servidor. */
(function () {
  var grid = document.querySelector('[data-um-best]');
  if (!grid || !window.fetch) return;
  grid.setAttribute('aria-busy', 'true');
  fetch(grid.getAttribute('data-um-best'), { credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var fresh = doc.querySelector('[data-um-best-grid]');
      if (!fresh || !fresh.querySelector('.grid__item')) return;
      grid.innerHTML = fresh.innerHTML;
      var count = document.querySelector('[data-um-count]');
      if (count && fresh.getAttribute('data-count')) count.textContent = fresh.getAttribute('data-count');
    })
    .catch(function () {})
    .then(function () {
      grid.removeAttribute('aria-busy');
    });
})();
