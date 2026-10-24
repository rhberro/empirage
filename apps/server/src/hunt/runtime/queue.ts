export type SerialEnqueue = <T>(trainerId: string, task: () => Promise<T>) => Promise<T>;

/**
 * The serial queue of the operations of each trainer.
 *
 * Two advances of the same hunt never run at the same time, and a command that
 * arrives while an advance runs waits for it instead of reading a half-updated
 * state. The queue is per trainer, so one hunt never waits for another.
 */
export function createSerialQueue(): SerialEnqueue {
  const queues = new Map<string, Promise<unknown>>();

  function enqueue<T>(trainerId: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(trainerId) ?? Promise.resolve();
    function runTask(): Promise<T> {
      return task();
    }
    const next = previous.then(runTask, runTask);
    function clearQueue(): void {
      if (queues.get(trainerId) === settled) {
        queues.delete(trainerId);
      }
    }
    const settled = next.then(clearQueue, clearQueue);
    queues.set(trainerId, settled);
    return next;
  }

  return enqueue;
}
