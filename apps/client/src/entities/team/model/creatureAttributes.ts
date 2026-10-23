import {
  calculateMaximumPotential,
  computeCreatureAttributes,
  readBaseValues,
} from '@creatures/contracts/attributes';
import type { Creature } from '@creatures/contracts/creature';

/**
 * One attribute of a creature, as the interface shows it.
 *
 * A linha carrega os tres numeros do atributo: o valor atual, que e o que a
 * criatura tem, o valor de base da especie e o potencial do individo.
 */
export type CreatureAttributeRow = {
  /** The base value of the species. */
  base: number;
  /** The value the creature has right now. */
  current: number;
  /** The label of the attribute. */
  label: string;
  /** The potential of the individual, in percent. */
  potential: number;
};

type AttributeKey =
  | 'magicAttack'
  | 'magicDefense'
  | 'physicalAttack'
  | 'physicalDefense'
  | 'vitality';

const ATTRIBUTE_ROWS: ReadonlyArray<{ key: AttributeKey; label: string }> = [
  { key: 'vitality', label: 'Vida' },
  { key: 'physicalAttack', label: 'Ataque Físico' },
  { key: 'magicAttack', label: 'Ataque Mágico' },
  { key: 'physicalDefense', label: 'Defesa Física' },
  { key: 'magicDefense', label: 'Defesa Mágica' },
];

/**
 * The attributes of a creature, as the rows the interface draws.
 */
export function readCreatureAttributeRows(creature: Creature): CreatureAttributeRow[] {
  const current = computeCreatureAttributes(creature);
  const base = readBaseValues(creature.species);
  return ATTRIBUTE_ROWS.map(function toRow(entry): CreatureAttributeRow {
    return {
      base: base[entry.key],
      current: current[entry.key],
      label: entry.label,
      potential: creature.potential[entry.key],
    };
  });
}

/**
 * The maximum potential of a creature: the average of its five potentials.
 */
export function readMaximumPotential(creature: Creature): number {
  return calculateMaximumPotential(creature.potential);
}
