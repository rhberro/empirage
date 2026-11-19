/* eslint-disable oxsome/no-inline-structural-types */
import { Dialog } from '@chakra-ui/react';

import { SpeciesConfigForm } from './SpeciesConfigForm';
import type { HuntingLocationSpecies, SpeciesCatalogItem } from './types';

export interface SpeciesConfigModalProps {
  catalog: Array<SpeciesCatalogItem>;
  onClose: () => void;
  onSave: (species: Array<HuntingLocationSpecies>) => void;
  open: boolean;
  species: Array<HuntingLocationSpecies>;
}

export function SpeciesConfigModal(props: SpeciesConfigModalProps): React.ReactElement {
  const { catalog, onClose, onSave, open, species } = props;

  function handleOpenChange(): void {
    onClose();
  }

  const formElement = open ? (
    <SpeciesConfigForm
      catalog={catalog}
      initialSpecies={species}
      onClose={onClose}
      onSave={onSave}
    />
  ) : null;

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={open} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content bg="gray.900" color="white" maxW="900px" p="6">
          <Dialog.Header>
            <Dialog.Title fontSize="lg" fontWeight="bold">
              Configurar Espécies do Local de Caça (Spawns)
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>{formElement}</Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
