/** Short exchanges between neighbors. No story spoilers and no dialogue modal. */
import { CHAR_BY_ID } from '../data/characters';

export interface AmbientContext { zone: string; period: number; rain: boolean; festival: boolean }
export interface AmbientLine { speaker: string; text: string }
interface Exchange { pair: [string, string]; lines: [string, string, string] }

const EXCHANGES: Exchange[] = [
  { pair: ['pip', 'spicy'], lines: ['¿Les llevo agua a las mesas?', 'Sí, Pip. ¡Y el wasabi va aparte!', '¡Agua primero, volcán después!'] },
  { pair: ['pip', 'spicy'], lines: ['Hoy no se me cayó ninguna bandeja.', 'Eso merece una merienda del chef.', '¿Una grande? Me esforcé mucho.'] },
  { pair: ['pip', 'rigg'], lines: ['Encontré una piedra que parece una luna.', 'Guardala. Después la dibujamos.', '¡Nuestra colección tiene cielo!'] },
  { pair: ['rigg', 'kumo'], lines: ['¿Tenés algún mapa viejo del pueblo?', 'Uno con anotaciones en los márgenes.', 'Los márgenes suelen ser lo mejor.'] },
  { pair: ['rigg', 'ume'], lines: ['¿Siempre hubo faroles en el jardín?', 'Los vecinos los colgaban entre todos.', 'Me gusta que cada uno tenga una historia.'] },
  { pair: ['momo', 'sumi'], lines: ['Las camelias abrieron esta mañana.', '¿Puedo dibujarlas antes de que cierre?', 'Te guardo un rincón junto al sendero.'] },
  { pair: ['momo', 'ume'], lines: ['¿Te preparo un té junto a las flores?', 'Sí, querida. Con tiempo para mirar.', 'Entonces dejo la regadera un ratito.'] },
  { pair: ['taro', 'yuki'], lines: ['Guardé las cintas que me pediste.', '¡Gracias! Son para unos moños nuevos.', 'Mañana te las llevo al abrir.'] },
  { pair: ['taro', 'bento'], lines: ['¿Necesitás harina para mañana?', 'Sí. El pan de leche se terminó temprano.', 'Te reservo una bolsa en el almacén.'] },
  { pair: ['yuki', 'bento'], lines: ['Tu delantal necesita una puntadita.', 'Se enganchó al sacar el pan del horno.', 'Pasá mañana y te lo arreglo.'] },
  { pair: ['bento', 'spicy'], lines: ['Traje pan recién horneado para después.', '¡El chef aprueba esa merienda!', 'Pero dejá el ají lejos de mi pan.'] },
  { pair: ['bento', 'ume'], lines: ['Te guardé un pancito de leche.', 'Como los que hacías de chiquito.', 'Ahora los hago un poco más grandes.'] },
  { pair: ['nami', 'spicy'], lines: ['La pesca salió buena hoy.', '¡Entonces habrá un plato especial!', 'Te separo lo más fresco al volver.'] },
  { pair: ['nami', 'sora'], lines: ['¿Tenés cartas para el puerto?', 'Una más y termino la vuelta.', 'Te acompaño. Voy para ese lado.'] },
  { pair: ['kiki', 'sora'], lines: ['Vi un atajo entre los árboles.', '¿Es seguro para llevar las cartas?', 'Te lo muestro cuando esté despejado.'] },
  { pair: ['kiki', 'momo'], lines: ['Encontré flores junto al sendero.', 'Miralas, pero dejalas crecer ahí.', '¡Entonces vuelvo con un dibujo!'] },
  { pair: ['hoshi', 'kumo'], lines: ['Busco un libro de constelaciones.', 'Te guardé uno con dibujos antiguos.', 'Esta noche voy a comparar el cielo.'] },
  { pair: ['hoshi', 'rigg'], lines: ['¿Ese cuaderno también mira el cielo?', 'Anoto lo que todavía no entiendo.', 'Tenemos bastante en común.'] },
  { pair: ['sumi', 'yuki'], lines: ['Ese tono quedaría lindo en una tela.', '¿El rosa del atardecer?', 'Sí. Con un bordado de faroles.'] },
  { pair: ['sora', 'taro'], lines: ['Traje una carta para el almacén.', '¿Será la lista del próximo pedido?', 'Sí, y llegó antes de que cierres.'] },
  { pair: ['pip', 'bento'], lines: ['¿Tu pan también cuenta como tesoro?', 'Si lo compartís, vale el doble.', '¡Entonces guardo uno para Spicy!'] },
  { pair: ['akio', 'ume'], lines: ['El salón sigue oliendo a té.', 'Y ahora se escuchan más risas.', 'Eso siempre le hizo bien a esta casa.'] },
];

