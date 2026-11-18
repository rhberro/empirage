#!/usr/bin/env python3
"""Regenerate the species and move catalog from the project-local reference files."""

from pathlib import Path
import json
import re
import subprocess

from gen1_effect_families import GEN1_CLASSIC_EFFECTS

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / 'supabase' / 'seed.sql'
POKEDEX = ROOT / 'pokedex_151.json'
MOVES = ROOT / 'moves_all.json'
COVERAGE_REPORT = ROOT / 'docs' / 'game' / 'GEN1_MOVE_EFFECT_COVERAGE.json'

TYPE_NAMES = [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
    'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
]
TYPE_IDS = {name: index for index, name in enumerate(TYPE_NAMES, 1)}
STONE_IDS = {'fire stone': 82, 'leaf stone': 85, 'moon stone': 81, 'thunder stone': 83, 'water stone': 84}
SUPER_EFFECTIVE = {
    'normal': [], 'fire': ['grass', 'ice', 'bug', 'steel'], 'water': ['fire', 'ground', 'rock'],
    'electric': ['water', 'flying'], 'grass': ['water', 'ground', 'rock'], 'ice': ['grass', 'ground', 'flying', 'dragon'],
    'fighting': ['normal', 'ice', 'rock', 'dark', 'steel'], 'poison': ['grass', 'fairy'],
    'ground': ['fire', 'electric', 'poison', 'rock', 'steel'], 'flying': ['grass', 'fighting', 'bug'],
    'psychic': ['fighting', 'poison'], 'bug': ['grass', 'psychic', 'dark'], 'rock': ['fire', 'ice', 'flying', 'bug'],
    'ghost': ['psychic', 'ghost'], 'dragon': ['dragon'], 'dark': ['psychic', 'ghost'],
    'steel': ['ice', 'rock', 'fairy'], 'fairy': ['fighting', 'dragon', 'dark'],
}
IMMUNITIES = {
    'normal': ['ghost'], 'electric': ['ground'], 'fighting': ['ghost'], 'ground': ['flying'],
    'ghost': ['normal'], 'psychic': ['dark'], 'dragon': ['fairy'], 'poison': ['steel'],
}
RESISTANCES = {
    'normal': ['rock', 'steel'], 'fire': ['fire', 'water', 'rock', 'dragon'], 'water': ['water', 'grass', 'dragon'],
    'electric': ['electric', 'grass', 'dragon'], 'grass': ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'],
    'ice': ['fire', 'water', 'ice', 'steel'], 'fighting': ['poison', 'flying', 'psychic', 'bug', 'fairy'],
    'poison': ['poison', 'ground', 'rock', 'ghost'], 'ground': ['grass', 'bug'], 'flying': ['electric', 'rock', 'steel'],
    'psychic': ['psychic', 'steel'], 'bug': ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'],
    'rock': ['fighting', 'ground', 'steel'], 'ghost': ['dark'], 'dragon': ['steel'],
    'dark': ['fighting', 'dark', 'fairy'], 'steel': ['fire', 'water', 'electric', 'steel'], 'fairy': ['fire', 'poison', 'steel'],
}


def quote(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (dict, list, tuple)):
        return quote(json.dumps(value, separators=(',', ':')))
    return "'" + str(value).replace("'", "''") + "'"


def rows(values):
    return ',\n'.join('  (' + ', '.join(quote(value) for value in row) + ')' for row in values)


def section(name, columns, values, conflict):
    return f'insert into public.{name} ({columns}) values\n{rows(values)}\n{conflict};\n\n'


def measure(value, unit):
    match = re.match(r'([0-9.]+) ' + unit, value)
    return round(float(match.group(1)) * (10 if unit == 'm' else 10)) if match else 1


def gender_rate(gender):
    if gender['genderless']:
        return -1
    return round(gender['female'] / 12.5)


def target(description):
    text = description.lower()
    if text == 'targets the user.': return 'self'
    if 'entire field' in text: return 'field'
    if 'all adjacent pokémon' in text: return 'all_adjacent'
    if 'all pokémon on the user' in text: return 'all_allies'
    if 'all adjacent foes' in text or 'opposing field' in text: return 'all_enemies'
    if 'random adjacent opponent' in text: return 'random_enemy'
    if 'user or an adjacent pokémon on the user' in text or 'on the user’s team' in text: return 'ally'
    return 'enemy'


