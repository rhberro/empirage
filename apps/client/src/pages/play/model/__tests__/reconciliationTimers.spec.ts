import { expect, test } from 'bun:test';
import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const CLIENT_SRC = fileURLToPath(new globalThis.URL('../../../../', import.meta.url));
const FORBIDDEN_DELAY_MS = 600;

type SourceFile = {
  path: string;
  source: string;
};

/**
 * Every source of the client.
 */
function readSources(directory: string): Promise<SourceFile[]> {
  return readdir(directory, { withFileTypes: true }).then(function readEntries(
    entries: Dirent[],
  ): Promise<SourceFile[]> {
    const reads: Promise<SourceFile[]>[] = [];
    for (const entry of entries) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        reads.push(readSources(path));
        continue;
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
        continue;
      }
      reads.push(
        readFile(path).then(function toFile(source: string): SourceFile[] {
          return [{ path, source }];
        }),
      );
    }
    return Promise.all(reads).then(function flatten(files: SourceFile[][]): SourceFile[] {
      return files.flat();
    });
  });
}

function readFile(path: string): Promise<string> {
  return globalThis.Bun.file(path).text();
}

/**
 * The delays of the timers of a source.
 */
function readDelays(source: string): number[] {
  const pattern = /setTimeout\([\s\S]{0,400}?,\s*(\d[\d_]*)\s*\)/gu;
  const delays: number[] = [];
  const matches = source.matchAll(pattern);
  for (const match of matches) {
    delays.push(Number(match[1].replaceAll('_', '')));
  }
  return delays;
}

/**
 * The names of the constants of a source that hold the forbidden delay.
 */
function readDelayConstants(source: string): string[] {
  const pattern = /const\s+(\w+)\s*=\s*600\b/gu;
  const names: string[] = [];
  const matches = source.matchAll(pattern);
  for (const match of matches) {
    names.push(match[1]);
  }
  return names;
}

/**
 * The sources that carry a timer of the forbidden delay.
 */
function findOffenders(sources: SourceFile[]): string[] {
  const offenders: string[] = [];
  for (const file of sources) {
    // The test itself carries the number it looks for.
    if (file.path.includes('reconciliationTimers.spec')) {
      continue;
    }
    if (readDelays(file.source).includes(FORBIDDEN_DELAY_MS)) {
      offenders.push(file.path);
      continue;
    }
    const constants = readDelayConstants(file.source);
    const usesConstant = constants.some(function uses(name: string): boolean {
      return file.source.includes('setTimeout') && file.source.includes(name);
    });
    if (usesConstant) {
      offenders.push(file.path);
    }
  }
  return offenders;
}

/**
 * The two timers of 600 ms that reconciled the state of the client with the
 * state of the server are gone: the command waits for the state that
 * confirms it, and the client asks for the state only when it does not come.
 */
test('no timer of 600 ms survives', function findsNoTimer(): Promise<void> {
  return readSources(CLIENT_SRC).then(function assertNoTimer(sources: SourceFile[]): void {
    expect(findOffenders(sources)).toEqual([]);
  });
});
