# Revisión online después de la etapa 0

## Resultado y alcance

El cooperativo de restaurante pasó las comprobaciones locales de dos pestañas: entrada, presencia y posiciones, clientes/pedidos, inicio y cancelación de cocina, consumo y devolución de ingredientes, bandeja, transporte y entrega de platos, salida, reingreso, desconexión al cerrar una pestaña y descanso compartido.

**No equivale a certificar Firebase en producción.** En el navegador de prueba se observó `configured: true`, base configurada, inicialización lista y `authenticated: false`. Sin dos cuentas autenticadas no se comprobó el acceso entre dos dispositivos a la base real ni las reglas que están publicadas. No se crearon cuentas ni se publicaron reglas. La prueba confirma que el transporte real pide ingresar a la cuenta en ese estado.

## Fallos reproducidos y corregidos

1. **Clima distinto durante la visita.** La prueba falló con anfitrión en `rain` e invitado en `clear`. El mundo inicial y las actualizaciones del salón no transmitían el clima. Ahora incluyen `weather?`, validado como `rain`/`clear`; el invitado lo aplica durante la visita y restaura su valor anterior al salir, incluso si originalmente no había bandera. Se mantienen protocolo 6 y guardados anteriores; ambos clientes actualizados reciben la mejora.
2. **Escenas personales disparadas en el restaurante ajeno.** La captura mostró la reunión de lluvia bloqueando al invitado. Entrar al mundo prestado ejecutaba `story.onEnterZone` de su propia partida. Ahora esa entrada narrativa se omite mientras `mirror.on`; la prueba exige que no aparezca diálogo ni bandera de reunión de lluvia. La llegada normal de una nueva partida se sigue recorriendo antes de cada prueba.
3. **Progreso personal por el día/nivel prestados.** Una prueba puntual reprodujo que una misión de «llegar al día dos» se completaba al prestar el día cinco del anfitrión. `quests.check()` ahora pausa la evaluación automática durante la visita. La prueba también comprueba que, de vuelta en la partida propia, la misión vuelve a avanzar normalmente. No se marcan misiones como completadas ni se cobra una recompensa al visitar.

El bloqueo de escritura del invitado ya existía y se conserva. Se verificó que intentar guardar durante la visita no modifica el guardado persistido y que al salir se recuperan decoración, estilos, nivel, hora, clima, misiones e historia previos.

## Pruebas mínimas

- 29 casos unitarios distintos aprobados en `coopSession.test.ts`, `coopLifecycle.test.ts`, `coopPresence.test.ts`, `coopServe.test.ts` y el nuevo `coopProgress.test.ts`. Después de las correcciones se repitieron solo los módulos modificados.
- Tres escenarios E2E aprobados: `coop-presence.spec.ts`, `coop-service.spec.ts` y `coop-sleep-night.spec.ts`. Cocina comprueba inicio/cancelación mediante la interfaz; la finalización del plato se envía por el mismo protocolo del minijuego y luego se recoge/entrega. No se automatizaron todos los cortes del minijuego.
- La prueba de cocina anterior asumía cuatro ingredientes fijos y un descuento fijo de arroz. Ahora abastece la receta que efectivamente pidió el cliente y verifica su consumo/reembolso, conservando las comprobaciones de entrega. El cierre de cocina se confirma con sus dos pulsaciones reales.
- La prueba de presencia utiliza también `?st`, el bucle de temporizador existente para pruebas de pestañas en segundo plano: sin él Chromium headless dejó de actualizar un salón a tiempo en una ejecución. No se cambia el bucle de producción ni se interpreta esto como prueba de suspensión en celulares.
- `npx tsc --noEmit` y `npm run build`: aprobados; Vite conserva avisos de módulos importados a la vez estática y dinámicamente.
- Capturas inspeccionadas en `docs/art/coop/etapa-0/`, con `/?debug&coop-local`, `window.mmDebug`, `perf: 'high'`. Dos pestañas del mismo contexto Chromium, viewport 1000×640; no dos dispositivos físicos. Sin errores de página en la prueba ampliada de presencia.

## Pendiente para validar internet real

Con dos cuentas ya existentes, entrar en el despliegue actualizado sin `coop-local`, abrir desde una y unirse con su código desde la otra. Comprobar pedidos/cocina/entrega, salida y reingreso. Después repetir al perder señal y volver, cambiar de aplicación y bloquear/desbloquear el celular. Verificar que la sala libera la plaza y conserva el progreso. Estas condiciones y la latencia móvil real siguen sin verificarse.

El anfitrión ejecuta la simulación en su navegador: no hay servidor que continúe el restaurante cuando su dispositivo queda suspendido. El cooperativo actual está centrado en el restaurante; no sincroniza toda la historia y el pueblo como un mundo persistente compartido. Miso y las demás mascotas decorativas siguen siendo locales, como se pidió.

## Archivos

`src/coop/index.ts`, `protocol.ts`, `serve.ts`, `src/restaurant/mirror.ts`, `src/quests/quests.ts`, `src/story/story.ts`; pruebas/capturas citadas arriba y actualización de `docs/coop.md`. Sin cambios de esquema de partida, reglas de Firebase ni dependencias.
