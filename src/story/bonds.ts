/**
 * Vínculos: short personal scenes with Pip, Spicy and Rigg (and a few with the three together).
 * Each one hangs from something the player did in the game: a corner restored, a shared activity, a night of rain, a photo.
 * They are optional, never missable (the condition stays true once met) and never move the main mystery forward.
 * Memories of Akio only use what the player already knows at that point of the story (see AKIO_* below).
 *
 * Saving: one flag per scene, `bond_<id>` = day it was seen. It is set in the same synchronous block as the rewards, after the
 * last line, so a scene closed or failing half-way gives nothing and can be played again; a finished one never pays twice.
 */
import { activityCount } from '../core/activityCounters';
import { game } from '../core/state';
import { runScene, say, choose } from '../dialogue/dialogue';
import { toast } from '../ui/dom';
import { learnRecipe } from '../restaurant/orders';
import { hasCorner } from '../restaurant/corners';
import { stageForLevel } from '../restaurant/stages';
import { companyVisits } from '../systems/companionship';
import { clock } from '../systems/time';
import { ITEMS_BY_ID } from '../data/items';
import { FURN_BY_ID } from '../data/furniture';
import { RECIPES_BY_ID } from '../data/recipes';

export type Beat = [speaker: string, text: string, expr?: 'happy' | 'sad' | 'smug' | 'surprised' | 'neutral'];
export type BondWho = 'pip' | 'spicy' | 'rigg' | 'trio';

export interface BondReward {
  /** title shown in the memories list (and its key is `bond_<id>`) */
  memory: string;
  furniture?: string;
  recipe?: string;
  items?: Record<string, number>;
  coins?: number;
  /** a small generated snapshot for the album: who appears and the caption */
  photo?: { who: string[]; subject: string };
}

export interface Bond {
  id: string;
  who: BondWho;
  title: string;
  /** what to do to unlock it, shown in the Vínculos panel while it is not ready */
  hint: string;
  /** one line for the end-of-story recap */
  recap: string;
  ready: () => boolean;
  intro: Beat[];
  choice?: { prompt?: string; options: [string, string]; replies: [Beat[], Beat[]] };
  outro?: Beat[];
  reward: BondReward;
}

// ------------------------------------------------------------------ conditions
const stat = (k: string) => activityCount(k);
const lvl = (id: string) => game.friendLevel(id);
const phase = (project: string, n: number) => game.has(`proj_${project}_${n}`);
const everyone = (n: number) => ['pip', 'spicy', 'rigg'].every((r) => lvl(r) >= n);
const stage = () => stageForLevel(game.save.restaurant.level);
const raining = () => game.flag('weather') === 'rain';
/** Akio is a name the player only knows after Ume tells the story (chapter 1), and his recipe notebook after chapter 4. */
const AKIO_NAME = () => game.has('ume_akio');
const AKIO_NOTEBOOK = () => game.has('notebook_found');

