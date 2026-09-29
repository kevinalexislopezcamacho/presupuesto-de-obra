/**
 * Íconos dibujados (SVG) para lo que la letra de la página no trae (✓, ✗, sol y luna): así todo el texto se ve
 * con la misma letra. Toman el color y el tamaño del texto que los rodea (clase .ico en base.css).
 */
const svg = (trazos, grosor = 2.4) =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazos}</svg>`;

export const ICONO_SI = svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.8);
export const ICONO_NO = svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 2.8);
export const ICONO_SOL = svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>', 1.8);
export const ICONO_LUNA = svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', 1.8);