def geometry(normalized_target, category):
    if normalized_target == 'self': return ('melee', 'self', 'single', 0, 0, 0, 0)
    if normalized_target in {'all_enemies', 'all_adjacent', 'field'}: return ('ranged', normalized_target, 'square', 4, 1, 0, 0)
    if normalized_target == 'all_allies': return ('ranged', normalized_target, 'square', 0, 1, 0, 0)
    return ('ranged' if category != 'physical' else 'melee', normalized_target, 'single', 4 if category != 'physical' else 1, 0, 0, 0)


def pokedex_learnsets(pokedex, move_ids):
    result = {}
    methods = {
        'Moves learnt by level up': 'level',
        'Moves learnt by TM': 'machine',
        'Moves learnt by HM': 'machine',
        'Moves learnt on evolution': 'evolution',
        'Pre-evolution moves': 'evolution',
    }
    for species in pokedex:
        games = species['moves']['games']
        default_game = species['moves'].get('default_game')
        moves = games.get('Red/Blue') or games.get(default_game, {})
        for label, method in methods.items():
            source = moves.get(label, {})
            entries = source.get('rows', source) if isinstance(source, dict) else source
            for entry in entries:
                move_id = move_ids.get(entry['slug'])
                if move_id is None:
                    continue
                required_level = entry.get('lv') if method == 'level' else None
                machine_code = None
                if method == 'machine':
                    code = entry.get('tm') or entry.get('hm')
                    prefix = 'TM' if entry.get('tm') else 'HM'
                    machine_code = prefix + code if code else prefix
                # Deduplicate by conflict key (species_id, move_id, learn_method),
                # keeping the lowest level so the move is known from the start.
                key = (species['number'], move_id, method)
                existing = result.get(key)
                if existing is None or (
                    required_level is not None and (existing[3] is None or required_level < existing[3])
                ):
                    result[key] = (species['number'], move_id, method, required_level, machine_code)
    return sorted(result.values())


def status_effects(moves):
    patterns = {
        'burn': r'(?:may )?burn(?:s| the)? (?:the )?(?:opponent|target)',
        'freeze': r'(?:may )?freeze(?:s| the)? (?:the )?(?:opponent|target)',
        'paralysis': r'(?:may )?paraly[sz](?:e|es)(?: the)? (?:the )?(?:opponent|target)',
        'poison': r'(?:may |badly )?poison(?:s| the)? (?:the )?(?:opponent|target)',
        'sleep': r'puts (?:the )?opponent to sleep',
        'confusion': r'(?:may )?confuse(?:s| the)? (?:the )?(?:opponent|target)',
    }
    result = []
    for move_id, move in enumerate(moves, 1):
        effect = move['effect'].lower()
        chance = move['prob'] if isinstance(move['prob'], int) else 100
        for status, pattern in patterns.items():
            if re.search(pattern, effect):
                result.append((move_id, status, chance, 'target'))
    return sorted(set(result))


def stat_effects(moves):
    stats = {
        'attack': 'attack',
        'defense': 'defense',
        'special attack': 'special_attack',
        'special defense': 'special_defense',
        'speed': 'speed',
        'accuracy': 'accuracy',
        'evasion': 'evasion',
        'evasiveness': 'evasion',
    }
    result = []
    for move_id, move in enumerate(moves, 1):
        effect = move['effect'].lower()
        if 'raises' not in effect and 'lowers' not in effect:
            continue
        stage = 3 if 'drastically' in effect else 2 if any(word in effect for word in ('sharply', 'harshly')) else 1
        direction = 1 if 'raises' in effect else -1
        move_target = target(move['detail']['data'].get('target', ''))
        effect_target = 'user' if move_target in {'self', 'ally', 'all_allies'} else 'target'
        chance = move['prob'] if isinstance(move['prob'], int) else 100
        remaining = effect
        for phrase, stat in sorted(stats.items(), key=lambda entry: len(entry[0]), reverse=True):
            if phrase in remaining:
                result.append((move_id, stat, direction * stage, chance, effect_target))
                remaining = remaining.replace(phrase, '')
    return sorted(set(result))


