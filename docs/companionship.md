# Punto 3 — Convivencia con Pip, Spicy y Rigg

Entrega posterior a identidad (2) y experiencia móvil (6). La auditoría formal (1) continúa aplazada. Reutiliza NPC, recorridos, poses, amistad, diálogo, minijuego de memoria, cámara y álbum existentes.

## Qué cambia

- Pip espera a un costado de la entrada, con dos destinos alternativos. La recepción y el acompañamiento de clientes tienen prioridad sobre su descanso; liberar ese trabajo inicia inmediatamente el regreso caminando.
- Spicy trabaja junto a la cocina, sin ocupar la interacción de preparación. Rigg lee y organiza junto al mostrador. Cada puesto dispone de alternativas, reserva temporal del destino y comprobación de colisiones y accesibilidad. Se evitan puertas, sus accesos, interacciones y el eje de entrada del restaurante; también los tiles ocupados por Sofi, visitantes y otros vecinos.
- Pausas escalonadas durante la tarde: Pip descansa, Spicy toma té y Rigg lee en los taburetes existentes. Al cerrar a las 23:00 caminan a sus habitaciones. Rigg lee un rato antes de dormir. El reloj, su velocidad y la iluminación conservan su funcionamiento.
- Las escenas y el encuentro/tutorial del primer día conservan sus posiciones. Las conversaciones y movimientos de escena reservan al NPC; al terminar, los mapaches desplazados retoman su ruta. Cambiar de día conserva la posición simulada, en lugar de recrearlos en el destino.
- Pequeñas actividades espontáneas diferenciadas: Pip juega/ordena y encuentra tesoros; Spicy cocina/ordena/toma una pausa; Rigg lee/anota/acomoda libros. Reutilizan las animaciones actuales y no repiten inmediatamente la misma ocurrencia. Dormir espontáneamente queda limitado a casa. Las actividades nuevas se suspenden durante menús, escenas y pausas.
- Nuevos intercambios cortos entre mapaches, con humor y ternura, usando las conversaciones ambientales por turnos. Spicy también puede charlar brevemente después del prólogo y regresar a la cocina. Una decoración puede provocar una reacción breve del mapache visible más cercano, como máximo una por personaje/día, sin ventana obligatoria ni premio automático.

## Cómo probarlo jugando

1. Continuar una partida después del prólogo y visitar el restaurante entre las 08:00 y las 23:00. Observar puestos, clientes y regreso de Pip. Las pausas se ven durante la tarde; al cierre se dirigen a casa.
2. Acercarse a un mapache libre. **Hablar** sigue disponible para conversaciones y misiones; **Compañía** aparece como otra acción, o dentro de **Más** si hay una estación más cercana.
3. Elegir **Acariciar**, **Compartir merienda**, **Sentarse juntos**, **Jugar** o **Foto juntos**. Las respuestas de caricias, merienda y descanso son propias de cada personaje. Para sentarse, Sofi camina hasta un tile libre cercano, con espacio entre sprites; si no hay lugar, avisa y devuelve el control.
4. La merienda consume una unidad de un alimento disponible. Repetir esa misma actividad con ese mapache en el mismo día conserva el rato juntos sin cobrar otro alimento. Cerrar el selector antes de elegir no consume nada.
5. La primera caricia o descanso del día por personaje aporta 2 de amistad; merienda o partida de memoria completada, 3. Repeticiones no vuelven a dar esos puntos. Memoria conserva sus premios anteriores y salir antes de terminar no cuenta como partida completada. No hay medidores de cuidados ni penalizaciones por ausencia.
6. El primer momento completado registra un recuerdo visible en el álbum existente. **Foto juntos** utiliza la cámara y las fotos del NoriPhone. Guardar, recargar y comprobar inventario, amistad, recuerdo y foto.

## Guardados y límites

Solo se agregan claves en `flags` y contadores en `stats`, compatibles con el formato y validador actuales. Cada actividad usa una clave fija con el último día premiado: no se acumulan claves diarias indefinidamente. Los estados de rutas y reservas son temporales. No se reemplazan monedas, inventario, muebles, misiones, capítulos ni recetas y no hace falta cambiar la versión de guardado.

Los rincones nuevos, sus reformas y las misiones personales extensas corresponden a los puntos 5 y 7. Esta entrega utiliza taburetes y habitaciones actuales; no crea habitaciones, sprites nuevos ni un simulador de mascotas.

## Archivos

- Puestos y rutas: `src/data/characters.ts`, `src/data/raccoons.ts`, `src/systems/npcs.ts`, `src/systems/townLife.ts`, `src/systems/journeys.ts`, `src/scenes/WorldScene.ts`.
- Convivencia y presentación: `src/systems/companionship.ts`, `src/story/companions.ts`, `src/story/quirks.ts`, `src/dialogue/ambient.ts`, `src/world/contextActions.ts`, `src/ui/skin.ts`.
- Cancelación de tareas asíncronas al cerrar Memoria: `src/minigames/casual.ts`.
- Documentación y capturas: este documento, `docs/roadmap-gameplay.md`, `docs/art/convivencia/`.

## Verificación de esta entrega

- `npm run typecheck` y `npm run build`: correctos. Vite mantiene avisos de módulos importados estática/dinámicamente; no impiden generar la aplicación.
- Comprobaciones puntuales en Chromium, con partidas controladas, a 1366×768 y 390×844: acciones desde el HUD/Más, botones de unos 60 px, caricias, respuestas alternadas, límite de amistad diario, una sola merienda, repetición y cancelación, paseo y pose al sentarse, apertura y cancelación de Memoria durante una tarea pendiente, foto y guardado/carga real en IndexedDB. Sin errores de página ni reportes del manejador global en las comprobaciones finalizadas.
- Comprobación adicional de la versión compilada en móvil emulado: continuar una partida guardada desde la portada y completar Memoria desde Compañía; se registran la partida y la actividad, se libera la pausa y no aparecen errores. Cerrar la escena mientras Sofi camina a sentarse también libera controles y pausa sin registrar la actividad.
- Simulación puntual con los mapas reales: puestos primarios ocupados y alternativos accesibles, pausas de los tres, trabajo y regreso inmediato de Pip, recuperación tras desplazamiento/conversación, lluvia, prioridad de posiciones narrativas, tutorial, regreso nocturno por puertas y conservación de posición al cambiar de día. Validación del guardado con metadatos nuevos y actividad al día siguiente.
- Comprobación del servicio real en la escena: recepción, acompañamiento y asiento de visitantes, exclusión de Compañía mientras Pip atiende, regreso al puesto, pausa congelada y reubicación de Rigg cuando un mueble de la partida controlada ocupa su puesto. Auditoría interna del servicio sin incidencias. Pose y elevación de Spicy sincronizadas durante la pausa de té. Comprobada una charla natural de Spicy y Rigg durante el descanso: turnos sin globos simultáneos, pausa congelada y regreso de Spicy a cocinar.

Las capturas pertenecen a partidas controladas de desarrollo. No equivalen a pruebas en celular físico, PWA instalada o APK. Las suites unitarias y E2E completas quedan para el punto 8, por pedido del usuario; también quedan sesiones prolongadas y la revisión narrativa completa.

Siguiente entrega recomendada: **punto 4, restaurante**, comenzando por identidad de clientes, grupos y pedidos individuales antes de transporte de platos y bebidas. Luego puntos 5, 7 y 8; punto 1 aplazado.
