import type { GoogleMergeResult } from '~/shared/api';
import type { AuthUser } from '~/shared/auth';

import { createGoogleMergeRequest, mergeGoogleAccount } from './googleMerge';

const TRAINERS_PATH = '/trainers';

export type PostAuthDeps = {
  decideDestination(): Promise<string>;
  requestGoogleMerge(email: string): Promise<GoogleMergeResult>;
};

export type PostAuthResolution = {
  destination: string;
  merge: GoogleMergeResult;
};

/**
 * Where the player goes after an authentication.
 *
 * The list of the trainers is read by the screen of the list, in a query that
 * the whole client shares. Deciding here would ask the server for the list a
 * second time, and the answer would arrive twice.
 *
 * The screen of the list sends the player to the screen that creates a
 * trainer when the account has none.
 */
export function decideDestinationAfterAuth(): Promise<string> {
  return Promise.resolve(TRAINERS_PATH);
}

/**
 * The dependencies of the post-authentication resolution.
 */
export function createPostAuthDeps(): PostAuthDeps {
  return {
    decideDestination: decideDestinationAfterAuth,
    requestGoogleMerge: createGoogleMergeRequest(),
  };
}

/**
 * Where the player goes after an authentication that came from outside.
 *
 * The merge comes first, on purpose: it moves the trainers of the password
 * account to the Google account, and the destination reads the list of
 * trainers. Deciding before the merge would send a player that had trainers
 * to the screen that creates one.
 *
 * A merge that fails does not keep the player out of the game: the session is
 * already valid, so the resolution goes on and only carries the reason of the
 * failure.
 */
export function resolvePostAuth(
  user: AuthUser | null,
  deps: PostAuthDeps,
): Promise<PostAuthResolution> {
  return mergeGoogleAccount(user, deps.requestGoogleMerge).then(function decide(
    merge: GoogleMergeResult,
  ): Promise<PostAuthResolution> {
    return deps.decideDestination().then(function resolve(destination: string): PostAuthResolution {
      return { destination, merge };
    });
  });
}
