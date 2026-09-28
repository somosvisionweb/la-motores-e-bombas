'use client';

import { useEffect } from 'react';

/**
 * Revela ao rolar (discreto): elementos `.reveal` fora da primeira tela começam levemente abaixo e transparentes.
 * Depois da animação o atributo é removido, devolvendo ao elemento as transições do próprio componente (hover).
 * Sem JavaScript ou com "reduzir movimento", tudo aparece normalmente.
 */
export function RevealController() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (items.length === 0 || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timers = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.dataset.reveal = 'visible';
          observer.unobserve(el);
          const timer = window.setTimeout(() => {
            el.removeAttribute('data-reveal');
            timers.delete(timer);
          }, 1200);
          timers.add(timer);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    for (const el of items) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) continue;
      el.dataset.reveal = 'pending';
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      for (const timer of timers) window.clearTimeout(timer);
      // Nada fica invisível se o componente for desmontado no meio do caminho.
      for (const el of items) el.removeAttribute('data-reveal');
    };
  }, []);

  return null;
}
