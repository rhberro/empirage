import type { SupabaseClient } from '@supabase/supabase-js';

export const CAPTURE_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
const AUTO_CAPTURE_ITEM_SLUG_VALUES = ['poke-ball', 'great-ball', 'ultra-ball'];
const AUTO_CAPTURE_ITEM_SLUGS = new Set(AUTO_CAPTURE_ITEM_SLUG_VALUES);

export type CaptureRarity = (typeof CAPTURE_RARITIES)[number];
export type CaptureItemResource = {
  captureRateMultiplier: number;
  goldCost: number;
  id: number;
  name: string;
  slug: string;
};
export type CaptureConfigurationResource = { itemId: number; rarities: Array<CaptureRarity> };
export type CharacterCaptureResources = {
  captureConfiguration: CaptureConfigurationResource | undefined;
  captureItems: Array<CaptureItemResource>;
};

type CaptureConfigurationRows = Array<CaptureConfigurationRow>;
type CaptureConfigurationRow = { item_id: number; rarities: Array<string> };
type CaptureRarities = Array<CaptureRarity>;
type CaptureItemRow = {
  buy_price: number;
  capture_rate_multiplier: number | string | null;
  id: number;
  name: string;
  slug: string;
};
type CaptureItemRows = Array<CaptureItemRow>;
type ResourceQuery = PromiseLike<{ data: unknown; error: unknown }>;
type CaptureQueries = [ResourceQuery, ResourceQuery];

function isCaptureRarity(value: string): value is CaptureRarity {
  return CAPTURE_RARITIES.includes(value as CaptureRarity);
}

function captureRateMultiplier(value: number | string | null): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1;
}

function mapCaptureItem(row: CaptureItemRow): CaptureItemResource {
  return {
    captureRateMultiplier: captureRateMultiplier(row.capture_rate_multiplier),
    goldCost: row.buy_price,
    id: row.id,
    name: row.name,
    slug: row.slug,
  };
}

function isPurchasableCaptureItem(row: CaptureItemRow): boolean {
  return (
    AUTO_CAPTURE_ITEM_SLUGS.has(row.slug) &&
    row.buy_price > 0 &&
    captureRateMultiplier(row.capture_rate_multiplier) > 0
  );
}

function configuredRarities(values: Array<string>): CaptureRarities {
  return values.filter(isCaptureRarity);
}

export async function loadCharacterCaptureResources(
  client: SupabaseClient,
  characterId: string,
): Promise<CharacterCaptureResources> {
  const queries: CaptureQueries = [
    client
      .from('character_capture_configuration')
      .select('item_id, rarities')
      .eq('character_id', characterId),
    client
      .from('items')
      .select('id, slug, name, buy_price, capture_rate_multiplier')
      .eq('category', 'poke_ball')
      .gt('buy_price', 0)
      .order('buy_price'),
  ];
  const [configurationResult, itemResult] = await Promise.all(queries);
  if (configurationResult.error) {
    throw configurationResult.error;
  }
  if (itemResult.error) {
    throw itemResult.error;
  }
  const itemRows = itemResult.data as CaptureItemRows;
  const purchasableItems = itemRows.filter(isPurchasableCaptureItem);
  const captureItems = purchasableItems.map(mapCaptureItem);
  const configurations = configurationResult.data as CaptureConfigurationRows;
  const configuration = configurations[0];
  const configuredItemId = configuration ? configuration.item_id : undefined;
  function isConfiguredItem(item: CaptureItemResource): boolean {
    return item.id === configuredItemId;
  }
  const configuredItem = configuration ? captureItems.find(isConfiguredItem) : undefined;
  const rarities = configuration ? configuredRarities(configuration.rarities) : [];
  const captureConfiguration =
    configuredItem && rarities.length > 0 ? { itemId: configuredItem.id, rarities } : undefined;
  return { captureConfiguration, captureItems };
}