export const BONDS: Bond[] = [
  // ============================================================ PIP
  {
    id: 'pip_nap', who: 'pip', title: 'La siesta del claro', recap: 'Pip durmió una siesta en el banco del claro y dice que fueron "dos minutitos".',
    hint: 'Armá el banco y el farol del Claro del bosque (Proyectos) y hablá con Pip.',
    ready: () => lvl('pip') >= 1 && phase('forest_clearing', 1),
    intro: [
      ['narr', 'Pip arrastra un almohadón hasta donde estás y lo apoya en el piso, muy serio. Como si fuera el banco del claro.'],
      ['pip', 'Prueba número uno: sentarse. Se aprueba.', 'happy'],
      ['pip', 'Prueba número dos: acostarse. Mmm. El banco es de dos plazas. Yo soy de tres.', 'smug'],
      ['narr', 'Se tira sobre el almohadón con los brazos en cruz. Dos segundos después ronca bajito, con la cola colgando.'],
    ],
    choice: {
      options: ['Taparlo con cuidado.', 'Sacarle una foto mental.'],
      replies: [
        [['narr', 'Lo tapás con un repasador. Pip sonríe dormido y murmura: «...cuatro platos...»'], ['pip', '¿Ya amaneció? ¿Qué día es? ¿Quién ganó?', 'surprised']],
        [['narr', 'Clic imaginario. Pip abre un ojo justo a tiempo.'], ['pip', 'Seguro salí en mi mejor ángulo. Siempre es el dormido.', 'smug']],
      ],
    },
    outro: [
      ['pip', '¿Cuánto dormí? ¿Un minuto? ¿Dos? Qué buen banco. Cuando lo vuelvas a ver, saludalo de mi parte.', 'happy'],
      ['pip', 'Y quedate con este almohadón. Ya tiene mi forma, pero se le va a ir.', 'happy'],
    ],
    reward: { memory: 'La siesta en el claro', furniture: 'bond_nap_cushion', recipe: 'pip_nap' },
  },
  {
    id: 'pip_bottle', who: 'pip', title: 'El mensaje de la botella', recap: 'Pip encontró una botella con un mensaje que olía a té.',
    hint: 'Terminá los faroles del muelle (Rincón del muelle), aprendé quién fue el antiguo dueño y hablá con Pip.',
    ready: () => lvl('pip') >= 2 && phase('beach_corner', 2) && AKIO_NAME(),
    intro: [
      ['pip', '¡{name}! Encontré una botella entre los faroles del muelle. ¡Con un mensaje adentro!', 'happy'],
      ['narr', 'El papel está tan gastado que casi no se lee. Pip lo sostiene con las dos manos, como si fuera una torta.'],
      ['pip', 'Dice: «Para quien lo encuentre: que no se te enfríe el té».', 'happy'],
      ['pip', 'Me hizo acordar a alguien. No me acuerdo la cara. Pero sí el vapor. Y una voz que se reía fuerte.', 'sad'],
    ],
    choice: {
      options: ['Guardemos la botella.', 'Escribamos una respuesta y la tiramos al mar.'],
      replies: [
        [['pip', 'La pongo en mi caja de tesoros. Entre la piedra y la pluma. Va a estar contenta.', 'happy']],
        [['pip', '«Se enfrió un poquito. Pero ya lo calentamos.» ...¿Así está bien? Le agrego un dibujo de arroz.', 'happy'], ['narr', 'La botella flota hasta perderse entre los reflejos rojos de los faroles.']],
      ],
    },
    outro: [['pip', 'Los mensajes buenos siempre vuelven. Aunque tarden. Aunque lleguen como té.', 'happy']],
    reward: { memory: 'La botella del muelle', items: { g_tea: 2 } },
  },
  {
    id: 'pip_storm', who: 'pip', title: 'La noche de la manta', recap: 'En una noche de tormenta, Pip y vos armaron un fuerte de mantas.',
    hint: 'Pip te contó su miedo a las tormentas. Esperá una noche de lluvia (tarde o noche) y hablá con él.',
    ready: () => game.has('memory_pip_storm') && raining() && clock.period >= 2,
    intro: [
      ['narr', 'Afuera llueve a baldazos. Pip aparece arrastrando todas las mantas que encontró, que son muchas más de las necesarias.'],
      ['pip', 'Dijiste que ibas a venir en la próxima tormenta. Así que armé un fuerte. Tiene techo, puerta y un lugar para el postre.', 'happy'],
      ['narr', 'Un trueno hace temblar los vasos. Pip se esconde debajo de tres mantas a la vez.'],
      ['pip', 'Estoy perfectamente bien. Es solo que... el fuerte necesita que alguien lo habite.', 'surprised'],
    ],
    choice: {
      options: ['Cantar la canción del mapache.', 'Contar las gotas juntos.'],
      replies: [
        [['narr', 'La canción dice «mapache» muchas veces y ninguna rima. Pip la canta cada vez más fuerte, hasta que el trueno suena chiquito.'], ['pip', '¡Funciona! ¡La tormenta no se anima a cantar!', 'happy']],
        [['narr', 'Contás hasta cuarenta y dos. Pip se equivoca en el treinta y uno a propósito para empezar de nuevo.'], ['pip', 'Uno... dos... tres... Con vos hasta las tormentas tardan más en terminar. Y eso es bueno.', 'happy']],
      ],
    },
    outro: [
      ['narr', 'Cuando la lluvia afloja, Pip ya está dormido con la mitad de las mantas en la cara.'],
      ['pip', '(dormido) ...cuatro platos... y una manta...', 'happy'],
    ],
    reward: { memory: 'La noche de la manta', furniture: 'bond_storm_blanket' },
  },
  {
    id: 'pip_photo', who: 'pip', title: 'La foto torcida', recap: 'Pip y vos se sacaron una foto tan torcida que quedó perfecta.',
    hint: 'Guardá 2 fotos con la cámara del NoriPhone y hablá con Pip (amistad nivel 3).',
    ready: () => lvl('pip') >= 3 && stat('photos') >= 2,
    intro: [
      ['pip', 'Vi tus fotos en el álbum. Están muy lindas. Muy... derechas.', 'smug'],
      ['pip', 'Yo quiero una torcida. Con la cámara torcida. Y yo torcido. Y vos también. ¡Torcidos juntos!', 'happy'],
      ['narr', 'Se acomodan frente a la cámara imaginaria. Pip inclina la cabeza tanto que casi se cae.'],
    ],
    choice: {
      options: ['Inclinarte para el otro lado.', 'Hacer la pose más seria del mundo.'],
      replies: [
        [['pip', '¡Somos una letra V! ¡La V de «vos y yo»!', 'happy']],
        [['pip', 'Perfecto. Muy elegante. Una foto de museo con un mapache torcido al lado.', 'smug']],
      ],
    },
    outro: [['narr', 'Clic. La foto sale movida, con la cola de Pip tapando la mitad. Se miran. Se ríen. Es la mejor.'], ['pip', 'La guardás en el álbum, ¿sí? Yo la miro cada vez que me sale algo mal.', 'happy']],
    reward: { memory: 'La foto torcida', photo: { who: ['pip', 'player'], subject: 'Foto torcida con Pip' } },
  },
  {
    id: 'pip_plate', who: 'pip', title: 'Un plato de más', recap: 'Pip puso un plato de más en la mesa nueva, por si llegaba alguien.',
    hint: 'Renová el salón del restaurante (nivel 5), aprendé quién fue el antiguo dueño y hablá con Pip (amistad nivel 3).',
    ready: () => lvl('pip') >= 3 && stage() >= 2 && AKIO_NAME(),
    intro: [
      ['narr', 'Con la renovación del salón, Pip se pasó la tarde acomodando la mesa nueva. Ahora estira el brazo y pone un plato en un lugar vacío.'],
      ['pip', '¿Viste? Un plato de más. Alguien siempre ponía uno, «por si llegaba alguien». Yo creía que era para mí.', 'smug'],
      ['pip', 'Después me di cuenta de que ya tenía el mío. El de más era para los que todavía no conocíamos.', 'happy'],
      ['pip', 'Y llegaste vos. Ahora el de más es para el siguiente. Hay que dejar el lugar. Es la regla.', 'happy'],
    ],
    outro: [['narr', 'Pip alisa el mantel con la patita, con muchísimo cuidado, como quien acomoda un sueño.']],
    reward: { memory: 'El plato de más', furniture: 'bond_plate_frame' },
  },

  {
    id: 'pip_corner', who: 'pip', title: 'Inauguración del rincón', recap: 'Pip inauguró su rincón de tesoros con una cinta hecha de servilletas.',
    hint: 'Construí el Rincón de tesoros de Pip (Restaurante → Mejoras) y hablá con él (amistad nivel 2).',
    ready: () => lvl('pip') >= 2 && hasCorner('pip'),
    intro: [
      ['pip', '¡{name}! ¡Ya está! ¡Mi rincón está listo! Ven... digo, imaginá que venís. Hay que hacer la inauguración.', 'happy'],
      ['narr', 'Pip desenrolla una cinta hecha con servilletas atadas entre sí. Se la pone en las dos patitas, esperando que la cortes.'],
      ['pip', 'Hay un baúl para los tesoros, un zabuton para sentarse y una regla. Una sola: nadie puede estar triste adentro.', 'happy'],
    ],
    choice: {
      options: ['Cortar la cinta con mucha ceremonia.', 'Atar la cinta en vez de cortarla.'],
      replies: [
        [['narr', 'Cortás la cinta con un cuchillo de untar. Pip aplaude tan fuerte que se cae el baúl, que, por suerte, estaba vacío.'], ['pip', '¡Inaugurado! ¡Oficialmente el mejor rincón de todos los rincones!', 'happy']],
        [['narr', 'La atás con un moño en la tapa del baúl. Pip la mira como si fuera una medalla.'], ['pip', 'Mejor así. Los moños duran más que los cortes. Y se puede volver a desatar.', 'happy']],
      ],
    },
    outro: [['pip', 'Cuando quieras pasar un rato, el zabuton de al lado es tuyo. Es el lugar de siempre. Y el de más.', 'happy']],
    reward: { memory: 'La cinta de servilletas', items: { st_quartz: 1, g_candy: 2 } },
  },

  // ============================================================ SPICY
  {
    id: 'spicy_taster', who: 'spicy', title: 'Catadora oficial', recap: 'Spicy te nombró catadora oficial y te entregó un carnet.',
    hint: 'Cociná 3 platos a mano y hablá con Spicy.',
    ready: () => lvl('spicy') >= 1 && stat('handCooked') >= 3,
    intro: [
      ['spicy', 'Alto ahí. Vi tus platos. Tienen alma. Y un poquito de arroz pegado, pero eso es parte del estilo.', 'smug'],
      ['spicy', 'Por eso, por la presente, te nombro CATADORA OFICIAL de Midnight Maki. Con carnet y todo.', 'happy'],
      ['narr', 'Spicy te entrega una tarjetita laminada con un dibujo de pepino con corona. Está firmada «El Chef (yo)».'],
    ],
    choice: {
      options: ['Aceptar con una reverencia.', 'Pedir un aumento (de postres).'],
      replies: [
        [['spicy', 'Eso es profesionalismo. Ahora, primera regla: nunca digas «está rico» sin decir por qué.', 'happy']],
        [['spicy', '¿Un aumento? Tengo flan. Es todo lo que ofrece el sindicato de catadores.', 'smug']],
      ],
    },
    outro: [['spicy', 'Cuando algo te guste de verdad, decímelo. Cuando no, también. Pero con cariño. Y con pepino.', 'happy']],
    reward: { memory: 'El carnet de catadora', items: { chili: 2 } },
  },
  {
    id: 'spicy_garden', who: 'spicy', title: 'Lo que se cosecha', recap: 'Spicy plantó ají en el jardín y lo cuida como a un bebé.',
    hint: 'Colgá los faroles del jardín (Jardín de faroles), cosechá 2 veces y hablá con Spicy.',
    ready: () => lvl('spicy') >= 2 && phase('garden_lanterns', 1) && stat('harvests') >= 2,
    intro: [
      ['spicy', 'Vení. No hagas ruido. Estoy en un momento delicado con una planta.', 'smug'],
      ['spicy', 'Es un ají. Lo planté en el jardín cuando nadie miraba. Todos los días le cuento cómo estuvo el servicio.', 'happy'],
      ['narr', 'Con dos dedos, Spicy sostiene un ajicito rojo como si fuera una joya. Se le llenan los ojos de lágrimas, y no del picante.'],
      ['spicy', 'Me enseñaron que una receta empieza mucho antes del fuego. Bueno: empieza con alguien que riega.', 'sad'],
    ],
    choice: {
      options: ['Probarlo (con valentía).', 'Dejarlo madurar un día más.'],
      replies: [
        [['narr', 'Lo mordés. Primero, nada. Después, todo. Los ojos, las orejas, las pestañas.'], ['spicy', '¡Es perfecto! ¡Mirá cómo llorás! ¡Eso es cariño!', 'happy']],
        [['spicy', 'Sabia decisión. La paciencia es el ingrediente secreto. Y el otro ingrediente secreto es el ají.', 'smug']],
      ],
    },
    outro: [['spicy', 'Llevate una maceta. Para tu rincón. Así tenés a alguien en casa que no hace ruido y da de comer.', 'happy']],
    reward: { memory: 'El ají del jardín', furniture: 'bond_chili_pot', items: { sd_chili: 2 } },
  },
  {
    id: 'spicy_hum', who: 'spicy', title: 'La canción del cuchillo', recap: 'Spicy tarareó la canción que tarareaba el antiguo dueño al cortar el pepino.',
    hint: 'Encontrá el cuaderno de recetas del antiguo dueño (capítulo 4), cociná 6 platos a mano y hablá con Spicy.',
    ready: () => lvl('spicy') >= 2 && AKIO_NOTEBOOK() && stat('handCooked') >= 6,
    intro: [
      ['narr', 'Spicy corta pepino con un ritmo raro: tac, tac, pausa, tac. Se da cuenta de que lo mirás.'],
      ['spicy', 'No es un ritmo. Es una canción. La tarareaba el que cocinaba antes que yo. Siempre desafinado. Siempre la misma.', 'smug'],
      ['spicy', 'Yo la aprendí sin querer. La sé entera y no me acuerdo de la letra. Solo de cómo suena el cuchillo.', 'sad'],
    ],
    choice: {
      options: ['Pedirle que la tararee.', 'Acompañar con la tabla de cortar.'],
      replies: [
        [['narr', 'Spicy tararea. Desafina muchísimo, a propósito, para que sea fiel al original.'], ['spicy', '¿Ves? Imposible de olvidar. Imposible de cantar bien.', 'happy']],
        [['narr', 'Tac, tac, pausa, tac. Dos cuchillos, un ritmo. Pip aparece en la puerta y baila sin saber por qué.'], ['spicy', 'Una cocina con música cocina distinto. Eso también estaba en el cuaderno, creo.', 'happy']],
      ],
    },
    outro: [['spicy', 'Gracias por no preguntarme qué canción es. A veces alcanza con que suene.', 'happy']],
    reward: { memory: 'La canción del cuchillo', furniture: 'bond_kitchen_light' },
  },
  {
    id: 'spicy_egg', who: 'spicy', title: 'El huevo, otra vez', recap: 'Spicy volvió a hacer el huevo con carácter y esta vez no se quemó (casi).',
    hint: 'Alcanzá el nivel 4 de amistad con Spicy, cociná 8 platos a mano y hablá con ella.',
    ready: () => lvl('spicy') >= 4 && stat('handCooked') >= 8,
    intro: [
      ['spicy', 'Hoy es el día. Voy a hacer el huevo. EL huevo. El de las cenizas. El del carácter.', 'smug'],
      ['narr', 'Spicy se ata el pañuelo, se arremanga y mira la sartén como quien mira un viejo rival.'],
      ['spicy', 'Fuego medio. Una cucharada de azúcar. Un cuarto de vuelta de soja. Y... ¿ahora?', 'surprised'],
    ],
    choice: {
      options: ['«¡Más carácter!»', '«Bajá el fuego, chef.»'],
      replies: [
        [['narr', 'El huevo se pone negro por un costado y dorado por el otro. Medio huevo sobrevive.'], ['spicy', 'Mitad ceniza, mitad gloria. Es el mejor equilibrio que logré en mi vida.', 'happy']],
        [['narr', 'Spicy baja el fuego. El huevo se hace dorado, esponjoso, perfecto. Los dos se quedan mirándolo, sin creerlo.'], ['spicy', 'Eso... eso lo hice yo. ¿Verdad? ¿Lo hice yo?', 'surprised']],
      ],
    },
    outro: [
      ['narr', 'Spicy corta el huevo en dos y te da la mitad. Está rico. Tiene un borde tostado, nomás para no perder la costumbre.'],
      ['spicy', 'Tiene carácter. Pero ahora es el mío. Quedate con la receta: es tuya también.', 'happy'],
    ],
    reward: { memory: 'El huevo de Spicy, otra vez', furniture: 'bond_egg_frame', recipe: 'spicy_egg' },
  },

  {
    id: 'spicy_corner', who: 'spicy', title: 'La mesa de las ideas', recap: 'Spicy probó su primera idea en la mesa nueva de su rincón: salió un poco picante.',
    hint: 'Construí el Rincón de sabores de Spicy (Restaurante → Mejoras) y hablá con ella (amistad nivel 2).',
    ready: () => lvl('spicy') >= 2 && hasCorner('spicy'),
    intro: [
      ['spicy', 'La mesa nueva es oficial. Acá solo se prueban ideas. Nada de platos terminados. Todo es borrador.', 'smug'],
      ['narr', 'Sobre la mesa redonda hay tres cuencos con pruebas de salsa. Uno está etiquetado «seguro». Otro, «ni idea». El tercero dice «no».'],
      ['spicy', 'Elegí uno. Si sobrevivís, se agrega a la carta. Si no, se agrega a la carta de otro restaurante.', 'happy'],
    ],
    choice: {
      options: ['El de «seguro».', 'El de «no». Qué me van a decir.'],
      replies: [
        [['narr', 'Está bien. Rico. Razonable. Spicy lo mira con la decepción de quien esperaba más drama.'], ['spicy', 'Muy seguro. Muy tibio. Me lo anoto como «para los que necesitan descansar el paladar».', 'smug']],
        [['narr', 'Primero, nada. Después, un tornado. Se te escapa un sonido que no sabías que podías hacer.'], ['spicy', '¡Esa cara! ¡Esa cara es la salsa funcionando! Voy a hacer un cartel con tu cara.', 'happy']],
      ],
    },
    outro: [['spicy', 'La mesa quedó estrenada. Ahora, a limpiar. Y mañana, otra idea. Y pasado, otra peor.', 'happy']],
    reward: { memory: 'La mesa de las ideas', items: { g_tea: 2 } },
  },

  // ============================================================ RIGG
  {
    id: 'rigg_tally', who: 'rigg', title: 'Contar estrellas', recap: 'Rigg te dejó ponerle nombre a una estrella en su cuaderno.',
    hint: 'De noche, con cielo despejado (sin lluvia), hablá con Rigg.',
    ready: () => lvl('rigg') >= 1 && clock.period === 3 && !raining(),
    intro: [
      ['narr', 'Rigg anota algo en su cuaderno sin levantar la vista. Cuando termina, da vuelta la hoja y te muestra una columna de puntitos.'],
      ['rigg', 'Estrellas que conté esta noche: cuarenta y tres. Estrellas con nombre: cero. Es un desequilibrio.', 'smug'],
      ['rigg', 'Le puse un número a cada una. Pero un número no es un nombre. Elegí una. Yo anoto.', 'neutral'],
    ],
    choice: {
      options: ['Llamarla «Pip». Brilla poco y hace ruido.', 'Llamarla {name}.'],
      replies: [
        [['rigg', 'Anotado: «Pip, estrella 17: brilla poco y hace ruido». Prohibido cambiarlo. Es oficial.', 'happy']],
        [['rigg', 'Anotado. Estrella 17: {name}. ...La puse al lado de las otras tres. Para que no esté sola.', 'happy']],
      ],
    },
    outro: [['rigg', 'Gracias. Las estrellas con nombre se cuentan mejor. Y se pierden menos.', 'happy']],
    reward: { memory: 'Una estrella con nombre', recipe: 'rigg_notebook', furniture: 'bond_star_notebook' },
  },
  {
    id: 'rigg_shelf', who: 'rigg', title: 'El estante de Rigg', recap: 'Rigg ordenó sus libros por estado de ánimo.',
    hint: 'Armá el carrito de libros (Rincón de lectura), leé en la biblioteca una vez y hablá con Rigg.',
    ready: () => lvl('rigg') >= 2 && phase('library_corner', 1) && stat('libraryReads') >= 1,
    intro: [
      ['rigg', 'Reorganicé mi estante. Con el carrito nuevo de la biblioteca, entró todo. Hasta lo que no leí.', 'smug'],
      ['rigg', 'Ya no está por autor ni por tamaño. Está por estado de ánimo. Esa pila: «para días lentos». Esa otra: «para cuando no sé qué hacer».', 'happy'],
      ['narr', 'Rigg señala una pila chiquita, aparte, con una cinta roja. No dice nada.'],
    ],
    choice: {
      options: ['Preguntar por la pila de la cinta.', 'Dejar la pila en paz.'],
      replies: [
        [['rigg', '«Para cuando alguien se queda un rato». Hay tres libros. Dos son míos. Uno es para vos. Cuando quieras.', 'happy']],
        [['rigg', 'Gracias. No era secreto. Pero es lindo que alguien no pregunte todo.', 'happy']],
      ],
    },
    outro: [['rigg', 'Quedate con la lámpara. La usaba para releer de noche. Así tenés dónde seguir.', 'happy']],
    reward: { memory: 'El estante por estados de ánimo', furniture: 'bond_reading_lamp' },
  },
  {
    id: 'rigg_map', who: 'rigg', title: 'Dónde conviene detenerse', recap: 'Rigg marcó en su mapa los lugares donde conviene quedarse un rato.',
    hint: 'Conseguí el mapa de Rigg (amistad nivel 4), terminá las flores del bosque (Claro del bosque), conocé al antiguo dueño y hablá con Rigg.',
    ready: () => game.has('memory_rigg_map') && phase('forest_clearing', 2) && AKIO_NAME(),
    intro: [
      ['narr', 'Rigg extiende su mapa de Villa Nori sobre la mesa. Tiene tazas dibujadas en algunos lugares, con una pequeña flecha.'],
      ['rigg', 'Antes marcaba caminos. Ahora marco dónde conviene parar. Una taza significa: «acá se está bien».', 'smug'],
      ['rigg', 'Tengo cuatro. Me falta una. La próxima la elegís vos.', 'neutral'],
    ],
    choice: {
      options: ['La playa, al atardecer.', 'El jardín, entre los faroles.'],
      replies: [
        [['rigg', 'La playa. Lo suponía. Dibujo la taza con vapor, así se entiende que hay cosas calientes aunque haga viento.', 'happy']],
        [['rigg', 'El jardín. Buena elección. Dibujo la taza chica, que no tape a las flores.', 'happy']],
      ],
    },
    outro: [['rigg', 'Listo. El mapa ahora dice cinco lugares donde quedarse. Y uno de ellos lo decidiste vos.', 'happy']],
    reward: { memory: 'La quinta taza del mapa', furniture: 'bond_map_frame' },
  },
  {
    id: 'rigg_silence', who: 'rigg', title: 'Un silencio compartido', recap: 'Rigg y vos compartieron un silencio tan largo que ganaron un récord.',
    hint: 'Sentate junto a Rigg 3 veces (Compañía → Sentarse juntos) y hablá con ella (amistad nivel 3).',
    ready: () => lvl('rigg') >= 3 && companyVisits('rigg', 'sit') >= 3,
    intro: [
      ['rigg', 'Llevamos varias veces sentadas juntas sin decir nada. Lo medí.', 'smug'],
      ['rigg', 'Tres minutos y once segundos, la última vez. Es un récord. Mi anterior récord era de cuarenta segundos. Con Pip.', 'neutral'],
      ['narr', 'Rigg anota la marca en el cuaderno, con la fecha y la hora, en una hoja que dice «Cosas que se hacen bien juntos».'],
    ],
    choice: {
      options: ['Proponer batir el récord ahora.', 'Preguntar qué más hay en la hoja.'],
      replies: [
        [['narr', 'Se quedan en silencio. Pasa un pájaro. Pasa otro. Rigg cuenta mentalmente hasta que se le escapa una sonrisa y pierde.'], ['rigg', 'Cuatro minutos. Récord roto. Y yo me reí. No lo anotes. Es un error técnico.', 'happy']],
        [['rigg', 'Dice: «Mirar el mar. Esperar que pase la lluvia. Ordenar libros sin ponerse de acuerdo. Y esto».', 'happy']],
      ],
    },
    outro: [['rigg', 'Gracias. A veces compartir silencio es la forma más prolija de decir «me alegra que estés».', 'happy']],
    reward: { memory: 'Un silencio compartido' },
  },
  {
    id: 'rigg_beam', who: 'rigg', title: 'Una postal para el faro', recap: 'Rigg y vos escribieron una postal para quien cuida el faro desde lejos.',
    hint: 'Terminá la historia principal (capítulo 8) y hablá con Rigg (amistad nivel 3).',
    ready: () => lvl('rigg') >= 3 && game.has('story_done'),
    intro: [
      ['narr', 'Rigg está sentada con una postal en blanco. La dirección ya está escrita, con su letra más prolija.'],
      ['rigg', 'El cuaderno decía: «Escribime cuando quieras». Hace días que miro esta postal. No sé cómo empezar.', 'sad'],
      ['rigg', 'Yo escribo bien las listas. Las cosas que importan me salen en columnas. ¿Me ayudás?', 'neutral'],
    ],
    choice: {
      options: ['«El faro sigue girando.»', '«Tenemos una mesa con un lugar de más.»'],
      replies: [
        [['rigg', '«El faro sigue girando.» ...Corto. Directo. Sirve. Agrego: «Las estrellas están en su lugar».', 'happy']],
        [['rigg', '«Tenemos una mesa con un lugar de más.» ...Sí. Eso es lo más cierto que puede decir una postal.', 'happy']],
      ],
    },
    outro: [
      ['narr', 'Firman las dos, una al lado de la otra. Rigg pega un sello con una gaviota y lo alisa con el pulgar, tres veces.'],
      ['rigg', 'Mañana la mando. Hoy... hoy me quedo un rato acá, mirando cómo seca la tinta.', 'happy'],
    ],
    reward: { memory: 'La postal al faro', photo: { who: ['rigg', 'player'], subject: 'Rigg y la postal al faro' } },
  },

  {
    id: 'rigg_corner', who: 'rigg', title: 'El escritorio en orden', recap: 'Rigg estrenó su escritorio y dejó un lugar para vos en la esquina.',
    hint: 'Construí el Rincón de lectura de Rigg (Restaurante → Mejoras) y hablá con ella (amistad nivel 2).',
    ready: () => lvl('rigg') >= 2 && hasCorner('rigg'),
    intro: [
      ['rigg', 'El escritorio llegó. Lo ordené en tres turnos: primero, lo que escribo. Después, lo que leo. Al final, lo que no sé dónde poner.', 'smug'],
      ['narr', 'Sobre el escritorio hay tres montañitas prolijas. Y en una esquina, un espacio vacío con una tarjeta: «Reservado».'],
      ['rigg', 'Ese lugar vacío es el único desorden que me permito. Es tuyo. Podés dejar algo ahí cuando quieras.', 'neutral'],
    ],
    choice: {
      options: ['Dejar un lápiz.', 'Dejar un sushi de papel.'],
      replies: [
        [['rigg', 'Un lápiz. Sin punta. Perfecto: así lo afilo yo, y lo uso, y es de las dos.', 'happy']],
        [['rigg', 'Un sushi de papel. ¿Para qué sirve? ...Para nada. Es lo mejor que me dejaron en un escritorio.', 'happy']],
      ],
    },
    outro: [['narr', 'Rigg acomoda el objeto con las dos manos, a un centímetro exacto del borde. Después lo corre un poquito, para que no quede perfecto.']],
    reward: { memory: 'El lugar reservado', coins: 80 },
  },

  // ============================================================ THE THREE TOGETHER (talk to Pip, at the restaurant)
  {
    id: 'trio_tuesday', who: 'trio', title: 'Martes de club', recap: 'Los tres armaron un «martes de club» y pusieron una lámpara que no se apaga.',
    hint: 'Terminá el capítulo 4 y alcanzá el nivel 2 de amistad con los tres. Hablá con Pip en el restaurante.',
    ready: () => game.has('ch4_done') && everyone(2) && game.has('intro_done'),
    intro: [
      ['pip', '¡Convocatoria! ¡Reunión urgente! ¡Spicy, Rigg, vengan! ¡Es martes!', 'happy'],
      ['spicy', 'Hoy es jueves, Pip.', 'smug'],
      ['pip', 'Hoy es martes en mi corazón.', 'happy'],
      ['rigg', 'Podemos tener un martes cuando queramos. Solo hace falta decidir que lo es.', 'neutral'],
      ['narr', 'Spicy trae té y galletitas. Rigg trae un cuaderno. Pip trae una vela con forma de pescado que nadie sabe de dónde sacó.'],
    ],
    choice: {
      options: ['Proponer una regla: cada martes, un chiste malo por cabeza.', 'Proponer una regla: nadie se va hasta que se enfríe el té.'],
      replies: [
        [['pip', '¿Qué hace un pez en el cine? ¡Nada!', 'happy'], ['spicy', 'Eso fue una falta de respeto a la cocina.', 'smug'], ['rigg', '...Lo anoto. Cuenta como chiste. Por un punto de lástima.', 'smug']],
        [['rigg', 'Acepto. Con la condición de que alguien caliente el té de nuevo.', 'neutral'], ['spicy', 'Y así nunca se enfría. Ni el té ni la reunión.', 'happy']],
      ],
    },
    outro: [
      ['pip', 'Esta lámpara se queda acá. La enciendo cada martes. Es la lámpara de los martes.', 'happy'],
      ['spicy', 'Hoy no es martes.', 'smug'],
      ['pip', 'Hoy es martes en la lámpara.', 'happy'],
    ],
    reward: { memory: 'El martes de la lámpara', furniture: 'bond_tuesday_lamp' },
  },
  {
    id: 'trio_table', who: 'trio', title: '¿Dónde va la mesa nueva?', recap: 'Los tres discutieron durante una hora dónde poner la mesa nueva.',
    hint: 'Renová el salón del restaurante (nivel 5), alcanzá el nivel 2 de amistad con los tres y hablá con Pip en el restaurante.',
    ready: () => stage() >= 2 && everyone(2) && game.has('intro_done'),
    intro: [
      ['narr', 'Pip, Spicy y Rigg rodean la mesa nueva, cada uno empujándola hacia un rincón distinto. No avanza.'],
      ['pip', 'Cerca de la ventana. Así los clientes ven el mar... y yo veo a los clientes.', 'happy'],
      ['spicy', 'Cerca de la cocina. Así el plato llega calentito. Y yo veo las caras al primer bocado.', 'smug'],
      ['rigg', 'En el medio. Así se llega desde cualquier lado. Es una cuestión de flujo.', 'neutral'],
    ],
    choice: {
      options: ['«Cerca de la ventana.»', '«Dejémosla donde está y pensemos otra vez mañana.»'],
      replies: [
        [['pip', '¡Gané! ¡Gané, gané! ¡Ganó la ventana!', 'happy'], ['spicy', 'Gana la ventana. Pero el flan lo llevo yo.', 'smug'], ['rigg', 'Anotado. Con reservas. Y con vista.', 'neutral']],
        [['rigg', 'La procrastinación estratégica es un arte.', 'smug'], ['pip', 'Entonces mañana la volvemos a mover. ¡Y pasado!', 'happy'], ['spicy', 'Y yo me quedo mirando cómo te cansás, Pip.', 'smug']],
      ],
    },
    outro: [['narr', 'Entre los tres levantan la mesa a la vez. Se chocan, se ríen y la dejan en un lugar que nadie eligió, pero queda perfecto.']],
    reward: { memory: 'La mesa de los cuatro', furniture: 'bond_table_four' },
  },
  {
    id: 'trio_photo', who: 'trio', title: 'La foto de los cuatro', recap: 'Se sacaron una foto los cuatro, con Pip adelante y Rigg a punto de irse.',
    hint: 'Alcanzá el nivel 3 de amistad con los tres, guardá 3 fotos y hablá con Pip en el restaurante.',
    ready: () => everyone(3) && stat('photos') >= 3 && game.has('intro_done'),
    intro: [
      ['pip', '¡Ya sé! ¡Una foto de los cuatro! ¡Todos juntos! ¡Sin que nadie se vaya!', 'happy'],
      ['rigg', 'Yo quedo en el costado. Las composiciones prolijas tienen asimetría.', 'neutral'],
      ['spicy', 'Yo salgo con el cucharón. Si no, mis fans no me reconocen.', 'smug'],
      ['narr', 'Pip pone el temporizador. Corre a su lugar. Resbala. Rigg lo agarra de la cola. Spicy levanta el cucharón. Clic.'],
    ],
    choice: {
      options: ['Quedarte en el medio, sonriendo.', 'Quedarte atrás, asomando la cabeza.'],
      replies: [
        [['pip', 'Ahí estás. En el medio, como corresponde. Sos el centro de la familia.', 'happy']],
        [['spicy', 'Asomando la cabeza. Un clásico. ¡Parecés una dama de la selva!', 'happy']],
      ],
    },
    outro: [['rigg', 'La foto salió bien. Un poco movida. Como la vida. La voy a poner en el cuaderno.', 'happy']],
    reward: { memory: 'La foto de los cuatro', furniture: 'bond_group_frame', photo: { who: ['pip', 'spicy', 'rigg', 'player'], subject: 'Los cuatro, en el restaurante' } },
  },
];

