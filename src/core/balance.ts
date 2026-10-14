/** Balance parameters kept apart from logic so they can be tuned without touching systems. */
export const BALANCE = {
  startCoins: 120,
  periodMinutes: 90,             // in-game minutes per period
  realSecondsPerGameMinute: 1, // one minute on the clock per real second, day and night. Menus pause the clock.
  periodNames: ['Mañana', 'Tarde', 'Atardecer', 'Noche'],
  daysPerSeason: 14,
  maxOrders: 3,
  restaurantXpPerLevel: (lvl: number) => 60 + (lvl - 1) * 50,
  maxRestaurantLevel: 10,
  reputationPerServe: 2,
  friendshipPerLevel: 100,
  maxFriendship: 500,
  talkPoints: 8,
  giftLoved: 40,
  giftLiked: 20,
  giftNeutral: 8,
  qualityBonus: [0, 0.1, 0.25], // ok, good, perfect
  freeCookMultiplier: [0.8, 0.9, 1], // walk-ins: no service tips, charm or mastery premium
  sellMultiplier: 1,
};

export const SEASONS = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function seasonOf(day: number) {
  return Math.floor((day - 1) / BALANCE.daysPerSeason) % 4;
}
export function dayOfSeason(day: number) {
  return ((day - 1) % BALANCE.daysPerSeason) + 1;
}
export function weekday(day: number) {
  return (day - 1) % 7;
}
