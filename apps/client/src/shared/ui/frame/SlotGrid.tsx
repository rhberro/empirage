import { Box } from '@chakra-ui/react';
import {
  isValidElement,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Slot } from './Slot';
import { SLOT_SIZE } from './slot.constants';
import {
  computeEmptySlotCount,
  computeSlotColumns,
  readSlotMetrics,
  resolveSlotColumns,
} from './slotGridLayout';

const EMPTY_DEPS: ReadonlyArray<unknown> = [];

type SlotGridProps = {
  children: ReactNode;
};

/**
 * A grade de slots.
 *
 * A grade **preenche a largura do painel**: as colunas se ajustam a largura e a
 * ultima linha e completada com slots vazios. Uma grade com numero fixo de
 * colunas deixa o resto do painel vazio — e o painel vazio e o que faz a
 * interface parecer quebrada.
 *
 * A grade **nao cria linha nova**: tres itens fazem uma linha, nao tres
 * linhas de onze. O scroll so aparece quando o conteudo realmente nao cabe.
 *
 * A grade **sem nenhum item** mostra uma linha inteira de slots vazios: o
 * jogador ve que os slots existem, em vez de uma area sem nada.
 *
 * A coluna tem a largura do slot, e o slot esta em `rem`: a grade acompanha a
 * escala da interface, do mesmo jeito que o texto acompanha.
 *
 * O slot e a unica forma de mostrar item, criatura ou habilidade: nada de
 * circulo, nada de quadrado solto.
 */
export function SlotGrid(props: SlotGridProps): ReactElement {
  const { children } = props;
  const gridRef = useRef<HTMLDivElement | null>(null);
  const columns = useSlotColumns(gridRef);
  const filled = countChildren(children);
  const empty = buildEmptySlots(resolveSlotColumns(columns, filled), filled);
  const template = buildTemplate();

  return (
    <Box display="grid" gap="1" gridTemplateColumns={template} justifyContent="start" ref={gridRef}>
      {children}
      {empty}
    </Box>
  );
}

/**
 * As colunas da grade, pela largura que ela tem.
 *
 * A largura e lida no layout, antes do primeiro desenho: a grade nunca mostra
 * uma fileira sem os slots vazios que a completam e so depois cresce.
 */
function useSlotColumns(gridRef: RefObject<HTMLDivElement | null>): number {
  const [columns, setColumns] = useState<number>(0);

  useLayoutEffect(measure, EMPTY_DEPS);
  useEffect(observe, EMPTY_DEPS);

  function measure(): void {
    setColumns(readColumns(gridRef.current));
  }

  function observe(): () => void {
    const element = gridRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return noop;
    }
    const observer = new ResizeObserver(handleResize);
    observer.observe(element);
    return function teardown(): void {
      observer.disconnect();
    };
  }

  function handleResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    if (!entry) {
      return;
    }
    // A largura do conteudo: e a mesma que o auto-fill usa para as colunas.
    const metrics = readSlotMetrics();
    setColumns(computeSlotColumns(entry.contentRect.width, metrics.size, metrics.gap));
  }

  return columns;
}

function readColumns(element: HTMLDivElement | null): number {
  if (!element) {
    return 0;
  }
  const metrics = readSlotMetrics();
  return computeSlotColumns(element.getBoundingClientRect().width, metrics.size, metrics.gap);
}

function buildTemplate(): string {
  return `repeat(auto-fill, ${SLOT_SIZE})`;
}

/**
 * Quantos slots a grade tem.
 *
 * Os slots vazios que a area preenche tambem contam: a grade conta o que ela
 * mostra, e nao o que ela recebeu.
 */
function countChildren(children: ReactNode): number {
  if (Array.isArray(children)) {
    return countAll(children);
  }
  if (isValidElement(children)) {
    return 1;
  }
  return 0;
}

function countAll(children: ReactNode[]): number {
  let total = 0;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    total += countChildren(child);
  }
  return total;
}

/**
 * Os slots vazios que faltam para a ultima linha fechar.
 *
 * Nao ha linha nova: se o conteudo cabe em uma linha, a grade tem uma linha.
 */
function buildEmptySlots(columns: number, filled: number): ReactElement[] {
  const total = computeEmptySlotCount(columns, filled);
  const slots: ReactElement[] = [];
  for (let index = 0; index < total; index += 1) {
    slots.push(buildEmptySlot(index));
  }
  return slots;
}

function buildEmptySlot(index: number): ReactElement {
  const key = `empty-${index}`;
  return <Slot empty key={key} />;
}

function noop(): void {
  void 0;
}
