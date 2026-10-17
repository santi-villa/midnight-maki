# Lámina de exteriores aportada

`lamina-aportada.png` es el PNG de 1013×1181 recibido en `Imagen de ChatGPT 17 oct 2026, 01_34_44.zip`. Se conserva sin modificar para poder revisar o repetir los recortes. Corresponde a la lámina de edificios japoneses de VectoRaith mostrada por el usuario; sus créditos siguen en `docs/asset-credits.md`.

El ZIP solo permitió transferir el archivo al entorno; no cambió su resolución ni recuperó detalle. Esta imagen tiene píxeles interpolados y transparencia parcial, por lo que no se trata como si fuera la exportación original de una cuadrícula de 16×16. Los recortes usan coordenadas explícitas de esta lámina, eliminan el leve fondo semitransparente y se ajustan sin suavizado adicional.

Regenerar los recursos utilizados:

```sh
python3 scripts/build-village-assets.py
```

Solo `src/assets/village/atlas.png` (512×256) y su catálogo entran en el juego. La lámina completa de esta carpeta no se descarga al abrir la web.

No renombrar los IDs técnicos de los muebles, casas o zonas para sustituir sus gráficos. El restaurante conserva su nombre y su acceso histórico; no se modifica la progresión.
