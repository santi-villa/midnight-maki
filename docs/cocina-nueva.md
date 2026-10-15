# Cocina nueva (rediseño del minijuego)

El minijuego se rehízo desde cero en `src/kitchen/`. Dos espacios:

**A. Estación de cocción (pestaña Plancha)** — plancha/sartén para lo que lo necesita (huevo, camarón, anguila) y la **olla de arroz por tanda**: el arroz de hasta 4 platos se cocina junto, con una sola barra (cruda → en su punto → pasada → quemada). Cada plato que lleva arroz espera su porción; mientras se cocina se puede seguir con el alga u otros platos. Solo las recetas que lo necesitan generan piezas para cocinar, y **todo lo que se cocina va antes de la mesa** (se corrigió `recipes.ts`: antes había recetas que pedían cocinar después de enrollar). Un test lo vigila.

**B. Tablero de preparación** (`board.ts`) — una sola mesa continua, vista desde arriba con leve inclinación, sin cambiar de pantalla:

| Paso | Cómo se juega |
|---|---|
| Alga | se arrastra al esterilla |
| Arroz | se arrastra el bollo al alga y se **frota** (de lado a lado o en círculos) con una máscara de cobertura (`rice.ts`); se apunta a 80–92 %; queda un borde de alga |
| Uramaki | se da vuelta el alga y el arroz queda por fuera |
| Relleno | se arrastra cada ingrediente donde se quiera; cae con variación natural y se puede sacar o tirar |
| Enrollar | arrastre **lento y real** hacia arriba (`roll.ts`): quieto no avanza, a toda velocidad avanza poco; bandas distintas para mouse y dedo; la esterilla se curva; al final se mantiene apretado para compactar |
| Cortar | cuchillo hacia abajo sobre marcas sutiles, primero el medio; cada corte progresa de verdad y las piezas se separan y se ponen de pie mostrando el interior (`cut.ts`) |
| Nigiri / gunkan / onigiri | láminas de pescado, bolitas moldeadas manteniendo apretado, cobertura y alga arrastradas pieza por pieza |
| Temaki | arrastre diagonal para armar el cono |
| Emplatar | cada pieza se lleva al plato; el plato corrige solapes (`plating.ts`); detalles opcionales (wasabi, jengibre y la variante de la receta) |

Modos relajado / normal / desafío intactos (`judgeCook`, siempre se puede terminar; el reloj solo cuenta en desafío). **Emplatado rápido** disponible solo en platos dominados (3★). Cancelar devuelve los ingredientes (hooks de `kitchen.ts` sin cambios). Guardados, pedidos, calidad 0|1|2, maestría, economía: sin cambios (no hay campos nuevos en el save).

## Cómo se probó
- `src/tests/kitchenPure.test.ts`: arroz, enrollado, corte, emplatado y orden de pasos de todas las recetas.
- Con el navegador y gestos reales (mouse y táctil, horizontal y vertical): kappa, california (uramaki), nigiri, tamago (con plancha real), onigiri, temaki, gunkan, three_stars, rainbow, dragon, moonlight, veggie_roll, crunchy; y dentro de la cocina real (sesión con pestañas) con la olla de arroz y los tres modos.
- `e2e/newgame.spec.ts` reescrito para el tablero nuevo (nueva partida → primer sushi → guardar → continuar).

## Cambios respecto a antes
Se quitó el cuchillo que se ensucia/trapo y la bandeja de 6 compartimientos (la repisa de arriba la reemplaza). No probado en dispositivo físico.
