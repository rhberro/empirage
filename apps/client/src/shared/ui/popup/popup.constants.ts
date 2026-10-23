/**
 * The width of the panel: it is the width of the current popup, and it is in
 * `rem` so the panel scales with the interface.
 */
export const PANEL_WIDTH = '15rem';

/**
 * The smallest width of the panel: um popup de uma palavra nao pode ser uma
 * tira de texto solto no canto da tela.
 */
export const PANEL_MIN_WIDTH = '9rem';

/** The panel never leaves the screen. */
export const PANEL_MAX_WIDTH = 'calc(100vw - 2rem)';

/**
 * The position of the panel: below the trigger, aligned with its edge, e
 * presa à viewport (`fixed`): o painel nunca é recortado pelo contentor do
 * modal, que corta o que sai de dentro. O resto vem do padrão do Ark
 * (`@zag-js/popper`): `flip` e `slide` ligados, gutter de 8 e padding de 8 —
 * então o painel vira para cima quando não há espaço embaixo.
 */
export const POPUP_POSITIONING = { placement: 'bottom-start' } as const;
