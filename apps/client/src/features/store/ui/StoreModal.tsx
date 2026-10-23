import { Box } from '@chakra-ui/react';
import type { StoreCatalog } from '@creatures/contracts/store';
import type { ReactElement, RefObject } from 'react';
import { useEffect, useRef } from 'react';

import type { StoreTab, StoreView } from '~/features/store/model/store.types';
import { useStore } from '~/features/store/model/useStore';
import { StoreBuyFooter } from '~/features/store/ui/StoreBuyFooter';
import { StoreBuyPanel } from '~/features/store/ui/StoreBuyPanel';
import { StoreSellFooter } from '~/features/store/ui/StoreSellFooter';
import { StoreSellPanel } from '~/features/store/ui/StoreSellPanel';
import { DIVIDER_BOTTOM } from '~/shared/theme';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '~/shared/ui/modal';
import { Tab, TabBar, TabPanel, Tabs } from '~/shared/ui/tab';
import { Text } from '~/shared/ui/text';

const TITLE = 'Loja';
const BUY_LABEL = 'Comprar';
const SELL_LABEL = 'Vender';
const STORE_WIDTH = '45rem';
const STORE_HEIGHT = '38.75rem';
const BUY_TAB = 'buy';
const SELL_TAB = 'sell';

export type StoreModalProps = {
  contained?: boolean;
  isOpen: boolean;
  onClose: () => void;
  /** The catalog of samples, when the store is shown outside the game. */
  snapshot?: StoreCatalog | null;
};

/**
 * The store of the city.
 *
 * The modal has two tabs: the buy, which is the one that opens, and the sell.
 * The modal does not pause the game: the simulation keeps running with it
 * open.
 */
export function StoreModal(props: StoreModalProps): ReactElement {
  const { contained = false, isOpen, onClose, snapshot = null } = props;
  const store = useStore(isOpen, onClose, snapshot);
  const footerRef = useSelectionDismiss({
    clearSelection: keepHighlighted,
    isOpen,
    selectedBagItemId: store.selectedBagItemId,
    selectedItemId: store.selectedItemId,
  });
  const tabs = buildTabs(store);
  const footer = buildFooter(store);
  return (
    <Modal
      contained={contained}
      height={STORE_HEIGHT}
      isOpen={isOpen}
      onClose={store.close}
      width={STORE_WIDTH}
    >
      {tabs}
      <ModalFooter>
        <Box ref={footerRef} alignItems="center" display="flex" flex="1" gap="2">
          {footer}
        </Box>
      </ModalFooter>
    </Modal>
  );
}

/**
 * The tabs of the modal, with the panel of the one that is active.
 */
function buildTabs(store: StoreView): ReactElement {
  const tabChange = buildTabChange(store.setTab);
  const error = buildErrorMessage(store.error);
  const buyPanel = (
    <TabPanel value={BUY_TAB}>
      <StoreBuyPanel store={store} />
    </TabPanel>
  );
  const sellPanel = (
    <TabPanel value={SELL_TAB}>
      <StoreSellPanel store={store} />
    </TabPanel>
  );
  return (
    <Tabs onValueChange={tabChange} value={store.tab}>
      <ModalHeader>{TITLE}</ModalHeader>
      <Box css={DIVIDER_BOTTOM} paddingBlock="2" paddingInline="4">
        <TabBar>
          <Tab value={BUY_TAB}>{BUY_LABEL}</Tab>
          <Tab value={SELL_TAB}>{SELL_LABEL}</Tab>
        </TabBar>
      </Box>
      <ModalBody>
        {error}
        {buyPanel}
        {sellPanel}
      </ModalBody>
    </Tabs>
  );
}

/**
 * The footer of the tab the modal is showing.
 */
function buildFooter(store: StoreView): ReactElement {
  if (store.tab === 'sell') {
    return <StoreSellFooter store={store} />;
  }
  return <StoreBuyFooter store={store} />;
}

/**
 * The message of the last refusal of the server.
 */
function buildErrorMessage(message: string | null): ReactElement | null {
  if (message === null) {
    return null;
  }
  return (
    <Text color="fg.error" marginBlockEnd="3" variant="meta">
      {message}
    </Text>
  );
}

/**
 * The change of the tab: the modal resets itself when the tab changes.
 */
function buildTabChange(setTab: (tab: StoreTab) => void): (value: string) => void {
  return function changeTab(value: string): void {
    setTab(value === SELL_TAB ? 'sell' : 'buy');
  };
}

type StoreSelection = {
  selectedBagItemId: string | null;
  selectedItemId: string | null;
};

/**
 * The dismissal of the highlight, while the modal is open.
 *
 * It follows the house standard: the document listeners of
 * `SkillPanelOverlay.closeOnOutsideClick`. The ref it returns is the footer —
 * the region the dismissal keeps, because the footer is where the selection
 * continues. The decision itself lives in `clearOnOutsideClick`.
 */
function useSelectionDismiss(props: {
  clearSelection(): void;
  isOpen: boolean;
  selectedBagItemId: string | null;
  selectedItemId: string | null;
}): RefObject<HTMLDivElement | null> {
  const { clearSelection, isOpen, selectedBagItemId, selectedItemId } = props;
  const footerRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<StoreSelection>(buildSelection(selectedBagItemId, selectedItemId));
  const atPointerDownRef = useRef<StoreSelection>(selectionRef.current);
  selectionRef.current = buildSelection(selectedBagItemId, selectedItemId);

  useEffect(
    function listen(): (() => void) | undefined {
      function handlePointerDown(): void {
        atPointerDownRef.current = selectionRef.current;
      }
      function handleClick(event: MouseEvent): void {
        clearOnOutsideClick(
          footerRef.current,
          atPointerDownRef.current,
          selectionRef.current,
          clearSelection,
          event,
        );
      }
      if (!isOpen) {
        return undefined;
      }
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('click', handleClick);
      return function remove(): void {
        document.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('click', handleClick);
      };
    },
    [clearSelection, isOpen],
  );

  return footerRef;
}

/**
 * The click anywhere — inside the modal or outside it — clears the highlight.
 *
 * Two clicks are kept. The first is the click that chose the item: the
 * selection at the pointer down and the selection at the click are compared,
 * and any difference means the click was the choice — the same rising edge as
 * the `openSlotRef` of `SkillPanelOverlay`, so the click that selects the slot
 * never clears its own highlight. The second is the click on the footer: the
 * footer is where the selection continues — the quantity, the total and the
 * action —, and a click there is the player choosing the quantity, not
 * walking away from the item. Dismissing on it would close the quantity
 * context on the very click that uses it.
 */
function clearOnOutsideClick(
  footer: HTMLDivElement | null,
  atPointerDown: StoreSelection,
  atClick: StoreSelection,
  clearSelection: () => void,
  event: MouseEvent,
): void {
  const target = event.target;
  if (footer !== null && target instanceof Node && footer.contains(target)) {
    return;
  }
  if (atClick.selectedBagItemId !== atPointerDown.selectedBagItemId) {
    return;
  }
  if (atClick.selectedItemId !== atPointerDown.selectedItemId) {
    return;
  }
  clearSelection();
}

/**
 * The selection as the dismissal reads it: the two ids that say which slot is
 * highlighted.
 */
function buildSelection(
  selectedBagItemId: string | null,
  selectedItemId: string | null,
): StoreSelection {
  return { selectedBagItemId, selectedItemId };
}

function keepHighlighted(): void {
  // Keep the selected slot highlighted while the transaction is edited.
}
