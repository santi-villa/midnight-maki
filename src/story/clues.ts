/** Investigation notebook content: clues and deductions for the main mystery. */
export type ClueKind = 'carta' | 'foto' | 'testimonio' | 'objeto' | 'lugar' | 'contradicción' | 'hipótesis';

export interface ClueDef { id: string; title: string; kind: ClueKind; text: string; chapter: number; }

export const CLUES: ClueDef[] = [
  { id: 'letter_inherit', title: 'La carta sin remitente', kind: 'carta', chapter: 0, text: '"Hoy el restaurante necesita a alguien nuevo. Si decidís venir, vas a reconocer Midnight Maki por sus dos faroles." Firmada solo con una letra: A.' },
  { id: 'drawing_stars', title: 'Dibujo de tres estrellas', kind: 'objeto', chapter: 0, text: 'Un dibujo viejo que Pip encontró debajo de su futón. Tres estrellas unidas por líneas, sobre un faro.' },
  { id: 'akio_gone', title: 'El antiguo dueño', kind: 'testimonio', chapter: 1, text: 'Abuela Ume: "Akio cerró el restaurante hace diez años, una noche de tormenta. Al otro día ya no estaba. Nadie lo vio irse."' },
  { id: 'note_storage', title: 'Nota del depósito', kind: 'carta', chapter: 1, text: '"Las tres estrellas no se perdieron. Están esperando. Donde el arroz duerme, la madera recuerda." — A.' },
  { id: 'odd_order', title: 'Pedido sin remitente', kind: 'carta', chapter: 2, text: '"Un sake maki para la mesa que nadie usa. Servilo cuando la sombra del depósito toque el tercer tablón."' },
  { id: 'photo_old', title: 'Fotografía antigua', kind: 'foto', chapter: 2, text: 'Akio sonriendo frente al restaurante, con tres mapaches muy chiquitos en brazos. Al dorso: "Mis tres estrellitas. Año 1."' },
  { id: 'rusty_key', title: 'Llave oxidada', kind: 'objeto', chapter: 2, text: 'Estaba en el compartimento oculto. Tiene grabado un tren. ¿La estación abandonada?' },
  { id: 'pip_memory', title: 'Recuerdo de Pip', kind: 'testimonio', chapter: 3, text: 'Pip: "Me acuerdo de una cabaña con olor a pino y una voz que cantaba bajito. Me acuerdo de una manta con una estrella bordada."' },
  { id: 'pip_claim', title: 'Lo que Pip creía', kind: 'testimonio', chapter: 3, text: 'Pip siempre dijo que llegó al restaurante "hace poquito, solo", y que nunca conoció al antiguo dueño.' },
  { id: 'cabin_blanket', title: 'La manta de la cabaña', kind: 'objeto', chapter: 3, text: 'Una mantita diminuta con una estrella rosada bordada. Adentro, envuelta, había una pieza con forma de estrella.' },
  { id: 'old_notebook', title: 'Cuaderno de recetas de Akio', kind: 'objeto', chapter: 4, text: 'Una receta llamada "Tres Estrellas": una pieza dulce, una picante y una misteriosa. Requiere carambola del Mercado Nocturno.' },
  { id: 'plate_map', title: 'El plato revela un mapa', kind: 'lugar', chapter: 4, text: 'Al servir las Tres Estrellas, las piezas forman las posiciones de la plaza, la estación y el faro.' },
  { id: 'secret_club', title: 'El club de los martes', kind: 'testimonio', chapter: 4, text: 'Ume: "Los martes nos juntábamos en el restaurante después del cierre. Akio, Bento, yo, y la mamá de Hoshi. Le decíamos el Club de las Tres Estrellas."' },
  { id: 't_bento', title: 'Testimonio de Bento', kind: 'testimonio', chapter: 5, text: 'Bento: "Yo nunca estuve en el faro. Nunca. Ni siquiera sé cómo es por dentro."' },
  { id: 't_taro', title: 'Testimonio de Taro', kind: 'testimonio', chapter: 5, text: 'Taro: "Bento me pidió hace años que le hiciera una copia de una llave con tres estrellas grabadas. La llave del faro, diría yo."' },
  { id: 't_kumo', title: 'Testimonio de Kumo', kind: 'testimonio', chapter: 5, text: 'Kumo: "El club se deshizo la noche de la tormenta. Akio dejó un libro devuelto a la biblioteca con una página marcada: el mecanismo del faro."' },
  { id: 't_hoshi', title: 'Testimonio de Hoshi', kind: 'testimonio', chapter: 5, text: 'Hoshi: "La luz del faro se apagó esa misma noche. Mi mamá decía que solo se enciende si las tres estrellas vuelven a su lugar."' },
  { id: 'rigg_letter', title: 'La carta de Rigg', kind: 'carta', chapter: 6, text: '"Rigg: vos vas a entender esto mejor que nadie. Cuando llegue alguien que haga reír a Pip y que se anime a probar los platos de Spicy, mostrale el camino. La última estrella espera cuando el reloj marque la hora en que nos conocimos."' },
  { id: 'clock_time', title: 'La hora en que se conocieron', kind: 'testimonio', chapter: 6, text: 'Rigg: "Akio me encontró en la estación. Me dijo la hora de su reloj: las diez y diez. Es lo único que recuerdo con claridad."' },
  { id: 'dark_night', title: 'La noche sin constelaciones', kind: 'lugar', chapter: 7, text: 'Una noche el cielo de Villa Nori se quedó sin estrellas. Hoshi dice que pasa cuando el mecanismo lleva demasiado tiempo apagado.' },
  { id: 'hoshi_key', title: 'La llave de Hoshi', kind: 'objeto', chapter: 7, text: 'La llave del faro que la mamá de Hoshi guardó. Tiene tres huecos con forma de estrella.' },
];

