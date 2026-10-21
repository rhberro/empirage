import { expect, test } from 'bun:test';

import type { HuntAction, HuntSession } from '@creatures/contracts/huntSession';

import { advance } from '~/hunt/clock';
import type { HuntEvent } from '~/hunt/events';
import type { HuntAdvanceRules } from '~/hunt/rules';

const START = Date.parse('2026-10-21T12:00:00.000Z');
const MINUTE = 60_000;

function buildSession(overrides: Partial<HuntSession>): HuntSession {
  return {
    accountId: 'account-1',
    actions: [],
    encounters: 0,
    endReason: null,
    endedAt: null,
    huntAreaId: 'area-1',
    id: 'session-1',
    kills: 0,
    lastSimulatedAt: START,
    rngDraws: 0,
    rngSeed: 42,
    staminaAtStart: 720,
    staminaSpentMinutes: 0,
    startedAt: START,
    status: 'active',
    trainerId: 'trainer-1',
    ...overrides,
  };
}

function alwaysKeepFighting(): boolean {
  return true;
}

function noViableCreature(): boolean {
  return false;
}

function buildRules(overrides: Partial<HuntAdvanceRules>): HuntAdvanceRules {
  return {
    accountType: 'free',
    canKeepFighting: alwaysKeepFighting,
    trainerSwitchedAt: null,
    ...overrides,
  };
}

function readEventsOfType(events: HuntEvent[], type: HuntEvent['type']): HuntEvent[] {
  return events.filter(function isOfType(event: HuntEvent): boolean {
    return event.type === type;
  });
}

function readActionEvents(events: HuntEvent[]): HuntEvent[] {
  return readEventsOfType(events, 'action_applied');
}

function readMinutes(event: HuntEvent | undefined): number {
  if (event === undefined || event.type !== 'stamina_spent') {
    return -1;
  }
  return event.minutes;
}

function theSameInputGivesTheSameOutput(): void {
  const session = buildSession({});
  const untilTs = START + 30 * MINUTE;
  const first = advance(session, untilTs, buildRules({}));
  const second = advance(session, untilTs, buildRules({}));
  expect(first.session).toEqual(second.session);
  expect(first.events).toEqual(second.events);
}

function theCatchUpConsumesTheStaminaOfTheWindow(): void {
  const session = buildSession({});
  const untilTs = START + 60 * MINUTE;
  const result = advance(session, untilTs, buildRules({}));
  expect(result.session.lastSimulatedAt).toBe(untilTs);
  expect(result.session.staminaSpentMinutes).toBe(60);
  expect(result.session.status).toBe('active');
  expect(result.session.endReason).toBeNull();
}

function theCatchUpReportsTheConsumption(): void {
  const result = advance(buildSession({}), START + 60 * MINUTE, buildRules({}));
  const spent = readEventsOfType(result.events, 'stamina_spent');
  expect(spent.length).toBe(1);
  expect(spent[0]?.at).toBe(START + 60 * MINUTE);
  expect(readMinutes(spent[0])).toBe(60);
}

function theHuntEndsWhenTheStaminaIsGone(): void {
  const untilTs = START + 60 * MINUTE;
  const session = buildSession({ staminaAtStart: 30 });
  const result = advance(session, untilTs, buildRules({}));
  expect(result.session.status).toBe('finished');
  expect(result.session.endReason).toBe('stamina_depleted');
  expect(result.session.endedAt).toBe(START + 30 * MINUTE);
  expect(result.session.lastSimulatedAt).toBe(START + 30 * MINUTE);
  expect(result.session.staminaSpentMinutes).toBe(30);
}

function theStaminaOfTheSessionDecidesTheEnd(): void {
  const untilTs = START + 60 * MINUTE;
  const session = buildSession({ staminaAtStart: 45 });
  const result = advance(session, untilTs, buildRules({}));
  expect(result.session.endReason).toBe('stamina_depleted');
  expect(result.session.endedAt).toBe(START + 45 * MINUTE);
}

function theHuntEndsWhenTheOfflineSessionIsGone(): void {
  const untilTs = START + 300 * MINUTE;
  const result = advance(buildSession({}), untilTs, buildRules({ accountType: 'free' }));
  expect(result.session.status).toBe('finished');
  expect(result.session.endReason).toBe('offline_session_expired');
  expect(result.session.endedAt).toBe(START + 240 * MINUTE);
  expect(result.session.staminaSpentMinutes).toBe(240);
}

function thePaidAccountHuntsForLonger(): void {
  const untilTs = START + 600 * MINUTE;
  const result = advance(buildSession({}), untilTs, buildRules({ accountType: 'paid' }));
  expect(result.session.endReason).toBe('offline_session_expired');
  expect(result.session.endedAt).toBe(START + 480 * MINUTE);
}

