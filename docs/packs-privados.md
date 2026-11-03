# Packs con licencia en un repo privado

Los recortes de los packs (LimeZu, VectoRaith, Japanese City, Serene Village, Sprout Lands) viven en
`src/assets/packs/`, que git ignora: sus licencias no permiten compartir los archivos. Sin ellos el juego usa su propio
arte dibujado por código (por ejemplo, otra arena y otro mar).

Para que **la web publicada** (GitHub Pages) se vea igual que en la PC, el workflow `.github/workflows/pages.yml` baja
esos recortes de un **repo privado** antes de compilar. La web sigue siendo pública; lo único privado es el repo con los
archivos sueltos.

## Una sola vez
1. **Crear el repo privado** `santi-villa/midnight-maki-packs` en GitHub (Private, vacío).
   Otro nombre sirve: ponelo en *Settings → Secrets and variables → Actions → Variables* como `PACKS_REPO`
   (por ejemplo `santi-villa/mis-packs`).
2. **Subir la carpeta** desde la PC: el contenido de `src/assets/packs/` va a la raíz del repo privado
   (quedan `limezu/`, `jp-buildings/`, `japanese-city/`, `serene/`, `ui/` arriba de todo):
   ```
   cd "ruta/a/midnight-maki/src/assets/packs"
   git init -b main
   git add .
   git commit -m "Recortes de los packs"
   git remote add origin https://github.com/santi-villa/midnight-maki-packs.git
   git push -u origin main
   ```
3. **Crear el permiso de lectura**: GitHub → foto de perfil → *Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token*. Repository access: *Only select repositories* → `midnight-maki-packs`.
   Permissions → Repository → **Contents: Read-only**. Copiá el token.
4. **Guardarlo como secreto** en el repo `midnight-maki`: *Settings → Secrets and variables → Actions → Secrets →
   New repository secret*, nombre `PACKS_TOKEN`, valor el token.
5. Volver a publicar: *Actions → Publicar en GitHub Pages → Run workflow* (o cualquier push a la rama).

## Después
Cada vez que los scripts `scripts/build-*.py` regeneren recortes nuevos en `src/assets/packs/`, hay que hacer
`git add . && git commit && git push` dentro de esa carpeta para que la web los tenga.

Sin el secreto, el workflow igual publica (con el arte propio) y deja un aviso en el registro.
