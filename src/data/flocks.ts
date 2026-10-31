/**
 * Flocks of birds: where they gather by day, in village world coordinates. They hop about together and all fly off when
 * you walk up to one of them. Only where a flock makes sense: pigeons on the square, gulls on the sand and the quay,
 * sparrows on lawns and in clearings. None at night, in the rain, at the station, in the residential streets or at
 * the shrine.
 */
import { villageSpot } from './villageGeography';

export type BirdSpecies = 'sparrow' | 'pigeon' | 'gull';
export interface Flock { zone: string; x: number; y: number; n: number; species: BirdSpecies }

const AT: [x: number, y: number, n: number, species: BirdSpecies][] = [
  [55, 40, 6, 'pigeon'], // the square, in front of the fountain
  [48, 47, 4, 'sparrow'], // the lawn under the cherry trees, before the restaurant
  [8, 57, 5, 'gull'], // the open sand of the beach
  [21, 61, 4, 'gull'], // the wet sand by the water
  [50, 66, 3, 'gull'], // the market's quay
  [82, 67, 4, 'gull'], // the harbour's quay, between the cargo and the bench
  [16, 36, 4, 'sparrow'], // the garden's lawn by the pond
  [25, 38, 3, 'sparrow'], // the garden's east beds
  [20, 8, 4, 'sparrow'], // the forest path's clearing
];

export const FLOCKS: Flock[] = [
  ...AT.map(([x, y, n, species]) => { const at = villageSpot(x, y); return { zone: at.zone, x: at.x, y: at.y, n, species }; }),
  { zone: 'deepforest', x: 16, y: 13, n: 5, species: 'sparrow' }, // the Bosque profundo's clearing
];
