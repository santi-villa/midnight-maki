# Assets y licencias

Los packs comerciales no se suben al repositorio público ni se envían a un servicio externo. `.gitignore` excluye `ASSETS DESCARGADOS/` y `src/assets/packs/`. El comentario de `src/art/packs.ts` lo repite: si el archivo no está, el juego usa el arte dibujado.

`NUEVO` es la biblioteca descargada para mirar. El juego no la empaqueta. Los cortes que sí usa salen de `scripts/build-*.py` hacia `src/assets/packs/` (limezu, jp-buildings, japanese-city, serene, ui).

## En el repositorio

| Carpeta | Procedencia | Licencia, en corto |
|---|---|---|
| `src/assets/cozy-town/` | Recortes de VectoRaith (tiles y fachadas japonesas, incluso un demo) y de Bitglow (living, decoración) | Bitglow: se puede usar y modificar en el proyecto; no revender, no redistribuir sueltos, no meter en otro pack. `Bitglow-license.txt` |
| `src/assets/interiors/` | Bitglow | La misma licencia |
| `src/assets/bridges/` | Recorte del tileset japonés de VectoRaith | Ver `provenance.json`. No republicar el pack |
| `src/assets/map-study/` | LimeZu, Serene Village revamped v1.9 | CC BY 4.0. `credits.json` |
| `src/assets/farm/` | Cozy Farm Lite, Bramble & Byte | Uso comercial y modificación permitidos. No revender el asset. Crédito apreciado, no obligatorio |
| `src/assets/village/` | Recortes de una lámina de VectoRaith que está en el proyecto, no el zip demo | Mismas condiciones: no republicar el pack. `docs/asset-credits.md` |
| `src/assets/pets/` | Cat Pixel Mega Pack y Animal Mega Pack | El script de corte dice que se usan con permiso del dueño, en un proyecto privado. No los redistribuyas |
| `src/assets/clientes/`, `portraits/`, `icons16/` | Hojas del juego. Iconos sin ficha de licencia en el repo | No los mandes a un generador |
| `src/music/` | Canciones propias. Ogg para escritorio, m4a para el teléfono | `src/music/LEEME.txt` |

## Packs que viven solo en la máquina

Nombrados en `src/art/packs.ts` y en los scripts de corte:

- LimeZu Modern Interiors y Modern Exteriors.
- VectoRaith, edificios japoneses tradicionales.
- GuttyKreum, The Japanese City (hay versión free en la ruta de `scripts/build-japanese-city-assets.py`).
- Serene Village, LimeZu.
- Sprout Lands UI (Cup Nooble, pack básico). `docs/asset-credits.md` lo marca de uso no comercial y con la licencia sin cerrar. No agregues más piezas de ese pack.

Están bajo `ASSETS DESCARGADOS/` en el equipo de quien desarrolla. No los copies a `public/`, no los adjuntes y no los uses como entrada de un modelo de imagen.

## Regla de integración

1. Reutiliza un frame, un prop o un rect de atlas antes de dibujar otro.
2. Si hace falta uno nuevo, dibújalo a 16×16 (suelo) o al frame del sistema que lo va a mostrar (personaje 20×30, cliente 28×40).
3. Misma paleta, mismo contorno, mismo origen en los pies.
4. Documenta el recorte en un `provenance.json` junto al atlas si el pixel sale de un pack, sin copiar el pack entero.
5. El PNG de juego queda en `src/assets/` solo cuando se pide integrarlo. Hasta entonces, `.claude/skill-tests/`.