export const BOND_BY_ID: Record<string, Bond> = Object.fromEntries(BONDS.map((b) => [b.id, b]));

// ------------------------------------------------------------------ state
export const bondDone = (b: Bond) => game.has('bond_' + b.id);
export const bondsDone = () => BONDS.filter(bondDone).length;
/** Scenes that can be played right now (their condition is met and they are not done). */
export const readyBonds = () => BONDS.filter((b) => !bondDone(b) && b.ready());
export const readyBondCount = () => (game.save && game.loaded ? readyBonds().length : 0);

/** Which scene Pip, Spicy or Rigg would start if you talk to them now (the three-way ones belong to Pip, at the restaurant). */
export function nextBondFor(id: string, zone: string): Bond | null {
  return readyBonds().find((b) => (b.who === id ? true : b.who === 'trio' && id === 'pip' && zone === 'restaurant')) ?? null;
}

// ------------------------------------------------------------------ playing
async function beats(list: Beat[]) {
  for (const [who, text, expr] of list) await say(who, text, expr ?? 'neutral');
}

/** Plays the lines. Returns true only if the last line was reached. */
async function playLines(b: Bond): Promise<boolean> {
  let completed = false;
  await runScene('bond_' + b.id, async () => {
    await beats(b.intro);
    if (b.choice) {
      const c = await choose(b.choice.options, 'player', b.choice.prompt);
      await beats(b.choice.replies[c === 1 ? 1 : 0]);
    }
    if (b.outro) await beats(b.outro);
    completed = true;
  });
  return completed;
}

