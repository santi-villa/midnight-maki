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
