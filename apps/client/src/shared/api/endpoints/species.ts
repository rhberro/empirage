import type { Ability, Element, Species } from '@creatures/contracts/species';

import type { ApiDeps } from '~/shared/api/client';
import { buildHeaders, isSuccessStatus, resolveErrorCode } from '~/shared/api/http';
import type { TrainerClientErrorCode } from '~/shared/api/http';

const SPECIES_PATH = '/api/species';
const UNAUTHENTICATED: TrainerClientErrorCode = 'unauthenticated';

const ELEMENTS: readonly Element[] = ['fire', 'neutral', 'plant', 'water'];

export type SpeciesResult =
  | { ok: true; species: Species }
  | { ok: false; code: TrainerClientErrorCode };

/**
 * One species, with the abilities it declares.
 *
 * A criatura carrega os valores de base da especie, mas nao as habilidades: o
 * detalhe de uma criatura do armazenamento precisa delas.
 */
export function requestSpecies(deps: ApiDeps, speciesId: string): Promise<SpeciesResult> {
  return deps.getAccessToken().then(function withToken(
    token: string | null,
  ): SpeciesResult | Promise<SpeciesResult> {
    if (token === null) {
      return { code: UNAUTHENTICATED, ok: false };
    }
    const headers = buildHeaders(token);
    const init = { headers, method: 'GET' };
    return globalThis
      .fetch(buildSpeciesUrl(deps.baseUrl, speciesId), init)
      .then(readSpeciesResponse)
      .catch(readSpeciesNetworkFailure);
  });
}

function readSpeciesResponse(response: Response): Promise<SpeciesResult> {
  if (isSuccessStatus(response.status)) {
    return response.json().then(buildSpeciesResult, buildUnreadableSpeciesResult(response.status));
  }
  return response
    .json()
    .then(buildSpeciesFailure(response.status), buildUnreadableSpeciesResult(response.status));
}

function buildSpeciesResult(body: unknown): SpeciesResult {
  const record = readRecord(body);
  const species = record === null ? null : readSpecies(record.species);
  if (species === null) {
    return { code: 'unknown', ok: false };
  }
  return { ok: true, species };
}

function buildSpeciesFailure(status: number): (body: unknown) => SpeciesResult {
  return function toSpeciesFailure(body: unknown): SpeciesResult {
    return { code: resolveErrorCode(status, body), ok: false };
  };
}

function buildUnreadableSpeciesResult(status: number): () => SpeciesResult {
  return function toUnreadableSpecies(): SpeciesResult {
    return { code: resolveErrorCode(status, null), ok: false };
  };
}

function readSpeciesNetworkFailure(): SpeciesResult {
  return { code: 'unknown', ok: false };
}

function readSpecies(value: unknown): Species | null {
  const record = readRecord(value);
  if (record === null) {
    return null;
  }
  const id = readString(record.id);
  const name = readString(record.name);
  if (id === null || name === null) {
    return null;
  }
  return {
    abilities: readAbilities(record.abilities),
    baseExperience: readNumber(record.baseExperience),
    baseMagicAttack: readNumber(record.baseMagicAttack),
    baseMagicDefense: readNumber(record.baseMagicDefense),
    basePhysicalAttack: readNumber(record.basePhysicalAttack),
    basePhysicalDefense: readNumber(record.basePhysicalDefense),
    baseVitality: readNumber(record.baseVitality),
    captureChance: readNumber(record.captureChance),
    description: readString(record.description) ?? '',
    element: readElement(record.element),
    id,
    isStarter: record.isStarter === true,
    name,
    slug: readString(record.slug) ?? '',
  };
}

function readAbilities(value: unknown): Ability[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const abilities: Ability[] = [];
  for (const entry of value) {
    const ability = readAbility(entry);
    if (ability !== null) {
      abilities.push(ability);
    }
  }
  return abilities;
}

function readAbility(value: unknown): Ability | null {
  const record = readRecord(value);
  if (record === null) {
    return null;
  }
  const id = readString(record.id);
  const name = readString(record.name);
  if (id === null || name === null) {
    return null;
  }
  return {
    cooldownMs: readNumber(record.cooldownMs),
    damage: readNumber(record.damage),
    description: readString(record.description) ?? '',
    element: readElement(record.element),
    id,
    name,
    slug: readString(record.slug) ?? '',
  };
}

function readElement(value: unknown): Element {
  return ELEMENTS.includes(value as Element) ? (value as Element) : 'neutral';
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function buildSpeciesUrl(baseUrl: string, speciesId: string): string {
  return `${baseUrl}${SPECIES_PATH}/${speciesId}`;
}