def move_cooldown(move):
    power = move.get('power')
    effect = move.get('effect', '').lower()

    if power is not None and power > 0:
        if power <= 40:
            cd = 1500 + int(power * 12.5)
        else:
            cd = 2000 + int((power - 40) * 55)
        return max(1500, min(10000, cd))

    if 'one-hit-ko' in effect or ('faints' in effect and 'target' in effect):
        return 10000
    if 'deals 40 hp' in effect:
        return 2500
    if 'deals 20 hp' in effect:
        return 1800
    if "damage equal to user's level" in effect:
        return 3500
    if "half the target's current hp" in effect:
        return 5000

    has_sleep = bool(re.search(r'puts (?:the )?opponent to sleep', effect))
    has_freeze = bool(re.search(r'(?:may )?freeze(?:s| the)? (?:the )?(?:opponent|target)', effect))
    has_toxic = 'badly poison' in effect
    if has_sleep or has_freeze or has_toxic:
        return 10000

    has_paralysis = bool(re.search(r'(?:may )?paraly[sz](?:e|es)(?: the)? (?:the )?(?:opponent|target)', effect))
    has_poison = bool(re.search(r'(?:may |badly )?poison(?:s| the)? (?:the )?(?:opponent|target)', effect))
    has_burn = bool(re.search(r'(?:may )?burn(?:s| the)? (?:the )?(?:opponent|target)', effect))
    has_confusion = bool(re.search(r'(?:may )?confuse(?:s| the)? (?:the )?(?:opponent|target)', effect))
    if has_paralysis or has_poison or has_burn or has_confusion:
        return 8000

    if 'raises' in effect or 'lowers' in effect:
        if any(w in effect for w in ('sharply', 'harshly', 'drastically')) or ('raises' in effect and 'and' in effect):
            return 8000
        return 6000

    if 'recovers hp' in effect or 'recovers half' in effect or 'user sleeps' in effect:
        return 8000

    if 'halves damage' in effect or 'reduces damage' in effect or 'resets' in effect:
        return 8000

    return 5000


def move_effects(moves):
    result = []
    for move_id, move in enumerate(moves, 1):
        effect = move['effect'].lower()
        sequence = 0
        move_target = target(move['detail']['data'].get('target', ''))
        effect_target = 'user' if move_target in {'self', 'ally', 'all_allies'} else 'target'
        chance = move['prob'] if isinstance(move['prob'], int) else 100
        metadata = move.get('combat_metadata') or {}
        if move['power'] is not None:
            result.append((move_id, sequence, 'damage', effect_target, 100, None, None, None, None, None, None, None))
            sequence += 1
        drain_percentage = metadata.get('drain_percentage', 0)
        if drain_percentage:
            result.append((move_id, sequence, 'health_delta', 'user', 100, drain_percentage, None, None, None, 'damage_dealt', None, None))
            sequence += 1
        healing_percentage = metadata.get('healing_percentage', 0)
        if healing_percentage:
            result.append((move_id, sequence, 'health_delta', 'user', 100, healing_percentage, None, None, None, 'maximum_health', None, None))
            sequence += 1
        flinch_chance = metadata.get('flinch_chance', 0)
        if flinch_chance:
            result.append((move_id, sequence, 'action_block', 'target', flinch_chance, None, None, None, None, 'next_action', None, None))
            sequence += 1
        for stat_move_id, stat, stage, stat_chance, stat_target in stat_effects([move]):
            result.append((move_id, sequence, 'stat_stage', stat_target, stat_chance, stage, None, None, None, None, stat, None))
            sequence += 1
        for status_move_id, status, status_chance, status_target in status_effects([move]):
            result.append((move_id, sequence, 'status', status_target, status_chance, None, None, None, None, None, None, status))
            sequence += 1
        if 'traps opponent, damaging them for 4-5 turns' in effect:
            result.append((move_id, sequence, 'recurring_damage', 'target', 100, 12, 4, 5, 1000, None, None, None))
            sequence += 1
        elif 'drains hp from opponent each turn' in effect:
            result.append((move_id, sequence, 'recurring_damage', 'target', 100, 12, None, None, 1000, None, None, None))
            sequence += 1
        elif 'sleeping opponent loses 25%' in effect:
            result.append((move_id, sequence, 'recurring_damage', 'target', 100, 25, None, None, 1000, 'target_asleep', None, None))
            sequence += 1
        if 'sleeping opponent' in effect:
            result.append((move_id, sequence, 'target_requirement', 'target', 100, None, None, None, None, 'target_asleep', None, None))
            sequence += 1
        for definition in GEN1_CLASSIC_EFFECTS.get(move['slug'], []):
            kind = definition['kind']
            if (
                (kind == 'health_delta' and drain_percentage)
                or (kind == 'status' and status_effects([move]))
                or (kind == 'target_requirement' and 'sleeping opponent' in effect)
            ):
                continue
            effect_target = definition.get('target', effect_target)
            effect_chance = definition.get('chance', 100)
            effect_status = definition.get('status')
            parameters = {
                key: value
                for key, value in definition.items()
                if key not in {'chance', 'kind', 'status', 'target'}
            }
            result.append((
                move_id,
                sequence,
                kind,
                effect_target,
                effect_chance,
                None,
                None,
                None,
                None,
                definition.get('requirement'),
                None,
                effect_status,
                parameters,
            ))
            sequence += 1
    return [entry + ({},) if len(entry) == 12 else entry for entry in result]


