import { Box, Menu } from '@chakra-ui/react';
import { Fragment, useCallback, useRef, useState, type MouseEvent, type ReactElement } from 'react';

import { useHasHoverCapability } from '~/shared/ui/popup';

import type { ContextMenuItem, ContextMenuProps } from './menu.types';

const MENU_WIDTH = '13rem';

/**
 * The weight of a click that never drives the menu:
 *
 * - The desktop never vetoes: the mouse click is the very way the menu opens,
 *   and the Ark trigger would toggle the very menu the component has just
 *   opened — the double transition desyncs it. In the capture phase — before
 *   any handler — the veto prevents the default, and the Ark trigger backs
 *   away.
 * - The touch never opens the menu by click — a plain tap turns the tooltip
 *   and marks the slot, and the tap on a marked slot opens the menu. The tap
 *   on the own slot closes the menu that is open.
 */
function vetoArkToggle(event: MouseEvent<HTMLDivElement>): void {
  event.preventDefault();
}

/**
 * Builds the veto of the touch clicks: the capture-phase handler that keeps
 * the Ark trigger quiet, closes the menu when the menu is already open, and
 * carries the tap of the marked slot to the menu — the tooltip steps aside
 * while the menu lives.
 */
function buildTouchClickVeto(deps: {
  isOpenRef: React.RefObject<boolean>;
  onOpenChange?: (open: boolean) => void;
  pointerRef: React.RefObject<PointerAnchor | null>;
  setIsOpen: (open: boolean) => void;
  shouldOpenOnTap?: () => boolean;
}): (event: MouseEvent<HTMLDivElement>) => void {
  const { isOpenRef, onOpenChange, pointerRef, setIsOpen, shouldOpenOnTap } = deps;
  return function vetoTouchClick(event: MouseEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (isOpenRef.current) {
      setIsOpen(false);
      onOpenChange?.(false);
      pointerRef.current = null;
      return;
    }
    if (shouldOpenOnTap?.() !== true) {
      return;
    }
    // The slot is already marked: the tap is a command, not an answer. The
    // event sinks here — the mark would only be set again, and the tooltip
    // would fight the menu it just lost to.
    event.stopPropagation();
    pointerRef.current = pointerAnchorAt(event.clientX, event.clientY);
    setIsOpen(true);
    onOpenChange?.(true);
  };
}

/**
 * The anchor of the menu at the point of the pointer.
 *
 * E um elemento virtual: um retangulo de zero tamanho no ponto do ponteiro, e
 * e ele que faz o menu abrir ali.
 */
function pointerAnchorAt(x: number, y: number): PointerAnchor {
  return {
    getBoundingClientRect: function readRect(): DOMRect {
      return new DOMRect(x, y, 0, 0);
    },
  };
}

type PointerAnchor = {
  getBoundingClientRect(): DOMRect;
};

type ContextMenuEvent = {
  clientX: number;
  clientY: number;
  preventDefault(): void;
  /** Distinguishes the left click from the context menu event. */
  type: string;
};

/**
 * The context menu of an element.
 *
 * It is the `Menu` of the Chakra (Ark UI): the click opens the menu, e o
 * **clique — esquerdo ou direito do mouse** abre o mesmo menu, na posicao do
 * ponteiro. No toque, o menu abre com o segundo toque no slot marcado.
 *
 * O menu e o lugar das acoes do elemento: o que o jogador pode fazer com
 * aquela criatura ou com aquele item. O popup e o lugar da informacao.
 *
 * O gatilho do menu vive num `Box` de `display: contents`, e nao no elemento
 * do gatilho em si: os atributos do menu (`id`, `data-scope`) nao podem
 * pousar no mesmo node que os do tooltip — quem perde e a identidade do
 * tooltip, e o painel dele nasce parado na origem. Os eventos sobem pelo
 * wrapper; o layout e o hover seguem do elemento de dentro.
 *
 * O que nao e nosso e o texto do item e o divisor: a receita `menu` do tema
 * default desenha o divisor em `bg.muted` — um token que o sistema nao tem,
 * que resolve para o cinza claro do tema padrao e sai branco sobre o painel
 * escuro. O separador e o divisor do sistema (`border`), e o texto da opcao
 * e o rotulo do sistema (`textStyle label`), como no resto da interface.
 */
