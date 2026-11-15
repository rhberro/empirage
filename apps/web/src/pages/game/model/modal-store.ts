import { createStore, useStore } from 'zustand';

type ModalStore = {
  abilitySlot: number | null;
  capture: boolean;
  healingItem: boolean;
  storage: boolean;
};

export type ModalStoreSelector<T> = (state: ModalStore) => T;

const initialModalStoreValues: ModalStore = {
  abilitySlot: null,
  capture: false,
  healingItem: false,
  storage: false,
};

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

export function selectCaptureModalState(state: ModalStore): boolean {
  return state.capture;
}

export function toggleCaptureModal(): void {
  const currentState = modalStore.getState();
  const nextState = { ...currentState, capture: !currentState.capture };
  modalStore.setState(nextState);
}

export function selectStorageModalState(state: ModalStore): boolean {
  return state.storage;
}

export function toggleStorageModal(): void {
  const currentState = modalStore.getState();
  const nextState = { ...currentState, storage: !currentState.storage };
  modalStore.setState(nextState);
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
