import type { Direction } from '@creatures/contracts/world';
import type { SupabaseClient } from '@supabase/supabase-js';

const POSITION_COLUMNS = 'x, y, facing';

const DIRECTIONS: ReadonlySet<string> = new Set([
  'up',
  'upRight',
  'right',
  'downRight',
  'down',
  'downLeft',
  'left',
  'upLeft',
]);

/**
 * The last durable square of a trainer.
 *
 * The facing travels with the square because the client draws the idle sprite
 * in the direction the trainer was looking when the connection ended.
 */
export type TrainerPosition = {
  facing: Direction;
  x: number;
  y: number;
};

type PositionRow = {
  facing: string;
  x: number;
  y: number;
};

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export function readTrainerPosition(
  admin: SupabaseClient,
  trainerId: string,
): Promise<TrainerPosition | null> {
  const query = admin
    .from('trainer_positions')
    .select(POSITION_COLUMNS)
    .eq('trainer_id', trainerId)
    .maybeSingle();
  return Promise.resolve(query.then(readPosition));
}

/**
 * Writes the position of a trainer, creating the row on the first write.
 *
 * The caller owns the debounce; this function is one round trip to the
 * database, not a queue.
 */
export function saveTrainerPosition(
  admin: SupabaseClient,
  trainerId: string,
  position: TrainerPosition,
): Promise<void> {
  const query = admin.from('trainer_positions').upsert(
    {
      facing: position.facing,
      trainer_id: trainerId,
      x: position.x,
      y: position.y,
    },
    { onConflict: 'trainer_id' },
  );
  return Promise.resolve(query.then(readSaveOutcome));
}

function readPosition(result: QueryResult<PositionRow>): TrainerPosition | null {
  if (result.error !== null) {
    throw new Error(`Position lookup failed: ${result.error.message}`);
  }
  const row = result.data;
  if (row === null) {
    return null;
  }
  return { facing: readFacing(row.facing), x: row.x, y: row.y };
}

function readSaveOutcome(result: { error: { message: string } | null }): void {
  if (result.error !== null) {
    throw new Error(`Position write failed: ${result.error.message}`);
  }
}

/**
 * A row written by an older version, or edited by hand, may carry a facing
 * this build does not know; the square is still valid, so it is kept.
 */
function readFacing(value: string): Direction {
  return DIRECTIONS.has(value) ? (value as Direction) : 'down';
}
