import type { ReactNode } from 'react';

/**
 * The four states of a slot.
 *
 * - **filled**: there is content, and it takes the whole width and height of
 *   the slot;
 * - **selected**: the slot was clicked. It shows the **border** of the
 *   selected state (two pixels, drawn on top of the content, so the art
 *   meets it at every corner) **and** the corner bracket at the top left.
 *   The border is a real border, not an outline, so it does not
 *   fight the outline of the keyboard focus, which lives outside the element.
 *   It does **not** mean the creature is in the team nor that it is the active
 *   one — that is the domain, not the slot;
 * - **equipped**: the item is equipped somewhere. The corner bracket goes at
 *   the bottom right;
 * - **empty**: there is nothing.
 *
 * The selection ring and the corner bracket are different things: the ring
 * marks a selection (a card, a trainer), the bracket marks the slot that is
 * selected. A slot never draws the ring.
 */
export type SlotProps = {
  children?: ReactNode;
  empty?: boolean;
  equipped?: boolean;
  selected?: boolean;
};
