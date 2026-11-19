type PageEntityIds = Array<string>;

export class PaginatedEntityCache {
  private pages = new Map<number, PageEntityIds>();
  private revision = 0;

  public get(page: number, currentRevision: number): PageEntityIds | undefined {
    if (this.revision !== currentRevision) {
      this.pages.clear();
      this.revision = currentRevision;
      return undefined;
    }
    return this.pages.get(page);
  }

  public set(page: number, ids: PageEntityIds, revision: number): void {
    if (this.revision !== revision) {
      this.pages.clear();
      this.revision = revision;
    }
    this.pages.set(page, ids);
  }

  public has(page: number, currentRevision: number): boolean {
    return this.revision === currentRevision && this.pages.has(page);
  }

  public invalidate(): void {
    this.pages.clear();
  }
}
