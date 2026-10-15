# Villa Nori: distribución y primera muestra jugable

> Registro de la primera muestra. La continuación autorizada por el usuario se documenta en [Distribución completa de exteriores](villa-nori-exteriores.md), con las ubicaciones y verificaciones actuales. Los pendientes y capturas de este documento corresponden a la entrega inicial.

## Dirección

Tomar de la referencia la separación por necesidades, la identidad de los barrios y las conexiones por naturaleza. El objetivo es que un paseo tenga destinos reconocibles y que ir a comprar ingredientes siga siendo cómodo.

Esta entrega es una **primera muestra integrada**, no la sustitución completa de todos los escenarios. No se agregó un menú de demostración ni una copia del pueblo: la muestra se recorre en la Villa Nori de la partida habitual.

[Plano propuesto de sectores](art/villa-nori-muestra/plano-general.svg).

Imágenes de revisión:

- [Kit de fachadas y cuatro etapas de Midnight Maki](art/villa-nori-muestra/kit-fachadas.png).
- [Villa Nori completa con la muestra integrada](art/villa-nori-muestra/villa-nori-completa.png): exportación del escenario, de día y sin HUD/personajes. No representa un rediseño completo del pueblo.
- [Plano general por sectores](art/villa-nori-muestra/plano-general.png): propuesta orientativa, no mapa transitable ni posiciones definitivas.
- [Restaurante en PC](art/villa-nori-muestra/restaurante-pc.png), [Bento en vertical](art/villa-nori-muestra/bento-movil.png) y [muelle en vertical](art/villa-nori-muestra/muelle-movil.png).

## Ubicación de todo el contenido

| Sector | Contenido existente que debe alojar | Conexión y prioridad |
| --- | --- | --- |
| Midnight Maki y hogar | Cocina y parrilla, pedidos, bandeja, bebidas, mesas, clientes individuales/grupos, personal, renovaciones, dominio y recetas; habitaciones y rincones de Sofi/Pip/Spicy/Rigg; depósito y hallazgos | Restaurante como referencia visual. Compras cotidianas a pocos segundos. Primera muestra: fachada en cuatro etapas. |
| Paseo comercial | Bento, Taro, Yuki; ingredientes, suministros, semillas, regalos, ropa y muebles | Recorrido corto Bento–Taro, unido a plaza y ribera. Primera muestra: Bento y Taro; Yuki conserva su edificio actual. |
| Centro cívico | Fuente, biblioteca, cartelera, encargos, proyectos, eventos, correspondencia y encuentros | Plaza más pequeña y bordes verdes. Se mantienen todos los puntos de interacción. |
| Barrio residencial | Dieciséis interiores de casas existentes repartidos entre pueblo/costa/jardín; patios y rutinas de los vecinos | Conservar identidad de cada casa y acceso a visitas/amistades. Etapa posterior de fachadas y patios. |
| Ribera | Cruces, cerezos, bancos, pesca y paseos | Primera muestra de borde de piedra y puente; conectar con jardín y paseo comercial. |
| Jardín | Cultivos, parcelas adicionales de proyectos, semillas, estanque, casa de té, florería y actividades de jardinería | Mantener crecimiento, riego, cosechas y llave de acceso. Ampliación visual posterior. |
| Puerto y playa | Muelle, Nami y puestos, peces de mar, conchas, botellas, cabañas de la cala y proyectos costeros | Primera muestra de muelle y redes en el puerto del pueblo. Costa y barcos más variados, después. |
| Bosque | Recolección, bichos, lago, puente, cabaña, santuario y proyectos/actividades del claro | Exploración con destinos y descansos; respetar sus bloqueos y hallazgos narrativos. |
| Santuario y Mercado Nocturno | Colina, torii, puestos y actividades nocturnas | Llegada diferenciada; conservar acceso y horario del mercado. Desniveles y acantilados, en otra entrega. |
| Estación | Edificio ferroviario, patio, depósito exterior y escenas | Conservar llave, camino y objetivos de la historia. |
| Faro | Mecanismo, tres estrellas, pistas y final | Mantener condiciones de acceso y revelaciones. Sin cambio narrativo en la muestra. |

Misiones, historia, amistad, cámara, álbumes, colecciones, NoriPhone y personal atraviesan estos sectores; no se crean interfaces duplicadas para cada barrio.

## Qué cambió en la muestra

- **Midnight Maki:** fachada original nueva de dos niveles, madera y revoque, tejas con juntas, buhardilla, entrada remetida, noren y faroles. Se conservan las cuatro etapas: desgaste inicial; reparación/maceteros; detalles de balcón; remate de estrellas.
- **Bento:** tejado de terracota con chimenea, vidriera con panes, toldo, madera y acceso visible a la izquierda.
- **Taro:** tejas verdes, ventanas y toldo, cajones de productos y acceso visible a la derecha.
- **Centro/paseo:** se reduce la gran explanada de adoquines a una plaza más contenida, con bordes verdes; un paseo de dos tiles une Bento y Taro y un acceso de piedra conduce al cruce del río.
- **Ribera/muelle:** kit modular de madera con tablones, juntas, fijaciones y postes; borde bajo de piedra con musgo; red y cuerda en tierra. Se reutilizan los caminos transitables y la pesca existentes.

