const BEARER_PREFIX = 'Bearer ';

/**
 * The token of the account, read from the header of the request.
 *
 * The header is the only place where the token travels: a token in the query
 * string is written down by every proxy in front of the server. The reading
 * lives in its own module because two routes need it: the middleware that
 * validates the token of every request, and the route that issues the ticket
 * of the channel, which has to carry the token to the upgrade.
 */
export function readBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (header === null || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token === '' ? null : token;
}
