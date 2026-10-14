# Plan: nueva cocina (estaciones en paralelo, modo difícil, música y arte)

Estado: **plan, todavía sin código** (a la espera de tres respuestas, ver al final). Se conserva el contrato actual del minijuego: el resultado del plato sigue siendo 0 / 1 / 2 (`CookResult`), las funciones puras de `cookScore.ts`, el dominio de recetas (`mastery.ts`), la economía y los pedidos de historia.

## Qué cambia para quien juega
1. **Cocina con estaciones, no con pasos fijos.** En la parte de arriba hay pestañas (Alga · Cocinar · Arroz · Relleno · Corte · Servir). Se puede ir a cualquiera que ya esté disponible, en el orden que se quiera. Lo que se cocina sigue haciéndose solo mientras tanto, como en Papa's Pizzeria: el salmón en la plancha, el tamago en la sartén o la tempura en la freidora avisan con un globito en su pestaña ("70 %", "¡Listo!", "¡Se quema!") y con un sonido suave.
2. **Dependencias físicas, no órdenes.** No se puede rellenar antes de haber puesto arroz, ni cortar sin rollo. Lo demás (cocinar, preparar arroz, cortar verduras, dejar listos los platos) se puede adelantar. Pensar el orden pasa a ser parte del juego: lo que tarda, primero.
3. **Cocción con punto justo.** Cada ingrediente cocinado tiene tres zonas (falta · listo · quemado) y una barra visible. Se da vuelta con un toque (espátula), se retira con las pinzas o se baja el calor. Se puede dejar en la plancha, pero no esperar de más.
4. **Bandeja de ingredientes** de seis compartimientos, **"Sacar último"** y **tacho**: equivocarse no arruina el plato.
5. **Cuchillo sucio, algo simple.** Cada tantos cortes el cuchillo se llena de arroz pegado y corta peor. Un deslizamiento con el trapo lo limpia en un segundo. En Relajado casi no molesta; en Difícil es parte del ritmo.
6. **Tres dificultades** elegibles plato por plato (la etiqueta "Relajado" de la pantalla se puede tocar), con un valor por defecto en Ajustes:

| | Relajado | Normal | Difícil |
|---|---|---|---|
| Reloj | no hay | no hay (se puntúa la técnica) | sí, con tiempo por fase y lo que sobra pasa a la siguiente |
| Cocción | se "pasa" de punto sin quemarse (baja la calidad) | se quema si te olvidás mucho | se quema pronto y tiene racha |
| Deshacer / tacho | libres | libres | cada uso cuesta tiempo |
| Cuchillo | casi no se ensucia | se ensucia cada tanto | se ensucia seguido |
| Premio | el actual | el actual | más propina y experiencia, mejor tiempo guardado por receta |

La historia nunca exige Difícil.

## Cómo se arma por dentro
- El minijuego actual (`restaurant/cooking.ts`, ~1500 líneas) es una sola clase lineal con un índice de paso. Se separa en: **sesión de cocina** (estado compartido y reloj), **estaciones** (cada una con su lógica y su dibujo) y un **planificador de tareas en segundo plano** (cocciones). El resultado final sigue saliendo por la misma puerta.
- Cada estación reutiliza el código existente (arroz, relleno, enrollar, cortar, emplatar), así que el trabajo grande es el esqueleto y las estaciones nuevas (cocción), no reescribir todo.
- Lo nuevo y puro (qué punto tiene una cocción, cuánto ensucia un corte, cuánto tiempo da cada fase) va en `cookScore.ts`, con tests unitarios sin pantalla.
- Un pedido a la vez (ver pregunta 1). Pausas, menús y escenas congelan también las cocciones.
- Accesibilidad: avisos por sonido, vibración opcional y texto; todo funciona con toque y con mouse/teclado; sin parpadeos fuertes.

## Recetas con "Cocinar"
Propuesta (ver pregunta 2): cuatro recetas existentes ganan su estación de cocina y el resto no cambia.
- **Tamago**: tamagoyaki en sartén (en capas).
- **Ebi**: langostino a la plancha.
- **Dragon**: anguila glaseada a la plancha.
- **Crunchy**: tempura en freidora.
- Más una variante de salmón a la plancha para el Sake Maki y el Philadelphia, opcional: se agrega como "cocido" por encima de la receta cruda (mismo plato, otro nombre y precio).

## Música
Se quita `src/music/kitchen-minigame-music.mp3` (queda la música generada) y se escribe una nueva generada por código: ritmo de cuchillo y madera, bajo caminando, parte A y B, con una capa de urgencia en Difícil. El prompt para una canción hecha con Suno/Udio está en `docs/cocina-musica-prompt.md`. Las otras dos canciones (menú, introducción) pasan a ogg liviano para bajar los 12 MB que se descargan al abrir el juego.