/** One synchronous block: flag + every reward, so it cannot be left half-granted or granted twice. */
export function grantBond(b: Bond, photo: string | null) {
  if (bondDone(b)) return;
  const r = b.reward;
  game.setFlag('bond_' + b.id, game.save.time.day);
  game.collect('memories', 'bond_' + b.id);
  game.setFlag('memory_bond_' + b.id, r.memory);
  if (r.furniture && FURN_BY_ID[r.furniture]) game.save.furnitureOwned[r.furniture] = (game.save.furnitureOwned[r.furniture] ?? 0) + 1;
  if (r.recipe && RECIPES_BY_ID[r.recipe]) { game.setFlag('recipe_bond_' + b.who); learnRecipe(r.recipe); }
  for (const [item, n] of Object.entries(r.items ?? {})) if (ITEMS_BY_ID[item]) game.addItem(item, n, 'bond');
  if (r.coins) game.addCoins(r.coins, 'bond');
  if (photo) {
    if (game.save.photos.length >= 60) game.save.photos.shift();
    game.save.photos.push({ id: game.uid(), day: game.save.time.day, zone: 'restaurant', subject: r.photo!.subject, data: photo });
  }
  if (b.who !== 'trio') game.setFlag(`bond_count_${b.who}`, (Number(game.flag(`bond_count_${b.who}`)) || 0) + 1);
  game.touch('bond');
}

