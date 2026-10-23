import type { HuntArea, HuntAreaSpecies } from '@creatures/contracts/hunt';
import type { ItemCategory } from '@creatures/contracts/inventory';
import type { Element } from '@creatures/contracts/species';
import type { Gender } from '@creatures/contracts/trainer';

/**
 * An area of the list carries the primary species as well, because the card of
 * the area draws it. The shared contract keeps it on the detail, where the
 * drawer shows the whole area.
 */
export type HuntAreaListEntry = HuntArea & { primarySpecies: HuntAreaSpecies };

/** Shape of a Postgres error the repository can forward to the error mapper. */
export type DatabaseError = {
  code: string;
  message: string;
};

export type TrainerRow = {
  created_at: string;
  diamonds: number;
  gender: Gender;
  gold: number;
  id: string;
  level: number;
  name: string;
  owner_id: string;
  stamina_minutes: number;
  starter_species_id: string;
};

export type CreatureRow = {
  captured_at: string | null;
  created_at: string;
  experience: number;
  id: string;
  is_in_team: boolean;
  level: number;
  nickname: string | null;
  potential: unknown;
  species: CreatureSpeciesRow | CreatureSpeciesRow[] | null;
  species_id: string;
  team_slot: number | null;
  trainer_id: string;
};

export type SpeciesSummaryRow = {
  element: Element;
  id: string;
  name: string;
  slug: string;
};

/**
 * The species of a creature, with the values of base.
 *
 * A creature carries the BVs of its species because the interface shows the
 * calculated attributes, and the calculation needs the base value.
 */
export type CreatureSpeciesRow = SpeciesSummaryRow & {
  base_magic_attack: number;
  base_magic_defense: number;
  base_physical_attack: number;
  base_physical_defense: number;
  base_vitality: number;
};

export type TrainerItemRow = {
  item_id: string;
  items: ItemRow | ItemRow[] | null;
  quantity: number;
};

export type ItemRow = {
  category: ItemCategory;
  description: string;
  id: string;
  is_store_item: boolean;
  name: string;
  price: number;
  slug: string;
};

export type CreatureAbilityFields = {
  cooldown_ms: number;
  damage: number;
  description?: string;
  element: Element;
  id: string;
  name: string;
  slug: string;
};

export type CreatureAbilityRow = {
  abilities: CreatureAbilityFields | CreatureAbilityFields[] | null;
  slot: number;
};

export type AbilityFields = {
  cooldown_ms: number;
  damage: number;
  description: string;
  element: Element;
  id: string;
  name: string;
  slug: string;
};

export type SpeciesAbilityRow = {
  abilities: AbilityFields | AbilityFields[] | null;
  slot: number;
  species_id: string;
};

export type HuntAreaRow = {
  description: string;
  hunt_area_species: HuntAreaSpeciesRow[];
  id: string;
  minimum_level: number;
  name: string;
  recommended_level: number;
  slug: string;
  tone: string;
};

export type HuntAreaSpeciesRow = {
  is_primary: boolean;
  position: number;
  species: SpeciesSummaryRow | SpeciesSummaryRow[] | null;
};

export type HuntAreaItemRow = {
  items: ItemRow | ItemRow[] | null;
  species_id: string;
};

/** A slot of the skill bar that holds an ability of a creature. */
export type CreatureAbilitySlotRow = {
  abilities: CreatureAbilityFields | CreatureAbilityFields[] | null;
  slot: number;
};

/** A slot of the skill bar that belongs to the trainer. */
export type TrainerGearSlotRow = {
  item_id: string;
  items: GearItemFields | GearItemFields[] | null;
  kind: string;
  slot: number;
  trigger_hp_percent: number | null;
};

/** The fields of the item a slot of the trainer holds. */
export type GearItemFields = {
  id: string;
  name: string;
};

/** The quantity the trainer owns of one item. */
export type TrainerItemQuantityRow = {
  item_id: string;
  quantity: number;
};

/** The values that decide the life of the creature in the field. */
export type CreatureVitalsRow = {
  current_hp: number | null;
  level: number;
  potential: unknown;
  species: SpeciesVitalityRow | SpeciesVitalityRow[] | null;
};

export type SpeciesVitalityRow = {
  base_vitality: number;
};

export type SpeciesRow = {
  base_experience: number;
  base_magic_attack: number;
  base_magic_defense: number;
  base_physical_attack: number;
  base_physical_defense: number;
  base_vitality: number;
  capture_chance: number | string;
  description: string;
  element: Element;
  id: string;
  is_starter: boolean;
  name: string;
  slug: string;
};
