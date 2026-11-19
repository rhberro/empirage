/* eslint-disable oxsome/no-inline-structural-types */
import { AnimationManagerModal } from './AnimationManagerModal';
import { CreateLocationModal } from './CreateLocationModal';
import { ExportSeedModal } from './ExportSeedModal';
import { SpeciesConfigModal } from './SpeciesConfigModal';
import type {
  CreateHuntingLocationPayload,
  HuntingLocationAnimation,
  HuntingLocationSpecies,
  HuntingLocationWaveRange,
  SpeciesCatalogItem,
} from './types';
import { WaveRangesModal } from './WaveRangesModal';

export interface EditorModalsProps {
  animations: Array<HuntingLocationAnimation>;
  configuredSpecies: Array<HuntingLocationSpecies>;
  configuredWaveRanges: Array<HuntingLocationWaveRange>;
  exportSql: string;
  isAnimationModalOpen: boolean;
  isCreateLocationModalOpen: boolean;
  isCreatingLocation: boolean;
  isExportModalOpen: boolean;
  isSpeciesModalOpen: boolean;
  isWaveRangesModalOpen: boolean;
  onCloseAnimationModal: () => void;
  onCloseCreateLocationModal: () => void;
  onCloseExportModal: () => void;
  onCloseSpeciesModal: () => void;
  onCloseWaveRangesModal: () => void;
  onCreateLocation: (payload: CreateHuntingLocationPayload) => Promise<void>;
  onSaveAnimations: (anims: Array<HuntingLocationAnimation>) => void;
  onSaveSpecies: (species: Array<HuntingLocationSpecies>) => void;
  onSaveWaveRanges: (ranges: Array<HuntingLocationWaveRange>) => void;
  speciesCatalog: Array<SpeciesCatalogItem>;
}

export function EditorModals(props: EditorModalsProps): React.ReactElement {
  const {
    animations,
    configuredSpecies,
    configuredWaveRanges,
    exportSql,
    isAnimationModalOpen,
    isCreateLocationModalOpen,
    isCreatingLocation,
    isExportModalOpen,
    isSpeciesModalOpen,
    isWaveRangesModalOpen,
    onCloseAnimationModal,
    onCloseCreateLocationModal,
    onCloseExportModal,
    onCloseSpeciesModal,
    onCloseWaveRangesModal,
    onCreateLocation,
    onSaveAnimations,
    onSaveSpecies,
    onSaveWaveRanges,
    speciesCatalog,
  } = props;

  return (
    <>
      <AnimationManagerModal
        animations={animations}
        onClose={onCloseAnimationModal}
        onSave={onSaveAnimations}
        open={isAnimationModalOpen}
      />
      <SpeciesConfigModal
        catalog={speciesCatalog}
        onClose={onCloseSpeciesModal}
        onSave={onSaveSpecies}
        open={isSpeciesModalOpen}
        species={configuredSpecies}
      />
      <WaveRangesModal
        onClose={onCloseWaveRangesModal}
        onSave={onSaveWaveRanges}
        open={isWaveRangesModalOpen}
        waveRanges={configuredWaveRanges}
      />
      <ExportSeedModal onClose={onCloseExportModal} open={isExportModalOpen} sql={exportSql} />
      <CreateLocationModal
        isCreating={isCreatingLocation}
        onClose={onCloseCreateLocationModal}
        onCreate={onCreateLocation}
        open={isCreateLocationModalOpen}
      />
    </>
  );
}
