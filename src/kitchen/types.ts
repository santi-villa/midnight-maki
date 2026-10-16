/** What the kitchen session and the stove need from a dish that is being cooked, whichever way it is played. */
export interface DishBoard {
  readonly recipe: import('../data/recipes').RecipeDef;
  /** pieces of this dish waiting to go on the stove (or into the rice pot) */
  readonly rawPieces: { item: string; how: 'plancha' | 'sarten' | 'olla' }[];
  takeRaw(i: number): { item: string; how: 'plancha' | 'sarten' | 'olla' } | null;
  /** a piece came off the stove at cooking point `p` */
  putCooked(item: string, p: number): void;
  readonly waitingFor: string | null;
  readonly customer: string;
  readonly finished: boolean;
  /** 0..1 of the steps already done, for the dish chip */
  readonly progress: number;
  readonly stepName: string;
  setActive(on: boolean): void;
  discard(): void;
  start(): void;
}
