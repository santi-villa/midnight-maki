# Vínculos con Pip, Spicy y Rigg

Ampliación narrativa de las amistades. Se partió de master-mgsshv con los puntos 3 (convivencia), 4 (servicio) y 5 (progresión y hogar) ya integrados, y se leyó `docs/companionship.md`, `docs/restaurant-service.md` y `docs/progression-home.md`.

## Qué se agregó

**20 escenas cortas y opcionales** (`src/story/bonds.ts`), de 5 a 9 líneas, con una elección tierna o divertida en casi todas. Cada una cuelga de algo que la jugadora hizo: un rincón restaurado, una actividad compartida, una noche de lluvia, una foto, una renovación del salón o el final de la historia. No se pierden nunca: cuando se cumple lo que piden, quedan disponibles al hablar con el personaje.

| Escena | Se desbloquea con | Premio |
|---|---|---|
| **Pip** · La siesta del claro | Banco del Claro del bosque (fase 1), amistad 1 | memoria, Almohadón de siesta, receta *Maki Siesta de Pip* |
| El mensaje de la botella | Faroles del muelle (fase 2), amistad 2, conocer el nombre del antiguo dueño | memoria, 2 té |
| La noche de la manta | Haber oído su miedo a las tormentas (recuerdo de nivel 4) y una noche de lluvia | memoria, Manta de tormenta |
| La foto torcida | Amistad 3, 2 fotos guardadas | memoria, **foto** generada |
| Un plato de más | Salón renovado (nivel 5), amistad 3, nombre del antiguo dueño | memoria, Cuadro: el plato de más |
| Inauguración del rincón | Rincón de tesoros de Pip, amistad 2 | memoria, cuarzo y caramelos |
| **Spicy** · Catadora oficial | 3 platos a mano, amistad 1 | memoria, 2 ajíes |
| Lo que se cosecha | Faroles del jardín, 2 cosechas, amistad 2 | memoria, Ají de la huerta, 2 semillas de ají |
| La canción del cuchillo | Cuaderno de recetas (cap. 4), 6 platos a mano, amistad 2 | memoria, Farolito de la cocina |
| La mesa de las ideas | Rincón de sabores de Spicy, amistad 2 | memoria, 2 té |
| El huevo, otra vez | Amistad 4, 8 platos a mano | memoria, Cuadro, receta *Tamago con carácter* |
| **Rigg** · Contar estrellas | De noche, sin lluvia, amistad 1 | memoria, Cuaderno de estrellas, receta *Maki del Cuaderno* |
| El estante de Rigg | Carrito de libros, 1 lectura, amistad 2 | memoria, Lámpara de lectura |
| El escritorio en orden | Rincón de lectura de Rigg, amistad 2 | memoria, 80 monedas |
| Dónde conviene detenerse | Su mapa (nivel 4), flores del bosque, nombre del antiguo dueño | memoria, Cuadro: el mapa de Rigg |
| Un silencio compartido | 3 veces *Sentarse juntos* con Rigg, amistad 3 | memoria |
| Una postal para el faro | Historia terminada, amistad 3 | memoria, **foto** generada |
| **Los tres** · Martes de club | Cap. 4 terminado, amistad 2 con los tres (hablar con Pip en el restaurante) | memoria, Farol de los martes |
| ¿Dónde va la mesa nueva? | Salón renovado, amistad 2 con los tres | memoria, Mesa de los cuatro |
| La foto de los cuatro | Amistad 3 con los tres, 3 fotos | memoria, Portarretrato, **foto** generada |

Cada escena suma además una pequeña cantidad de amistad (8 por escena personal, 4 por mapache en las de los tres) y, si cruza un nivel, muestra la escena de subida de nivel de siempre.

## Recuerdos de Akio sin adelantar nada
Las escenas que lo evocan tienen condiciones propias: solo hablan de él **cuando la jugadora ya conoce su nombre** (Ume, cap. 1) o **su cuaderno de recetas** (cap. 4), y sólo con costumbres cotidianas (el plato de más, el té, el ritmo del cuchillo, los martes). Ninguna menciona adónde fue, su salud, la Ciudad del Puerto, las estrellas escondidas ni la constelación. La única que usa lo revelado al final (*Una postal para el faro*) exige haber terminado la historia. Un test lo vigila (`src/tests/bonds.test.ts`).

