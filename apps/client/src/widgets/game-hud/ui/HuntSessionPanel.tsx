import { Box } from '@chakra-ui/react';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { selectHuntPhase, selectSession } from '~/entities/hunt';
import { useHuntState } from '~/entities/hunt';
import { formatDuration } from '~/entities/hunt';
import { useHuntExitCountdown } from '~/entities/hunt/model/useHuntExitCountdown';
import { useHuntTick } from '~/entities/hunt/model/useHuntTick';
import { Button } from '~/shared/ui/button';
import { Text } from '~/shared/ui/text';

import { HuntPanelFrame } from './HuntPanelFrame';

const FINALIZE_LABEL = 'Finalizar Caçada';
const ELAPSED_LABEL = 'Tempo decorrido';
const REMAINING_LABEL = 'Tempo restante';

type HuntSessionPanelProps = {
  onFinalize: () => Promise<boolean>;
};

/**
 * The panel of the session: where the trainer hunts, for how long, and the
 * button that ends it with the five second countdown.
 */
export function HuntSessionPanel(props: HuntSessionPanelProps): ReactElement {
  const { onFinalize } = props;
  const session = useHuntState(selectSession);
  const phase = useHuntState(selectHuntPhase);
  const [pending, setPending] = useState<boolean>(false);
  const { remaining, start } = useHuntExitCountdown(handleCountdownEnd);

  function handleCountdownEnd(): void {
    setPending(true);
    onFinalize().then(handleFinalizeResult, handleFinalizeFailure);
  }

  function handleFinalizeResult(finished: boolean): void {
    if (!finished) {
      setPending(false);
    }
  }

  function handleFinalizeFailure(): void {
    setPending(false);
  }

  if (session === null) {
    return <HuntPanelFrame />;
  }

  const disabled = pending || remaining !== null || phase === 'leaving';
  const label = readFinalizeLabel(pending, remaining);

  return (
    <HuntPanelFrame>
      <Text color="fg" variant="title">
        {session.areaName}
      </Text>
      <SessionClock endsAt={session.endsAt} startedAt={session.startedAt} />
      <Button disabled={disabled} tone="danger" width="full" onClick={start}>
        {label}
      </Button>
    </HuntPanelFrame>
  );
}

/**
 * The elapsed and remaining time.
 *
 * They tick once a second, so they live in their own component: the area name
 * and the finalize button must not re-render for the clock.
 */
function SessionClock(props: { endsAt: number; startedAt: number }): ReactElement {
  const { endsAt, startedAt } = props;
  const now = useHuntTick();
  const elapsed = formatDuration(now - startedAt);
  const timeLeft = formatDuration(endsAt - now);
  return (
    <>
      <HuntStat label={ELAPSED_LABEL} value={elapsed} />
      <HuntStat label={REMAINING_LABEL} value={timeLeft} />
    </>
  );
}

function HuntStat(props: { label: string; value: string }): ReactElement {
  const { label, value } = props;
  return (
    <Box alignItems="center" display="flex" justifyContent="space-between">
      <Text color="fg.muted" variant="meta">
        {label}
      </Text>
      <Text color="fg" variant="numeric">
        {value}
      </Text>
    </Box>
  );
}

function readFinalizeLabel(pending: boolean, remaining: number | null): string {
  if (pending) {
    return 'Finalizando...';
  }
  if (remaining !== null) {
    return `Finalizando em ${remaining}`;
  }
  return FINALIZE_LABEL;
}
