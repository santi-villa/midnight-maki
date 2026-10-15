# Roadmap NoriPhone

## Auditoría (antes)
- `src/ui/noriPhone.ts`: un panel de madera (`panel()`), centrado, con grilla de apps. Se abría desde un botón del HUD, `Android back` y el menú.
- Sin personalización, sin estado propio, sin animación de entrada, sin tecla de atajo.

## Arquitectura (ahora) — `src/ui/phone/`
| Archivo | Rol |
|---|---|
| `catalog.ts` | modelos, colores, fondos y reglas de desbloqueo (datos puros) |
| `prefs.ts` | estado guardado en `save.phone`, desbloqueos, novedades (puntitos), migración/saneo |
| `caseArt.ts` | carcasa en pixel art (canvas, sin imágenes ni madera) |
| `wallpapers.ts` | fondos pintados por código |
| `phone.ts` | controlador + DOM: peek, abrir/cerrar, home, Personalizar, gestos, teclado |
| `phone.css` | estilos acotados a `.noriphone-*` / `.pn-*` |
| `ui/menus.ts` | registra las apps (`registerPhoneApps`): reusan Cámara, Mapa, Misiones, etc. |

## Paquetes
- **A – Carcasa y apertura desde abajo** ✔ Solo asoma la parte superior (parlante, cámara, color elegido); al tocar sube y se centra con el mundo oscurecido; entrada bloqueada y apps no clickeables durante ~340 ms; cierre con ✕, Escape, tocar afuera (>450 ms) o deslizar hacia abajo en el marco; movimiento reducido ⇒ instantáneo.
- **B – Layout y gestos** ✔ Escala entera 2–4 px, safe-areas, alto máx. 780 px en PC, pausa del reloj y bloqueo del personaje (vía `openModal`), foco al abrir, atajo configurable (P/N/T en Ajustes), botón atrás de Android.
- **C – Personalización** ✔ App "Personalizar" (Modelo/Color/Fondo), vista previa en vivo, Guardar/Cancelar, opciones bloqueadas como siluetas con pista. Se guarda en `save.phone` (separado de los campos de historia).
- **D – Apps/home** ✔ (parcial) Home con hora/día del juego, íconos del skin, puntitos solo para novedades reales (recetas, misiones, diseños nuevos).
- **E – Pulido** ◐ Sonidos suaves (abrir, cerrar, tocar, cambiar, desbloqueo) y pulso háptico (respetan los ajustes). Pendiente: probar en celular real.

## Desbloqueos (resumen)
Plus: restaurante nivel 3 · MoonBerry: capítulo 5 · colores Pip/Spicy/Rigg: amistad 3 · Sakura: 2 proyectos · Medianoche: cap. 4 · Estrellas: final de historia · fondos de los mapaches: amistad 2 (los tres juntos: 4) · Midnight Maki: nivel 2 · Villa Nori: 3 proyectos · Recuerdo: final.

## Decisiones / pendientes
- **NoriFlip**: se omitió (era opcional; la carcasa no se pliega de forma legible con el layout actual).
- **Foto como fondo**: omitida (almacenamiento y rendimiento; las fotos del álbum no se tocan).
- Tests: un unit test de reglas de catálogo (`src/tests/noriphone.test.ts`) y revisión visual por capturas (390×844, 844×390, 1280×720). No se probó en un dispositivo físico.
- En horizontal en pantallas bajas el teléfono es angosto: las etiquetas se achican y la grilla scrollea.

## Plan maestro, etapa 6
- **12 aplicaciones por página** (3 columnas × 4 filas) con íconos que se ajustan a la altura; se revisó en vertical y horizontal.
- **Nuevas apps sin duplicar funciones:** *Personal* (equipo, sueldos, tareas) y *Suministros* (despensa del restaurante, capacidad y faltantes); *Restaurante* sigue siendo pedidos, nivel y mejoras.
- **HUD:** revisado en 390×844 y 844×390: el reloj se puede plegar, los botones de acción quedan sobre el borde derecho sin tapar a Sofi y el joystick sube cuando el teléfono cerrado asoma. Sin cambios necesarios.
