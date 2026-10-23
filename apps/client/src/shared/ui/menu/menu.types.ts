import type { ReactElement } from 'react';

export type ContextMenuItem = {
  /** A divider que separa o item do anterior. */
  dividerBefore?: boolean;
  /** The label of the action. */
  label: string;
  /** The action of the item. */
  onSelect: () => void;
  /** The tone of the item: a acao destrutiva e vermelha. */
  tone?: 'danger' | 'ghost';
};

export type ContextMenuProps = {
  /** The element that opens the menu. */
  children: ReactElement;
  /** The actions of the element. */
  items: ContextMenuItem[];
  /** The rising and the falling edge of the menu, para quem precisa reagir a ele. */
  onOpenChange?: (open: boolean) => void;
  /**
   * The touch reads the slot before the click reaches the menu: when the
   * callback answers yes, the tap on the own slot opens the menu instead of
   * touching the tooltip. The desktop never asks.
   */
  shouldOpenOnTap?: () => boolean;
};
