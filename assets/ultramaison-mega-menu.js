/**
 * Ultra Maison — megamenú editorial (desktop).
 * Basado en <details>: funciona con teclado y sin JS. Este script agrega
 * apertura con hover (solo punteros finos), un único panel abierto a la vez,
 * cierre con Escape / clic fuera y cambio de vista al pasar por subcategorías.
 */
(() => {
  if (customElements.get('um-mega-menu')) return;

  const OPEN_DELAY = 120;
  const CLOSE_DELAY = 220;
  const SWITCH_DELAY = 90;

  class UMMegaMenu extends HTMLElement {
    connectedCallback() {
      this.details = [...this.querySelectorAll('.um-mega__details')];
      if (!this.details.length) return;

      this.controller = new AbortController();
      const signal = this.controller.signal;
      this.hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
      this.header = document.querySelector('.header-wrapper');

      this.details.forEach((details) => {
        const item = details.closest('.um-mega__item');
        const summary = details.querySelector('summary');

        details.addEventListener('toggle', () => this.onToggle(details), { signal });

        item.addEventListener('mouseenter', () => this.schedule(details, true), { signal });
        item.addEventListener('mouseleave', () => this.schedule(details, false), { signal });

        // Con mouse, el clic en el título no debe cerrar un panel abierto por hover.
        // Con teclado (event.detail === 0) se mantiene el comportamiento nativo.
        summary.addEventListener(
          'click',
          (event) => {
            if (event.detail === 0 || !this.hoverQuery.matches) return;
            if (details.open) {
              event.preventDefault();
              this.open(details);
            }
          },
          { signal }
        );

        // Pequeña demora al pasar el mouse: evita cambios de vista al cruzar en diagonal hacia los relojes.
        details.querySelectorAll('.um-mega__sublink').forEach((link) => {
          link.addEventListener(
            'mouseenter',
            () => {
              clearTimeout(this.switchTimer);
              this.switchTimer = setTimeout(() => this.activate(details, link), SWITCH_DELAY);
            },
            { signal }
          );
          link.addEventListener('mouseleave', () => clearTimeout(this.switchTimer), { signal });
          link.addEventListener('focus', () => this.activate(details, link), { signal });
        });

        details.addEventListener(
          'focusout',
          () => {
            setTimeout(() => {
              if (details.open && !details.contains(document.activeElement)) this.close(details);
            });
          },
          { signal }
        );
      });

      document.addEventListener(
        'keydown',
        (event) => {
          if (event.key !== 'Escape') return;
          const openDetails = this.details.find((details) => details.open);
          if (!openDetails) return;
          this.close(openDetails);
          openDetails.querySelector('summary').focus();
        },
        { signal }
      );

      document.addEventListener(
        'click',
        (event) => {
          if (!this.contains(event.target)) this.details.forEach((details) => this.close(details));
        },
        { signal }
      );
    }

    disconnectedCallback() {
      this.controller?.abort();
      clearTimeout(this.timer);
      clearTimeout(this.switchTimer);
    }

    schedule(details, shouldOpen) {
      if (!this.hoverQuery.matches) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(
        () => (shouldOpen ? this.open(details) : this.close(details)),
        shouldOpen ? OPEN_DELAY : CLOSE_DELAY
      );
    }

    open(details) {
      this.details.forEach((other) => other !== details && this.close(other));
      details.open = true;
    }

    close(details) {
      details.open = false;
    }

    onToggle(details) {
      if (details.open) {
        this.details.forEach((other) => other !== details && this.close(other));
        this.setAvailableHeight();
      }
      if (this.header) this.header.preventHide = this.details.some((item) => item.open);
    }

    // El panel nunca supera el alto visible debajo del header (también con header fijo o scroll).
    setAvailableHeight() {
      const bottom = this.header ? this.header.getBoundingClientRect().bottom : 0;
      this.style.setProperty('--um-mega-top', `${Math.max(0, Math.round(bottom))}px`);
    }

    activate(details, link) {
      const target = link.dataset.umTarget;
      if (!target || link.classList.contains('is-active')) return;
      details.querySelectorAll('.um-mega__sublink').forEach((item) => item.classList.toggle('is-active', item === link));
      details.querySelectorAll('.um-mega__view').forEach((view) => {
        view.hidden = view.id !== target;
      });
    }
  }

  customElements.define('um-mega-menu', UMMegaMenu);
})();
