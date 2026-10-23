export type ScaleInputs = {
  max: number;
  min: number;
  reference: number;
  referenceHeight: number;
  viewportHeight: number;
  viewportWidth: number;
};

/**
 * The scale of the interface.
 *
 * A escala e o menor entre as duas razoes: a da largura e a da altura. A
 * interface e desenhada para uma tela de referencia, e ela precisa caber na
 * tela que o jogador tem — nas duas direcoes. Uma janela larga e baixa
 * encolhe a interface como uma janela estreita e alta encolhe, e nos dois
 * casos o que fica grande demais e o que fica pequeno demais nao aparecem.
 */
export function computeScale(inputs: ScaleInputs): number {
  const { max, min, reference, referenceHeight, viewportHeight, viewportWidth } = inputs;
  if (reference <= 0 || referenceHeight <= 0) {
    return min;
  }
  const raw = Math.min(viewportWidth / reference, viewportHeight / referenceHeight);
  if (raw < min) {
    return min;
  }
  if (raw > max) {
    return max;
  }
  return raw;
}