def level_up_move_slugs(pokedex, move_slugs):
    result = set()
    for species in pokedex:
        games = species['moves']['games']
        default_game = species['moves'].get('default_game')
        source = (games.get('Red/Blue') or games.get(default_game, {})).get(
            'Moves learnt by level up', {}
        )
        entries = source.get('rows', source) if isinstance(source, dict) else source
        for entry in entries:
            slug = entry.get('slug')
            if slug in move_slugs:
                result.add(slug)
    return sorted(result)


def coverage_classification(move):
    effect = move['effect'].lower().strip()
    slug = move['slug']
    outside_scope = {
        'pay-day': 'battle_reward',
        'roar': 'wild_encounter_escape',
        'teleport': 'world_travel',
        'whirlwind': 'wild_encounter_escape',
    }
    if slug in outside_scope:
        return ('outside_scope', outside_scope[slug])
    if slug in GEN1_CLASSIC_EFFECTS:
        return ('supported', 'classic_structured_effect')
    if not effect:
        return ('supported', 'damage')
    supported_patterns = (
        'user recovers half the hp inflicted on opponent.',
        'user recovers half the hp inflicted on a sleeping opponent.',
        'user receives recoil damage.',
        'may cause flinching.',
        'may freeze opponent.',
        'may paralyze opponent.',
        'may burn opponent.',
        'may poison opponent.',
        'may confuse opponent.',
        'confuses opponent.',
        'puts opponent to sleep.',
        'poisons opponent.',
        'paralyzes opponent.',
        'traps opponent, damaging them for 4-5 turns.',
        'drains hp from opponent each turn.',
        'may lower opponent',
        'lowers opponent',
        'raises user',
        'sharply raises user',
        'sharply lowers opponent',
        'user recovers half its max hp.',
        'sleeping opponent loses 25%',
        'user attacks first.',
    )
    if any(effect == pattern or effect.startswith(pattern) for pattern in supported_patterns):
        return ('supported', 'structured_effect')
    return ('pending', 'missing_structured_primitive')


def audit_gen1_move_coverage(pokedex, moves):
    moves_by_slug = {move['slug']: move for move in moves}
    level_moves = level_up_move_slugs(pokedex, moves_by_slug)
    entries = []
    for slug in level_moves:
        move = moves_by_slug[slug]
        classification, reason = coverage_classification(move)
        entries.append({
            'classification': classification,
            'effect': move['effect'],
            'name': move['name'],
            'reason': reason,
            'slug': slug,
        })
    entries.sort(key=lambda entry: (entry['classification'], entry['slug']))
    report = {
        'scope': 'Generation 1 species moves learnt by level up',
        'summary': {
            classification: sum(1 for entry in entries if entry['classification'] == classification)
            for classification in ('supported', 'outside_scope', 'pending')
        },
        'moves': entries,
    }
    COVERAGE_REPORT.write_text(json.dumps(report, indent=2) + '\n')
    pending = [entry['slug'] for entry in entries if entry['classification'] == 'pending']
    if pending:
        pending_text = ', '.join(pending)
        raise RuntimeError(
            f'gen1_move_effect_coverage_pending: {len(pending)} move(s): {pending_text}'
        )


