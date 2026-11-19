/* eslint-disable oxsome/no-inline-structural-types */
import { useState } from 'react';

export interface EditorModalsState {
  handleCloseAnimationModal: () => void;
  handleCloseSpeciesModal: () => void;
  handleCloseWaveRangesModal: () => void;
  handleOpenAnimationModal: () => void;
  handleOpenSpeciesModal: () => void;
  handleOpenWaveRangesModal: () => void;
  isAnimationModalOpen: boolean;
  isSpeciesModalOpen: boolean;
  isWaveRangesModalOpen: boolean;
}

export function useEditorModalsState(): EditorModalsState {
  const [isAnimationModalOpen, setIsAnimationModalOpen] = useState(false);
  const [isSpeciesModalOpen, setIsSpeciesModalOpen] = useState(false);
  const [isWaveRangesModalOpen, setIsWaveRangesModalOpen] = useState(false);

  function handleOpenAnimationModal(): void {
    setIsAnimationModalOpen(true);
  }

  function handleCloseAnimationModal(): void {
    setIsAnimationModalOpen(false);
  }

  function handleOpenSpeciesModal(): void {
    setIsSpeciesModalOpen(true);
  }

  function handleCloseSpeciesModal(): void {
    setIsSpeciesModalOpen(false);
  }

  function handleOpenWaveRangesModal(): void {
    setIsWaveRangesModalOpen(true);
  }

  function handleCloseWaveRangesModal(): void {
    setIsWaveRangesModalOpen(false);
  }

  return {
    handleCloseAnimationModal,
    handleCloseSpeciesModal,
    handleCloseWaveRangesModal,
    handleOpenAnimationModal,
    handleOpenSpeciesModal,
    handleOpenWaveRangesModal,
    isAnimationModalOpen,
    isSpeciesModalOpen,
    isWaveRangesModalOpen,
  };
}
