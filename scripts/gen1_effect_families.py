"""Structured Gen 1 move families that cannot be inferred safely from text alone."""

from collections.abc import Iterable


def effects_for_moves(slugs: Iterable[str], kind: str, **parameters: object) -> dict[str, list[dict[str, object]]]:
    return {slug: [{"kind": kind, **parameters}] for slug in slugs}


GEN1_CLASSIC_EFFECTS: dict[str, list[dict[str, object]]] = {}

GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(
        (
            "barrage",
            "comet-punch",
            "double-slap",
            "fury-attack",
            "fury-swipes",
            "pin-missile",
            "spike-cannon",
        ),
        "multi_hit",
        minimum_hits=2,
        maximum_hits=5,
    )
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(
        ("bonemerang", "double-kick", "twineedle"),
        "multi_hit",
        minimum_hits=2,
        maximum_hits=2,
    )
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("dragon-rage",), "fixed_damage", amount=40)
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("sonic-boom",), "fixed_damage", amount=20)
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("night-shade", "seismic-toss"), "level_damage")
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("super-fang",), "target_health_fraction", numerator=1, denominator=2)
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("guillotine", "horn-drill"), "one_hit_ko")
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("crabhammer", "karate-chop", "razor-leaf", "slash"), "critical_ratio", multiplier=8)
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("focus-energy",), "critical_ratio", multiplier=4, target="user")
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("dig", "skull-bash", "sky-attack", "solar-beam"), "charge", turns=1)
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("hyper-beam",), "recharge", turns=1)
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("petal-dance", "thrash"), "forced_repeat", minimum_turns=2, maximum_turns=3, after="confusion")
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("reflect",), "damage_screen", category="physical", duration_ticks=5)
)
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(("light-screen",), "damage_screen", category="special", duration_ticks=5)
)
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("haze",), "reset_stat_stages", target="all"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("mist",), "prevent_stat_stage_change", turns=5, target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("rest",), "full_heal_and_sleep", turns=2, target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("self-destruct", "explosion"), "self_faint", target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("jump-kick", "high-jump-kick"), "miss_recoil", percentage=50, target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("swift",), "always_hit"))
GEN1_CLASSIC_EFFECTS["dream-eater"] = [
    {"kind": "health_delta", "percentage": 50, "requirement": "damage_dealt"},
    {"kind": "target_requirement", "requirement": "target_asleep"},
]
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("poison-sting",), "status", status="poison", chance=30))
GEN1_CLASSIC_EFFECTS.update(
    effects_for_moves(
        ("tri-attack",),
        "random_status",
        statuses=("paralysis", "burn", "freeze"),
        chance=20,
    )
)
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("roar", "whirlwind"), "wild_battle_flee"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("teleport",), "wild_battle_flee", target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("splash",), "no_op"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("disable",), "disable_last_move", duration_ticks=4))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("counter",), "counter_physical", multiplier=2))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("rage",), "retaliation_stat_stage", stat="attack", stage=1))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("substitute",), "substitute", health_fraction=4, target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("conversion",), "copy_first_move_type", target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("transform",), "copy_target_combat_profile", target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("metronome",), "random_known_move", target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("mirror-move",), "repeat_target_last_move", target="user"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("pay-day",), "battle_reward", amount=5))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("low-kick",), "weight_scaled_damage"))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("earthquake",), "underground_damage_multiplier", multiplier=2))
GEN1_CLASSIC_EFFECTS.update(effects_for_moves(("gust",), "airborne_damage_multiplier", multiplier=2))
