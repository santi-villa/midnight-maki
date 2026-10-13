/** Optional town memories. These never advance the main mystery or its deductions. */
import { game } from '../core/state';
import { inDialogue, runScene, say } from '../dialogue/dialogue';
import { projectDone } from '../restaurant/projects';

interface TownMemory { id: string; project: string; title: string; lines: [string, string][]; }
export const TOWN_MEMORIES: TownMemory[] = [
  { id: 'tea', project: 'plaza_garden', title: 'Un lugar para una taza más', lines: [
    ['narr', 'Entre las tablas del banco restaurado aparece una pequeña marca: un círculo, como el fondo de una taza.'],
    ['pip', '¡Ahora cabe una merienda entera! Y alguien más, si nos corremos un poquito.'],
    ['spicy', 'Akio siempre dejaba un lugar libre. Decía que una mesa nunca sabe quién va a llegar.'],
    ['narr', 'Dejás ese rincón despejado. El banco nuevo conserva una costumbre antigua.'],
  ] },
  { id: 'lights', project: 'plaza_lights', title: 'La luz del regreso', lines: [
    ['narr', 'Spicy acomoda una pantalla del farol. Pip sostiene la escalera con una seriedad poco habitual.'],
    ['spicy', 'En la cocina, Akio dejaba una luz encendida cuando terminábamos de limpiar.'],
    ['pip', 'Para que nadie se tropezara buscando la última galletita.'],
    ['rigg', 'También para que el restaurante pareciera un lugar al que se puede volver.'],
  ] },
  { id: 'shore', project: 'beach_corner', title: 'Un bolsillo de arena', lines: [
    ['narr', 'Pip sacude el almohadón del rincón de la playa. Cae una conchita diminuta, escondida en una costura.'],
    ['pip', '¡El banco tenía un tesoro! ¿Lo guardamos?'],
    ['rigg', 'Podemos dejarlo acá. El próximo que se siente también merece encontrar algo lindo.'],
    ['narr', 'La conchita queda sobre la madera, junto a una nota: «Para quien necesite un descanso».'],
  ] },
  { id: 'forest', project: 'forest_clearing', title: 'El mapa sin apuro', lines: [
    ['narr', 'Rigg dibuja el claro restaurado en una hoja. Pip agrega un banco demasiado grande.'],
    ['rigg', 'Akio decía que un mapa también puede señalar dónde conviene detenerse.'],
    ['spicy', 'Marcá este lugar. Acá se enfría el té sin que nadie tenga apuro.'],
    ['narr', 'Rigg dibuja una taza al lado del sendero. El mapa ya no cuenta solamente caminos.'],
  ] },
  { id: 'garden', project: 'garden_lanterns', title: 'Lo que vuelve a crecer', lines: [
    ['narr', 'Spicy observa la tierra entre los faroles nuevos. Pip aparta una piedrita con mucho cuidado.'],
    ['spicy', 'Akio me enseñó que una receta empieza bastante antes de encender el fuego.'],
    ['pip', '¿Cuando uno tiene hambre?'],
    ['spicy', 'Cuando alguien cuida lo que va a crecer.'],
    ['narr', 'Por una vez, Pip no contesta. Se agacha y sigue acomodando la tierra.'],
  ] },
  { id: 'books', project: 'library_corner', title: 'Una página para el pueblo', lines: [
    ['narr', 'Kumo abre un cuaderno de préstamos recuperado durante la restauración. En el margen hay un dibujo de una taza.'],
    ['kumo', 'Akio anotaba recetas en cualquier papel. Pero los libros siempre los devolvía limpios.'],
    ['rigg', 'Podríamos guardar acá nuestros dibujos del pueblo. No todo tiene que ser un secreto.'],
    ['narr', 'El club reserva una carpeta para recuerdos nuevos. La primera hoja lleva cuatro firmas.'],
  ] },
];
export const townMemorySeen = (id: string) => game.has('town_memory_' + id);
export const townMemoryReady = (memory: TownMemory) => game.has('ch3_done') && projectDone(memory.project) >= 2;
export const restorationSecretReady = () => TOWN_MEMORIES.every((m) => townMemorySeen(m.id));
let playing = false;
/** Mark only after the last line; errors leave the memory available for another attempt. */
export async function playTownMemory(id: string): Promise<boolean> {
  const memory = TOWN_MEMORIES.find((m) => m.id === id);
  const secret = id === 'album';
  if (playing || inDialogue() || (secret ? !restorationSecretReady() : !memory || !townMemoryReady(memory))) return false;
  playing = true;
  let completed = false;
  try {
    await runScene('town_restoration_' + id, async () => {
      if (secret) {
        await say('narr', 'Al reunir los seis recuerdos, notás que todos tienen algo en común: un sitio donde quedarse un rato.');
        await say('rigg', 'No encontramos un tesoro enterrado. Hicimos lugar para uno nuevo.');
        await say('pip', '¡Entonces falta la foto! Spicy, vení. Que salgamos todos.');
        await say('narr', 'Anotás el momento en el álbum: cuatro amigos y un pueblo que vuelve a reunirse. Todavía quedan muchas páginas en blanco.');
      } else for (const [who, text] of memory!.lines) await say(who, text);
      game.setFlag('town_memory_' + id);
      completed = true;
    });
    return completed;
  } finally { playing = false; }
}
