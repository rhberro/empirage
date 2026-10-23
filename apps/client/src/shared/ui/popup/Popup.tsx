import { Box, Tooltip } from '@chakra-ui/react';
import {
  cloneElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from 'react';

import { mergeTriggerProps } from '~/shared/ui/trigger';

import { PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, POPUP_POSITIONING } from './popup.constants';
import type { PopupProps } from './popup.types';

const PANEL_PROPS = {
  bg: 'bg.panel',
  borderColor: 'border.emphasized',
  borderRadius: 'sm',
  borderWidth: '1px',
  boxShadow: 'overlay',
  maxW: PANEL_MAX_WIDTH,
  minW: PANEL_MIN_WIDTH,
  padding: '3',
  width: 'max-content',
};

const AFTER_THE_CLICK = 0;

/**
 * The popup.
 *
 * It is the `Tooltip` of the Chakra (Ark UI) with the look of the system: the
 * panel is the one of the game, e o comportamento e o de um tooltip de verdade.
 * Ele espera antes de abrir, espera antes de fechar, e **fica aberto enquanto
 * o cursor esta sobre o painel** — passar o mouse do slot para o painel nunca
 * faz ele piscar.
 *
 * O hover so existe em ponteiro fino. No toque, o tooltip so existe quando o
 * consumidor controla o `open` — e quem decide e o `useSlotTooltip`, onde o
 * toque abre a informacao e o toque fora a fecha.
 *
 * O `open` optional holds the panel shut: the consumer que tem estado proprio
 * (o gatilho da criatura, enquanto o menu dela esta aberto) passa `false` e o
 * hover nao abre nada. Sem a prop, o hover manda, como sempre.
 *
 * Um fechamento controlado adota uma geracao nova: a raiz do tooltip remonta,
 * e a maquina dele morre com o painel — a maquina do Ark reabre por eventos
 * de ponteiro por conta propria, e um painel que o consumidor fechou nunca
 * ressuscita. A troca de geracao nunca ocorre no meio de uma pressao: ela
 * espera o `pointerup` e sai do frame do clique, para o click nunca pousar
 * num node que o remount vai destruir.
 */
export function Popup(props: PopupProps): ReactElement {
  const { children, content, disabled = false, open, ...triggerProps } = props;
  const { generation, rootRef } = useGenerationOnClose(open);
  const trigger = cloneElement(
    children as ReactElement<Record<string, unknown>>,
    mergeTriggerProps(children.props as Record<string, unknown>, triggerProps),
  );
  return (
    <Box display="contents" ref={rootRef}>
      <Tooltip.Root
        closeDelay={200}
        disabled={disabled}
        interactive
        key={generation}
        open={open}
        openDelay={150}
        positioning={POPUP_POSITIONING}
      >
        <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content {...PANEL_PROPS}>{content}</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>
    </Box>
  );
}

function bumpGeneration(value: number): number {
  return value + 1;
}

// The generations of the tooltip root, and the window of a pointer press on
// the glass around it. The root carries the key: a controlled close adopts
// the next generation — unless a press is running on the popup subtree, when
// the turnover waits for the release, because the click of that press has to
// run on the very nodes the remount would destroy.
// eslint-disable-next-line max-lines-per-function
function useGenerationOnClose(open: boolean | undefined): {
  generation: number;
  rootRef: RefObject<HTMLDivElement | null>;
} {
  const [generation, setGeneration] = useState(0);
  const wasOpenRef = useRef(false);
  const isPressedRef = useRef(false);
  const isClosePendingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const adoptAPendingClose = useCallback(
    function adopt(): void {
      if (!isClosePendingRef.current) {
        return;
      }
      isClosePendingRef.current = false;
      setGeneration(bumpGeneration);
    },
    [isClosePendingRef],
  );

  useEffect(
    function watchThePresses(): () => void {
      function releaseThePress(): void {
        // The click of a press lands right after this release: the turnover
        // waits for the next tick, so the remount can never destroy the node
        // the click is about to run.
        isPressedRef.current = false;
        window.setTimeout(adoptAPendingClose, AFTER_THE_CLICK);
      }
      function press(event: PointerEvent): void {
        const isOnTheGlass =
          rootRef.current !== null &&
          event.target instanceof Node &&
          rootRef.current.contains(event.target);
        if (isOnTheGlass) {
          isPressedRef.current = true;
          return;
        }
        releaseThePress();
      }
      document.addEventListener('pointerdown', press, true);
      document.addEventListener('pointerup', releaseThePress, true);
      return function stop(): void {
        document.removeEventListener('pointerdown', press, true);
        document.removeEventListener('pointerup', releaseThePress, true);
      };
    },
    [adoptAPendingClose, isPressedRef],
  );

  useEffect(
    function settleOnClose(): void {
      if (!open && wasOpenRef.current) {
        if (isPressedRef.current) {
          isClosePendingRef.current = true;
        } else {
          setGeneration(bumpGeneration);
        }
      }
      wasOpenRef.current = open === true;
    },
    [open, isPressedRef],
  );

  return { generation, rootRef };
}
