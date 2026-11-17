type CatalogLoader<T> = () => Promise<T>;

const entries = new Map<string, Promise<unknown>>();

export function loadCatalog<T>(key: string, loader: CatalogLoader<T>): Promise<T> {
  const current = entries.get(key) as Promise<T> | undefined;
  if (current) {
    return current;
  }
  const pending = loader();
  entries.set(key, pending);
  function removeRejectedEntry(): void {
    if (entries.get(key) === pending) {
      entries.delete(key);
    }
  }
  pending.catch(removeRejectedEntry);
  return pending;
}
