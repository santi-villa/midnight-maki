# Etapa 4 — Persianas, narrador y clientes

- Persianas metálicas procedurales con listones sobre las entradas de Midnight Maki, Bento, Taro, Yuki y la biblioteca. Se reutiliza la geometría exacta de cada fachada, incluidas las cuatro etapas del restaurante y su alternativa sin atlas.
- La persiana queda recogida mientras hay atención, a medias durante preparación/cierre y baja por completo al cerrar. Se anima recortando el dibujo durante 450 ms, sin estirar los listones. Movimiento reducido y efectos bajos aplican el cambio inmediatamente. Cada cambio cancela la animación anterior y destruir la fachada cancela la pendiente.
- Reemplaza las placas flotantes en esas fachadas; los puestos sin edificio conservan su indicador. Los horarios, permisos, excepciones narrativas y Mercado Nocturno siguen saliendo de `shopGate`/`restaurantPhase`. No se cambian colisiones ni puertas. La interacción conserva los horarios completos.
- El narrador usa una pluma y una luna creciente, dibujadas con `PixBuf` sobre fondo nocturno. Para sustituirlo por un PNG, importar su URL y asignarla a `NARRATOR_PORTRAIT_IMAGE` en `src/art/narratorPortrait.ts`; el diálogo no necesita cambios.
- Tres apariencias nuevas (gata, conejo y nutria) distribuidas entre clientes genéricos existentes; se conservan las ocho originales y todos los identificadores de pedidos/guardados. Pelo y paletas de ropa deterministas por identidad, sin personajes distintos en cada visita. Los clientes originales con nombre mantienen su ropa habitual.
- Decisión artística: piloto mostaza con bolsillos y capucha plegada, en lugar de paraguas. Se coloca al llover en exteriores y se retira dentro del local; no aumenta el tamaño ni tapa otras cabezas. Se conservan los 28×40 píxeles, los 30 cuadros comunes de Actor y los 17 adicionales para sentarse/comer.
- Se corrige la caché de retratos de clientes: antes compartían una sola clave. Ahora distingue especie e identidad y refleja el aspecto utilizado en el mundo.

## Compatibilidad

No hay campos nuevos en la partida, recursos cobrados ni dependencias agregadas. Las apariencias derivan de IDs existentes, y las persianas son únicamente visuales. Sin cambios en el reloj, iluminación, música, historia ni protocolo online.

## Verificación

- `npx tsc --noEmit`: aprobado.
- 6 casos unitarios puntuales: `customers.test.ts`, `speakerFace.test.ts`, `shopArt.test.ts`; especies anteriores/nuevas, poses, ropa determinista, pilotos, resolución de retratos, niveles de persiana y dibujo del narrador.
- 4 casos Playwright: `e2e/shops.spec.ts` (tres) y `e2e/shop-art.spec.ts` (uno). Se actualizó la prueba anterior de placas para exigir persianas y respetar los horarios actuales distintos, sin borrar sus comprobaciones de servicio.
- Comprueban apertura/preparación/cierre, animación intermedia, movimiento reducido, ausencia de placas en fachadas, puertas y compras rechazadas fuera de hora, callbacks de compra/venta, excepciones de cierre forzado, los 47 cuadros, cambio de piloto exterior/interior y retratos distintos.
- Capturas inspeccionadas en `docs/art/arte/etapa-4/`: persiana abierta/a medias/cerrada, clientes con tiempo seco/lluvia y narrador. Chromium headless, 1280×800, `/?debug`, `window.mmDebug`, `perf: 'high'`. Para comparar los aspectos se colocaron clientes mediante objetos Journey reales desde debug, sin esperar llegadas aleatorias. No se probó en teléfono físico ni una sesión multijugador real. Sin errores de página en los casos visuales nuevos.
- No se ejecutó la suite completa.

## Archivos

`src/art/shopShutter.ts`, `narratorPortrait.ts`, `customers.ts`, `customerSheet.ts`, `src/dialogue/speakerFace.ts`, `src/restaurant/customers.ts`, `src/scenes/WorldScene.ts`, `textures.ts`; pruebas y capturas citadas arriba.

Las etapas 3 y 4 quedan entregadas. Siguen aparte los arreglos de etapa 0 que se habían pospuesto; esta entrega no los considera completados.
