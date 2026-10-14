# Roadmap del mapa

La idea: que el pueblo se sienta recorrible (no todo a mano), con identidad por zona y con cada camino cerrado tapado por algo que se vea.

## Geografía nueva (coordenadas en tiles; el centro viejo conserva las suyas)
| Zona | Tamaño antes → ahora | Qué se agregó |
|---|---|---|
| **Villa Nori** (`plaza`) | 32×26 → **58×44** | Río con dos puentes, Ribera de los Cerezos (este), Colina del Santuario (NE, escalera + torii + santuario), Callejón del Puerto (dos calles con casas de entrada lateral), bahía con muelles y botes, plaza vieja intacta |
| Playa | 30×22 → **48×26** | Cala este: cabañas de pescadores (entrada lateral), segundo muelle, botes y redes |
| Bosque | 30×24 → **48×24** | Arroyo, estanque con puente, santuario del bosque, cabaña vieja |
| Jardín | 24×18 → **38×26** | Estanque de carpas con puente, casa de té y florería, huerto de cerezos |
| Mercado | 26×18 → **40×18** | Segunda sección de puestos y farolitos |
| Estación | 24×16 → **24×26** | Patio del depósito con cabaña, cajones y vía auxiliar |

Se crece siempre **hacia el este y el sur** (las puertas viejas siguen en el mismo lugar), así que misiones, horarios, rutinas y proyectos siguen apuntando a coordenadas válidas. Las puertas que cambiaron: plaza→playa (15–16, 43) y plaza→jardín (57, 12–13); las zonas vecinas ya apuntan ahí.

## Caminos cerrados: obstáculos físicos
Cada salida que todavía no se abrió está tapada por un prop sólido con condición `!flag` (se dibuja y bloquea solo mientras la bandera no esté puesta). Al fijarse la bandera, la zona se reconstruye y el obstáculo desaparece. Al tocarlo aparece el mensaje de siempre y, si corresponde, corre el hook de la historia (llave oxidada de la estación).

| Salida | Obstáculo | Bandera |
|---|---|---|
| Bosque (norte) | Troncos caídos entre pinos | `unlock_forest` |
| Playa (sur) | Valla de obras con caballetes | `unlock_beach` |
| Jardín (este) | Portón de madera con soga y cartel | `unlock_garden` |
| Estación (oeste) | Portón de hierro oxidado cubierto de enredaderas | `unlock_station` |
| Mercado (torii) | Soga de bambú con cartel "CERRADO" | `market_open` (se abre de noche) |

Los costados de cada salida están cerrados con árboles, rocas o piedras, para que no se pueda rodear.

## Dónde está cada cosa
- `src/data/plazaMap.ts`: mapa de Villa Nori (calles, río, puentes, casas, obstáculos, puertas).
- `src/data/zoneKit.ts`: helpers (`Builder`, `zone`, `treeBorder`) compartidos.
- `src/data/zones.ts`: el resto de las zonas.
- `src/art/townart.ts`: troncos, vallas, portones, santuario y las casas con entrada lateral (`townhouse`).
- `src/systems/handlers.ts`: acciones `blocked:` y `note:`.
- `src/ui/worldmap.ts`: ilustración del mapa del menú (barrios de Villa Nori como placas extra).

## Cómo agregar un obstáculo nuevo
1. Dibujar el prop en `townart.ts` y registrarlo en `data/props.ts` (`block_*`).
2. Ponerlo en el mapa con `cond: '!bandera'` y cerrar los costados.
3. Agregar la `interact` `blocked:<zona destino>` con la misma condición.

## Pruebas
`src/tests/zones.test.ts` recorre todas las zonas al aire libre: puertas, interacciones y recolecciones alcanzables, props sólidos sin superponerse ni caer al agua, y que cada camino cerrado de la plaza esté realmente cerrado hasta que se pone su bandera.

## Pendiente / ideas
- Convertir también Ropa de Yuki, el Almacén y la Panadería a entrada lateral (hoy son de frente, con sus coordenadas viejas).
- Que las casas del puerto se puedan visitar por dentro (hoy dicen una nota).
- Música/ambiente propios para el puerto y el santuario.
- No se probó en un dispositivo físico.
