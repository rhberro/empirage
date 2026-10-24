/**
 * The minimum heap of the weighted search.
 *
 * An entry is ordered by its cost and, on a tie, by the order it entered the
 * heap. The order is what makes the walk deterministic: two clicks on the
 * same square always produce the same steps.
 */
export type SearchEntry = {
  cost: number;
  key: number;
  order: number;
};

export function pushEntry(heap: SearchEntry[], entry: SearchEntry): void {
  heap.push(entry);
  let index = heap.length - 1;
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    if (compareEntries(heap[parentIndex], heap[index]) <= 0) {
      break;
    }
    swapEntries(heap, parentIndex, index);
    index = parentIndex;
  }
}

export function popEntry(heap: SearchEntry[]): SearchEntry | undefined {
  const first = heap[0];
  if (first === undefined) {
    return undefined;
  }
  const last = heap.pop();
  if (last !== undefined && heap.length > 0) {
    heap[0] = last;
    siftDown(heap, 0);
  }
  return first;
}

function siftDown(heap: SearchEntry[], index: number): void {
  let current = index;
  while (true) {
    const left = current * 2 + 1;
    const right = left + 1;
    let smallest = current;
    if (left < heap.length && compareEntries(heap[left], heap[smallest]) < 0) {
      smallest = left;
    }
    if (right < heap.length && compareEntries(heap[right], heap[smallest]) < 0) {
      smallest = right;
    }
    if (smallest === current) {
      return;
    }
    swapEntries(heap, current, smallest);
    current = smallest;
  }
}

function compareEntries(left: SearchEntry, right: SearchEntry): number {
  if (left.cost !== right.cost) {
    return left.cost - right.cost;
  }
  return left.order - right.order;
}

function swapEntries(heap: SearchEntry[], left: number, right: number): void {
  const value = heap[left];
  heap[left] = heap[right];
  heap[right] = value;
}