## Epílogo y dedicatoria
Se revisaron antes de tocarlos.
- **Corregido:** la carta de la cena mostraba literalmente `{name}` (el texto se pone en el DOM sin pasar por el reemplazo de nombre). Ahora lo reemplaza. El texto de la carta **no se cambió**, ni la firma «Con amor, Santi.»; ese texto es personal y lo conviene escribir quien lo firma.
- **Mejorado:** la carta también se puede cerrar con Enter, Espacio o Escape (antes solo con un toque), y se anuncia como diálogo.
- **Ampliado:** tras la cena, al hablar con Pip en el restaurante hay una escena opcional, *El álbum de la cena* (`epilogueAlbum` en `story.ts`). Repasa **lo que la jugadora vivió** (la última página de cada mapache y las de los tres), o deja una línea abierta si no hay nada. Da el Cuadro: la cena y un recuerdo. No exige haber completado los vínculos.
- Se conservan la cena (`sofi_dinner`), su receta, el rincón de estrellas y la misión «Una cena especial».

## Garantías de guardado
- Un solo indicador por escena: `bond_<id>` = día en que se vivió. Se escribe **después de la última línea** y en el mismo bloque síncrono que todos los premios (recuerdo, mueble, receta, objetos, monedas, foto, amistad). Una escena cerrada o con error a mitad **no da nada y se puede repetir**; una completa **no paga dos veces** (`grantBond` comprueba el indicador).
- El recuerdo entra como `memory_bond_<id>` (aparece en *Recuerdos* y en la colección). Las fotos generadas se agregan al álbum existente (tope de 60, sin cambiar la estadística de fotos que usan los proyectos).
- *Recordar* en el panel **Vínculos** repite la escena sin premios.
- Solo se usan indicadores (`flags`), recetas, muebles, objetos y fotos existentes: **no cambia el formato de guardado ni el validador**; las partidas avanzadas simplemente ven escenas disponibles cuando cumplen las condiciones. Los eventos principales (ocho capítulos, tres estrellas, faro, misterio, misiones previas) no se tocaron y tienen prioridad: una escena de vínculo solo arranca si no hay una escena de historia pendiente con ese personaje.
- Las escenas se juegan con el sistema de diálogo habitual (`runScene`), que pausa el reloj y lo reanuda al terminar: el personaje se queda donde está y sigue su rutina. No se cambió el reloj, la iluminación, los horarios ni la música.

## Dónde verlas
- Hablar con Pip, Spicy o Rigg cuando se cumple lo que piden. Un puntito rojo aparece en el ícono **Amigos** del NoriPhone mientras haya una escena lista.
- **Diario → Amigos → Vínculos** (y desde el NoriPhone, ícono Amigos) lista todas, qué pide cada una y permite recordarlas.

## Archivos
- Nuevos: `src/story/bonds.ts` (datos y motor), `src/ui/bonds.ts` (panel), `src/tests/bonds.test.ts`, este documento.
- Modificados: `src/dialogue/talk.ts` (gancho en la conversación), `src/story/story.ts` (carta y *El álbum de la cena*), `src/ui/menus.ts` (botón Vínculos), `src/ui/phone/prefs.ts` y `phone.ts` (puntito), `src/data/furniture.ts` (13 decoraciones, sólo premios), `src/data/recipes.ts` (3 recetas), `src/tests/progression.test.ts` (dos pruebas que quedaron desactualizadas por el ascenso manual y los materiales del punto 5).

## Cómo probarlo
1. Partida tras el prólogo y el primer capítulo. Dar a Pip amistad 1 y armar el banco del claro; hablarle: *La siesta del claro*. Mirar el recuerdo, el almohadón, la receta y la amistad.
2. Esperar una noche de lluvia con el recuerdo de la tormenta de Pip: *La noche de la manta*.
3. Guardar 2 fotos y llegar a amistad 3: *La foto torcida* agrega una foto al álbum.
4. Construir los rincones (Restaurante → Mejoras) y hablar con cada uno.
5. Terminar la historia y la cena; hablar con Pip en el restaurante: *El álbum de la cena*.
6. Guardar, recargar y abrir **Vínculos**: lo vivido figura como hecho y no se repite.

## Límites
Hecho con pruebas unitarias mínimas y una pasada real en el navegador de dos escenas y del epílogo (con partidas controladas). No se recorrieron las 20 escenas a mano ni se probó en un celular real. Los textos están escritos para leerse rápido; conviene que los lea alguien que conozca a la jugadora antes de publicarlos.
