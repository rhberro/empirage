/**
 * The loadout of the creatures of the test account.
 *
 * The 2.2 catalog has three kinds of ability, and the test account exercises
 * every one of them in the four slots of the bar: two that reach a target, one
 * area around a target, and one centred on the caster. The slots of the species
 * and the slots of the player are independent, so an ability declared in slot 4
 * of the species can be equipped in slot 3 of the creature.
 */
import type { AdminClient, SeedContext } from './seedTestAccountStore';

// Target, target, area around a target and area centred on the caster.
const LOADOUT_SLUGS = ['brasa', 'garra', 'ignea', 'explosao'];

type CatalogAbility = {
  id: string;
  slug: string;
};

type AbilitySlotRow = {
  ability_id: string;
  creature_id: string;
  slot: number;
};

type RowsResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export function equipSpeciesAbilities(ctx: SeedContext): Promise<SeedContext> {
  return readLoadout(ctx.admin).then(function equipEveryCreature(
    loadout: CatalogAbility[],
  ): Promise<SeedContext> {
    return equipCreature(ctx, ctx.creatureIds, loadout, 0);
  });
}

function readLoadout(admin: AdminClient): Promise<CatalogAbility[]> {
  const query = admin.from('abilities').select('id, slug').in('slug', LOADOUT_SLUGS);
  return Promise.resolve(query).then(function orderRows(
    result: RowsResult<CatalogAbility>,
  ): CatalogAbility[] {
    if (result.error !== null) {
      throw new Error(`Falha ao ler o catálogo de habilidades: ${result.error.message}`);
    }
    return orderLoadout(result.data ?? []);
  });
}

function orderLoadout(rows: CatalogAbility[]): CatalogAbility[] {
  return LOADOUT_SLUGS.map(function pick(slug: string): CatalogAbility {
    const row = rows.find(function matches(candidate: CatalogAbility): boolean {
      return candidate.slug === slug;
    });
    if (row === undefined) {
      throw new Error(`A habilidade "${slug}" não está no catálogo.`);
    }
    return row;
  });
}

function equipCreature(
  ctx: SeedContext,
  creatureIds: string[],
  loadout: CatalogAbility[],
  index: number,
): Promise<SeedContext> {
  const creatureId = creatureIds[index];
  if (creatureId === undefined) {
    return Promise.resolve(ctx);
  }
  const rows = loadout.map(function toSlot(ability: CatalogAbility, slot: number): AbilitySlotRow {
    return { ability_id: ability.id, creature_id: creatureId, slot };
  });
  const query = ctx.admin.from('creature_ability_slots').upsert(rows);
  return Promise.resolve(query).then(function written(result: {
    error: { message: string } | null;
  }): Promise<SeedContext> {
    if (result.error !== null) {
      throw new Error(`Falha ao equipar as habilidades: ${result.error.message}`);
    }
    return equipCreature(ctx, creatureIds, loadout, index + 1);
  });
}
