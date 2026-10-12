# ROADMAP — Midnight Maki

Leyenda: ✅ hecho y verificado · 🟡 implementado, falta verificación/pulido · ⬜ pendiente

## Etapa 1 — Base técnica y primera experiencia
- ✅ Proyecto (Vite + TS + Phaser), escalado responsivo, pixel nítido
- ✅ Pantalla principal animada, sistema de escenas, controles (tocar, teclado), joystick opcional 🟡
- ✅ Personaje con capas y animaciones (caminar 4 direcciones, parpadeo, alegría, sorpresa, dormir, tristeza)
- ✅ Mapa del restaurante, interacciones, guardado automático en IndexedDB

## Etapa 2 — Personajes y vida cotidiana
- ✅ Pip, Spicy Beacon y Rigg con retratos y diálogos
- 🟡 Rutinas por momento del día (entran/salen por puertas), acciones espontáneas
- 🟡 Relaciones de 5 niveles, regalos, recompensas, memoria por flags
- 🟡 Cambios de horario con iluminación y música

## Etapa 3 — Restaurante funcional
- ✅ Pedidos, ingredientes, inventario, cocina (11 tipos de paso), monedas, reputación, experiencia
- 🟡 Clientes con nombre y pedidos favoritos, mejoras visibles, cocina libre, laboratorio de Spicy
- ⬜ Clientes visibles sentados comiendo en las mesas

## Etapa 4 — Decoración y personalización
- ✅ Editor de personaje
- 🟡 Ropa (58 prendas, 7 ranuras), ropero, atuendos de mapaches
- 🟡 Tiendas, 67 muebles, pisos y paredes, editor de habitaciones con validación de caminos y deshacer

## Etapa 5 — Pueblo y exploración
- 🟡 Plaza, Playa, Bosque, Jardín, Estación, Mercado Nocturno, Faro (10 zonas)
- 🟡 12 vecinos con rutina, recolección diaria variable, pesca, jardinería, insectos
- 🟡 27 misiones secundarias + 5 tareas opcionales, cartelera

## Etapa 6 — Historia y misterio
- 🟡 Prólogo + 8 capítulos + epílogo, 4 deducciones con pistas progresivas, 3 finales
- 🟡 Cuaderno de investigación

## Etapa 7 — Expansión del contenido
- ⬜ Escenas jugables para cada evento del calendario (hoy: fecha, música y aviso)
- ⬜ Más líneas de diálogo y conversaciones entre vecinos
- ⬜ Contenido post-historia adicional (zona especial del rincón secreto ampliada)

## Etapa 8 — Pulido profesional
- 🟡 PWA (manifest, íconos, service worker)
- ✅ Pruebas unitarias de lógica y de integridad de datos (Vitest)
- ⬜ Pruebas E2E (Playwright) del flujo nuevo juego → cocina → guardado
- ⬜ Balance fino de economía tras jugar varias horas
