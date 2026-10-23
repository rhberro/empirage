import type { ReactElement, ReactNode } from 'react';

import type { TriggerProps } from '~/shared/ui/trigger';

export type PopupProps = {
  /** The element that opens the popup. */
  children: ReactElement;
  /** The content of the panel. */
  content: ReactNode;
  /** Disables the hover popup, used while a contextual menu is open. */
  disabled?: boolean;
  /**
   * The open state of the panel, when the consumer owns it.
   *
   * `false` holds the panel shut while the state lasts: the hover stops
   * opening it. `undefined` restores the behavior by default, where the
   * hover of the trigger rules.
   */
  open?: boolean;
} & TriggerProps;