/** Sequence advances per pair, so two friends don't repeat one exchange all day. */
export function ambientExchange(a: string, b: string, ctx: AmbientContext, sequence: number): AmbientLine[] {
  if (!CHAR_BY_ID[a] || !CHAR_BY_ID[b] || a === b) return [];
  const line = (speaker: string, text: string): AmbientLine => ({ speaker, text });
  if (ctx.rain && sequence % 3 === 0) {
    return [line(a, ctx.zone === 'restaurant' ? 'Qué suerte encontrar un lugar seco.' : 'Hoy los caminos están mojados.'), line(b, ctx.zone === 'restaurant' ? 'Un té calentito viene bien.' : 'Vamos despacio, sin apurarnos.'), line(a, 'Sí. Después seguimos la vuelta.')];
  }
  if (ctx.festival && ctx.zone === 'plaza' && sequence % 3 === 0) {
    return [line(a, 'La plaza quedó linda para la fiesta.'), line(b, 'Después de la vuelta, me quedo un rato.'), line(a, 'Nos encontramos junto a los faroles.')];
  }
  const choices = EXCHANGES.filter((e) => e.pair.includes(a) && e.pair.includes(b));
  if (choices.length) {
    const e = choices[sequence % choices.length];
    return [line(e.pair[0], e.lines[0]), line(e.pair[1], e.lines[1]), line(e.pair[0], e.lines[2])];
  }
  const first = PERSONAL[a];
  const name = CHAR_BY_ID[b].name;
  if (first) return [line(a, `${name}, ${first[0]}`), line(b, first[1]), line(a, first[2])];
  return [line(a, ctx.period >= 2 ? '¿Terminaste la vuelta de hoy?' : '¿Cómo va tu mañana?'), line(b, 'Bien. Me quedé a descansar un ratito.'), line(a, 'Te hago compañía antes de seguir.')];
}

/** The reply responds to the speaker's specific interest, even for an unusual pair. */
const PERSONAL: Record<string, [string, string, string]> = {
  pip: ['¿viste algo brillante por acá?', 'Si encuentro algo, te lo guardo.', '¡Gracias! Después te muestro mi colección.'],
  spicy: ['estoy pensando un plato nuevo.', 'Avisame cuando se pueda probar.', '¡Vas a tener el primer bocado!'],
  rigg: ['estoy ordenando mis notas.', '¿Querés un ratito de tranquilidad?', 'Sí, gracias. Después te cuento.'],
  momo: ['hoy regué las flores temprano.', 'Así te queda tiempo para descansar.', 'Y para ver cómo van abriendo.'],
  taro: ['mañana me llega mercadería.', 'Paso por el almacén cuando abras.', 'Te guardo lo que necesites.'],
  yuki: ['estoy probando un bordado nuevo.', 'Me gustaría verlo cuando lo termines.', 'Te lo muestro en la tienda.'],
  kumo: ['encontré un libro interesante.', '¿Me lo recomendás para después?', 'Claro. Te lo guardo cuando termine.'],
  nami: ['hoy estuve pescando en la costa.', '¿Salió buena la pesca?', 'Sí. Ahora toca descansar las patas.'],
  hoshi: ['esta noche quiero mirar las estrellas.', 'Ojalá el cielo esté despejado.', 'Llevo el cuaderno por si acaso.'],
  bento: ['mañana vuelvo a hornear temprano.', 'Entonces te merecés descansar ahora.', 'Sí. Con un té y buena compañía.'],
  sumi: ['quiero pintar este rincón del pueblo.', '¿Te dejo espacio para el cuadro?', 'Con quedarte un ratito ya me inspirás.'],
  kiki: ['estuve mirando los senderos.', 'Cuidate cuando salgas a explorar.', 'Voy despacio y vuelvo antes de tarde.'],
  sora: ['me queda una carta por entregar.', 'Después vení a descansar un rato.', '¡Sí! Termino la vuelta y vuelvo.'],
  ume: ['me gusta escuchar al pueblo.', 'Cada día hay algo para contar.', 'Y alguien con tiempo para escuchar.'],
  akio: ['me alegra volver a visitar el pueblo.', 'Acá siempre hay lugar para vos.', 'Gracias. Se siente como llegar a casa.'],
};
