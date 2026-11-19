/* eslint-disable react/no-multi-comp, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types */
import { Box, HStack, Text } from '@chakra-ui/react';
import * as React from 'react';

import { Icon } from '~/shared/ui/Icon';

import {
  selectHuntEnemyCount,
  selectHuntId,
  selectHuntNextEventAt,
  selectHuntServerTime,
  selectHuntWave,
  useGameStore,
} from '../model/game-store';

export function HuntWaveCountdown(): React.ReactElement | null {
  const enemyCount = useGameStore(selectHuntEnemyCount);
  const huntId = useGameStore(selectHuntId);
  const nextEventAt = useGameStore(selectHuntNextEventAt);
  const serverTime = useGameStore(selectHuntServerTime);
  const wave = useGameStore(selectHuntWave);
  if (!huntId || !nextEventAt || wave === undefined || enemyCount > 0) {
    return null;
  }
  const key = `${huntId}-${wave}`;
  return <WaveCountdown key={key} nextEventAt={nextEventAt} serverTime={serverTime} />;
}

type WaveCountdownProps = { nextEventAt: string; serverTime: number | undefined };
type CountdownClock = { startedAt: number; totalMs: number };

function WaveCountdown(props: WaveCountdownProps): React.ReactElement {
  const { nextEventAt, serverTime } = props;
  const endsAt = new Date(nextEventAt).getTime();
  const [clock] = React.useState(function createClock(): CountdownClock {
    const startedAt = serverTime ?? Date.now();
    return { startedAt, totalMs: Math.max(1, endsAt - startedAt) };
  });

  const [seconds, setSeconds] = React.useState(function initSeconds(): number {
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 1_000));
  });

  React.useEffect(
    function startInterval(): (() => void) | undefined {
      function updateSeconds(): void {
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1_000));
        setSeconds(remaining);
      }
      const timer = globalThis.setInterval(updateSeconds, 1_000);
      return function clearTimer(): void {
        globalThis.clearInterval(timer);
      };
    },
    [endsAt],
  );

  const remainingMs = Math.min(clock.totalMs, seconds * 1_000);
  const progress = Math.min(
    100,
    Math.max(0, ((clock.totalMs - remainingMs) / clock.totalMs) * 100),
  );
  const progressWidth = `${progress}%`;

  return (
    <Box bottom="28" left="50%" minW="xs" position="fixed" transform="translateX(-50%)" zIndex="2">
      <HStack bg="bg.muted" borderRadius="sm" boxShadow="panel" gap="3" p="3">
        <Icon name="autorenew" />
        <Box flex="1">
          <HStack justify="space-between" mb="1">
            <Text fontSize="xs">Próxima onda</Text>
            <Text fontSize="xs" fontWeight="bold">
              {seconds}
            </Text>
          </HStack>
          <Box bg="bg.subtle" borderRadius="full" h="2" overflow="hidden">
            <Box bg="brand.solid" h="full" transition="width 1s linear" w={progressWidth} />
          </Box>
        </Box>
      </HStack>
    </Box>
  );
}
