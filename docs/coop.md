# Jugar juntos (coop de 2 personas)

Estado: **etapa 1 hecha** (conexión, sala por código, ver el restaurante del anfitrión, verse caminar). Falta que el invitado vea los clientes y sirva (etapa 2) y que cocine (etapa 3).

## Idea
- El **anfitrión manda**: su partida y su restaurante siguen corriendo en su dispositivo.
- El **invitado** entra con un código, ve el restaurante del anfitrión (decoración, nivel, hora) y su personaje aparece en el salón de los dos. Su propia partida **no se toca**: mientras visita, el juego le presta los datos del anfitrión y no escribe nada en el guardado; al salir se le devuelve todo como estaba (`src/coop/index.ts`, `setSaveBlocked` en `persistence/storage.ts`).
- Máximo 2 personas. El invitado se lleva **solo las propinas** que recoja.

## Piezas
- `src/coop/protocol.ts`: mensajes y validación.
- `src/coop/session.ts`: saludo, versión, latido (9 s sin señal = desconexión), salir. No sabe de Phaser ni de Firebase.
- `src/coop/transport.ts`: la tubería de a dos: memoria (tests), misma ventana del navegador (`?coop-local`, para probar sin internet) y `firebaseTransport.ts` (Realtime Database).
- `src/coop/index.ts`: conecta la sesión con el juego y presta el restaurante al invitado.
- `src/scenes/WorldScene.ts` (`syncCoop`): manda tu posición ~6 veces por segundo y dibuja al otro.
- `src/ui/coop.ts`: pantalla «Jugar juntos» (Esc → Pausa → Jugar juntos, o Amigos online).
- Tests: `src/tests/coopSession.test.ts` (sesión) y `e2e/coop-presence.spec.ts` (dos pestañas).

## Puesta en marcha con Firebase (una vez)
1. Firebase console → **Realtime Database** → Crear base de datos (modo bloqueado) → elegí región.
2. Pestaña **Reglas**: pegá el contenido de `database.rules.json` y publicá. (Si ya habías pegado una versión anterior, **volvé a pegar esta**: la primera tenía un error y daba «no te deja entrar».)
3. Copiá la URL de la base a `.env.local` como `VITE_FIREBASE_DATABASE_URL` (ver `.env.example`) y reiniciá.
4. Hace falta tener cuenta iniciada (Authentication) para abrir o unirse a una sala.

Plan gratis (Spark) de Realtime Database: unas 100 conexiones simultáneas; con 2 por sala sobra para empezar. Confirmá los límites actuales en la página de precios de Firebase.

## Lo que sigue
- **Etapa 2:** el invitado ve a los clientes y el estado del salón (mesas, pedidos, platos) y puede tomar pedidos, llevar platos y recoger propinas. Cada acción la pide el invitado y la ejecuta el anfitrión con las mismas funciones que usa el personal contratado.
- **Etapa 3:** el invitado cocina (el acto en la cocina corre en su dispositivo; el anfitrión descuenta los ingredientes y recibe el plato con su calidad). Propina para el invitado con un tope por día.
- Pendiente de decidir: qué pasa con el reloj si el anfitrión abre una ventana (hoy cada uno tiene el suyo).

## Etapa 2: servir juntos (protocolo v3)

El anfitrión sigue siendo la autoridad. El invitado no simula nada del salón: ve una copia.

- **Espejo.** Cada 0,4 s (y enseguida después de una acción del invitado) el anfitrión manda el estado `floor`: clientes del salón (`guestViews`), dónde está parado cada uno, trabajos por mesa (`tableJobs`), platos terminados, orden de las mesas y hora. En el invitado, `restaurant/mirror.ts` guarda esa copia y `restaurant/service.ts` responde desde ella mientras `mirror.on` (así el menú de acciones, la bandeja, las marcas "!" y las barras de paciencia funcionan sin cambios). El invitado no corre `pumpFloor`, el personal, el horario ni el sueño: toma la hora del anfitrión.
- **Pedidos del invitado.** Mensajes `act` (`take`, `claim`, `release`, `deliver`, `tip`) → el anfitrión los ejecuta con las mismas funciones que usa el personal (`takeOrderAt`, `claimPlate`, `staffDeliver`) y contesta `res` con el texto y las monedas. `coop/serve.ts` revisa todo de nuevo contra la partida del anfitrión.
- **Bandeja.** Un plato que lleva el invitado queda reservado con el nombre `guest`. Si el invitado se va, los platos vuelven a la bandeja.
- **Propinas.** Solo propinas, con tope por día de juego (`GUEST_TIP_CAP`, 120). Pasado el tope, la propina de esa mesa queda para el restaurante. El invitado no recibe otras monedas.
- **Todavía no:** ver al personal contratado ni las burbujas de los clientes en el invitado.

## Etapa 3: cocinar juntos (protocolo v4)

- El invitado cocina con la misma cocina (acto y minijuego) que usa el anfitrión, desde la acción "Cocinar" de la mesa o la tabla de cocina. `coop/guestKitchen.ts` le pone otros ganchos a la sesión de cocina: los platos salen de `cookable` del espejo y los ingredientes que se miran son los del anfitrión (`pantry`).
- Al empezar un plato (`cookTake`) el anfitrión gasta los ingredientes de su cocina y marca el pedido como ocupado (el personal no lo repite). Si el invitado lo tira o se va, los ingredientes vuelven (`cookCancel`, `dropGuestCooking`).
- Al terminar (`plate`) el anfitrión recibe el plato en la bandeja con su calidad. Se ignoran platos que el invitado no empezó, y el bonus se limita al precio del plato.
- El invitado no cobra por cocinar y no suma maestría ni recetario: solo se cansa (energía propia) y se lleva las propinas, con el tope diario.
- Bebidas: de momento las prepara el anfitrión.
