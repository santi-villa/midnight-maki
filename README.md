# Midnight Maki: Los secretos de Villa Nori

Juego cozy en pixel art para navegador (celular primero): restaurante de sushi, tres mapaches
(Pip, Spicy Beacon y Rigg), un pueblo para explorar y un misterio de tres estrellas.
Sin anuncios, sin compras, sin registro, funciona offline una vez instalado.

## Ejecutar
```bash
npm install
npm run dev        # http://localhost:5173 (también accesible desde el celu en la misma red)
npm test           # pruebas de lógica e integridad de datos
npm run build      # versión de producción en dist/ (PWA)
```

Para instalarlo en el celular: publicar `dist/` en cualquier hosting estático (o servirlo en la red local),
abrirlo en Safari/Chrome y elegir "Agregar a pantalla de inicio".

## Controles
- **Celular**: tocá el suelo para caminar, tocá personas y objetos para interactuar, botón grande de acción.
  Joystick opcional en Ajustes.
- **Computadora**: WASD / flechas, E o Espacio para interactuar, Escape para cerrar, mouse para todo lo demás.

## Estructura
- `src/core` estado, eventos, balance, ajustes, flujo de partida
- `src/art` generadores de pixel art (personajes, tiles, objetos, íconos)
- `src/data` contenido: ítems, recetas, ropa, muebles, mapas, personajes
- `src/scenes`, `src/entities`, `src/world` mundo Phaser, actores, grilla/A*
- `src/systems` tiempo, NPC, jardín, recolección, colecciones, logros, acciones
- `src/restaurant` pedidos, cocina (minijuego), mejoras
- `src/dialogue`, `src/story`, `src/quests` diálogos, historia, pistas, misiones
- `src/minigames` pesca, insectos, restauración, puzles, ordenar, macetas, memoria
- `src/decoration` editor de interiores · `src/ui` HUD, menús, tiendas, ropero, cámara
- `src/persistence` guardado IndexedDB, validación y migraciones

Ver también `GAME_DESIGN.md`, `ROADMAP.md` y `PROGRESS.md`.
