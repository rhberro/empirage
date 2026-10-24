import { expect, test } from 'bun:test';

import { buildFakeAdmin } from '~/__tests__/fakeAdmin';
import type { TrainerPositionRow } from '~/__tests__/fakeAdmin';
import { createPositionWriter } from '~/world/positionWriter';

const TRAINER = 'trainer-1';

function wait(ms: number): Promise<void> {
  return new globalThis.Promise(function resolveLater(resolve): void {
    setTimeout(resolve, ms);
  });
}

/**
 * The debounce keeps only the last position of the window: a walk does not
 * become one upsert per step.
 */
test('the debounce coalesces the writes of a trainer', function coalesces(): Promise<void> {
  const saves: TrainerPositionRow[] = [];
  const writer = createPositionWriter({
    admin: buildFakeAdmin(undefined, { saves }),
    delayMs: 20,
  });

  writer.mark(TRAINER, { facing: 'right', x: 1, y: 1 });
  writer.mark(TRAINER, { facing: 'right', x: 2, y: 2 });
  writer.mark(TRAINER, { facing: 'right', x: 3, y: 3 });
  return wait(60).then(function assertWrites(): void {
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ facing: 'right', trainer_id: TRAINER, x: 3, y: 3 });
  });
});

/**
 * The immediate flush of a disconnect does not wait for the window, and it
 * does not write the same position twice.
 */
test('flush writes now and cancels the window', function flushes(): Promise<void> {
  const saves: TrainerPositionRow[] = [];
  const writer = createPositionWriter({
    admin: buildFakeAdmin(undefined, { saves }),
    delayMs: 50,
  });

  writer.mark(TRAINER, { facing: 'down', x: 4, y: 4 });
  return writer
    .flush(TRAINER)
    .then(function assertFirstWrite(): Promise<void> {
      expect(saves).toHaveLength(1);
      return wait(80);
    })
    .then(function assertNoSecondWrite(): void {
      expect(saves).toHaveLength(1);
    });
});
