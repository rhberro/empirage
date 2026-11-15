/* eslint-disable react/no-multi-comp, react/set-state-in-effect, oxc/no-optional-chaining, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types, oxsome/no-jsx-inline-computation */
import { Badge, Box, Button, Dialog, Grid, HStack, Image, Stack, Text } from '@chakra-ui/react';
import * as React from 'react';

import type { HuntingLocation } from '../api/hunting-locations';
import {
  selectHuntingLocationsModalState,
  toggleHuntingLocationsModal,
  useModalStore,
} from '../model/modal-store';

type HuntingLocationsDialogProps = {
  locations: Array<HuntingLocation>;
  onStart: (locationId: number) => boolean;
};

const COUNTDOWN_SECONDS = 5;

export function HuntingLocationsDialog(props: HuntingLocationsDialogProps): React.ReactElement {
  const { locations, onStart } = props;
  const open = useModalStore(selectHuntingLocationsModalState);
  const [selectedLocationId, setSelectedLocationId] = React.useState<number | null>(null);
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const selectedLocation = locations.find(function findLocation(location): boolean {
    return location.id === selectedLocationId;
  });

  function selectLocation(locationId: number): void {
    if (countdown === null) {
      setSelectedLocationId(locationId);
    }
  }

  function beginHunt(): void {
    if (!selectedLocation || countdown !== null) {
      return;
    }
    setCountdown(COUNTDOWN_SECONDS);
  }

  function closeDialog(): void {
    if (countdown === null) {
      toggleHuntingLocationsModal();
    }
  }

  React.useEffect(
    function progressCountdown(): (() => void) | undefined {
      if (countdown === null) {
        return;
      }
      if (countdown === 0) {
        if (selectedLocation && onStart(selectedLocation.id)) {
          toggleHuntingLocationsModal();
        }
        setCountdown(null);
        return;
      }
      const timer = globalThis.setTimeout(function decrementCountdown(): void {
        setCountdown(countdown - 1);
      }, 1_000);
      function clearCountdown(): void {
        globalThis.clearTimeout(timer);
      }
      return clearCountdown;
    },
    [countdown, onStart, selectedLocation],
  );

  return (
    <Dialog.Root lazyMount onOpenChange={closeDialog} open={open} size="xl" unmountOnExit>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="calc(100dvh - 8)" overflow="hidden">
          <Dialog.Header>
            <Text color="brand.solid" fontSize="xs" fontWeight="bold" letterSpacing="widest">
              LOCAIS DE CAÇA
            </Text>
            <Dialog.Title>Escolha seu destino</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body overflowY="auto">
            <Grid gap="3" templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }}>
              {locations.map(function renderLocation(location): React.ReactElement {
                const selected = location.id === selectedLocationId;
                return (
                  <Button
                    aria-pressed={selected}
                    borderColor={selected ? 'brand.solid' : 'border.default'}
                    borderWidth="1px"
                    h="auto"
                    key={location.id}
                    onClick={selectLocation.bind(null, location.id)}
                    p="4"
                    textAlign="start"
                    variant="ghost"
                  >
                    <LocationDetails location={location} />
                  </Button>
                );
              })}
            </Grid>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack justify="space-between" w="full">
              <Dialog.ActionTrigger asChild>
                <Button disabled={countdown !== null} variant="outline">
                  Cancelar
                </Button>
              </Dialog.ActionTrigger>
              <Button disabled={!selectedLocation || countdown !== null} onClick={beginHunt}>
                {countdown === null ? 'Iniciar caça' : `Partindo em ${countdown}`}
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

function LocationDetails(props: { location: HuntingLocation }): React.ReactElement {
  const { location } = props;
  const preview = `/assets/creatures/icons/${location.species[0]?.id}.png`;
  return (
    <Stack align="start" gap="3" w="full">
      <HStack align="start" gap="3" w="full">
        <Box bg="surface.sunken" p="2">
          <Image alt="" boxSize="12" imageRendering="pixelated" src={preview} />
        </Box>
        <Stack align="start" flex="1" gap="1">
          <Text fontWeight="bold">{location.name}</Text>
          <Text color="fg.muted" fontSize="xs" textWrap="wrap">
            {location.description}
          </Text>
        </Stack>
      </HStack>
      <HStack flexWrap="wrap" gap="2">
        {location.species.map(function renderSpecies(species): React.ReactElement {
          return (
            <Badge key={species.id} title={species.description}>
              {species.name} · Nv. {species.minimumLevel}–{species.maximumLevel}
            </Badge>
          );
        })}
      </HStack>
      <HStack flexWrap="wrap" gap="2">
        <Text color="fg.muted" fontSize="xs">
          Criaturas por onda:
        </Text>
        {location.waveRanges.map(function renderWaveRange(range): React.ReactElement {
          return (
            <Badge key={`${range.minimumSize}-${range.maximumSize}`}>
              {range.minimumSize}–{range.maximumSize}
            </Badge>
          );
        })}
      </HStack>
    </Stack>
  );
}
