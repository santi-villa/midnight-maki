# Celular, carga y cocina

Cambios del 31/10/2026:

- Las aplicaciones del NoriPhone usan su propia pantalla. Las subpantallas y las
  confirmaciones también quedan dentro del dispositivo; al volver se recupera
  la pantalla anterior. El botón circular del marco inferior cierra el celular
  y sus pantallas abiertas. Escape retrocede una pantalla.
- La cámara muestra el juego en vivo dentro del celular: encuadre, zoom, disparo,
  vista previa y guardado en el álbum permanecen dentro de la misma pantalla.
- Se conservan los modelos, colores, fondos y desbloqueos guardados. El borde
  inferior tiene más espacio para el botón; el teléfono sigue ajustándose a la
  ventana y al tamaño de interfaz elegido.
- Las dos pantallas de carga muestran 28 pétalos rosas, detrás de la tarjeta de
  progreso. Se desactivan con movimiento reducido.
- Al entrar al área de trabajo, la cámara encuadra toda la cocina y deja espacio
  para el HUD. Al salir vuelve a seguir al personaje. La cámara de fotos y el
  editor de decoración conservan sus encuadres independientes.
- Los menús de heladera y despensa, y la barra de corte, se ubican junto a su
  estación. Siguen al objeto al cambiar el encuadre o el tamaño de pantalla,
  ajustan su altura al espacio disponible y permiten desplazar el contenido.

Implementación compartida: `ui/dom.ts` aloja las pantallas de las apps sin duplicar
su contenido; `ui/actionPanel.ts` posiciona las tarjetas; `ui/kitchenFrame.ts`
calcula el encuadre de cocina. No cambian las recetas, los inventarios ni las reglas
de cocción.

Validación: 652 pruebas unitarias y compilación correctas; 4 recorridos en
navegador aprobados para aplicaciones en PC y móvil, confirmaciones, botón
inferior, cámara, heladera/despensa, cargas y una receta completa hasta su entrega.
Capturas en `docs/celular-app-*.png`, `docs/cocina-encuadre-*.png`,
`docs/heladera-cercana-*.png`, `docs/despensa-cercana-*.png` y
`docs/carga-petalos-*.png`.