function thePlayerFinalizesTheHunt(): void {
  const actions: HuntAction[] = [{ at: START + 10 * MINUTE, type: 'finalize_hunt' }];
  const session = buildSession({ actions });
  const untilTs = START + 60 * MINUTE;
  const result = advance(session, untilTs, buildRules({}));
  expect(result.session.status).toBe('finished');
  expect(result.session.endReason).toBe('player_finalized');
  expect(result.session.endedAt).toBe(START + 10 * MINUTE);
  expect(result.session.lastSimulatedAt).toBe(START + 10 * MINUTE);
  expect(result.session.staminaSpentMinutes).toBe(10);
}

function theTrainerSwitchEndsTheHunt(): void {
  const untilTs = START + 60 * MINUTE;
  const result = advance(
    buildSession({}),
    untilTs,
    buildRules({ trainerSwitchedAt: START + 15 * MINUTE }),
  );
  expect(result.session.status).toBe('finished');
  expect(result.session.endReason).toBe('trainer_switched');
  expect(result.session.endedAt).toBe(START + 15 * MINUTE);
}

function theTeamWithoutAViableCreatureEndsTheHunt(): void {
  const untilTs = START + 60 * MINUTE;
  const result = advance(
    buildSession({}),
    untilTs,
    buildRules({ canKeepFighting: noViableCreature }),
  );
  expect(result.session.status).toBe('finished');
  expect(result.session.endReason).toBe('no_viable_creature');
  expect(result.session.endedAt).toBe(START);
}

function theActionsAreReplayedInOrder(): void {
  const actions: HuntAction[] = [
    { at: START + 20 * MINUTE, creatureId: 'creature-2', type: 'swap_creature' },
    { at: START + 10 * MINUTE, creatureId: 'creature-1', type: 'swap_creature' },
  ];
  const session = buildSession({ actions });
  const result = advance(session, START + 60 * MINUTE, buildRules({}));
  const applied = readActionEvents(result.events);
  expect(applied.length).toBe(2);
  expect(applied[0]?.at).toBe(START + 10 * MINUTE);
  expect(applied[1]?.at).toBe(START + 20 * MINUTE);
}

function theActionOfThePlayerAffectsTheStateFromItsMoment(): void {
  const actions: HuntAction[] = [{ at: START + 10 * MINUTE, type: 'finalize_hunt' }];
  const session = buildSession({ actions });
  const result = advance(session, START + 60 * MINUTE, buildRules({}));
  expect(result.session.endedAt).toBe(START + 10 * MINUTE);
  expect(result.session.staminaSpentMinutes).toBe(10);
}

function theViableCreatureIsCheckedAtTheMomentOfTheAction(): void {
  const moments: number[] = [];
  function recordMoment(at: number): boolean {
    moments.push(at);
    return true;
  }
  const actions: HuntAction[] = [
    { at: START + 20 * MINUTE, creatureId: 'creature-1', type: 'swap_creature' },
  ];
  const session = buildSession({ actions });
  advance(session, START + 60 * MINUTE, buildRules({ canKeepFighting: recordMoment }));
  expect(moments).toEqual([START, START + 20 * MINUTE]);
}

function theEndedHuntIsNotAdvancedAgain(): void {
  const session = buildSession({
    endReason: 'player_finalized',
    endedAt: START + 10 * MINUTE,
    lastSimulatedAt: START + 10 * MINUTE,
    status: 'finished',
  });
  const result = advance(session, START + 60 * MINUTE, buildRules({}));
  expect(result.events).toEqual([]);
  expect(result.session).toEqual(session);
}

function theWindowWithoutTimeDoesNotMoveTheSession(): void {
  const session = buildSession({ lastSimulatedAt: START + 30 * MINUTE });
  const result = advance(session, START + 30 * MINUTE, buildRules({}));
  expect(result.events).toEqual([]);
  expect(result.session).toEqual(session);
}

test('the same input gives the same output', theSameInputGivesTheSameOutput);
test('the catch-up consumes the stamina of the window', theCatchUpConsumesTheStaminaOfTheWindow);
test('the catch-up reports the consumption', theCatchUpReportsTheConsumption);
test('the hunt ends when the stamina is gone', theHuntEndsWhenTheStaminaIsGone);
test('the stamina of the session decides the end', theStaminaOfTheSessionDecidesTheEnd);
test('the hunt ends when the offline session is gone', theHuntEndsWhenTheOfflineSessionIsGone);
test('the paid account hunts for longer', thePaidAccountHuntsForLonger);
test('the player finalizes the hunt', thePlayerFinalizesTheHunt);
test('the trainer switch ends the hunt', theTrainerSwitchEndsTheHunt);
test('the team without a viable creature ends the hunt', theTeamWithoutAViableCreatureEndsTheHunt);
test('the actions are replayed in order', theActionsAreReplayedInOrder);
test(
  'the action of the player affects the state from its moment',
  theActionOfThePlayerAffectsTheStateFromItsMoment,
);
test(
  'the viable creature is checked at the moment of the action',
  theViableCreatureIsCheckedAtTheMomentOfTheAction,
);
test('the ended hunt is not advanced again', theEndedHuntIsNotAdvancedAgain);
test(
  'the window without time does not move the session',
  theWindowWithoutTimeDoesNotMoveTheSession,
);