## Arte
Fase 1: se mejora el dibujo por código (sombreado, contornos, granos de arroz, vapor, brillo de la plancha) para que la pantalla ya se vea mucho mejor. Fase 2: el motor carga PNG de `public/cocina/` y usa el dibujo por código si falta alguno; así se reemplaza pieza por pieza sin romper nada. La lista de piezas, tamaños y prompts está en `docs/cocina-assets.md`.

## Orden de trabajo
1. **Música:** quitar el mp3, escribir la canción nueva, comprimir los otros dos.
2. **Esqueleto:** sesión + estaciones + pestañas libres, con las estaciones actuales (sin cocción todavía) y los tres modos.
3. **Bandeja, deshacer y tacho.**
4. **Cocción en segundo plano** (plancha, sartén, freidora), avisos y las cuatro recetas.
5. **Cuchillo y trapo.**
6. **Modo difícil:** reloj por fase, racha, premios y mejor tiempo por receta.
7. **Arte:** primero por código; luego se enchufan los PNG que pases.
8. **Sonidos y pulido**, tests unitarios y una pasada en celular.

Cada etapa se prueba y se sube por separado. Si algo sale mal, se vuelve atrás sin perder el resto.

## Riesgos
- El archivo actual es grande y estaba pensado para ir paso a paso; separarlo es lo más delicado y lo que hace falta probar mejor.
- Más cosas en pantalla en un celular chico: las pestañas y la bandeja deben quedar a más de 44 px de toque.
- El balance: Difícil paga más, pero no debe ser obligatorio para progresar.

## Estado actual (lo que ya está en el juego)
- **Varios pedidos a la vez.** La cocina (`src/restaurant/kitchenSession.ts`) tiene pestañas *Pedidos · Mesa · Plancha*. Se pueden empezar hasta 4 platos y saltar entre ellos con las etiquetas de arriba; cada plato es su propio tablero y se congela (con su reloj) mientras no se mira. Al empezar un plato se consumen los ingredientes; al descartarlo o salir se devuelven. Salir con platos sin terminar pide un segundo toque.
- **Plancha en segundo plano** (`grill.ts` reglas puras, `grillView.ts` pantalla). Cuatro lugares; se toca un ingrediente de abajo y después un lugar libre; se cocina solo y avisa con globito en la pestaña, sonido y vibración. Zonas: falta · en su punto · pasado · quemado. Se quema, pero despacio (la barra completa tarda unos 40 s; en Relajado, 1,5 veces más). Un plato que llega a su paso "Cocinar" sin pieza lista espera y muestra cómo va; las anteriores (alga, arroz) se pueden adelantar.
- **Recetas con cocción:** Tamago (sartén), Ebi (langostino), Roll crocante (langostino), Dragon Roll (langostino antes de rellenar y anguila antes de decorar). Pieza cruda → punto justo da precisión; cruda o quemada cuenta como error.
- **Cocina libre** usa la misma cocina (un cliente sin reserva compra el plato). El flujo de escenas se muestra al cerrar la cocina.
- **Bandeja de seis compartimientos**, *Sacar último* (relleno/decoración) y *Tacho* (rehace arroz, relleno o decoración; cuenta un error).
- **Cuchillo que se ensucia** cada 3 cortes (4 con la mejora de cuchillo) mientras queden cortes por hacer: aparece el trapo, se arrastra sobre la mesa y listo.
- **Modo Difícil (con reloj)**: reloj real; terminar a tiempo sube el plato un nivel, pasarse lo limita a "muy bueno"; plato perfecto paga +25 % y se guarda el mejor tiempo por receta (`save.bestTimes`); suena `kitchen_hard`.
- **Arte:** `src/art/cookingSprites.ts` carga `public/cocina/<nombre>.png` si existe (hoy: `mesa`, `plancha`, `sarten-tamago`, `esterilla` ya enchufadas); si falta usa el dibujo por código.

## Falta
- Pasar el resto de las piezas de `docs/cocina-assets.md` y enchufarlas (tabla, bandeja, herramientas, interfaz).
- Freidora y variante de salmón a la plancha para el Sake Maki (opcional).
- Espátula, pinzas, sal y aceite en la plancha (dar vuelta para dorado parejo).
- Racha en Difícil y reloj por fase si se quiere más presión.
- Prueba en celular real (pestañas y bandeja a más de 44 px de toque).

## Preguntas que quedaron resueltas
1. Varios pedidos a la vez, ella decide cuáles y en qué orden; pone cada ingrediente.
2. Tamago, Ebi, Dragon y Crunchy llevan "Cocinar"; el salmón a la plancha es variante opcional.
3. En Relajado también se quema, pero tarda más.