/** Small polaroid of the people in the scene, drawn from their portraits (only in a browser). */
export async function composePhoto(who: string[], caption: string): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  try {
    const { portraitURL } = await import('../systems/appearance');
    const imgs = await Promise.all(who.map((id) => new Promise<HTMLImageElement | null>((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = portraitURL(id, 'happy');
    })));
    const W = 200, H = 150;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#f6ecd6'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f2c6a0'; g.fillRect(8, 8, W - 16, H - 36);
    g.fillStyle = '#f8dcb8'; g.fillRect(8, 8, W - 16, 28);
    g.fillStyle = '#9bb59a'; g.fillRect(8, H - 62, W - 16, 26);
    const live = imgs.filter((i): i is HTMLImageElement => !!i);
    const size = Math.min(70, Math.floor((W - 24) / Math.max(1, live.length)));
    const total = size * live.length;
    live.forEach((im, i) => {
      const tilt = ((i % 2) * 2 - 1) * 0.06;
      g.save();
      g.translate(Math.round((W - total) / 2 + i * size + size / 2), H - 42 - size / 2);
      g.rotate(tilt);
      g.drawImage(im, -size / 2, -size / 2, size, size);
      g.restore();
    });
    g.fillStyle = '#4a3326'; g.font = '10px monospace'; g.textAlign = 'center';
    g.fillText(caption.slice(0, 34), W / 2, H - 10);
    return c.toDataURL('image/jpeg', 0.75);
  } catch { return null; }
}

