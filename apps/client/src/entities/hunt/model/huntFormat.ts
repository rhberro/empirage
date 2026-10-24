import type { HuntLedgerItem } from '@creatures/contracts/huntSim';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const MS_PER_HOUR = SECONDS_PER_HOUR * 1000;

/**
 * A duration as `mm:ss`, or `h:mm:ss` past the first hour.
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * The fraction of a cooldown that still remains, from one down to zero.
 */
export function cooldownRemainingFraction(
  readyAt: number,
  cooldownMs: number,
  now: number,
): number {
  if (cooldownMs <= 0) {
    return 0;
  }
  const remaining = readyAt - now;
  if (remaining <= 0) {
    return 0;
  }
  return Math.min(1, remaining / cooldownMs);
}

/**
 * How many milliseconds of a cooldown are left.
 */
export function cooldownRemainingMs(readyAt: number, now: number): number {
  return Math.max(0, readyAt - now);
}

/**
 * A total scaled to an hourly rate.
 *
 * The rate is zero while there is no elapsed time to divide by.
 */
export function perHour(total: number, elapsedMs: number): number {
  const hours = elapsedMs / MS_PER_HOUR;
  if (hours <= 0) {
    return 0;
  }
  return Math.round(total / hours);
}

/**
 * The quantity of an item, with the name to label the slot.
 *
 * The ledger already aggregates equal items, so the slot only reads it.
 */
export function readLedgerItem(item: HuntLedgerItem): { label: string; quantity: number } {
  return { label: item.name, quantity: item.quantity };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
