import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface PackTilesetResult {
  atlasUrl: string;
  mapping: Record<string, number>;
  tilesetUrl: string;
  totalTiles: number;
}

type PromiseResolve = (val: PackTilesetResult) => void;
type PromiseReject = (err: unknown) => void;
type StdioConfig = ['pipe', 'pipe', 'pipe'];

function resolveScriptPath(): string {
  const currentDir = import.meta.dir;
  const candidatePaths = [
    path.resolve(currentDir, '../../web/scripts/pack-map-tileset.py'),
    path.resolve(currentDir, '../../../apps/web/scripts/pack-map-tileset.py'),
  ];
  const found = candidatePaths.find(existsSync);
  return found ?? candidatePaths[0];
}

export function packMapTileset(slug: string, frames: Array<number>): Promise<PackTilesetResult> {
  function executor(resolvePromise: PromiseResolve, rejectPromise: PromiseReject): void {
    const scriptPath = resolveScriptPath();
    const spawnArgs = [scriptPath, '-'];
    const stdio: StdioConfig = ['pipe', 'pipe', 'pipe'];
    const spawnOptions = { stdio };
    const child = spawn('python3', spawnArgs, spawnOptions);

    const payloadObj = { frames, slug };
    const payload = JSON.stringify(payloadObj);
    let stdoutData = '';
    let stderrData = '';

    function onStdoutData(chunk: Buffer): void {
      stdoutData += chunk.toString();
    }

    function onStderrData(chunk: Buffer): void {
      stderrData += chunk.toString();
    }

    function onClose(code: number | null): void {
      if (code !== 0) {
        const error = new Error(`Tileset packer failed with code ${code}: ${stderrData}`);
        rejectPromise(error);
        return;
      }
      try {
        const parsed = JSON.parse(stdoutData.trim()) as PackTilesetResult;
        resolvePromise(parsed);
      } catch (err) {
        rejectPromise(err);
      }
    }

    child.stdout.on('data', onStdoutData);
    child.stderr.on('data', onStderrData);
    child.on('close', onClose);

    child.stdin.write(payload);
    child.stdin.end();
  }

  return new Promise(executor);
}