/**
 * Plays a scene. `replay` (from the Vínculos panel) shows it again without giving anything.
 * The rewards only arrive after the last line.
 */
export async function playBond(b: Bond, replay = false): Promise<boolean> {
  if (!replay && bondDone(b)) return false;
  const completed = await playLines(b);
  if (!completed || replay || bondDone(b)) return completed;
  const photo = b.reward.photo ? await composePhoto(b.reward.photo.who, b.reward.photo.subject) : null;
  grantBond(b, photo);
  toast(`Nuevo recuerdo: ${b.reward.memory}`);
  const notes = [b.reward.furniture && FURN_BY_ID[b.reward.furniture] ? `Decoración: ${FURN_BY_ID[b.reward.furniture].name}` : '', b.reward.recipe && RECIPES_BY_ID[b.reward.recipe] ? `Receta: ${RECIPES_BY_ID[b.reward.recipe].name}` : '', photo ? 'Foto nueva en el álbum' : ''].filter(Boolean);
  if (notes.length) toast(notes.join(' · '));
  // a little extra friendship, with the usual level-up scene if it crosses a level
  const who = b.who === 'trio' ? ['pip', 'spicy', 'rigg'] : [b.who];
  for (const id of who) {
    const up = game.addFriendship(id, b.who === 'trio' ? 4 : 8);
    if (up) await runScene('bond_levelup_' + id, async () => { const t = await import('../dialogue/talk'); await t.friendshipUp(id, up); });
  }
  return true;
}