El arte se genera mediante el renderer pixel art del juego, a resolución nativa. Los PNG de revisión son exportaciones de esos mismos gráficos. No hay una imagen estática sustituyendo colisiones o escenarios.

## Escala, accesos y guardados

Se mantienen los destinos y las coordenadas actuales: Midnight Maki (5,6), Bento (5,18), Taro (27,18). Sus puertas dibujadas y umbrales coinciden con esos tiles. Los interiores, salidas, horarios y vendedores son los existentes.

Las huellas sólidas de los tres edificios se mantienen. Los tejados ganan altura visual, no colisiones invisibles. Los suelos nuevos se dibujan bajo los personajes, no producen sombras verticales ni hacen transparente el muelle cuando Sofi lo pisa. No cambian el terreno transitable o el agua.

No se modifica el esquema del guardado: no hay que trasladar objetos, muebles, personajes o pedidos almacenados. Los accesos bloqueados por historia siguen bloqueados. No se cambia el reloj, el cálculo de iluminación, estaciones, diálogos, canciones ni economía. Las máscaras de ventanas de las fachadas nuevas usan las coordenadas del dibujo y el comportamiento de luz vigente.

Para una redistribución posterior más grande, los IDs actuales de casas deben conservarse aunque se trasladen: hoy varios contienen coordenadas. Antes de mover puertas habrá que centralizar direcciones y migrar posiciones antiguas, y revisar objetivos, horarios, proyectos y rutas. No se debe regenerar el ID de una casa solo porque cambió su ubicación.

## Orden siguiente

1. Revisar esta muestra a escala de Sofi y elegir ajustes de estilo o proporciones.
2. Extender la familia visual a Yuki, biblioteca y una casa residencial; trabajar patios y perfiles de tejado.
3. Redistribuir los sectores que lo necesiten mediante direcciones compartidas y migraciones, conservando trayectos cotidianos cortos. Medir viajes de compras antes de alargar el mapa.
4. Extender costa, barcos, puentes, vegetación y desniveles; conservar la carga por zonas para móvil.
5. Revisar todos los vecinos, clientes, accesos de historia, escenas y rendimiento de una sesión completa.

No se implementan automáticamente los siguientes sectores: primero corresponde revisar la muestra.

## Archivos

- src/art/village.ts: kit original de fachadas, tablones, piedra y redes.
- src/art/objects.ts: registro y selección del dibujo de las fachadas.
- src/data/props.ts: dimensiones, variantes y marca de suelo.
- src/data/plazaMap.ts: paseo, plaza, fachadas, cruce, borde del río y muelle.
- src/scenes/WorldScene.ts: orden y oclusión de piezas de suelo, sin cambiar controles o lógica de iluminación.
- src/scenes/textures.ts: máscara de ventanas según la fachada nueva.
- src/tests/villageSample.test.ts: contratos de puertas, umbrales, muelles transitables y bloqueos.

## Verificación

Verificación del 15 de octubre de 2026:

- `npm run typecheck`: correcto.
- `npm run build`: correcto, 203 módulos. Vite conserva 19 avisos sobre módulos importados tanto estática como dinámicamente; no bloquean el build.
- `npx vitest run src/tests/zones.test.ts src/tests/villageSample.test.ts`: 2 archivos, **28 casos correctos**. Puertas y umbrales, accesibilidad de todas las zonas, muelles transitables, orillas sin colisiones y salidas narrativas bloqueadas. No se ejecuta la suite completa pospuesta por el usuario.
- Chromium con Playwright en **1366×768** y **390×844**, este último con emulación táctil: salida del restaurante, entrada/salida de Bento y Taro, menús originales, compra real de Tamagoyaki, caminata por el cruce y hasta la pesca del muelle. Se comprobó movimiento con teclado y con joystick táctil emulado, además de rutas del personaje.
- En ambas resoluciones, el personaje se dibuja encima de las dos piezas del muelle; el suelo no oculta personajes ni se trata como fachada. Sin errores globales/promesas registradas y sin bloqueos de controles al cerrar menús.
- Guardado en IndexedDB, recarga y botón Continuar: se conservan el artículo comprado, monedas y posición de pesca (35,40).
- Repetición en `vite preview` con los archivos del build, en las dos resoluciones: Continuar desde un guardado, caminatas frente a las tres fachadas, cruce del río y llegada al muelle. Sin errores registrados, con el personaje visible encima del muelle y el tiempo sin quedar pausado. Las capturas de PC/vertical enlazadas arriba corresponden a esta versión compilada.
- Captura nocturna en Taro para revisar la máscara de sus ventanas. Se exportaron las 30 zonas sin errores de navegador; no equivale a recorrer todas sus actividades.

Límites: móvil emulado, sin prueba en teléfono físico ni medición de rendimiento en hardware móvil. No se verificó toda la historia, cada variante decorativa ni toda la suite E2E. Casas, otros barrios y negocios pendientes mantienen su arte actual. Este plano es una propuesta de distribución, no una afirmación de que todos los barrios ya fueron rediseñados.
