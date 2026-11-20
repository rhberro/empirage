#!/usr/bin/env python3
"""Generate the immutable game seed from public Pokémon reference data."""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen
import csv
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
GENERATION_ONE_DATA = ROOT / 'gen1.json'
ROUTES_DATA = ROOT / 'routes.json'
API = 'https://pokeapi.co/api/v2/'
ITEMS_CSV = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/items.csv'
TYPE_NAMES = [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
    'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'bird',
]
PHYSICAL_TYPES = {'normal', 'fighting', 'poison', 'ground', 'flying', 'bug', 'rock', 'ghost'}
GENERATION_ONE_TYPE_OVERRIDES = {
    35: ['normal'], 36: ['normal'], 39: ['normal'], 40: ['normal'],
    81: ['electric'], 82: ['electric'], 122: ['psychic'],
}
GENERATION_ONE_MOVE_TYPE_OVERRIDES = {44: 'normal'}
GENERATION_ONE_EVOLUTION_STONES = {
    'fire-stone',
    'leaf-stone',
    'moon-stone',
    'thunder-stone',
    'water-stone',
}
TYPE_MULTIPLIERS = {
    'normal': {'rock': .5, 'ghost': 0},
    'fire': {'fire': .5, 'water': .5, 'grass': 2, 'ice': 2, 'bug': 2, 'rock': .5, 'dragon': .5},
    'water': {'fire': 2, 'water': .5, 'grass': .5, 'ground': 2, 'rock': 2, 'dragon': .5},
    'electric': {'water': 2, 'electric': .5, 'grass': .5, 'ground': 0, 'flying': 2, 'dragon': .5},
    'grass': {'fire': .5, 'water': 2, 'grass': .5, 'poison': .5, 'ground': 2, 'flying': .5, 'bug': .5, 'rock': 2, 'dragon': .5},
    'ice': {'water': .5, 'grass': 2, 'ice': .5, 'ground': 2, 'flying': 2, 'dragon': 2},
    'fighting': {'normal': 2, 'ice': 2, 'poison': .5, 'flying': .5, 'psychic': .5, 'bug': .5, 'rock': 2, 'ghost': 0},
    'poison': {'grass': 2, 'poison': .5, 'ground': .5, 'bug': 2, 'rock': .5, 'ghost': .5},
    'ground': {'fire': 2, 'electric': 2, 'grass': .5, 'poison': 2, 'flying': 0, 'bug': .5, 'rock': 2},
    'flying': {'electric': .5, 'grass': 2, 'fighting': 2, 'bug': 2, 'rock': .5},
    'psychic': {'fighting': 2, 'poison': 2, 'psychic': .5},
    'bug': {'fire': .5, 'grass': 2, 'fighting': .5, 'poison': 2, 'flying': .5, 'psychic': 2, 'ghost': .5},
    'rock': {'fire': 2, 'ice': 2, 'fighting': .5, 'ground': .5, 'flying': 2, 'bug': 2},
    'ghost': {'normal': 0, 'psychic': 0, 'ghost': 2},
    'dragon': {'dragon': 2},
}
AREA_MOVES = {'blizzard', 'earthquake', 'explosion', 'self-destruct', 'surf', 'swift', 'rock-slide', 'smokescreen', 'poison-gas', 'string-shot', 'growl', 'screech', 'tail-whip'}
SELF_MOVES = {'acid-armor', 'agility', 'amnesia', 'barrier', 'defense-curl', 'double-team', 'focus-energy', 'growth', 'harden', 'meditate', 'minimize', 'recover', 'rest', 'sharpen', 'soft-boiled', 'splash', 'substitute', 'swords-dance', 'transform', 'withdraw'}
NATURE_ROWS = [
    ('hardy', 'Hardy', None, None), ('lonely', 'Lonely', 'attack', 'defense'),
    ('brave', 'Brave', 'attack', 'speed'), ('adamant', 'Adamant', 'attack', 'special_attack'),
    ('naughty', 'Naughty', 'attack', 'special_defense'), ('bold', 'Bold', 'defense', 'attack'),
    ('docile', 'Docile', None, None), ('relaxed', 'Relaxed', 'defense', 'speed'),
    ('impish', 'Impish', 'defense', 'special_attack'), ('lax', 'Lax', 'defense', 'special_defense'),
    ('timid', 'Timid', 'speed', 'attack'), ('hasty', 'Hasty', 'speed', 'defense'),
    ('serious', 'Serious', None, None), ('jolly', 'Jolly', 'speed', 'special_attack'),
    ('naive', 'Naive', 'speed', 'special_defense'), ('modest', 'Modest', 'special_attack', 'attack'),
    ('mild', 'Mild', 'special_attack', 'defense'), ('quiet', 'Quiet', 'special_attack', 'speed'),
    ('bashful', 'Bashful', None, None), ('rash', 'Rash', 'special_attack', 'special_defense'),
    ('calm', 'Calm', 'special_defense', 'attack'), ('gentle', 'Gentle', 'special_defense', 'defense'),
    ('sassy', 'Sassy', 'special_defense', 'speed'), ('careful', 'Careful', 'special_defense', 'special_attack'),
    ('quirky', 'Quirky', None, None),
]
MOVE_STAT_EFFECT_ROWS = [
    (28, 'accuracy', -1, 100, 'target'), (39, 'defense', -1, 100, 'target'),
    (43, 'defense', -1, 100, 'target'), (45, 'attack', -1, 100, 'target'),
    (51, 'defense', -1, 33, 'target'), (61, 'speed', -1, 33, 'target'),
    (62, 'attack', -1, 10, 'target'), (81, 'speed', -1, 100, 'target'),
    (94, 'special_attack', -1, 33, 'target'), (94, 'special_defense', -1, 33, 'target'),
    (96, 'attack', 1, 100, 'user'), (97, 'speed', 2, 100, 'user'),
    (103, 'defense', -2, 100, 'target'), (104, 'evasion', 1, 100, 'user'),
    (106, 'defense', 1, 100, 'user'), (107, 'evasion', 1, 100, 'user'),
    (108, 'accuracy', -1, 100, 'target'), (110, 'defense', 1, 100, 'user'),
    (111, 'defense', 1, 100, 'user'), (112, 'defense', 2, 100, 'user'),
    (132, 'speed', -1, 10, 'target'), (133, 'special_attack', 2, 100, 'user'),
    (133, 'special_defense', 2, 100, 'user'), (134, 'accuracy', -1, 100, 'target'),
    (145, 'speed', -1, 33, 'target'), (159, 'attack', 1, 100, 'user'),
]


