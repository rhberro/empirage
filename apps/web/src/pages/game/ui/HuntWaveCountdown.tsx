/* eslint-disable react/no-multi-comp, oxsome/no-inline-functions-objects-arrays, oxsome/no-inline-structural-types */
import { Box, HStack, Text } from '@chakra-ui/react';
import * as React from 'react';

import { Icon } from '~/shared/ui/Icon';

import type { HuntState } from '../api/hunt-protocol';

type HuntWaveCountdownProps = { hunt: HuntState | null };
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

export function HuntWaveCountdown(props: HuntWaveCountdownProps): React.ReactElement | null {
  const { hunt } = props;
  if (!hunt || hunt.enemies.length > 0) {
    return null;
  }
  const key = `${hunt.huntId}-${hunt.wave}`;
  return <WaveCountdown hunt={hunt} key={key} />;
}

type WaveCountdownProps = { hunt: HuntState };

function WaveCountdown(props: WaveCountdownProps): React.ReactElement {
  const { hunt } = props;
  const now = useCurrentTime();
  const [startedAt] = React.useState(currentTime);
  const nextEventAt = new Date(hunt.nextEventAt).getTime();
  const serverNow = hunt.serverTime ? hunt.serverTime + now - startedAt : now;
  const delayMs = Math.max(0, nextEventAt - serverNow);
  const seconds = Math.ceil(delayMs / 1_000);
  const totalMs = Math.max(1, nextEventAt - (hunt.serverTime ?? serverNow));
  const progress = Math.min(100, Math.max(0, ((totalMs - delayMs) / totalMs) * 100));
  const progressWidth = `${progress}%`;
  return (
    <Box bottom="20" left="50%" minW="xs" position="fixed" transform="translateX(-50%)" zIndex="2">
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
