/**
 * Ultra Maison — megamenú V3.
 *
 * <um-nav-mega> (escritorio): basado en <details>, funciona con teclado y sin JS. Agrega apertura con
 * hover (si el editor lo indica y el puntero lo permite), un único panel abierto, cierre con Escape /
 * clic fuera / salida del foco, y cambio de familia al pasar el mouse o con el foco.
 *
 * <um-nav-drawer> (celular): pestañas y acordeones dentro del drawer de Dawn. Dawn cierra el drawer
 * con cualquier <button> (MenuDrawer.onCloseButtonClick), así que los controles propios se atienden en
 * fase de captura y no se propagan.
 */
(() => {
  const OPEN_DELAY = 120;
  const CLOSE_DELAY = 220;
  const SWITCH_DELAY = 90;

  // Fotos del menú: se piden en cuanto hay intención (mouse sobre la barra, foco o drawer abierto), para que
  // el panel se abra con las fotos ya listas. Sin intención no se descarga nada (carga diferida).
  const warmImages = (root) => {
    root.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      img.loading = 'eager';
    });
  };

  if (!customElements.get('um-nav-mega')) {
    class UMNavMega extends HTMLElement {
      connectedCallback() {
        this.details = [...this.querySelectorAll('.umv3__details')];
        if (!this.details.length) return;

        this.controller = new AbortController();
        const signal = this.controller.signal;
        this.hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
        this.useHover = this.dataset.trigger !== 'click';
        this.header = document.querySelector('.header-wrapper');

        this.details.forEach((details) => {
          const item = details.closest('.umv3__item');
          const summary = details.querySelector('summary');
          summary.setAttribute('aria-expanded', 'false');

          details.addEventListener('toggle', () => this.onToggle(details), { signal });

          if (this.useHover) {
            item.addEventListener('mouseenter', () => this.schedule(details, true), { signal });
            item.addEventListener('mouseleave', () => this.schedule(details, false), { signal });

            // Con mouse, el clic en el título no cierra un panel abierto por hover (teclado: nativo).
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
          }

          details.querySelectorAll('[data-umv3-target]').forEach((family) => {
            family.addEventListener(
              'mouseenter',
              () => {
                if (!this.hoverQuery.matches) return;
                clearTimeout(this.switchTimer);
                this.switchTimer = setTimeout(() => this.activate(details, family), SWITCH_DELAY);
              },
              { signal }
            );
            family.addEventListener('mouseleave', () => clearTimeout(this.switchTimer), { signal });
            family.addEventListener('focus', () => this.activate(details, family), { signal });
            family.addEventListener(
              'click',
              (event) => {
                // Sin destino propio (#) o en pantallas táctiles con la familia aún no activa: solo cambia la vista.
                const noTarget = family.getAttribute('role') === 'button';
                const firstTouch = !this.hoverQuery.matches && !family.classList.contains('is-active');
                if (noTarget || firstTouch) {
                  event.preventDefault();
                  this.activate(details, family);
                }
              },
              { signal }
            );
            family.addEventListener(
              'keydown',
              (event) => {
                if (family.getAttribute('role') === 'button' && event.key === ' ') {
                  event.preventDefault();
                  this.activate(details, family);
                }
              },
              { signal }
            );
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

        const warm = () => warmImages(this);
        this.addEventListener('pointerenter', warm, { once: true, signal });
        this.addEventListener('focusin', warm, { once: true, signal });

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
        details.querySelector('summary').setAttribute('aria-expanded', String(details.open));
        if (details.open) {
          this.details.forEach((other) => other !== details && this.close(other));
          this.setAvailableHeight();
        }
        if (this.header) this.header.preventHide = this.details.some((item) => item.open);
      }

      // El panel nunca supera el alto visible debajo del header (también con header fijo o scroll).
      setAvailableHeight() {
        const bottom = this.header ? this.header.getBoundingClientRect().bottom : 0;
        this.style.setProperty('--umv3-top', `${Math.max(0, Math.round(bottom))}px`);
      }

      activate(details, family) {
        const target = family.dataset.umv3Target;
        if (!target || family.classList.contains('is-active')) return;
        details.querySelectorAll('[data-umv3-target]').forEach((item) => item.classList.toggle('is-active', item === family));
        details.querySelectorAll('.umv3__view').forEach((view) => {
          view.hidden = view.id !== target;
        });
      }
    }

    customElements.define('um-nav-mega', UMNavMega);
  }

  if (!customElements.get('um-nav-drawer')) {
    class UMNavDrawer extends HTMLElement {
      connectedCallback() {
        this.controller = new AbortController();
        const signal = this.controller.signal;

        // Captura: se atiende antes que los listeners de Dawn en cada <button> y se corta la propagación.
        this.addEventListener(
          'click',
          (event) => {
            const tab = event.target.closest('.umv3-d__tab');
            const acc = event.target.closest('.umv3-d__acc-btn');
            if (!tab && !acc) return;
            event.stopPropagation();
            event.preventDefault();
            if (tab) this.selectTab(tab);
            else this.toggle(acc);
          },
          { capture: true, signal }
        );

        // Fotos: se piden al abrir el drawer (no antes).
        const drawer = this.closest('details');
        if (drawer) {
          const warm = () => drawer.open && warmImages(this);
          drawer.addEventListener('toggle', warm, { signal });
          warm();
        }

        // Desvanecido de la barra de pestañas solo mientras quedan categorías a la derecha.
        const bar = this.querySelector('.umv3-d__tabs');
        if (bar) {
          const syncEnd = () => bar.toggleAttribute('data-end', bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 2);
          bar.addEventListener('scroll', syncEnd, { passive: true, signal });
          window.addEventListener('resize', syncEnd, { signal });
          requestAnimationFrame(syncEnd);
          // El drawer se abre oculto: se recalcula al mostrarse.
          new ResizeObserver(syncEnd).observe(bar);
        }

        // Flechas entre pestañas (patrón de tabs accesibles).
        this.addEventListener(
          'keydown',
          (event) => {
            const tab = event.target.closest('.umv3-d__tab');
            if (!tab) return;
            const tabs = [...this.querySelectorAll('.umv3-d__tab')];
            const index = tabs.indexOf(tab);
            let next = null;
            if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
            if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
            if (event.key === 'Home') next = tabs[0];
            if (event.key === 'End') next = tabs[tabs.length - 1];
            if (!next) return;
            event.preventDefault();
            this.selectTab(next);
            next.focus();
          },
          { signal }
        );
      }

      disconnectedCallback() {
        this.controller?.abort();
      }

      selectTab(tab) {
        this.querySelectorAll('.umv3-d__tab').forEach((item) => {
          const selected = item === tab;
          item.setAttribute('aria-selected', String(selected));
          item.tabIndex = selected ? 0 : -1;
          const panel = document.getElementById(item.getAttribute('aria-controls'));
          if (panel) panel.hidden = !selected;
        });
        // Barra deslizable: la pestaña elegida queda a la vista (solo desplazamiento horizontal de la barra).
        const bar = tab.parentElement;
        const left = tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2;
        bar.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      }

      // Un acordeón abierto por nivel: al abrir uno se cierran sus hermanos.
      toggle(button) {
        const willOpen = button.getAttribute('aria-expanded') !== 'true';
        const group = button.closest('.umv3-d__acc').parentElement;
        group.querySelectorAll(':scope > .umv3-d__acc > .umv3-d__acc-btn').forEach((other) => {
          if (other !== button) this.setOpen(other, false);
        });
        this.setOpen(button, willOpen);
      }

      setOpen(button, open) {
        button.setAttribute('aria-expanded', String(open));
        const panel = document.getElementById(button.getAttribute('aria-controls'));
        if (panel) panel.hidden = !open;
      }
    }

    customElements.define('um-nav-drawer', UMNavDrawer);
  }
})();
