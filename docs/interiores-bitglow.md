# Colección de interiores

Se incorporan 173 muebles y adornos de los paquetes Bitglow Bathroom (19), Bedroom (20) y Living Room & Kitchen (21), disponibles en `ASSETS DESCARGADOS/ORGANIZADO/biblioteca/02_interiores`. Amplían el catálogo existente: no se sustituyen sus IDs, precios, compras o muebles colocados.

## Uso en el juego

1. Ir al Almacén de Taro entre las 08:00 y las 23:00.
2. Abrir **Muebles** y elegir **Tipo de mueble** para filtrar dormitorio, alfombras, plantas, luces, cocina, baño o adornos de pared.
3. Comprar el objeto y volver a la habitación.
4. Abrir **Decorar**, elegir la categoría del objeto y colocarlo con los controles actuales. **Listo** confirma; **Cancelar** descarta.

Las camas conservan la acción de dormir de la habitación del jugador. Las alfombras son transitables; las luces iluminan con el sistema existente; los objetos de pared se colocan en la pared. Las sillas y sillones con cuatro dibujos usan sus orientaciones nativas. Electrodomésticos, bañeras e inodoros son decoración: no agregan mecánicas de cocina o higiene.

## Archivos y arte

- `scripts/build-interior-assets.py`: selección explícita de recortes completos y regeneración, requiere Pillow como la herramienta existente de iconos.
- `src/assets/interiors/catalog.json`: identificadores estables, nombres, categorías, precios, huellas y procedencia de cada recorte/orientación.
- `src/assets/interiors/atlas.png`: 197 recortes a resolución original en una textura 1024×512 (2 MiB de píxeles RGBA; unos 53 KiB de PNG).
- `src/assets/interiors/Bitglow-license.txt`: licencia adjunta a los paquetes originales.
- `src/data/interiorFurniture.ts`: integración con el catálogo y las tiendas existentes.
- `src/art/interiors.ts`: representación a tamaño nativo con pivote en la base.
- `src/art/furniture.ts`: representación compartida por el mundo, tienda, editor y premios. Conserva el dibujo procedural como fallback si falla la carga.
- `src/scenes/BootScene.ts`: carga el atlas antes del mundo utilizando el progreso real del cargador de Phaser.

No se precarga la biblioteca de descargas. No se incluyen ejemplos completos, capturas de packs premium, versiones ampliadas, exportaciones Unity/RPGMaker ni materiales de otras familias con permisos pendientes. Los suelos, paredes, puertas y escaleras estructurales de los paquetes no se convierten en muebles: siguen usando los sistemas actuales.

Para cambiar el recorte o agregar una pieza, editar la selección del script y ejecutar:

```sh
python3 scripts/build-interior-assets.py
```

Mantener los IDs `interior_*` una vez publicados, ya que las partidas los guardan. Las dimensiones visuales y la huella de colisión son independientes. Si se cambia una huella, revisar las ubicaciones guardadas y la accesibilidad antes de publicar.

## Cooperativo

Los IDs nuevos viajan con la decoración del anfitrión mediante el protocolo existente. Ambos jugadores deben cargar esta versión para ver los muebles nuevos. El invitado no compra ni cambia la decoración del anfitrión; al salir recupera la suya y el bloqueo de guardado durante la visita continúa vigente.

## Verificación

Ver `docs/art/interiores/` para el catálogo y capturas de compra, decoración y visita cooperativa. La comprobación de navegador usa emulación de PC y móvil y el transporte local de dos pestañas; no demuestra conexión entre teléfonos ni la configuración del Firebase desplegado.