def evolutions(pokedex):
    result = []
    for species in pokedex:
        chain = species['evolution_chain']
        for index, entry in enumerate(chain):
            if 'condition' not in entry or index == 0 or index + 1 >= len(chain):
                continue
            source, destination, condition = chain[index - 1], chain[index + 1], entry['condition']
            if (
                'number' not in source
                or 'number' not in destination
                or source['number'] > 151
                or destination['number'] > 151
            ):
                continue
            level = re.search(r'Level (\d+)', condition)
            if level:
                result.append((source['number'], destination['number'], 'level', int(level.group(1)), None, condition))
            elif 'Trade' in condition:
                result.append((source['number'], destination['number'], 'trade', None, None, condition))
            else:
                stone = next((name for name in STONE_IDS if name.title() in condition), None)
                if stone:
                    result.append((source['number'], destination['number'], 'item', None, STONE_IDS[stone], condition))
    return sorted(set(result))


def replace_catalog(existing, generated):
    start = existing.index('insert into public.types')
    static_source = subprocess.check_output(
        ['git', 'show', 'HEAD:supabase/seed.sql'], cwd=ROOT, text=True
    )
    items_start = static_source.index('insert into public.items')
    species_start = static_source.index('insert into public.species')
    end = existing.index('insert into public.hunting_locations')
    items = static_source[items_start:species_start]
    catalog_species_start = generated.index('insert into public.species')
    catalog = generated[:catalog_species_start] + items + generated[catalog_species_start:]
    return existing[:start] + catalog + existing[end:]


