# Vida del pueblo y recepción de Midnight Maki

Los vecinos conservan su posición al cambiar de mapa. Cuando cambia su horario,
caminan hacia una puerta, aparecen en la salida correspondiente del mapa vecino
y siguen hasta su destino. Bento, por ejemplo, sale de la panadería a la plaza
antes de entrar al restaurante. Los vecinos que se van a dormir recorren primero
el camino a su lugar de descanso.

Pip atiende la recepción durante el horario público: se acerca a los visitantes,
los saluda, indica dónde esperar cuando no hay mesas y los acompaña hasta una
mesa adecuada para el tamaño del grupo. Las sillas se ocupan al terminar el
recorrido; las mesas se liberan cuando el grupo sale por la puerta. Tomar el
pedido, cocinar, llevar el plato y recoger la propina siguen siendo acciones
del jugador.

Los visitantes usan el mismo aspecto en todo su viaje. Llegan desde el camino
sur de la plaza mientras la estación está clausurada; una vez desbloqueada,
recorren estación → plaza → restaurante. Al salir hacen el camino de regreso.
Los recorridos y las comidas ya entregadas continúan mientras Sofi visita otro
mapa. Al cerrar, los grupos que aún no pidieron se retiran y los que ya tienen
pedido pueden terminar su comida.

Las conversaciones espontáneas tienen tres intervenciones alternadas, con
encuentros escritos para amigos y respuestas relacionadas con el oficio de
cada vecino. También hay variantes para lluvia y festivales. Los personajes
se acercan, se miran y descansan entre charlas. Las conversaciones se pausan
con los menús y se cancelan al cambiar de mapa o al hablarles directamente.

## Organización y límites

- `src/systems/journeys.ts`: recorrido continuo por grillas y puertas, sin Phaser.
- `src/systems/townLife.ts`: posiciones y destinos de los vecinos, grillas en caché.
- `src/dialogue/ambient.ts`: intercambios y contexto de las conversaciones.
- `src/restaurant/floor.ts`: modo físico que espera la recepción, la decisión
  de Pip y la llegada real a sillas y salida. El modo temporizado sigue disponible
  para pruebas y otros consumidores.
- `src/scenes/WorldScene.ts`: coordinación de visitantes, recepción, charlas y
  representación de las posiciones en el mapa visible.

Los recorridos son memoria de la sesión: se conservan entre mapas, pero se
reconstruyen según el horario al cargar una partida o avanzar al día siguiente.
Las ubicaciones forzadas por la historia tienen prioridad. Los movimientos
escritos de las escenas siguen funcionando mientras el reloj está pausado.
No se agrega un servicio de trenes a la estación abandonada.

## Verificación

Las pruebas de lógica cubren rutas entre interiores, salidas precisas, sueño,
posiciones recordadas, todos los cambios de período sobre los mapas con su
mobiliario inicial, obstáculos, escenas, conversaciones y recepción con fila.
Las pruebas de navegador en `e2e/town-life.spec.ts` siguen un visitante de ida
y vuelta, acompañan a Bento fuera de la panadería y comprueban los turnos y la
pausa de una conversación.
