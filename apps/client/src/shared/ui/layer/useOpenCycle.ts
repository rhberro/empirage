import { useRef } from 'react';

/**
 * The cycle of the opening: it grows one each time the layer opens.
 *
 * A camada que abre sempre nasce com o estado interno limpo: a chave muda no
 * instante em que ela abre, e a React desmonta o conteudo antigo — a busca da
 * mochila, a aba e o scroll nunca sobrevivem a um fechamento. Na saida a
 * chave nao muda: a animacao de fechar continua intacta.
 */
export function useOpenCycle(isOpen: boolean): number {
  const cycle = useRef<number>(0);
  const wasOpen = useRef<boolean>(false);
  if (isOpen && !wasOpen.current) {
    cycle.current += 1;
  }
  wasOpen.current = isOpen;
  return cycle.current;
}
