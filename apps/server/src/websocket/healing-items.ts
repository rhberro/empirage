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
  healing_item_id: number | null;
  healing_threshold_percentage: number | null;
};
type HealingItemRow = {
  gold_cost: number;
  healing_amount: number;
  id: number;
  name: string;
  restores_full_health: boolean;
  slug: string;
};
type HealingItemRows = Array<HealingItemRow>;
type ResourceQuery = PromiseLike<{ data: unknown; error: unknown }>;
type CharacterHealingQueries = [ResourceQuery, ResourceQuery];

function mapHealingItem(item: HealingItemRow): HealingItemResource {
  return {
    goldCost: item.gold_cost,
    healingAmount: item.healing_amount,
    id: item.id,
    name: item.name,
    restoresFullHealth: item.restores_full_health,
    slug: item.slug,
  };
}

export async function loadCharacterHealingResources(
  client: SupabaseClient,
  characterId: string,
): Promise<CharacterHealingResources> {
  const queries: CharacterHealingQueries = [
    client
      .from('characters')
      .select('gold, healing_item_id, healing_threshold_percentage')
      .eq('id', characterId)
      .single(),
    client
      .from('healing_items')
      .select('id, slug, name, healing_amount, restores_full_health, gold_cost')
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
  const healingItems = healingItemRows.map(mapHealingItem);
  const healingConfiguration =
    character.healing_item_id !== null && character.healing_threshold_percentage !== null
      ? {
          itemId: character.healing_item_id,
          thresholdPercentage: character.healing_threshold_percentage,
        }
      : undefined;
  return { gold: character.gold, healingConfiguration, healingItems };
}
