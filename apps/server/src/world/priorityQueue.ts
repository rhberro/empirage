/**
 * The heap of the shared pathfinding; the server imports it through this module
 * so the domain keeps its own entry point.
 */
export { popEntry, pushEntry } from '@creatures/contracts/priorityQueue';
export type { SearchEntry } from '@creatures/contracts/priorityQueue';
