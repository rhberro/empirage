import './Slot.css';
import { Portal, Show, Square, Tooltip } from '@chakra-ui/react';
import * as React from 'react';

type SlotProps = Omit<React.BaseHTMLAttributes<HTMLDivElement>, 'content'> & {
  content: React.ReactNode;
  cooldownMs: number | undefined;
  cooldownEndsAt: number | undefined;
  label: string;
};
type Cooldown = { delayMs: number; endsAt: number };
type CooldownStyle = React.CSSProperties & {
  '--cooldown-delay': string;
  '--cooldown-duration': string;
};

export const Slot = SlotComponent;

function SlotComponent(props: SlotProps): React.ReactElement {
  const { content, cooldownMs, cooldownEndsAt, label, onClick } = props;
  const [activeCooldown, setCooldown] = React.useState(getInitialCooldown);
  const previousCooldownEndsAt = React.useRef(cooldownEndsAt);
  function getInitialCooldown(): Cooldown | null {
    return createCooldown(cooldownEndsAt, cooldownMs);
  }
  function synchronizeCooldown(): void {
    if (previousCooldownEndsAt.current === cooldownEndsAt) {
      return;
    }
    previousCooldownEndsAt.current = cooldownEndsAt;
    setCooldown(createCooldown(cooldownEndsAt, cooldownMs));
  }
  React.useEffect(synchronizeCooldown, [cooldownEndsAt, cooldownMs]);
  const cooldown =
    activeCooldown && activeCooldown.endsAt === cooldownEndsAt ? activeCooldown : null;
  const cooldownStyle: CooldownStyle | undefined = cooldown
    ? {
        '--cooldown-delay': `-${cooldown.delayMs}ms`,
        '--cooldown-duration': `${cooldownMs}ms`,
      }
    : undefined;
  const hasCooldown = cooldown && cooldownStyle;
  const cursor = onClick ? 'pointer' : undefined;
  return (
    <Tooltip.Root>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content>
            <Tooltip.Arrow>
              <Tooltip.ArrowTip />
            </Tooltip.Arrow>
            {label}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
      <Tooltip.Trigger>
        <Square
          aspectRatio="square"
          // border="sm"
          borderRadius="sm"
          boxShadow="panel"
          cursor={cursor}
          onClick={onClick}
          overflow="hidden"
          position="relative"
          w="14"
        >
          <Show when={hasCooldown}>
            <span aria-hidden="true" className="slot__cooldown" style={cooldownStyle} />
          </Show>
          {content}
        </Square>
      </Tooltip.Trigger>
    </Tooltip.Root>
  );
}

function createCooldown(
  cooldownEndsAt: number | undefined,
  cooldownMs: number | undefined,
): Cooldown | null {
  if (cooldownEndsAt === undefined || cooldownMs === undefined) {
    return null;
  }
  const now = Date.now();
  const remainingMs = Math.max(0, cooldownEndsAt - now);
  if (remainingMs === 0) {
    return null;
  }
  const delayMs = Math.min(cooldownMs, Math.max(0, cooldownMs - remainingMs));
  return { delayMs, endsAt: cooldownEndsAt };
}
