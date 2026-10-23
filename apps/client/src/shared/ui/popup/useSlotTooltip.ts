import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 200;
const NO_TIMER = 0;

export type SlotTooltip = {
  handlePointerDown(): void;
  handlePointerEnter(): void;
  handlePointerLeave(): void;
  handleTapToggle(): void;
  /** Mirror of the contextual menu state, for render-time gates. */
  menuOpen: boolean;
  /** Whether the tooltip panel is open. */
  open: boolean;
  /**
   * The edge of the contextual menu: open holds the tooltip shut while the
   * menu lives; close puts the hover rules back — the panel returns at once
   * when the pointer is still over the slot, stays shut when it is not.
   */
  setMenuOpen(open: boolean): void;
  /** The element around the slot, for the tap-outside rule. */
  triggerRef: RefObject<HTMLDivElement | null>;
};

/**
 * Taps outside the slot: a touch landing anywhere else hides the panel — the
 * hover can not do it on the touch, and a pressed pointer anywhere else means
 * the panel lost its owner.
 */
function useOutsideTapDismiss(
  triggerRef: RefObject<HTMLDivElement | null>,
  gateRef: RefObject<boolean>,
  onDismiss: () => void,
): void {
  useEffect(
    function watchTaps(): (() => void) | undefined {
      function dismissAtTap(event: PointerEvent): void {
        const element = triggerRef.current;
        if (!element || gateRef.current) {
          return;
        }
        if (event.target instanceof Node && element.contains(event.target)) {
          return;
        }
        onDismiss();
      }
      document.addEventListener('pointerdown', dismissAtTap);
      return function stop(): void {
        document.removeEventListener('pointerdown', dismissAtTap);
      };
    },
    [gateRef, onDismiss, triggerRef],
  );
}

