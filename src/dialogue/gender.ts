/**
 * Text tokens that follow the player's name and gender (Santiago / Sofi).
 *   {name}  {restaurant}  and  {masculino|femenino}  (e.g. "{Bienvenido|Bienvenida}").
 * Pure on purpose, so it can be unit tested without a save.
 */
export type Gender = 'm' | 'f';

export function fillText(t: string, name: string, restaurant: string, gender: Gender): string {
  return t
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m: string, f: string) => (gender === 'm' ? m : f))
    .replace(/\{name\}/g, name)
    .replace(/\{restaurant\}/g, restaurant);
}
