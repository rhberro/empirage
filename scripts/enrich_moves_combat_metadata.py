#!/usr/bin/env python3
"""Snapshot PokéAPI move combat metadata into the local move catalog."""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import json

ROOT = Path(__file__).resolve().parents[1]
MOVES = ROOT / 'moves_all.json'
API = 'https://pokeapi.co/api/v2/move/'


def load_metadata(move):
    request = Request(API + move['slug'], headers={'User-Agent': 'Empirage catalog generator'})
    try:
        with urlopen(request, timeout=60) as response:
            payload = json.load(response)
    except HTTPError as error:
        if error.code == 404:
            return move['slug'], None
        raise
    meta = payload['meta'] or {}
    return move['slug'], {
        'drain_percentage': meta.get('drain') or 0,
        'flinch_chance': meta.get('flinch_chance') or 0,
        'healing_percentage': meta.get('healing') or 0,
    }


def main():
    moves = json.loads(MOVES.read_text())
    with ThreadPoolExecutor(max_workers=12) as executor:
        metadata = dict(executor.map(load_metadata, moves))
    for move in moves:
        move['combat_metadata'] = metadata[move['slug']]
    MOVES.write_text(json.dumps(moves, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
