import { useCallback, useEffect, useRef } from 'react';

/**
 * The dismissal of the selection, in the way the house does it: the same
 * document listeners of `SkillPanelOverlay.closeOnOutsideClick`.
 *
 * The click anywhere — inside the modal or outside it — clears the mark,
 * unless the click chose a creature or talked to the menu of its own slot:
 * o clique que abre o menu da criatura escolhida mantem a marca, e o clique
 * que fecha o menu (o item que executa a acao, o segundo clique no slot, o
 * clique fora) a limpa. O clique no fundo do painel do menu fecha nada:
 * a marca fica.
 *
 * O momento da decisao e o `pointerdown`, nao o clique: nele o DOM do menu
 * ainda e o de verdade, antes de qualquer desmonte. O clique que escolhe uma
 * criatura tambem fica guardado no mesmo escopo do evento: o handler da celula
 * roda antes do listener do document, entao a marca que ele deixa sobrevive
 * a leitura do clique.
 */
// eslint-disable-next-line max-lines-per-function
export function useSelectionDismiss(props: {
  onClearSelection(): void;
  onSelect(creatureId: string): void;
  onSelectTeam?(creatureId: string): void;
}): { select: (creatureId: string) => void; selectTeam: (creatureId: string) => void } {
  const { onClearSelection, onSelect, onSelectTeam } = props;
  const clearRef = useRef(onClearSelection);
  clearRef.current = onClearSelection;

  /**
   * The choice of the interaction: the creature the click itself chose, valid
   * from the click of the cell to the reading at the document, and only there.
   */
  const choiceRef = useRef<string | null>(null);

  /**
   * The menu, read at the pointer down: open or gone, whether the pointer has
   * fallen inside of it, and whether it has fallen on the slot marked.
   */
  const menuRef = useRef<{ open: boolean; onMarkedSlot: boolean; underPointer: boolean }>({
    onMarkedSlot: false,
    open: false,
    underPointer: false,
  });

  /**
   * Every choice the document reads has to sit a click apart from the mark:
   * the team slot lives in the same modal and the dismissal clears the mark
   * of a click that has chosen nothing.
   */
  const withinTheEventScope = useCallback(function chooseWithinTheEventScope(
    creatureId: string,
    onChoice: (creatureId: string) => void,
  ): void {
    choiceRef.current = creatureId;
    onChoice(creatureId);
  }, []);

  const select = useCallback(
    function selectCell(creatureId: string): void {
      withinTheEventScope(creatureId, onSelect);
    },
    [onSelect, withinTheEventScope],
  );

  const selectTeam = useCallback(
    function selectTeamCreature(creatureId: string): void {
      if (onSelectTeam === undefined) {
        return;
      }
      withinTheEventScope(creatureId, onSelectTeam);
    },
    [onSelectTeam, withinTheEventScope],
  );

  // eslint-disable-next-line max-lines-per-function
  useEffect(function listen(): () => void {
    function handlePointerDown(event: PointerEvent): void {
      choiceRef.current = null;
      const menu = document.querySelector('[role="menu"]');
      const target = event.target;
      menuRef.current.open = menu !== null;
      menuRef.current.underPointer =
        menu !== null && target instanceof Node && menu.contains(target);
      menuRef.current.onMarkedSlot =
        typeof (target as { closest?: unknown } | null)?.closest === 'function' &&
        (target as unknown as { closest(selector: string): unknown }).closest(
          '[data-selected="true"]',
        ) !== null;
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return;
      }
      clearRef.current();
    }

    function handleClick(event: MouseEvent): void {
      const { open, underPointer } = menuRef.current;
      if (underPointer) {
        // The click talks to the panel of an open menu: it only clears when
        // the click runs an item, which is what closes the menu.
        const itemTarget = event.target as { closest?: (selector: string) => unknown } | null;
        const item =
          typeof itemTarget?.closest === 'function' && !!itemTarget.closest('[role="menuitem"]');
        if (item) {
          clearRef.current();
        }
        return;
      }
      if (open) {
        // The menu was open and the pointer fell outside it: this click is
        // what closes the menu, so it clears the mark with it.
        clearRef.current();
        return;
      }
      // No menu in the interaction: the click that did not choose a creature
      // is a click anywhere else, so it clears.
      if (choiceRef.current === null) {
        clearRef.current();
      }
    }

    function handleContextMenu(_event: MouseEvent): void {
      const { onMarkedSlot, underPointer } = menuRef.current;
      // The right click has no click to read: the pointer decides. Inside the
      // panel of the menu, the menu owns the pointer; on the marked slot, o
      // menu da criatura escolhida abre com a marca que ela tem.
      if (underPointer || onMarkedSlot) {
        return;
      }
      clearRef.current();
    }

    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('pointerdown', handlePointerDown);

    return function remove(): void {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return { select, selectTeam };
}