/** Used by the conversation: a scene to start when you talk to this character, or null. */
export function bondTalk(id: string, zone: string): (() => Promise<void>) | null {
  const b = nextBondFor(id, zone);
  return b ? async () => { await playBond(b); } : null;
}

/** Lines for the epilogue album: one memory per raccoon, chosen from what the player actually lived. */
export function epilogueRecap(): Beat[] {
  const out: Beat[] = [];
  for (const id of ['pip', 'spicy', 'rigg'] as const) {
    const seen = BONDS.filter((b) => b.who === id && bondDone(b)).sort((a, b) => Number(game.flag('bond_' + b.id)) - Number(game.flag('bond_' + a.id)));
    const generic: Record<string, string> = { pip: 'Yo tengo todos mis tesoros. Pero las páginas del álbum que más me gustan todavía están en blanco. Para después.', spicy: 'Yo todavía no tengo mi página. Estoy esperando a que me pase algo bueno. Seguro hoy a la tarde.', rigg: 'Mi página dice: «Pendiente: lo mejor». Me gusta dejar espacio para lo que no preví.' };
    const name = { pip: 'Pip', spicy: 'Spicy', rigg: 'Rigg' }[id];
    out.push(seen.length ? ['narr', `En la página de ${name}: «${seen[0].title}». ${seen[0].recap}`] : [id, generic[id], 'happy']);
  }
  const trio = BONDS.filter((b) => b.who === 'trio' && bondDone(b));
  if (trio.length) out.push(['narr', `En el álbum también hay ${trio.length === 1 ? 'una página' : trio.length + ' páginas'} de los tres juntos: ${trio.map((b) => '«' + b.title + '»').join(', ')}.`]);
  return out;
}
