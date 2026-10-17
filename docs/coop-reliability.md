# Revisión del cooperativo

Sobre la versión de protocolo 6 se corrigieron cuatro fallos reproducidos con pruebas específicas:

1. Cancelar mientras se abría el transporte no invalidaba el resultado pendiente: la sala podía activarse después de salir.
2. El límite de tiempo rechazaba la promesa, pero no cerraba un transporte que finalmente se abriera más tarde.
3. El invitado podía permanecer indefinidamente en «Abriendo…» si el transporte se abría pero no llegaba el mundo del anfitrión.
4. Una notificación de posición ya encolada podía modificar una sesión cerrada o una visita posterior.

Cada intento tiene ahora una identidad; salir o finalizar lo invalida. Los transportes tardíos se cierran, los callbacks de transportes antiguos se ignoran y el intercambio inicial del invitado tiene un límite de 12 segundos desde que se abre el transporte. El panel permite cancelar también durante la conexión. Se mantienen el protocolo y los mensajes existentes.

Además, Firebase registra y confirma la limpieza al desconectarse **antes** de publicar la presencia. Si esa preparación falla, se rechaza la conexión, se intenta liberar únicamente la reserva del invitado que falló y se registra cualquier fallo de limpieza con el diagnóstico local sanitizado existente.

## Verificación acotada

```sh
npx vitest run src/tests/coopLifecycle.test.ts src/tests/coopPresence.test.ts src/tests/coopSession.test.ts src/tests/coopServe.test.ts
npm run typecheck
npm run build
```

Las pruebas nuevas reproducen los cuatro problemas anteriores y comprueban el orden de registro de presencia y la liberación condicional de la plaza si falla. La prueba de presencia usa un SDK simulado; no modifica Firebase.

La comprobación de navegador usa dos pestañas con `?coop-local`: entrada, decoración nueva recibida, bloqueo del guardado del invitado, restauración al salir y retorno de la sala fija a espera. Se conserva el guardado previo y los IDs de muebles existentes.

Esto no sustituye una prueba con dos cuentas y dispositivos conectados al Firebase desplegado. Quedan para esa comprobación la latencia real, pérdida de señal móvil, permisos publicados y suspensión de la aplicación por Android/iOS. No se cambian ni publican reglas de Firebase en esta entrega.
