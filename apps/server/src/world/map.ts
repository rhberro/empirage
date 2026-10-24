/**
 * The map loader has a single owner, and it is not the server: both apps
 * import the common loader from the contracts package, so a map change is
 * one diff and one moment of validation. Kept as a re-export because the
 * wiring below already names this module.
 */
export { CITY_MAP } from '@creatures/contracts/city';
