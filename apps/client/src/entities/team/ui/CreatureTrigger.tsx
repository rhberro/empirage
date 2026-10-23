import { Box } from '@chakra-ui/react';
import type { Creature } from '@creatures/contracts/creature';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { ContextMenu } from '~/shared/ui/menu';
import type { ContextMenuItem } from '~/shared/ui/menu';
import { Popup, useHasHoverCapability, useSlotTooltip } from '~/shared/ui/popup';

import { CreatureDetailsModal } from './CreatureDetailsModal';
import { CreatureTooltip } from './CreatureTooltip';

const DETAILS_LABEL = 'Ver detalhes';

export type CreatureTriggerProps = {
  /** The actions of the creature, antes da acao dos detalhes. */
  actions?: ContextMenuItem[];
  creature: Creature;
  /** The element that abre o popup e o menu. */
  children: ReactElement;
  /** The status of the creature, when the game has one to show. */
  status?: string | null;
  /**
   * The mark of the tap that opens the menu: a marked slot answers the second
   * tap with the menu, an unmarked one answers with the tooltip. The desktop
   * never asks.
   */
  selected?: boolean;
};

/**
 * The trigger of a creature.
 *
 * O hover mostra o popup com a ficha rapida da criatura, e o clique — esquerdo
 * ou direito do mouse — abre o menu com as acoes dela. Enquanto o menu esta
 * aberto, o popup fica fechado: um tooltip que sobrevive ao menu compete com
 * ele pelo mesmo ponteiro. Depois que o menu fecha, o hover volta a mandar —
 * e volta na primeira passada, sem re-entrar duas vezes.
 *
 * O toque manda no celular: o toque abre o popup com a ficha e marca a
 * criatura, e o segundo toque na criatura marcada abre o menu. Um toque fora
 * da criatura fecha o popup.
 */
export function CreatureTrigger(props: CreatureTriggerProps): ReactElement {
  const { actions = [], creature, children, selected, status = null } = props;
  const hasHover = useHasHoverCapability();
  const slotTooltip = useSlotTooltip(hasHover);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  const items = buildCreatureMenuItems(actions, setIsDetailsOpen);
  const tooltip = <CreatureTooltip creature={creature} status={status} />;
  const close = buildClose(setIsDetailsOpen);
  const menuOpenChange = buildMenuOpenChange(slotTooltip.setMenuOpen);
  const touchTapToggle = hasHover ? undefined : slotTooltip.handleTapToggle;
  const shouldOpenOnTap = selected === undefined ? undefined : buildTapGate(selected);
  const trigger = (
    <Popup content={tooltip} disabled={slotTooltip.menuOpen} open={slotTooltip.open}>
      {children}
    </Popup>
  );
  return (
    <>
      <ContextMenu items={items} onOpenChange={menuOpenChange} shouldOpenOnTap={shouldOpenOnTap}>
        <Box
          display="contents"
          onClick={touchTapToggle}
          onPointerDown={slotTooltip.handlePointerDown}
          onPointerEnter={slotTooltip.handlePointerEnter}
          onPointerLeave={slotTooltip.handlePointerLeave}
          ref={slotTooltip.triggerRef}
        >
          {trigger}
        </Box>
      </ContextMenu>
      <CreatureDetailsModal creature={creature} isOpen={isDetailsOpen} onClose={close} />
    </>
  );
}

/**
 * The menu of the creature: the common actions come first, and the
 * destructive ones come last — separated by a divider, nothing out there
 * happens by accident.
 */
function buildCreatureMenuItems(
  actions: ContextMenuItem[],
  openDetails: (open: boolean) => void,
): ContextMenuItem[] {
  const common = actions.filter(isCommonAction);
  const destructive = actions.filter(isDestructiveAction);
  const destructiveWithDivider = destructive.map(function markDivider(item: ContextMenuItem) {
    return { ...item, dividerBefore: true };
  });
  const details = buildDetailsItem(openDetails, actions.length > 0);
  return [...common, details, ...destructiveWithDivider];
}

function isDestructiveAction(item: ContextMenuItem): boolean {
  return item.tone === 'danger';
}

function isCommonAction(item: ContextMenuItem): boolean {
  return !isDestructiveAction(item);
}

/**
 * The action that opens the details of the creature.
 */
function buildDetailsItem(open: (open: boolean) => void, dividerBefore: boolean): ContextMenuItem {
  return {
    dividerBefore,
    label: DETAILS_LABEL,
    onSelect: function showDetails(): void {
      open(true);
    },
  };
}

function buildClose(close: (open: boolean) => void): () => void {
  return function hideDetails(): void {
    close(false);
  };
}

/**
 * The gate of the tap: the marked slot answers the second tap with the menu,
 * an unmarked one with the tooltip.
 */
function buildTapGate(marked: boolean): () => boolean {
  return function isSlotMarked(): boolean {
    return marked;
  };
}

/**
 * The edge of the menu for the popup: the open and the close say open shut,
 * so the popup stays closed while the menu is open and the hover rules
 * again after.
 */
function buildMenuOpenChange(change: (open: boolean) => void): (open: boolean) => void {
  return function openChanged(open: boolean): void {
    change(open);
  };
}
