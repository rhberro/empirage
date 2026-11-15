type CommandTask<T> = () => Promise<T>;

type QueueTail = Promise<void>;

export class SerialCommandQueue {
  private readonly tails = new Map<string, QueueTail>();

  public run<T>(key: string, task: CommandTask<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    const tails = this.tails;

    function complete(): void {
      if (tails.get(key) === tail) {
        tails.delete(key);
      }
    }

    const tail = result.then(complete, complete);
    this.tails.set(key, tail);
    return result;
  }

  public hasPending(key: string): boolean {
    return this.tails.has(key);
  }
}
