/**
 * The current attributes of a creature.
 *
 * The formula lives in the shared contract, because the client shows the same
 * attributes that the server uses to resolve the life of the creature: as duas
 * pontas precisam concordar sobre o mesmo numero.
 */
export {
  calculateAttribute,
  calculateMaxHp,
  LEVEL_GROWTH,
  POTENTIAL_DEVIATION,
  resolveCurrentHp,
} from '@creatures/contracts/attributes';
