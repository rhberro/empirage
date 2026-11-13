import { createStore, useStore } from 'zustand';

type ModalStore = { abilitySlot: number | null; healingItem: boolean };

export type ModalStoreSelector<T> = (state: ModalStore) => T;

const initialModalStoreValues: ModalStore = { abilitySlot: null, healingItem: false };

function createInitialState(): ModalStore {
  return initialModalStoreValues;
}

export const modalStore = createStore<ModalStore>()(createInitialState);

export function useModalStore<T>(selector: ModalStoreSelector<T>): T {
  return useStore(modalStore, selector);
}

export function selectHealingItemModalState(state: ModalStore): boolean {
  return state.healingItem;
}

export function selectAbilitySlot(state: ModalStore): number | null {
  return state.abilitySlot;
}

export function toggleHealingItemModal(): void {
  const currentState = modalStore.getState();
  const nextState = { ...currentState, healingItem: !currentState.healingItem };
  modalStore.setState(nextState);
}

export function openAbilityModal(slot: number): void {
  const currentState = modalStore.getState();
  const nextState = { ...currentState, abilitySlot: slot };
  modalStore.setState(nextState);
}

export function closeAbilityModal(): void {
  const currentState = modalStore.getState();
  const nextState = { ...currentState, abilitySlot: null };
  modalStore.setState(nextState);
}