export const CLUE_BY_ID: Record<string, ClueDef> = Object.fromEntries(CLUES.map((c) => [c.id, c]));

export interface Deduction {
  id: string;
  chapter: number;
  question: string;
  pair: [string, string];   // the two clues to connect (any order)
  conclusions: string[];
  correct: number;
  hints: [string, string, string];
  solvedFlag: string;
}

export const DEDUCTIONS: Deduction[] = [
  {
    id: 'd_order', chapter: 2, solvedFlag: 'ded_order',
    question: '¿Qué señala realmente el pedido sin remitente?',
    pair: ['odd_order', 'note_storage'],
    conclusions: ['Que alguien quiere comer gratis.', 'Un tablón del depósito donde hay algo escondido.', 'Que hay que cambiar las mesas de lugar.'],
    correct: 1,
    hints: ['Los dos papeles hablan de madera y de un lugar del restaurante.', 'La nota habla de "donde el arroz duerme". ¿Dónde se guarda el arroz?', 'Relacioná el pedido con la nota del depósito y elegí el tablón.'],
  },
  {
    id: 'd_pip', chapter: 3, solvedFlag: 'ded_pip',
    question: '¿Qué contradicción hay en la historia de Pip?',
    pair: ['pip_claim', 'photo_old'],
    conclusions: ['Pip miente a propósito.', 'Pip era un bebé cuando vivía con Akio y no lo recuerda bien.', 'La foto es falsa.'],
    correct: 1,
    hints: ['Mirá lo que Pip dice sobre cuándo llegó.', 'Compará eso con la fotografía antigua.', 'Pip dice que nunca conoció a Akio, pero la foto muestra tres mapachitos con él.'],
  },
  {
    id: 'd_bento', chapter: 5, solvedFlag: 'ded_bento',
    question: '¿Qué testimonio no encaja con otro?',
    pair: ['t_bento', 't_taro'],
    conclusions: ['Bento sí tuvo relación con el faro: pidió copiar su llave.', 'Taro inventó todo para vender llaves.', 'Kumo escondió el libro.'],
    correct: 0,
    hints: ['Alguien dijo algo muy firme sobre el faro.', '¿Quién mencionó una llave con tres estrellas?', 'Bento dijo que nunca estuvo en el faro, pero Taro le copió una llave del faro.'],
  },
  {
    id: 'd_light', chapter: 7, solvedFlag: 'ded_light',
    question: '¿Por qué se apagó la luz del faro y qué hay que hacer?',
    pair: ['t_hoshi', 'drawing_stars'],
    conclusions: ['Hay que cambiarle la lamparita.', 'Las tres estrellas son piezas del mecanismo: hay que devolverlas al faro.', 'El faro está embrujado.'],
    correct: 1,
    hints: ['Pensá en lo que dijo Hoshi sobre su mamá.', 'El dibujo de Pip muestra tres estrellas sobre un faro.', 'Las estrellas que juntaste son piezas: van en el faro.'],
  },
];
