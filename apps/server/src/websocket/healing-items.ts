import type { SupabaseClient } from '@supabase/supabase-js';

export type HealingItemResource = {
  goldCost: number;
  healingAmount: number;
  id: number;
  name: string;
  restoresFullHealth: boolean;
  slug: string;
};
export type HealingConfigurationResource = {
  itemId: number;
  thresholdPercentage: number;
};
export type CharacterHealingResources = {
  gold: number;
  healingConfiguration: HealingConfigurationResource | undefined;
  healingItems: Array<HealingItemResource>;
};

type CharacterRow = {
  gold: number;
  character_battle_item_configuration: BattleConfigurationRow | null;
};
type BattleConfigurationRow = { item_id: number; threshold_percentage: number };
type HealingItemRow = {
  buy_price: number;
  healing_amount: number | null;
  id: number;
  name: string;
  restores_full_health: boolean;
  slug: string;
};
type HealingItemRows = Array<HealingItemRow>;
type HealingItemResources = Array<HealingItemResource>;
type ResourceQuery = PromiseLike<{ data: unknown; error: unknown }>;
type CharacterHealingQueries = [ResourceQuery, ResourceQuery];

function mapHealingItem(item: HealingItemRow): HealingItemResource {
  return {
    goldCost: item.buy_price,
    healingAmount: item.healing_amount ?? 0,
    id: item.id,
    name: item.name,
    restoresFullHealth: item.restores_full_health,
    slug: item.slug,
  };
}

function isSupportedHealingItem(item: HealingItemRow): boolean {
  return (
    item.buy_price > 0 &&
    (item.restores_full_health || (item.healing_amount !== null && item.healing_amount > 0))
  );
}

function hasConfiguredItem(items: HealingItemResources, itemId: number): boolean {
  for (const item of items) {
    if (item.id === itemId) {
      return true;
    }
  }
  return false;
}

export async function loadCharacterHealingResources(
  client: SupabaseClient,
  characterId: string,
): Promise<CharacterHealingResources> {
  const queries: CharacterHealingQueries = [
    client
      .from('characters')
      .select('gold, character_battle_item_configuration(item_id, threshold_percentage)')
      .eq('id', characterId)
      .single(),
    client
      .from('items')
      .select('id, slug, name, healing_amount, restores_full_health, buy_price')
      .eq('category', 'medicine')
      .order('id'),
  ];
  const [characterResult, healingItemResult] = await Promise.all(queries);
  if (characterResult.error) {
    throw characterResult.error;
  }
  if (healingItemResult.error) {
    throw healingItemResult.error;
  }
  const character = characterResult.data as CharacterRow;
  const healingItemRows = healingItemResult.data as HealingItemRows;
  const healingItems = healingItemRows.filter(isSupportedHealingItem).map(mapHealingItem);
  const configuration = character.character_battle_item_configuration;
  const healingConfiguration =
    configuration && hasConfiguredItem(healingItems, configuration.item_id)
      ? { itemId: configuration.item_id, thresholdPercentage: configuration.threshold_percentage }
      : undefined;
  return { gold: character.gold, healingConfiguration, healingItems };
}
