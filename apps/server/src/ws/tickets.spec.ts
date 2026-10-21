import { expect, test } from 'bun:test';

import { createTicketStore } from '~/ws/tickets';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const TOKEN = 'token-of-the-account';
const OTHER_TOKEN = 'token-of-another-account';

function issuesATicketForTheAccount(): void {
  const store = createTicketStore();
  const issued = store.issue(USER_ID, TOKEN);
  expect(issued.ticket).not.toBe('');
  expect(issued.expiresAt).toBeGreaterThan(0);
}

/**
 * The ticket is of single use: the same value never opens two channels.
 */
function consumesTheTicketOnlyOnce(): void {
  const store = createTicketStore();
  const issued = store.issue(USER_ID, TOKEN);
  expect(store.consume(issued.ticket)?.userId).toBe(USER_ID);
  expect(store.consume(issued.ticket)).toBeNull();
}

function refusesAnUnknownTicket(): void {
  const store = createTicketStore();
  expect(store.consume('ticket-that-was-never-issued')).toBeNull();
}

/**
 * A ticket that expired opens nothing, and the value is gone even so.
 */
function refusesAnExpiredTicket(): void {
  let now = 1_000;
  const store = createTicketStore({
    now: function readNow(): number {
      return now;
    },
  });
  const issued = store.issue(USER_ID, TOKEN);
  now = issued.expiresAt + 1;
  expect(store.consume(issued.ticket)).toBeNull();
}

function issuesDifferentTickets(): void {
  const store = createTicketStore();
  const first = store.issue(USER_ID, TOKEN);
  const second = store.issue(USER_ID, TOKEN);
  expect(first.ticket).not.toBe(second.ticket);
}

/**
 * The ticket carries the identity of the account and the token that proves
 * that the session behind it is still signed in.
 */
function carriesTheIdentityOfTheAccount(): void {
  const store = createTicketStore();
  const issued = store.issue(OTHER_USER_ID, OTHER_TOKEN);
  const identity = store.consume(issued.ticket);
  expect(identity?.userId).toBe(OTHER_USER_ID);
  expect(identity?.token).toBe(OTHER_TOKEN);
}

test('the store issues a ticket for the account', issuesATicketForTheAccount);
test('the ticket is of single use', consumesTheTicketOnlyOnce);
test('the store refuses an unknown ticket', refusesAnUnknownTicket);
test('the store refuses an expired ticket', refusesAnExpiredTicket);
test('every ticket is different', issuesDifferentTickets);
test('the ticket carries the identity of the account', carriesTheIdentityOfTheAccount);
