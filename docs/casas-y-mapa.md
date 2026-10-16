# Casas japonesas y revisión del exterior

Las 16 viviendas con interiores utilizan módulos de las dos fachadas incluidas en la demo de VectoRaith: techos completos, puertas de madera, entramados, ventanas y jardineras. Se amplían por repetición de módulos de píxeles, sin deformar las puertas ni cambiar las huellas de seis por tres casillas. Los IDs de vecinos, partidas y accesos se conservan. Las luces nocturnas siguen las ventanas nuevas; las puertas de madera ya no simulan un vidrio iluminado.

Se despejó el eje norte de la plaza, separando los bancos a sus lados. Se retiraron bancos del camino del río, faroles del paso de la península, una máquina expendedora redundante y adornos que quedaban detrás de árboles o delante de entradas. La bicicleta del restaurante queda al costado de la cartelera. El patio residencial tiene un solo banco y una maceta; los árboles nuevos enmarcan claros y bordes de casas sin llenar las calles.

Se conservaron los edificios principales del restaurante, comercios, biblioteca y estación, así como las conexiones de caminos y los puentes. La demo contiene dos modelos, por lo que no se incorporan las casas y castillos exclusivos de la imagen del pack completo.

Verificación: pruebas generales del juego, pruebas de accesos y calles con todas las mejoras activadas, nueva regresión de alineación de las 16 puertas, atlas y luces en navegador, compilación de producción y capturas de día/noche. Las imágenes en `art/casas-y-mapa` son capturas del juego ejecutándose.

Las comprobaciones de escena inmóvil para ahorro de batería y movimiento reducido fijan el reloj de la prueba; así distinguen el parpadeo del avance legítimo de la luz ambiente. La exigencia de cero redibujados se conserva.