export function ContextMenu(props: ContextMenuProps): ReactElement {
  const { children, items, onOpenChange, shouldOpenOnTap } = props;
  const hasHover = useHasHoverCapability();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<PointerAnchor | null>(null);
  const isOpenRef = useRef<boolean>(false);
  isOpenRef.current = isOpen;
  const itemsNode = items.map(renderItem);
  const positioning = buildPositioning(anchorRef, pointerRef);
  const handleContextMenu = useTriggerHandler(pointerRef, setIsOpen, undefined, onOpenChange);
  const handleClick = useTriggerHandler(pointerRef, setIsOpen, isOpenRef, onOpenChange);
  const handleOpenChange = useOpenHandler(pointerRef, setIsOpen, onOpenChange);
  const menuClickHandler = hasHover ? handleClick : undefined;
  const menuClickVeto = hasHover
    ? vetoArkToggle
    : buildTouchClickVeto({ isOpenRef, onOpenChange, pointerRef, setIsOpen, shouldOpenOnTap });

  return (
    <Menu.Root onOpenChange={handleOpenChange} open={isOpen} positioning={positioning}>
      <Box display="inline-flex" onClickCapture={menuClickVeto} ref={anchorRef}>
        <Menu.Trigger asChild>
          <Box display="contents" onClick={menuClickHandler} onContextMenu={handleContextMenu}>
            {children}
          </Box>
        </Menu.Trigger>
      </Box>
      <MenuSurface>{itemsNode}</MenuSurface>
    </Menu.Root>
  );
}

/**
 * The floating surface: panel, edge and shadow of the menu. Always mounted —
 * the Ark machine owns whether it shows.
 */
function MenuSurface(props: { children: React.ReactNode }): ReactElement {
  const { children } = props;
  return (
    <Menu.Positioner>
      <Menu.Content
        bg="bg.panel"
        borderColor="border.emphasized"
        borderRadius="sm"
        borderWidth="1px"
        boxShadow="overlay"
        minW={MENU_WIDTH}
        padding="1"
      >
        {children}
      </Menu.Content>
    </Menu.Positioner>
  );
}

function useTriggerHandler(
  pointerRef: React.RefObject<PointerAnchor | null>,
  setIsOpen: (open: boolean) => void,
  isOpenRef?: React.RefObject<boolean>,
  onOpen?: (open: boolean) => void,
): (event: ContextMenuEvent) => void {
  return useCallback(
    function openAtThePointer(event: ContextMenuEvent): void {
      if (isOpenRef !== undefined && isOpenRef.current) {
        if (event.type === 'contextmenu') {
          // The menu is already open: the right button does not drive it, e
          // o menu nativo do navegador nunca sobe no lugar do nosso.
          event.preventDefault();
          return;
        }
        // The SDK keeps one meaning per event: a second click on the same
        // trigger closes the menu this component opened.
        setIsOpen(false);
        onOpen?.(false);
        return;
      }
      event.preventDefault();
      pointerRef.current = pointerAnchorAt(event.clientX, event.clientY);
      setIsOpen(true);
      // The Ark machine only reports onOpenChange for transitions it starts
      // itself. This handler owns the open, so the outside world learns it
      // here.
      onOpen?.(true);
    },
    [isOpenRef, pointerRef, setIsOpen, onOpen],
  );
}

/**
 * A abertura e o fechamento do menu: o ponto do ponteiro vale so enquanto o
 * menu esta aberto.
 */
function useOpenHandler(
  pointerRef: React.RefObject<PointerAnchor | null>,
  setIsOpen: (open: boolean) => void,
  onOpenChange?: (open: boolean) => void,
): (details: { open: boolean }) => void {
  return useCallback(
    function changeOpen(details: { open: boolean }): void {
      setIsOpen(details.open);
      onOpenChange?.(details.open);
      if (!details.open) {
        pointerRef.current = null;
      }
    },
    [pointerRef, setIsOpen, onOpenChange],
  );
}

function renderItem(item: ContextMenuItem): ReactElement {
  const { dividerBefore, label, onSelect, tone = 'ghost' } = item;
  const color = tone === 'danger' ? 'blood.emphasized' : 'fg';
  const sep = dividerBefore ? <Menu.Separator bg="border" /> : null;
  const node = (
    <Menu.Item key={label} onClick={onSelect} textStyle="label" value={label}>
      <Box color={color} width="full">
        {label}
      </Box>
    </Menu.Item>
  );
  return (
    <Fragment key={label}>
      {sep}
      {node}
    </Fragment>
  );
}

/**
 * The position of the menu.
 *
 * A ancora e a caixa do gatilho, e o ponteiro do botao direito quando o menu
 * foi aberto por ele: um menu de contexto nasce no ponto do clique.
 */
function buildPositioning(
  anchorRef: React.RefObject<HTMLDivElement | null>,
  pointerRef: React.RefObject<PointerAnchor | null>,
): {
  getAnchorElement: () => HTMLElement | PointerAnchor | null;
  placement: 'bottom-start';
} {
  return {
    getAnchorElement: function getAnchor(): HTMLElement | PointerAnchor | null {
      return pointerRef.current ?? anchorRef.current;
    },
    placement: 'bottom-start',
  };
}
