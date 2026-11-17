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

type IntervalCleanup = () => void;

function currentTime(): number {
  return Date.now();
}

function useCurrentTime(): number {
  const [now, setNow] = React.useState(currentTime);
  function refresh(): IntervalCleanup {
    const timer = globalThis.setInterval(function updateTime(): void {
      setNow(Date.now());
    }, 100);
    function clearTimer(): void {
      globalThis.clearInterval(timer);
    }
    return clearTimer;
  }
  React.useEffect(refresh, []);
  return now;
}

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

function WaveCountdown(props: WaveCountdownProps): React.ReactElement {
  const { nextEventAt, serverTime } = props;
  const now = useCurrentTime();
  const [clock] = React.useState(function createClock(): CountdownClock {
    const startedAt = serverTime ?? currentTime();
    const endsAt = new Date(nextEventAt).getTime();
    return { startedAt, totalMs: Math.max(1, endsAt - startedAt) };
  });
  const nextEventAtMs = new Date(nextEventAt).getTime();
  const elapsedMs = Math.max(0, now - clock.startedAt);
  const serverNow = clock.startedAt + elapsedMs;
  const delayMs = Math.max(0, nextEventAtMs - serverNow);
  const seconds = Math.ceil(delayMs / 1_000);
  const progress = Math.min(100, Math.max(0, ((clock.totalMs - delayMs) / clock.totalMs) * 100));
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
            <Box bg="brand.solid" h="full" transition="width 100ms linear" w={progressWidth} />
          </Box>
        </Box>
      </HStack>
    </Box>
  );
}

type CountdownClock = { startedAt: number; totalMs: number };
