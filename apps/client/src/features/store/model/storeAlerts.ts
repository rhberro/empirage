import { createElement } from 'react';

import type { AlertInput } from '~/shared/ui/alert';
import { IconBag, IconCoin } from '~/shared/ui/icon';
import { Text } from '~/shared/ui/text';

const ALERT_DURATION = 4000;

/**
 * O aviso da compra.
 *
 * O jogador precisa saber que a compra aconteceu: o item entrou na mochila, e
 * o dinheiro saiu da carteira.
 */
export function buildPurchaseAlert(name: string, quantity: number): AlertInput {
  return {
    content: createElement(Text, { color: 'fg' }, `Você comprou ${quantity} ${pluralize(name)}.`),
    duration: ALERT_DURATION,
    icon: createElement(IconBag),
  };
}

/**
 * O aviso da venda.
 *
 * O item saiu da mochila, e o dinheiro entrou na carteira.
 */
export function buildSaleAlert(name: string, quantity: number): AlertInput {
  return {
    content: createElement(Text, { color: 'fg' }, `Você vendeu ${quantity} ${pluralize(name)}.`),
    duration: ALERT_DURATION,
    icon: createElement(IconCoin),
  };
}

/**
 * O nome do item no plural.
 *
 * O nome do item vem do servidor, e o aviso fala de varios deles: so o
 * primeiro palavra precisa do plural.
 */
function pluralize(name: string): string {
  const words = name.split(' ');
  const first = words[0] ?? name;
  return [pluralizeWord(first), ...words.slice(1)].join(' ');
}

function pluralizeWord(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith('ão')) {
    return `${word.slice(0, -3)}ões`;
  }
  if (lower.endsWith('l')) {
    return `${word.slice(0, -1)}is`;
  }
  return `${word}s`;
}
