import { Box } from '@chakra-ui/react';
import type { HuntLedger, HuntLedgerItem } from '@creatures/contracts/huntSim';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { selectLedger, selectSession, useHuntState } from '~/entities/hunt';
import { perHour } from '~/entities/hunt';
import { useHuntTick } from '~/entities/hunt/model/useHuntTick';
import { NativeButton } from '~/shared/ui/button';
import { ScrollArea } from '~/shared/ui/scroll';
import { Text } from '~/shared/ui/text';

import { HuntPanelFrame } from './HuntPanelFrame';

const TITLE = 'Análise da Sessão';
const XP_PER_HOUR_LABEL = 'Experiência / hora';
const XP_TOTAL_LABEL = 'Experiência total';
const KILLS_PER_HOUR_LABEL = 'Abates / hora';
const KILLS_TOTAL_LABEL = 'Abates totais';
const GAINS_LABEL = 'Ganhos';
const SPENT_LABEL = 'Gastos';
const SCROLL_MAX_HEIGHT = '11rem';

/**
 * The analysis of the session: the numbers of the hunt and the items it
 * gained and spent. It collapses into a single line to give the screen back.
 */
export function HuntAnalyzerPanel(): ReactElement {
  const ledger = useHuntState(selectLedger);
  const session = useHuntState(selectSession);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  if (session === null || ledger === null) {
    return <HuntPanelFrame />;
  }

  const body = collapsed ? null : (
    <>
      <SessionStats ledger={ledger} startedAt={session.startedAt} />
      <ScrollArea maxHeight={SCROLL_MAX_HEIGHT}>
        <ItemSection label={GAINS_LABEL} items={ledger.drops} />
        <ItemSection label={SPENT_LABEL} items={ledger.spent} />
      </ScrollArea>
    </>
  );

  return (
    <HuntPanelFrame>
      <PanelHeader collapsed={collapsed} onToggle={setCollapsed} />
      {body}
    </HuntPanelFrame>
  );
}

/**
 * The numbers that depend on the elapsed time.
 *
 * They tick once a second, so they live in their own component: the rest of
 * the panel (gains, spent, the header) must not re-render for the clock.
 */
function SessionStats(props: { ledger: HuntLedger; startedAt: number }): ReactElement {
  const { ledger, startedAt } = props;
  const now = useHuntTick();
  const elapsed = now - startedAt;
  const xpPerHour = perHour(ledger.experience, elapsed);
  const killsPerHour = perHour(ledger.kills, elapsed);
  return (
    <StatGrid
      killsPerHour={killsPerHour}
      killsTotal={ledger.kills}
      xpPerHour={xpPerHour}
      xpTotal={ledger.experience}
    />
  );
}

function PanelHeader(props: {
  collapsed: boolean;
  onToggle: (collapsed: boolean) => void;
}): ReactElement {
  const { collapsed, onToggle } = props;
  const label = collapsed ? '+' : '−';
  const ariaLabel = collapsed ? 'Expandir análise' : 'Recolher análise';
  function toggle(): void {
    onToggle(!collapsed);
  }
  return (
    <Box alignItems="center" display="flex" justifyContent="space-between">
      <Text color="fg" variant="label">
        {TITLE}
      </Text>
      <NativeButton aria-label={ariaLabel} color="fg.muted" cursor="pointer" onClick={toggle}>
        {label}
      </NativeButton>
    </Box>
  );
}

function StatGrid(props: {
  killsPerHour: number;
  killsTotal: number;
  xpPerHour: number;
  xpTotal: number;
}): ReactElement {
  const { killsPerHour, killsTotal, xpPerHour, xpTotal } = props;
  return (
    <Box display="grid" gap="1" gridTemplateColumns="1fr auto" rowGap="1">
      <StatLabel>{XP_PER_HOUR_LABEL}</StatLabel>
      <StatValue value={xpPerHour} />
      <StatLabel>{XP_TOTAL_LABEL}</StatLabel>
      <StatValue value={xpTotal} />
      <StatLabel>{KILLS_PER_HOUR_LABEL}</StatLabel>
      <StatValue value={killsPerHour} />
      <StatLabel>{KILLS_TOTAL_LABEL}</StatLabel>
      <StatValue value={killsTotal} />
    </Box>
  );
}

function StatLabel(props: { children: string }): ReactElement {
  return (
    <Text color="fg.muted" variant="meta">
      {props.children}
    </Text>
  );
}

function StatValue(props: { value: number }): ReactElement {
  return (
    <Text color="fg" textAlign="right" variant="numeric">
      {props.value}
    </Text>
  );
}

function ItemSection(props: { items: HuntLedgerItem[]; label: string }): ReactElement {
  const { items, label } = props;
  const rows = items.length === 0 ? <EmptySection /> : items.map(renderItem);
  return (
    <Box marginBlockStart="3">
      <Text color="fg.muted" variant="meta">
        {label}
      </Text>
      {rows}
    </Box>
  );
}

function renderItem(item: HuntLedgerItem): ReactElement {
  return (
    <Box
      alignItems="center"
      display="flex"
      justifyContent="space-between"
      key={item.itemId}
      paddingBlock="1"
    >
      <Text color="fg" variant="body">
        {item.name}
      </Text>
      <Text color="fg" variant="numeric">
        {item.quantity}
      </Text>
    </Box>
  );
}

function EmptySection(): ReactElement {
  return (
    <Text color="fg.subtle" variant="meta">
      Nada por enquanto
    </Text>
  );
}
