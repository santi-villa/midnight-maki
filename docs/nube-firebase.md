# Cuenta y guardado en la nube (Firebase)

Todo es opcional: sin configuración el juego se comporta igual que antes (guardado local).

## Qué hace
- Entrar con **Google** o con **correo y contraseña** (crear cuenta, ingresar, recuperar contraseña). También se juega sin cuenta.
- Cada ranura (3) se sube sola unos 8 segundos después de guardar. Se guarda el automático y el manual, comprimidos.
- Al entrar con la cuenta en otro dispositivo, se compara cada ranura:
  - solo cambió acá → se sube; solo cambió en la nube → se baja;
  - cambió en los dos lados (o dos partidas distintas se encuentran) → el juego pregunta cuál conservar. Nunca pisa una versión sin preguntar.
- «Cerrar sesión» no borra nada local. «Borrar mi cuenta y datos» borra la cuenta y lo que hay en la nube.
- Pantalla: Título → «Cuenta y nube», o Esc → Pausa → «Cuenta».

Código: `src/cloud/decide.ts` (reglas puras, con tests), `src/cloud/cloud.ts` (estado y sincronización), `src/cloud/firebase.ts` (Firebase), `src/ui/account.ts` (pantallas). El resto del juego solo sabe que «se guardó la ranura N» (`setSaveObserver` en `persistence/storage.ts`).

## Puesta en marcha (una vez)
1. Firebase console → crear proyecto → **Authentication** → Sign-in method: activar **Google** y **Correo/contraseña**.
2. **Firestore Database** → crear base (modo producción) → pestaña Reglas → pegar `firestore.rules` → Publicar.
3. Project settings → Your apps → agregar app **Web** → copiar `apiKey`, `authDomain`, `projectId`, `appId`.
4. Copiar `.env.example` a `.env.local` y completar. Reiniciar `npm run dev` / volver a compilar.
5. Authentication → Settings → **Authorized domains**: agregar el dominio donde se publica el juego (localhost ya viene).
6. Opcional: Authentication → Templates: traducir el mail de recuperar contraseña al español.

## Pendiente
- **Android/iOS (Capacitor):** el popup de Google no anda en la app nativa. Hace falta el plugin `@capacitor-firebase/authentication` y la huella SHA-1 en Firebase. Se hace cuando se publique en tiendas.
- Política de privacidad (qué se guarda: correo, nombre y partidas) y texto de borrado de cuenta, para las tiendas.
- Pruebas contra un proyecto Firebase real: lo armado se probó solo hasta donde se puede sin credenciales.

## Amigos online (primera parte)
- **Tarjeta del restaurante:** nombre, restaurante, nivel, platos servidos, recetas y apariencia. Se publica sola al entrar con tu cuenta y cada vez que la partida se sube. Es lo único público.
- **Código de amigo:** 6 caracteres (sin 0/O/1/I/L). Quien lo escribe te agrega a su lista. Es de un solo sentido: no hay solicitudes que aprobar y se puede quitar a alguien cuando se quiera.
- **Tarjetas:** 8 mensajes fijos. Nadie puede escribirle texto libre a otro jugador. Cada amigo deja como mucho una tarjeta en tu buzón (la nueva reemplaza a la vieja), lo que frena el spam.
- Pantalla: Esc → Pausa → «Amigos online», o Cuenta → «Amigos online».
- **Hay que volver a publicar `firestore.rules`** (cambió: perfiles, códigos, amigos y buzón).

Código: `src/cloud/social.ts`, `src/cloud/friendCode.ts` (con tests), `src/ui/friends.ts`.

### Cuidado con los nombres
El nombre del jugador y del restaurante los escribe cada persona y los ven sus amigos. Hoy se limitan en largo (24 y 32) pero no se filtran. Antes de publicar en tiendas conviene sumar un filtro de palabras y un botón «Reportar».

### Siguiente
Visitar el restaurante de un amigo (verlo decorado, solo lectura), ranking entre amigos y regalos. Cada cosa necesita su propia regla de seguridad y moderación.

## Publicado en GitHub Pages
El juego publicado se arma en GitHub, que **no tiene tu `.env.local`**. Hay que cargar los mismos datos como **variables** del repositorio:
GitHub → Settings → Secrets and variables → Actions → pestaña **Variables** → New repository variable, una por cada una:
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_URL`.
(Son públicas, por eso van en Variables y no en Secrets.) Después, en Actions → «Publicar en GitHub Pages» → Run workflow (o un nuevo push).
En Firebase → Authentication → Settings → **Authorized domains** agregá `santi-villa.github.io`.
