# Informe final del plan maestro (etapas 1–8 y 10; la 9 queda pendiente)

## Qué se hizo
1. **Restaurante legible:** la mesa no se transparenta por comensales sentados; ! amarillo sobre cada cliente que espera pedir; flecha de entrega prioritaria con el nombre de la mesa. Sprites de cliente sentado de frente y de espaldas.
2. **Compras y despensa:** paquetes y cajas, despensa con capacidad, cocinar usa primero la despensa; app Suministros. (`docs/suministros.md`)
3. **Personal:** mozo/cocinero/cajero/ayudante contratables con sueldos y entrenamiento; Pip recibe (más lento), Rigg toma pedidos, lleva platos de la bandeja y cobra propinas, Spicy cocina (34 s por plato al inicio); todo mejorable. App Personal. (`docs/personal.md`)
4. **Mapas:** torii, farolas, bancos, plaza, casas de costado, orilla del mar corregida, luz continua entre momentos del día. (`docs/roadmap-mapa.md`, `docs/iluminacion.md`)
5. **NoriPhone:** apps Suministros, Personal y Clientes, paginado de 12 por pantalla. (`docs/roadmap-noriphone.md`)
6. **Cocina nueva:** sesión de varios pedidos, plancha en segundo plano, bandeja de 6, deshacer, tacho, cuchillo y trapo, modo difícil con reloj. (`docs/plan-cocina.md`)
7. **Pueblo vivo:** doce vecinos con personalidad, días planificados, amigos, bancos, mar, lluvia y noche, bicicletas. (`docs/pueblo-vivo.md`)
8. **Clientes del pueblo:** los vecinos vienen al restaurante, se los invita charlando, visitas planificadas, habituales con memoria de platos y esperas, demanda dinámica, libreta en el teléfono. (`docs/clientes-del-pueblo.md`)
9. **Nube (Firebase):** **no se hizo.** Pendiente por decisión; no hay credenciales ni proyecto creados.
10. **Balance:** informe actualizado en `docs/balance-economy.md` (script `scripts/staff-economy.ts`).

## Verificación (qué se corrió de verdad)
- `tsc --noEmit` y `vite build`: sin errores.
- Vitest: **353 tests, 47 archivos, todos verdes** (incluye un test de que un guardado viejo sin `pantry`/`staff`/`clients` carga y funciona).
- Playwright en Chromium headless: **43 de 58 pasan** con los tests actuales. Las 15 fallas, comparadas contra commits anteriores:
  - Ya fallaban antes de mi trabajo (`461a503`): boot ×2, business-hours ×2, light ×2 (reduced motion/battery).
  - Fallan también justo antes de la etapa 8 (`0c4cbd9`): resilience ×2 (aborto de IndexedDB, importar), transitions "primer arribo fallido", water. Tocan guardado/transiciones/agua; no investigué la causa y no puedo atribuirla a una etapa concreta.
  - town-life "visitantes… Pip los recibe" falla también en `461a503` (el invitado queda en `waiting_food`).
  - Sin comparar contra baseline: intro-music ×3 y newgame (en el árbol actual con el arreglo de ranura).
  - Los e2e de intro y jornada completa estaban rotos solo porque el título ahora pide elegir ranura ("Partida 1"); lo corregí en los tests y pasan.
  - No se presenta como 58/58: la máquina es lenta y las corridas con dos workers daban timeouts de arranque.
- Verificación visual real (Playwright + capturas): torii/plaza, sentados, personal trabajando, panel de Clientes, vecino llegando y sentándose en el salón (`waiting_order`).

## No verificado / límites
- **Ningún teléfono real.** Todo es emulación de Chromium.
- Un vecino pidiendo, comiendo y pagando en el juego real **no se vio** (cubierto por tests unitarios de la memoria de habituales).
- Charla de invitación en pantalla no vista (lógica testeada).
- Vecinos sentados usan los sprites normales de personaje, no los de frente/espalda de clientes.
- Sin limpieza de mesas; los vecinos solo vienen solos y piden un plato.
- Balance: modelo, no partida orgánica; sueldos muy bajos frente al margen (ver doc).
- Arte PNG de cocina: falta que se envíen las imágenes (`docs/cocina-assets.md`).
- Ramas de GitHub a borrar por el usuario: `main`, `menu-principal`, `feat/rutinas-vivas`.

## Segunda tanda (después del informe)
- **Carpintería de Ren** (madera y piedra a la venta), **menú de charla** (temas, Regalar, Más acciones, historial con cuaderno), **vida de los personajes** (gestos, frases según lo que hacen y ven) — ver `docs/suministros.md`, `docs/charla.md`, `docs/pueblo-vivo.md`.
- **Casas y locales** (`docs/fachadas.md`): casas rehechas, locales abiertos/cerrados, decoración por oficio, ventanas y puertas iluminadas de noche.
- **Mapa** (`docs/mapa-referencia.md`): el mapa del menú es la ilustración; el costado este de Villa Nori se rehízo siguiendo la imagen. Las demás regiones siguen siendo mapas separados.
- Verificación: typecheck, build y 410 tests unitarios verdes. Capturas del juego real de las casas de noche, los locales cerrados, las decoraciones y la nueva Villa Nori. e2e de Playwright: no se volvió a correr la suite completa tras estos cambios.