// The tooltip state of a slot, for the popup that shares the slot with a
// contextual menu.
//
// On the desktop, the hover opens after a short delay, and the click — the
// pointer down — takes the panel away: the menu and the selection then own
// the pointer. A sweep across many slots closes the abandoned ones at the
// first pointer step that is neither the slot nor the panel of the slot: no
// leave of the slot is trusted — a fast sweep may never deliver one.
//
// On the touch, there is no hover: the tap shows the panel, the next tap
// hides it, and any tap outside the slot hides it too.
//
// The tooltip state lives here, not in the popup, because the popup is held
// open: a controlled `open` every render keeps the underlying tooltip machine
// honest, so a hover after the menu closes works on the very first pass — the
// machine alone would carry a stale hover mark and swallow the re-entry.
// eslint-disable-next-line max-lines-per-function
export function useSlotTooltip(hasHover: boolean): SlotTooltip {
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpenState] = useState(false);
  const isPointerOverRef = useRef(false);
  const isPanelOverRef = useRef(false);
  const isMenuOpenRef = useRef(false);
  const wasMenuOpenRef = useRef(false);
  const openTimerRef = useRef(NO_TIMER);
  const closeTimerRef = useRef(NO_TIMER);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  const setPanel = useCallback(
    function settle(open: boolean): void {
      window.clearTimeout(openTimerRef.current);
      window.clearTimeout(closeTimerRef.current);
      openTimerRef.current = NO_TIMER;
      closeTimerRef.current = NO_TIMER;
      setIsOpen(open);
    },
    [openTimerRef, closeTimerRef],
  );

  /**
   * The pending close. It is the turnover of a sweep: the slot lost the
   * pointer, and the panel follows it as soon as the path of the pointer
   * says the slot is not coming back — but not while the pointer still
   * rests on the panel of the slot itself.
   */
  const hide = useCallback(
    function hideIfAbandoned(): void {
      if (isPointerOverRef.current || isPanelOverRef.current) {
        return;
      }
      setIsOpen(false);
    },
    [isPointerOverRef, isPanelOverRef],
  );

  const scheduleClose = useCallback(
    function queueHide(): void {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(hide, CLOSE_DELAY_MS);
    },
    [closeTimerRef, hide],
  );

  const handlePointerEnter = useCallback(
    function enter(): void {
      isPointerOverRef.current = true;
      if (!hasHover || isMenuOpenRef.current) {
        return;
      }
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = NO_TIMER;
      openTimerRef.current = window.setTimeout(function show(): void {
        setIsOpen(true);
      }, OPEN_DELAY_MS);
    },
    [hasHover, openTimerRef, closeTimerRef],
  );

  const handlePointerLeave = useCallback(
    function leave(): void {
      isPointerOverRef.current = false;
      if (!hasHover) {
        return;
      }
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = NO_TIMER;
      scheduleClose();
    },
    [hasHover, openTimerRef, scheduleClose],
  );

  const handlePointerDown = useCallback(
    function down(): void {
      wasMenuOpenRef.current = isMenuOpenRef.current;
      if (!hasHover) {
        return;
      }
      setPanel(false);
    },
    [hasHover, setPanel],
  );

  const handleTapToggle = useCallback(
    function tapToggle(): void {
      if (hasHover || isMenuOpenRef.current || wasMenuOpenRef.current) {
        return;
      }
      setIsOpen(function flip(open: boolean): boolean {
        return !open;
      });
    },
    [hasHover],
  );

  const setMenuOpen = useCallback(
    function menuChange(nextOpen: boolean): void {
      setMenuOpenState(nextOpen);
      isMenuOpenRef.current = nextOpen;
      if (nextOpen) {
        setPanel(false);
        return;
      }
      if (hasHover && isPointerOverRef.current) {
        setPanel(true);
      }
    },
    [hasHover, setPanel],
  );
  const dismissPanel = useCallback(
    function dismiss(): void {
      setPanel(false);
    },
    [setPanel],
  );

  useOutsideTapDismiss(triggerRef, isMenuOpenRef, dismissPanel);

  useEffect(
    function followThePointer(): (() => void) | undefined {
      if (!hasHover) {
        return undefined;
      }
      // The pointer the slot does not own closes the panel the slot has
      // opened. No leave of the slot is trusted: a fast sweep may never
      // deliver it, and a panel that believes the pointer is still there
      // outlives the pointer itself. Every pointer step that is neither
      // the slot nor the panel of the slot is the verdict.
      function watchThePointer(event: PointerEvent): void {
        isPanelOverRef.current = isOurPanelUnderThePointer(event.target, triggerRef.current);
        if (isPanelOverRef.current) {
          return;
        }
        const box = triggerRef.current;
        if (box !== null && event.target instanceof Node && box.contains(event.target)) {
          return;
        }
        scheduleClose();
      }
      document.addEventListener('pointerover', watchThePointer);
      return function stop(): void {
        document.removeEventListener('pointerover', watchThePointer);
      };
    },
    [hasHover, isPanelOverRef, scheduleClose, triggerRef],
  );

  useEffect(
    function settleOnUnmount(): () => void {
      return function stop(): void {
        window.clearTimeout(openTimerRef.current);
        window.clearTimeout(closeTimerRef.current);
      };
    },
    [openTimerRef, closeTimerRef],
  );

  return {
    handlePointerDown,
    handlePointerEnter,
    handlePointerLeave,
    handleTapToggle,
    menuOpen,
    open: isOpen,
    setMenuOpen,
    triggerRef,
  };
}

/**
 * The panel under the pointer is the panel of this slot? The tooltip ties
 * them by id: the trigger carries the `aria-describedby` of the content, and
 * a match means the panel belongs to it. A descriptionless trigger answers
 * no — the grace never latches onto the panel of another slot.
 */
function isOurPanelUnderThePointer(
  target: EventTarget | null,
  trigger: HTMLDivElement | null,
): boolean {
  if (!(target instanceof Node) || trigger === null) {
    return false;
  }
  const element: Element | null = target.parentElement;
  const panel = element?.closest('[role="tooltip"]') ?? null;
  if (panel === null) {
    return false;
  }
  const describedBy = trigger.querySelector('[aria-describedby]')?.getAttribute('aria-describedby');
  return describedBy !== undefined && describedBy === panel.id;
}
