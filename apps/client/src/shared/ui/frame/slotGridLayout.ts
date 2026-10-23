import { SLOT_GAP_REM, SLOT_SIZE_REM } from './slot.constants';

/**
 * The columns used while the width of the grid is unknown.
 *
 * The grid measures itself, and the measurement lands after the first render.
 * The fallback keeps the grid from showing nothing while it waits: without it
 * an empty backpack would show an empty area and then jump.
 */
export const DEFAULT_SLOT_COLUMNS = 11;

/**
 * How many columns fit in a width.
 *
 * The slot and o espaço entre ele são medidos em pixels: a grade conta com o
 * tamanho que o slot tem **agora**, e o slot escala com a fonte da raiz.
 *
 * A width of zero means "not measured yet", not "no columns at all".
 */
export function computeSlotColumns(width: number, slotSize: number, gap: number): number {
  if (width <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor((width + gap) / (slotSize + gap)));
}

/**
 * The size of the slot and the space between them, in pixels.
 *
 * A raiz da pagina e quem manda no tamanho: a escala da interface muda a
 * fonte dela, e o slot, que esta em `rem`, acompanha.
 */
export function readSlotMetrics(): { gap: number; size: number } {
  const rootSize = readRootFontSize();
  return { gap: SLOT_GAP_REM * rootSize, size: SLOT_SIZE_REM * rootSize };
}

/**
 * The font size of the root, in pixels.
 *
 * A fonte da raiz e o que a escala da interface move. Sem fonte (o documento
 * ainda nao existe), o tamanho de referencia e o do design.
 */
function readRootFontSize(): number {
  if (typeof document === 'undefined') {
    return 16;
  }
  const computed = getComputedStyle(document.documentElement).fontSize;
  const size = Number(computed.replace('px', ''));
  if (!Number.isFinite(size) || size <= 0) {
    return 16;
  }
  return size;
}

/**
 * The columns the grid works with.
 *
 * The measured ones when the grid knows its width; the fallback when it does
 * not and there is no item to show.
 */
export function resolveSlotColumns(columns: number, filled: number): number {
  if (columns > 0) {
    return columns;
  }
  if (filled === 0) {
    return DEFAULT_SLOT_COLUMNS;
  }
  return 0;
}

/**
 * The empty slots that complete the last row.
 *
 * The grid shows full rows: the last row of the items is completed with empty
 * slots, and a grid with no item at all shows one full row of empty slots —
 * the player sees that the slots are there, instead of an empty area.
 *
 * The grid does not grow: the empty slots never make a row of their own.
 */
export function computeEmptySlotCount(columns: number, filled: number): number {
  if (columns <= 0) {
    return 0;
  }
  if (filled === 0) {
    return columns;
  }
  return (columns - (filled % columns)) % columns;
}
