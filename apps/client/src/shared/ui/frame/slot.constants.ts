/**
 * O tamanho do slot.
 *
 * O slot é a unidade da interface, e ele é medido em `rem` — não em pixels.
 * A escala da interface muda a fonte da raiz, e tudo que está em `rem` cresce
 * junto: um pixel é fixo, e é por isso que o slot, a toolbar e o botão de
 * caçar ficavam do mesmo tamanho em qualquer tela.
 */
export const SLOT_SIZE = '3.5rem';

/** O tamanho do slot em rem, para a medição da grade em pixels. */
export const SLOT_SIZE_REM = 3.5;

/** O espaço entre dois slots, em rem. */
export const SLOT_GAP_REM = 0.25;