def get(path):
    request = Request(API + path, headers={'User-Agent': 'Empirage reference seed generator'})
    with urlopen(request, timeout=60) as response:
        return json.load(response)


def get_item_costs():
    request = Request(ITEMS_CSV, headers={'User-Agent': 'Empirage reference seed generator'})
    with urlopen(request, timeout=60) as response:
        rows = csv.DictReader(response.read().decode('utf-8').splitlines())
        return {row['identifier']: int(row['cost']) for row in rows}


def quote(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def text(value):
    return re.sub(r'\s+', ' ', value.replace('\f', ' ').replace('\n', ' ')).strip()


def normalized_name(value):
    gendered = value.replace('♀', 'f').replace('♂', 'm')
    decomposed = unicodedata.normalize('NFKD', gendered)
    return ''.join(character for character in decomposed.lower() if character.isalnum())


def slug(value):
    decomposed = unicodedata.normalize('NFKD', value)
    ascii_value = decomposed.encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', ascii_value)).strip('-')


def route_location_rows(routes, generation_one):
    species_ids = {}
    for species in generation_one:
        species_ids[normalized_name(species['name'])] = species['id']
        species_ids[normalized_name(species['names']['en'])] = species['id']
    routes_by_slug = set()
    location_rows = []
    location_species_rows = []
    for index, route in enumerate(routes, 1):
        if not isinstance(route, dict) or not isinstance(route.get('name'), str):
            raise ValueError('invalid_route')
        route_slug = slug(route['name'])
        if not route_slug or route_slug in routes_by_slug:
            raise ValueError(f'invalid_or_duplicate_route_slug:{route["name"]}')
        routes_by_slug.add(route_slug)
        creatures = route.get('creatures')
        if not isinstance(creatures, list):
            raise ValueError(f'invalid_route_creatures:{route["name"]}')
        encounters_by_species = {}
        for creature in creatures:
            if not isinstance(creature, dict) or not isinstance(creature.get('name'), str):
                raise ValueError(f'invalid_route_creature:{route["name"]}')
            chance = creature.get('spawnChance')
            if chance is None:
                continue
            level = creature.get('level')
            if (
                not isinstance(chance, dict)
                or not isinstance(chance.get('min'), int)
                or not isinstance(chance.get('max'), int)
                or chance['min'] < 1
                or chance['max'] < chance['min']
                or not isinstance(level, dict)
                or not isinstance(level.get('min'), int)
                or not isinstance(level.get('max'), int)
                or level['min'] < 1
                or level['max'] < level['min']
            ):
                raise ValueError(f'invalid_route_encounter:{route["name"]}:{creature["name"]}')
            species_id = species_ids.get(normalized_name(creature['name']))
            if species_id is None:
                raise ValueError(f'unknown_route_species:{route["name"]}:{creature["name"]}')
            weight = chance['max'] - chance['min'] + 1
            current = encounters_by_species.get(species_id)
            if current is None:
                encounters_by_species[species_id] = [level['min'], level['max'], weight]
            else:
                current[0] = min(current[0], level['min'])
                current[1] = max(current[1], level['max'])
                current[2] += weight
        if not encounters_by_species:
            raise ValueError(f'route_has_no_respawning_creatures:{route["name"]}')
        location_rows.append((index, route_slug, route['name'], f'Wild encounters inspired by {route["name"]}.', 3))
        for slot, (species_id, encounter) in enumerate(encounters_by_species.items(), 1):
            minimum_level, maximum_level, encounter_weight = encounter
            location_species_rows.append((index, species_id, slot, minimum_level, maximum_level, encounter_weight))
    return location_rows, location_species_rows


def values(rows):
    return ',\n'.join('  (' + ', '.join(quote(cell) for cell in row) + ')' for row in rows)


def generation_one_types(pokemon):
    override = GENERATION_ONE_TYPE_OVERRIDES.get(pokemon['id'])
    if override:
        return [{'type': {'name': name}} for name in override]
    for past in pokemon.get('past_types', []):
        if past['generation']['name'] == 'generation-i':
            return past['types']
    return pokemon['types']


def move_geometry(move):
    slug = move['name']
    category = move['damage_class']['name']
    if slug in SELF_MOVES:
        return ('melee', 'self', 'single', 0, 0, 0, 0)
    if slug in {'explosion', 'self-destruct'}:
        return ('melee', 'self', 'square', 0, 1, 0, 0)
    if slug in AREA_MOVES:
        return ('ranged', 'tile', 'square', 4, 1, 0, 0)
    if slug in {'hyper-beam', 'ice-beam', 'bubble-beam', 'psybeam', 'aurora-beam', 'solar-beam'}:
        return ('ranged', 'tile', 'line', 5, 0, 5, 1)
    if category == 'status':
        return ('ranged', 'unit', 'single', 4, 0, 0, 0)
    if move['type']['name'] in PHYSICAL_TYPES:
        return ('melee', 'unit', 'single', 1, 0, 0, 0)
    return ('ranged', 'unit', 'single', 4, 0, 0, 0)


def cooldown(move, geometry):
    power = move['power'] or 0
    delivery, target, shape, range_tiles, radius, length, width = geometry
    total = 1100 + min(power, 180) * 13 + max(range_tiles - 1, 0) * 90
    if delivery == 'ranged': total += 250
    if shape != 'single': total += 700 + radius * 250 + length * 75 + width * 75
    if move['damage_class']['name'] == 'status': total = max(total, 2500)
    if move['accuracy'] and move['accuracy'] < 80: total -= 150
    if move['name'] in {'hyper-beam', 'sky-attack', 'solar-beam', 'skull-bash', 'razor-wind'}: total += 1800
    if move['name'] in {'explosion', 'self-destruct'}: total += 2500
    return max(1000, min(10000, int(round(total / 100) * 100)))


def english_effect(resource):
    for entry in resource.get('effect_entries', []):
        if entry['language']['name'] == 'en':
            return text(entry['effect'])
    return 'No effect description is available.'


def english_flavor(resource):
    for entry in resource.get('flavor_text_entries', []):
        if entry['language']['name'] == 'en' and entry['version']['name'] in {'red', 'blue', 'yellow'}:
            return text(entry['flavor_text'])
    return ''


def item_category(category):
    if category in {'standard-balls', 'special-balls', 'apricorn-balls'}:
        return 'poke_ball'
    if category == 'evolution':
        return 'evolution_stone'
    return 'medicine'


def item_healing(item):
    effect = english_effect(item).lower()
    amount = None
    match = re.search(r'restores? (\d+) hp', effect)
    if match:
        amount = int(match.group(1))
    restores_full_health = 'full hp' in effect or 'restores hp to full' in effect
    return amount, restores_full_health, 'pp' in effect, 'revive' in effect


def main():
    with GENERATION_ONE_DATA.open() as source:
        generation_one = json.load(source)
    with ROUTES_DATA.open() as source:
        routes = json.load(source)
    if not isinstance(routes, list):
        raise ValueError('invalid_routes_data')
    ev_yields = {entry['id']: entry['ev_yield'] for entry in generation_one}
    item_costs = get_item_costs()
    with ThreadPoolExecutor(max_workers=12) as pool:
        moves = list(pool.map(lambda value: get(f'move/{value}'), range(1, 166)))
        species_resources = list(pool.map(lambda value: get(f'pokemon-species/{value}'), range(1, 152)))
        pokemon_resources = list(pool.map(lambda value: get(f'pokemon/{value}'), range(1, 152)))
        category_lists = list(pool.map(get, [
            'item-category/healing',
            'item-category/medicine',
            'item-category/standard-balls',
            'item-category/special-balls',
            'item-category/apricorn-balls',
            'item-category/evolution',
        ]))
    item_names = set()
    for category in category_lists:
        for entry in category['items']:
            name = entry['name']
            if category['name'] != 'evolution' or name.endswith('-stone'):
                item_names.add(name)
    item_names = sorted(item_names)
    with ThreadPoolExecutor(max_workers=12) as pool:
        item_resources = list(pool.map(lambda name: get(f'item/{name}'), item_names))
    pokemon_by_id = {resource['id']: resource for resource in pokemon_resources}
    species_rows = []
    species_type_rows = []
    learnset_rows = []
    for species in species_resources:
        identifier = species['id']
        pokemon = pokemon_by_id[identifier]
        stats = {entry['stat']['name']: entry['base_stat'] for entry in pokemon['stats']}
        ev_yield = ev_yields[identifier]
        species_rows.append((identifier, species['name'], species['name'].replace('-', ' ').title(), pokemon['height'], pokemon['weight'], english_flavor(species) or species['name'].replace('-', ' ').title(), species['gender_rate'], stats['hp'], stats['attack'], stats['defense'], stats['special-attack'], stats['special-defense'], stats['speed'], ev_yield['hp'], ev_yield['attack'], ev_yield['defense'], ev_yield['special-attack'], ev_yield['special-defense'], ev_yield['speed']))
        for slot, entry in enumerate(generation_one_types(pokemon), 1):
            species_type_rows.append((identifier, TYPE_NAMES.index(entry['type']['name']) + 1, slot))
        for entry in pokemon['moves']:
            for detail in entry['version_group_details']:
                if detail['version_group']['name'] != 'red-blue':
                    continue
                method = detail['move_learn_method']['name']
                if method == 'level-up':
                    learnset_rows.append((identifier, int(entry['move']['url'].rstrip('/').split('/')[-1]), 'level', detail['level_learned_at'], None))
                elif method == 'machine':
                    learnset_rows.append((identifier, int(entry['move']['url'].rstrip('/').split('/')[-1]), 'machine', None, entry['move']['name'].upper()))
    learnsets_by_key = {}
    for row in learnset_rows:
        key = (row[0], row[1], row[2])
        existing = learnsets_by_key.get(key)
        if existing is None or (row[3] is not None and row[3] < existing[3]):
            learnsets_by_key[key] = row
    learnset_rows = sorted(learnsets_by_key.values(), key=lambda row: (row[0], row[1], row[2]))
    move_rows = []
    for move in moves:
        geometry = move_geometry(move)
        type_slug = GENERATION_ONE_MOVE_TYPE_OVERRIDES.get(move['id'], move['type']['name'])
        category = 'status' if move['damage_class']['name'] == 'status' else ('physical' if type_slug in PHYSICAL_TYPES else 'special')
        move_rows.append((move['id'], move['name'], move['name'].replace('-', ' ').title(), TYPE_NAMES.index(type_slug) + 1, category, move['power'], move['accuracy'], move['pp'], move['priority'], english_effect(move), cooldown(move, geometry), *geometry))
    item_rows = []
    item_by_slug = {}
    for item in item_resources:
        category = item_category(item['category']['name'])
        healing, full, pp, revive = item_healing(item)
        multiplier = None
        if category == 'poke_ball':
            multiplier = 255 if item['name'] == 'master-ball' else 1
        cost = item_costs.get(item['name'], 0)
        item_rows.append((item['id'], item['name'], item['name'].replace('-', ' ').title(), category, cost, cost // 2, english_effect(item), healing, full, pp, revive, multiplier))
        item_by_slug[item['name']] = item['id']
    chains = {resource['evolution_chain']['url'] for resource in species_resources}
    def get_url(url):
        request = Request(url, headers={'User-Agent': 'Empirage reference seed generator'})
        with urlopen(request, timeout=60) as response:
            return json.load(response)
    with ThreadPoolExecutor(max_workers=12) as pool:
        chain_resources = list(pool.map(get_url, chains))
    evolution_rows = []
    def visit(node):
        source_id = int(node['species']['url'].rstrip('/').split('/')[-1])
        for child in node['evolves_to']:
            target_id = int(child['species']['url'].rstrip('/').split('/')[-1])
            if source_id <= 151 and target_id <= 151:
                for detail in child['evolution_details']:
                    if detail['version_group']['name'] not in {'red-blue', 'yellow'}:
                        continue
                    trigger = detail['trigger']['name']
                    if trigger == 'level-up' and not detail['time_of_day'] and detail['location'] is None:
                        evolution_rows.append((source_id, target_id, 'level', detail['min_level'], None))
                    elif (
                        trigger == 'use-item'
                        and detail['item']
                        and detail['item']['name'] in GENERATION_ONE_EVOLUTION_STONES
                    ):
                        evolution_rows.append((source_id, target_id, 'item', None, item_by_slug[detail['item']['name']]))
                    elif trigger == 'trade':
                        evolution_rows.append((source_id, target_id, 'trade', None, None))
            visit(child)
    for chain in chain_resources:
        visit(chain['chain'])
    evolution_rows = sorted(set(evolution_rows), key=lambda row: (row[0], row[1], row[2]))
    type_rows = [(index + 1, slug, slug.title(), slug == 'bird') for index, slug in enumerate(TYPE_NAMES)]
    effectiveness_rows = []
    for attacker_index, attacker in enumerate(TYPE_NAMES, 1):
        for defender_index, defender in enumerate(TYPE_NAMES, 1):
            effectiveness_rows.append((attacker_index, defender_index, TYPE_MULTIPLIERS.get(attacker, {}).get(defender, 1)))
    location_rows, location_species_rows = route_location_rows(routes, generation_one)
    location_wave_range_rows = []
    for location_id, *_ in location_rows:
        location_wave_range_rows.extend([(location_id, 1, 2), (location_id, 2, 4)])
    queries = [
        '-- Generated by scripts/generate_game_seed.py. Sources: Pokémon Database validation and PokéAPI canonical records.\n',
        'insert into public.types (id, slug, name, is_legacy) values\n' + values(type_rows) + '\non conflict (id) do update set slug = excluded.slug, name = excluded.name, is_legacy = excluded.is_legacy;\n',
        'insert into public.type_effectiveness (attacker_type_id, defender_type_id, multiplier) values\n' + values(effectiveness_rows) + '\non conflict (attacker_type_id, defender_type_id) do update set multiplier = excluded.multiplier;\n',
        'insert into public.items (id, slug, name, category, buy_price, sell_price, effect_description, healing_amount, restores_full_health, restores_pp, revives, capture_rate_multiplier) values\n' + values(item_rows) + '\non conflict (id) do update set slug = excluded.slug, name = excluded.name, category = excluded.category, buy_price = excluded.buy_price, sell_price = excluded.sell_price, effect_description = excluded.effect_description, healing_amount = excluded.healing_amount, restores_full_health = excluded.restores_full_health, restores_pp = excluded.restores_pp, revives = excluded.revives, capture_rate_multiplier = excluded.capture_rate_multiplier;\n',
        'insert into public.natures (slug, name, increased_stat, decreased_stat) values\n' + values(NATURE_ROWS) + '\non conflict (slug) do update set name = excluded.name, increased_stat = excluded.increased_stat, decreased_stat = excluded.decreased_stat;\n',
        'insert into public.species (id, slug, name, height_decimeters, weight_hectograms, description, gender_rate, base_hp, base_attack, base_defense, base_special_attack, base_special_defense, base_speed, ev_yield_hp, ev_yield_attack, ev_yield_defense, ev_yield_special_attack, ev_yield_special_defense, ev_yield_speed) values\n' + values(species_rows) + '\non conflict (id) do update set slug = excluded.slug, name = excluded.name, height_decimeters = excluded.height_decimeters, weight_hectograms = excluded.weight_hectograms, description = excluded.description, gender_rate = excluded.gender_rate, base_hp = excluded.base_hp, base_attack = excluded.base_attack, base_defense = excluded.base_defense, base_special_attack = excluded.base_special_attack, base_special_defense = excluded.base_special_defense, base_speed = excluded.base_speed, ev_yield_hp = excluded.ev_yield_hp, ev_yield_attack = excluded.ev_yield_attack, ev_yield_defense = excluded.ev_yield_defense, ev_yield_special_attack = excluded.ev_yield_special_attack, ev_yield_special_defense = excluded.ev_yield_special_defense, ev_yield_speed = excluded.ev_yield_speed;\n',
        'insert into public.species_types (species_id, type_id, slot) values\n' + values(species_type_rows) + '\non conflict (species_id, type_id) do update set slot = excluded.slot;\n',
        'insert into public.moves (id, slug, name, type_id, category, power, accuracy, base_pp, priority, effect_description, cooldown_ms, delivery, target, area_shape, range_tiles, area_radius, area_length, area_width) values\n' + values(move_rows) + '\non conflict (id) do update set slug = excluded.slug, name = excluded.name, type_id = excluded.type_id, category = excluded.category, power = excluded.power, accuracy = excluded.accuracy, base_pp = excluded.base_pp, priority = excluded.priority, effect_description = excluded.effect_description, cooldown_ms = excluded.cooldown_ms, delivery = excluded.delivery, target = excluded.target, area_shape = excluded.area_shape, range_tiles = excluded.range_tiles, area_radius = excluded.area_radius, area_length = excluded.area_length, area_width = excluded.area_width;\n',
        'insert into public.move_stat_effects (move_id, stat, stage, chance, target) values\n' + values(MOVE_STAT_EFFECT_ROWS) + '\non conflict (move_id, stat, target) do update set stage = excluded.stage, chance = excluded.chance;\n',
        'insert into public.species_move_learnsets (species_id, move_id, learn_method, required_level, machine_code) values\n' + values(learnset_rows) + '\non conflict (species_id, move_id, learn_method) do update set required_level = excluded.required_level, machine_code = excluded.machine_code;\n',
        'insert into public.evolutions (from_species_id, to_species_id, trigger, required_level, required_item_id) values\n' + values(evolution_rows) + '\non conflict (from_species_id, to_species_id, trigger) do update set required_level = excluded.required_level, required_item_id = excluded.required_item_id;\n',
        'insert into public.hunting_locations (id, slug, name, description, wave_delay_seconds) values\n' + values(location_rows) + '\non conflict (id) do update set slug = excluded.slug, name = excluded.name, description = excluded.description, wave_delay_seconds = excluded.wave_delay_seconds;\n',
        'insert into public.hunting_location_species (hunting_location_id, species_id, slot, minimum_level, maximum_level, encounter_weight) values\n' + values(location_species_rows) + '\non conflict (hunting_location_id, species_id) do update set slot = excluded.slot, minimum_level = excluded.minimum_level, maximum_level = excluded.maximum_level, encounter_weight = excluded.encounter_weight;\n',
        'insert into public.hunting_location_wave_ranges (hunting_location_id, minimum_size, maximum_size) values\n' + values(location_wave_range_rows) + '\non conflict (hunting_location_id, minimum_size, maximum_size) do nothing;\n',
    ]
    (ROOT / 'supabase' / 'seed.sql').write_text('\n'.join(queries))


if __name__ == '__main__':
    main()
