import { settings } from '../core/settings';
import { mirror } from '../restaurant/mirror';

/** The host's physical kitchen is on unless the player chose another way of cooking or is a guest in somebody else's. */
export function galleyOn(): boolean {
  return !mirror.on && (settings.cookStyle ?? 'galley') === 'galley';
}