def main():
    pokedex = json.loads(POKEDEX.read_text())
    moves = json.loads(MOVES.read_text())
    audit_gen1_move_coverage(pokedex, moves)
    move_ids = {move['slug']: index for index, move in enumerate(moves, 1)}
    type_rows = [(TYPE_IDS[name], name, name.title(), False) for name in TYPE_NAMES]
    effectiveness_rows = []
    for attacker in TYPE_NAMES:
        for defender in TYPE_NAMES:
            multiplier = 0 if defender in IMMUNITIES.get(attacker, []) else 2 if defender in SUPER_EFFECTIVE[attacker] else .5 if defender in RESISTANCES[attacker] else 1
            effectiveness_rows.append((TYPE_IDS[attacker], TYPE_IDS[defender], multiplier))
    species_rows, species_type_rows = [], []
    for species in pokedex:
        stats = species['base_stats']
        ev = species['training']['ev_yield']
        entries = species.get('pokedex_entries', [])
        description = entries[0]['text'] if entries else species['species']
        species_rows.append((species['number'], species['slug'], species['name'], measure(species['height'], 'm'), measure(species['weight'], 'kg'), description, gender_rate(species['breeding']['gender']), stats['hp']['base'], stats['attack']['base'], stats['defense']['base'], stats['sp_atk']['base'], stats['sp_def']['base'], stats['speed']['base'], ev.get('HP', 0), ev.get('Attack', 0), ev.get('Defense', 0), ev.get('Sp. Atk', 0), ev.get('Sp. Def', 0), ev.get('Speed', 0)))
        species_type_rows.extend((species['number'], TYPE_IDS[item.lower()], slot) for slot, item in enumerate(species['types'], 1))
    move_rows = []
    for move_id, move in enumerate(moves, 1):
        category = move['cat'].lower()
        if category not in {'physical', 'special', 'status'}:
            category = 'other'
        description = move['detail']['data'].get('target', '')
        normalized_target = target(description)
        delivery, target_value, shape, range_tiles, radius, length, width = geometry(normalized_target, category)
        accuracy = move['acc'] if isinstance(move['acc'], int) else None
        priority = int(move['detail']['data'].get('priority', '0'))
        cooldown = move_cooldown(move)
        metadata = move.get('combat_metadata') or {}
        move_rows.append((move_id, move['slug'], move['name'], TYPE_IDS[move['type'].lower()], category, move['power'], accuracy, move['pp'], priority, move['effect'], cooldown, delivery, target_value, shape, range_tiles, radius, length, width, metadata.get('drain_percentage', 0), metadata.get('healing_percentage', 0), metadata.get('flinch_chance', 0), description))
    output = '-- Generated by scripts/generate_local_catalog_seed.py from pokedex_151.json and moves_all.json.\n\n'
    output += section('types', 'id, slug, name, is_legacy', type_rows, 'on conflict (id) do update set slug = excluded.slug, name = excluded.name, is_legacy = excluded.is_legacy')
    output += section('type_effectiveness', 'attacker_type_id, defender_type_id, multiplier', effectiveness_rows, 'on conflict (attacker_type_id, defender_type_id) do update set multiplier = excluded.multiplier')
    output += section('species', 'id, slug, name, height_decimeters, weight_hectograms, description, gender_rate, base_hp, base_attack, base_defense, base_special_attack, base_special_defense, base_speed, ev_yield_hp, ev_yield_attack, ev_yield_defense, ev_yield_special_attack, ev_yield_special_defense, ev_yield_speed', species_rows, 'on conflict (id) do update set slug = excluded.slug, name = excluded.name, height_decimeters = excluded.height_decimeters, weight_hectograms = excluded.weight_hectograms, description = excluded.description, gender_rate = excluded.gender_rate, base_hp = excluded.base_hp, base_attack = excluded.base_attack, base_defense = excluded.base_defense, base_special_attack = excluded.base_special_attack, base_special_defense = excluded.base_special_defense, base_speed = excluded.base_speed, ev_yield_hp = excluded.ev_yield_hp, ev_yield_attack = excluded.ev_yield_attack, ev_yield_defense = excluded.ev_yield_defense, ev_yield_special_attack = excluded.ev_yield_special_attack, ev_yield_special_defense = excluded.ev_yield_special_defense, ev_yield_speed = excluded.ev_yield_speed')
    output += section('species_types', 'species_id, type_id, slot', species_type_rows, 'on conflict (species_id, type_id) do update set slot = excluded.slot')
    output += section('moves', 'id, slug, name, type_id, category, power, accuracy, base_pp, priority, effect_description, cooldown_ms, delivery, target, area_shape, range_tiles, area_radius, area_length, area_width, drain_percentage, healing_percentage, flinch_chance, source_target_description', move_rows, 'on conflict (id) do update set slug = excluded.slug, name = excluded.name, type_id = excluded.type_id, category = excluded.category, power = excluded.power, accuracy = excluded.accuracy, base_pp = excluded.base_pp, priority = excluded.priority, effect_description = excluded.effect_description, cooldown_ms = excluded.cooldown_ms, delivery = excluded.delivery, target = excluded.target, area_shape = excluded.area_shape, range_tiles = excluded.range_tiles, area_radius = excluded.area_radius, area_length = excluded.area_length, area_width = excluded.area_width, drain_percentage = excluded.drain_percentage, healing_percentage = excluded.healing_percentage, flinch_chance = excluded.flinch_chance, source_target_description = excluded.source_target_description')
    output += section('move_stat_effects', 'move_id, stat, stage, chance, target', stat_effects(moves), 'on conflict (move_id, stat, target) do update set stage = excluded.stage, chance = excluded.chance')
    output += section('move_status_effects', 'move_id, status, chance, target', status_effects(moves), 'on conflict (move_id, status, target) do update set chance = excluded.chance')
    output += 'delete from public.move_effects;\n\n'
    output += section('move_effects', 'move_id, sequence, kind, target, chance, magnitude, duration_min_ticks, duration_max_ticks, interval_ms, requirement, stat, status, parameters', move_effects(moves), 'on conflict (move_id, sequence) do update set kind = excluded.kind, target = excluded.target, chance = excluded.chance, magnitude = excluded.magnitude, duration_min_ticks = excluded.duration_min_ticks, duration_max_ticks = excluded.duration_max_ticks, interval_ms = excluded.interval_ms, requirement = excluded.requirement, stat = excluded.stat, status = excluded.status, parameters = excluded.parameters')
    output += section('species_move_learnsets', 'species_id, move_id, learn_method, required_level, machine_code', pokedex_learnsets(pokedex, move_ids), 'on conflict (species_id, move_id, learn_method) do update set required_level = excluded.required_level, machine_code = excluded.machine_code')
    output += section('evolutions', 'from_species_id, to_species_id, trigger, required_level, required_item_id, condition_description', evolutions(pokedex), 'on conflict (from_species_id, to_species_id, trigger) do update set required_level = excluded.required_level, required_item_id = excluded.required_item_id, condition_description = excluded.condition_description')
    SEED.write_text(replace_catalog(SEED.read_text(), output))


if __name__ == '__main__':
    main()
