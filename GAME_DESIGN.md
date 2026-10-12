# GAME_DESIGN — Midnight Maki: Los secretos de Villa Nori

> Este archivo contiene, primero, las decisiones de implementación y, después, la especificación
> integral original sin recortes. El alcance final se mantiene completo; lo pendiente figura en
> ROADMAP.md y PROGRESS.md.

## Decisiones técnicas principales
- **Motor**: Phaser 3 (mundo, tilemaps, cámara, partículas, iluminación) + **HTML/CSS** para toda la
  interfaz (menús, diálogos, minijuegos táctiles): texto nítido, accesible y escalable.
- **Arte 100% generado por código** (carpeta `src/art`): pixel art original con plantillas y paleta propia.
  Personajes por capas (cuerpo, ropa, pelo, orejas, accesorios) en hojas de 20 cuadros de 16×24,
  así la ropa se superpone de verdad y cualquier combinación funciona sin recursos rotos.
- **Audio 100% sintetizado** (`src/audio/audio.ts`): música generativa lo-fi por zona (pentatónica y
  miyako-bushi), ambiente (lluvia, olas, noche) y efectos. Reemplazable por archivos reales.
- **Datos separados de la lógica** (`src/data`, `src/story`, `src/quests`): recetas, ítems, ropa, muebles,
  mapas, personajes, diálogos, misiones y pistas. Balance en `src/core/balance.ts`.
- **Estado único** (`src/core/state.ts`) con mutadores validados (sin dinero negativo, recompensas
  idempotentes con `game.once`). Eventos tipados por `bus`.
- **Guardado** en IndexedDB con respaldo rotativo, validación + migraciones versionadas
  (`src/persistence/validate.ts`), exportar/importar JSON y fallback a localStorage.
- **Tiempo**: 4 momentos por día; se pausa en menús y diálogos; la noche espera a que la jugadora duerma.
  Nunca hay castigos por ausencia: las plantas no mueren, la amistad no baja.
- **Escenas narrativas** como funciones `async` con `say()` / `choose()` (`src/dialogue/dialogue.ts`).
- **Mapas** construidos con un builder (rectángulos + props) en lugar de grillas a mano (`src/data/zones.ts`).
- **Controles**: tocar el suelo para caminar (A*), joystick opcional, WASD/flechas + E, botón contextual.

## Ajustes respecto del documento (y por qué)
- El Mercado Nocturno es una zona propia detrás del torii de la plaza: abre viernes y sábados de noche
  del calendario interno, o cuando la historia lo necesita (nunca fechas reales).
- "Cocina libre" vende el plato a un cliente sin reserva (sin inventario de platos) para que cocinar
  siempre sea útil y la economía siga simple.
- La carta final para Sofi usa exactamente el texto pedido, aunque la protagonista tenga otro nombre.

---

IMPORTANTE: Este proyecto comienza completamente desde cero. No existe código anterior ni una arquitectura que debas conservar.

Quiero que desarrolles el videojuego a partir del documento completo que aparece a continuación.

No te limites a crear la estructura o planificar. Quiero que programes una primera versión realmente jugable y continúes implementando el proyecto por etapas.

Tomá decisiones técnicas profesionales, mantené una arquitectura escalable y verificá que cada funcionalidad implementada funcione correctamente.

No intentes completar todas las funcionalidades superficialmente. Priorizá sistemas sólidos, gráficos coherentes y una experiencia de juego entretenida.

Utilizá el documento como especificación integral del videojuego. No reduzcas el alcance final, pero organizá su implementación de manera progresiva.

# PROMPT MAESTRO: MIDNIGHT MAKI
## Los secretos de Villa Nori
### Documento integral de diseño y desarrollo de videojuego

---

# 1. TU ROL Y OBJETIVO

Actuá como un equipo profesional completo de desarrollo de videojuegos independientes, compuesto por:

- Director creativo y diseñador de videojuegos.
- Game designer especializado en juegos cozy y simuladores.
- Programador senior de videojuegos web.
- Diseñador UX/UI especializado en dispositivos móviles.
- Artista de pixel art.
- Diseñador narrativo de novelas visuales.
- Diseñador de sistemas de progresión y economías.
- Diseñador de sonido y ambientación.
- QA tester especializado en videojuegos.

Tu objetivo es **DESARROLLAR UN VIDEOJUEGO REAL, COMPLETO, JUGABLE Y FUNCIONAL**, no hacer un prototipo visual estático ni una demostración de conceptos.

El juego se llama:

**MIDNIGHT MAKI: LOS SECRETOS DE VILLA NORI**

Se trata de una experiencia cozy de gestión, exploración, cocina, personalización, novela visual y misterio protagonizada por tres mapaches llamados Pip, Spicy Beacon y Rigg.

Está pensado como un regalo personal para una chica llamada Sofi, que disfruta:

- Los mapaches y los animales adorables.
- El sushi y la gastronomía japonesa.
- Stardew Valley.
- Los juegos de novela visual con historias interesantes.
- Danganronpa y sus mecánicas de investigación y diálogo.
- Los juegos de celular con mecánicas sencillas y satisfactorias.
- Personalizar personajes, decorar y coleccionar objetos.
- Tener varias actividades disponibles sin sentirse saturada.
- Los juegos tranquilos, bonitos, con pequeños misterios.
- Las experiencias a las que puede volver durante semanas.

**Principio fundamental:**

El juego debe ofrecer libertad, profundidad y variedad, pero jamás convertir el entretenimiento en una lista interminable de obligaciones.

Quiero un videojuego con alma, identidad visual propia, personajes memorables y suficiente contenido para disfrutarlo durante muchas sesiones.

No copies código, personajes, mapas, ilustraciones ni recursos protegidos de otros videojuegos. Las referencias son únicamente de inspiración.

---

# 2. CONCEPTO GENERAL

## 2.1 Género

Una combinación equilibrada de:

1. Simulación de vida tranquila.
2. Gestión de restaurante.
3. Exploración de pueblo.
4. Novela visual interactiva.
5. Misterio narrativo.
6. Decoración y personalización.
7. Coleccionismo.
8. Minijuegos casuales.
9. Desarrollo de relaciones con personajes.
10. Progresión permanente.

No quiero diez juegos independientes reunidos en un menú. Todos los sistemas deben estar conectados entre sí.

## 2.2 Sinopsis

En un pequeño pueblo costero llamado Villa Nori, rodeado de bosques, jardines, faroles japoneses y antiguas construcciones, existe un restaurante de sushi abandonado.

La protagonista llega al pueblo después de recibir una misteriosa carta informándole que heredó el restaurante.

Al entrar descubre que tres pequeños mapaches viven allí.

Son Pip, Spicy Beacon y Rigg.

Los mapaches están intentando mantener el lugar funcionando, aunque cada uno tiene su propia personalidad, sueños y secretos.

La protagonista decide ayudarlos a restaurar el restaurante, conocer el pueblo y construir una nueva vida.

Sin embargo, Villa Nori esconde un misterio.

Hace muchos años desaparecieron tres estrellas de una antigua constelación. Desde entonces se producen acontecimientos extraños: cartas anónimas, recuerdos contradictorios, puertas ocultas y objetos que aparecen en lugares imposibles.

Los tres mapaches parecen tener una conexión con esos acontecimientos.

La historia principal combina humor, ternura, amistad, secretos y momentos emotivos.

El tono debe ser acogedor, aunque algunos capítulos tengan suspenso e intriga.

No debe transformarse en un juego de terror.

## 2.3 Experiencia deseada

Quiero que la jugadora piense:

- "Voy a entrar un ratito para preparar sushi".
- "Quiero comprar ese mueble para mi habitación".
- "Me pregunto qué estará haciendo Pip".
- "Quiero descubrir qué significa esta carta".
- "Voy a pescar para completar mi colección".
- "Tengo ganas de hablar con Rigg".
- "Hoy solo quiero decorar y escuchar la música".

El juego debe ofrecer pequeñas recompensas constantes sin depender de técnicas de monetización adictivas.

---

# 3. PLATAFORMA Y TECNOLOGÍA

## 3.1 Plataforma principal

Desarrollar para navegador web, con especial prioridad en celulares.

Debe funcionar correctamente en:

- iPhone con Safari.
- Android con Chrome.
- Computadoras con navegadores modernos.
- Tablets.

Debe poder instalarse como una PWA para abrirse desde la pantalla de inicio como una aplicación independiente.

## 3.2 Stack recomendado

Utilizar:

- TypeScript como lenguaje principal.
- Phaser 3 como motor 2D.
- Vite como herramienta de desarrollo.
- HTML y CSS para interfaces complementarias.
- IndexedDB para guardado de partidas.
- LocalStorage para configuraciones pequeñas.
- Service Worker para funcionamiento sin conexión.
- Web Audio API para efectos de sonido si resulta necesario.
- Vitest para pruebas de lógica.
- Playwright para pruebas de flujos completos.

Podés utilizar librerías adicionales cuando aporten un beneficio claro, pero evitá dependencias innecesarias.

Si el proyecto existente tiene otro stack, primero evaluá la arquitectura y adaptá la solución de manera razonable.

No quiero que una pantalla simple requiera diez librerías.

## 3.3 Requisitos técnicos

- Objetivo de 60 FPS en celulares compatibles.
- Degradación adecuada a 30 FPS en dispositivos modestos.
- Escalado responsivo.
- Sprites con pixelado nítido, sin filtros borrosos.
- Precarga de recursos importantes.
- Carga progresiva del contenido secundario.
- Sincronización entre lógica y animaciones.
- Guardado automático.
- Recuperación de partidas.
- Sistema de errores controlado.
- No depender de servicios externos para jugar.
- Sin anuncios.
- Sin compras integradas.
- Sin registro obligatorio.
- Sin rastreadores.
- Sin servidores necesarios para la experiencia individual.

Debe funcionar offline después de instalarse y cargar los recursos necesarios.

---

# 4. IDENTIDAD VISUAL

## 4.1 Estilo artístico

Pixel art 2D original, con vista principalmente desde arriba.

Debe sentirse como un videojuego independiente cuidado y no como una web con dibujos sueltos.

Inspiración estética:

- Pueblos japoneses pequeños.
- Cafeterías acogedoras.
- Faroles y luces cálidas.
- Bosques tranquilos.
- Noches estrelladas.
- Interiores decorados.
- Personajes pequeños y expresivos.
- Escenarios con mucho encanto.

Utilizar una estética pixel art consistente, con una resolución lógica base de 16 × 16 píxeles por tile y personajes de aproximadamente 24 × 32 o 32 × 32 píxeles según la escala.

Los sprites deben tener siluetas claras y proporciones coherentes.

## 4.2 Paleta

Usar principalmente:

- Verde salvia.
- Verde bosque apagado.
- Azul noche.
- Rosa empolvado.
- Crema.
- Marrón madera.
- Amarillo cálido.
- Lavanda suave.
- Tonos naturales.

Evitar colores neón, saturación excesiva y contrastes agresivos.

La interfaz debe tener buen contraste y excelente legibilidad.

## 4.3 Animaciones

Implementar animaciones de:

- Caminar en cuatro direcciones.
- Quedarse quieto.
- Parpadear.
- Reír.
- Sorprenderse.
- Dormir.
- Cocinar.
- Comer.
- Sentarse.
- Interactuar con objetos.
- Celebrar un descubrimiento.
- Reaccionar a un regalo.

Los mapaches también deben realizar acciones propias espontáneas.

No quiero personajes inmóviles que solo esperan que la jugadora les hable.

## 4.4 Ambientación

Añadir pequeños detalles ambientales:

- Hojas moviéndose.
- Faroles que iluminan suavemente.
- Humo de una cocina.
- Agua con movimiento.
- Luciérnagas nocturnas.
- Pétalos ocasionales.
- Gotas de lluvia.
- Ventanas encendidas.
- Gatos y pájaros paseando.
- Pequeñas partículas ambientales.

Todas estas animaciones deben ser discretas y poder reducirse mediante una opción de accesibilidad.

---

# 5. LOS TRES MAPACHES

Los tres son protagonistas y deben recibir muchísimo cuidado narrativo.

Cada uno necesita:

- Personalidad propia.
- Animaciones particulares.
- Habitación personal.
- Gustos y disgustos.
- Relación con la protagonista.
- Rutina cotidiana.
- Misiones individuales.
- Diálogos contextuales.
- Historia personal.
- Progresión de amistad.
- Atuendos desbloqueables.
- Reacciones a las decisiones.
- Participación en las mecánicas.

## 5.1 PIP

**Personalidad:** cariñoso, torpe, inocente, curioso y entusiasta.

Es el mapache más pequeño y expresivo.

Se emociona fácilmente y suele meterse en problemas sin querer.

Le gustan los objetos brillantes, las mantas, los dulces y los regalos.

### Función jugable

- Ayuda a atender mesas.
- Recibe clientes.
- Recolecta objetos pequeños.
- Encuentra regalos.
- Desbloquea misiones de exploración.
- Tiene eventos humorísticos.

### Características especiales

Pip puede perder objetos, traer regalos inesperados o encontrar algo interesante durante una caminata.

Ejemplo:

Pip aparece corriendo.

"¡Encontré un tesoro!"

La protagonista revisa el objeto.

Es una cuchara.

Pip responde:

"Bueno... es un tesoro bastante útil".

Su humor debe ser inocente, natural y adorable.

## 5.2 SPICY BEACON

**Personalidad:** excéntrico, creativo, hiperactivo por momentos, dramático y divertido.

Es el cocinero principal.

Le encantan los experimentos culinarios, especialmente los ingredientes picantes.

Tiene una personalidad teatral.

### Función jugable

- Enseña recetas.
- Participa en minijuegos de cocina.
- Descubre combinaciones especiales.
- Organiza concursos de sushi.
- Permite mejorar la cocina.
- Desbloquea eventos gastronómicos.

### Características especiales

A veces inventa platos extraños.

Ejemplo:

"Acabo de crear mi obra maestra".

"¿Qué tiene?"

"Arroz, salmón, pepino y una cantidad preocupante de wasabi".

Puede existir un sistema para experimentar con ingredientes y descubrir recetas ocultas.

## 5.3 RIGG

**Personalidad:** observador, inteligente, tranquilo, reservado, sarcástico de forma suave y extremadamente leal.

Le interesan los libros, los mapas, los acertijos y los secretos.

### Función jugable

- Acompaña investigaciones.
- Ayuda a interpretar pistas.
- Abre zonas misteriosas.
- Presenta acertijos.
- Participa en capítulos narrativos.
- Mantiene un cuaderno de investigación.

### Características especiales

Rigg nota pequeños detalles que otros personajes ignoran.

Puede hacer comentarios sobre contradicciones de los NPC.

Ejemplo:

"El panadero dijo que nunca estuvo en el faro".

"¿Y?"

"Entonces sería interesante saber por qué tiene una llave del faro".

Sus investigaciones deben ser entretenidas, pero no exageradamente difíciles.

---

# 6. PERSONALIZACIÓN DE LA PROTAGONISTA

La jugadora debe poder crear su propio personaje.

## Editor inicial

Permitir elegir:

- Nombre.
- Apariencia humana o animal antropomórfica.
- Color de piel o pelaje según el tipo de personaje.
- Peinado.
- Color de pelo.
- Ojos.
- Ropa inicial.
- Accesorio.
- Nombre del restaurante, si desea cambiarlo.

Ofrecer varias combinaciones visuales lindas desde el principio.

## Sistema de ropa

Permitir equipar simultáneamente:

- Prenda superior.
- Prenda inferior o vestido.
- Calzado.
- Sombrero o accesorio de cabeza.
- Accesorio facial.
- Accesorio adicional.
- Mochila o bolso.

Las prendas deben superponerse correctamente sobre el sprite.

Incluir estilos:

- Cozy.
- Gótico suave.
- Japonés.
- Casual.
- Pijamas.
- Elegante.
- Invierno.
- Verano.
- Disfraces de animales.
- Atuendos de cocinera.

La apariencia debe poder modificarse sin perder el progreso.

También debe ser posible cambiar la ropa de los tres mapaches.

---

# 7. ESTRUCTURA DEL MUNDO

El juego debe tener un pueblo explorable compuesto por distintas zonas conectadas.

No construir un único mapa gigantesco vacío.

Prefiero mapas medianos, densos, con detalles y actividades reales.

## 7.1 Restaurante Midnight Maki

Ubicación principal.

Incluye:

- Cocina.
- Mostrador.
- Mesas.
- Área de espera.
- Depósito.
- Patio.
- Habitación de la protagonista.
- Habitaciones de los mapaches.
- Espacio para ampliar.

Será la primera zona disponible.

## 7.2 Plaza de Villa Nori

Centro del pueblo.

Contiene:

- Fuente.
- Bancos.
- Puestos.
- Tienda de muebles.
- Tienda de ropa.
- Personajes paseando.
- Cartel de anuncios.
- Decoración estacional.
- Eventos comunitarios.

## 7.3 Bosque Susurrante

Zona natural.

Contiene:

- Árboles.
- Hongos.
- Flores.
- Ingredientes recolectables.
- Animales.
- Senderos ocultos.
- Un lago pequeño.
- Una cabaña misteriosa.
- Acertijos ambientales.

## 7.4 Playa de las Conchas

Contiene:

- Pesca.
- Colección de conchas.
- Botellas con mensajes.
- Muelles.
- Personajes pescando.
- Puestas de sol.
- Un pequeño mercado.

## 7.5 Mercado Nocturno

Una zona especial que aparece durante determinadas noches del calendario del juego.

Incluye:

- Comida especial.
- Objetos raros.
- Ropa exclusiva.
- Minijuegos.
- Diálogos únicos.
- Música diferente.

No depender de fechas reales para visitarlo.

## 7.6 Jardín de los Faroles

Zona tranquila.

Incluye:

- Plantación de flores.
- Cultivos pequeños.
- Decoración exterior.
- Bancos.
- Estanque.
- Mariposas.
- Eventos de amistad.

## 7.7 Estación Abandonada

Zona relacionada con el misterio.

Incluye:

- Documentos antiguos.
- Objetos investigables.
- Puzles.
- Recuerdos.
- Lugares que se desbloquean mediante la historia.

## 7.8 Faro de las Tres Estrellas

Zona avanzada.

Será importante para los últimos capítulos.

Debe tener una identidad visual muy especial.

---

# 8. SISTEMA DE TIEMPO

El juego debe tener un ciclo de tiempo propio.

Un día estándar puede dividirse en:

1. Mañana.
2. Tarde.
3. Atardecer.
4. Noche.

Cada período modifica:

- Iluminación.
- Música.
- Ubicación de NPC.
- Eventos disponibles.
- Actividades opcionales.
- Diálogos.

No utilizar un reloj excesivamente exigente.

Los diálogos, minijuegos y menús deben pausar o ralentizar el tiempo cuando corresponda.

La jugadora puede terminar el día descansando en su habitación.

Debe existir la opción de avanzar de período cuando se hayan completado las tareas que desea hacer.

Nunca castigarla por no jugar todos los días reales.

No incorporar mecánicas de pérdida de recompensas por ausencia.

Cada sesión debería poder durar entre 5 y 30 minutos, sin límite artificial.

---

# 9. GESTIÓN DEL RESTAURANTE

Este será uno de los sistemas principales.

## 9.1 Ciclo del restaurante

1. Consultar pedidos disponibles.
2. Seleccionar pedidos.
3. Revisar ingredientes.
4. Preparar sushi mediante minijuegos.
5. Entregar platos.
6. Recibir monedas, reputación y experiencia.
7. Comprar mejoras.
8. Decorar y expandir.

Debe ser fácil de entender y entretenido desde el primer minuto.

## 9.2 Minijuego de preparación

Crear una interfaz específica de cocina.

El jugador ve:

- Tabla.
- Arroz.
- Alga.
- Ingredientes.
- Utensilios.
- Plato.
- Pedido actual.

Implementar acciones táctiles:

- Arrastrar ingredientes.
- Cortar con gestos sencillos.
- Ordenar piezas.
- Enrollar sushi.
- Decorar el plato.
- Confirmar la preparación.

Ofrecer tres modos de desafío:

**Relajado:** sin cronómetro ni penalizaciones.

**Normal:** puntuación por precisión y eficiencia, sin presión excesiva.

**Desafío:** pedidos especiales con objetivos y tiempo opcional.

El modo relajado debe ser el predeterminado.

## 9.3 Recetas

Implementar al menos 24 recetas distribuidas en categorías.

### Básicas

- Kappa maki.
- Sake maki.
- Tamago nigiri.
- Onigiri.
- California roll.
- Nigiri de salmón.

### Intermedias

- Philadelphia roll.
- Roll de palta.
- Ebi nigiri.
- Futomaki.
- Temaki.
- Gunkan.
- Roll vegetariano.
- Roll crocante.

### Especiales

- Spicy Beacon Roll.
- Pip's Happy Maki.
- Rigg's Midnight Roll.
- Rainbow Roll.
- Dragon Roll.
- Moonlight Sushi.
- Sakura Roll.
- Nori Deluxe.
- Tres Estrellas.
- Maki Secreto.

Cada receta debe tener:

- Identificador único.
- Nombre.
- Descripción.
- Ingredientes.
- Dificultad.
- Precio.
- Experiencia.
- Requisitos de desbloqueo.
- Ícono o sprite.
- Pasos reales de preparación.
- Posibles variantes.

No implementar las 24 recetas como simples botones que otorgan monedas.

Debe existir interacción jugable.

## 9.4 Clientes

Los clientes deben tener cierta personalidad.

Algunos pueden:

- Tener un pedido favorito.
- Regresar frecuentemente.
- Contar historias.
- Desbloquear misiones.
- Pedir recetas especiales.
- Comentar cambios de decoración.
- Presentar amigos.
- Dar pistas.

Crear inicialmente entre 10 y 14 NPC recurrentes, además de clientes genéricos con diseños variados.

## 9.5 Mejoras del restaurante

Desbloquear:

- Más mesas.
- Equipamiento de cocina.
- Vitrinas.
- Iluminación.
- Decoraciones.
- Nuevos ambientes.
- Mejoras de depósito.
- Nuevas estaciones de cocina.
- Jardín exterior.
- Segundo sector del restaurante.

Las mejoras deben ser visibles físicamente en el escenario.

## 9.6 Ayudantes

Los tres mapaches pueden colaborar con habilidades diferentes.

Pip mejora la atención.

Spicy Beacon mejora la preparación.

Rigg ayuda con planificación, recetas y pedidos especiales.

Las mejoras deben ofrecer comodidad sin reemplazar por completo los minijuegos.

---

# 10. ECONOMÍA Y PROGRESIÓN

Utilizar una única moneda común: **Monedas Nori**.

No implementar monedas premium.

El dinero puede ganarse mediante:

- Pedidos.
- Misiones.
- Venta de recursos.
- Eventos.
- Actividades secundarias.
- Logros especiales.

Puede gastarse en:

- Ropa.
- Muebles.
- Decoración.
- Ingredientes.
- Mejoras.
- Accesorios de mapaches.
- Nuevas habitaciones.
- Objetos coleccionables.

## Balance inicial propuesto

- Pedido básico: 15 a 25 monedas.
- Pedido intermedio: 35 a 60.
- Pedido especial: 70 a 120.
- Mueble económico: 50 a 100.
- Mueble mediano: 150 a 300.
- Mueble especial: 400 a 700.
- Ropa común: 80 a 180.
- Mejora importante: 500 a 1.200.

Estos números son referencias iniciales. Ajustalos mediante pruebas para evitar progreso demasiado lento o demasiado rápido.

No quiero que la jugadora tenga que repetir cincuenta veces la misma actividad para comprar una silla.

Las primeras recompensas deben ser frecuentes.

Las mejoras avanzadas pueden requerir más dedicación, pero nunca resultar absurdamente caras.

## Progresión

Crear cuatro progresiones paralelas:

**Nivel del restaurante:** desbloquea instalaciones, recetas y pedidos.

**Reputación del pueblo:** desbloquea NPC, zonas y eventos.

**Amistad:** desbloquea historias y características de personajes.

**Progreso narrativo:** desbloquea capítulos, pistas y zonas misteriosas.

Estas progresiones deben interactuar entre sí.

---

# 11. DECORACIÓN Y CONSTRUCCIÓN

La personalización tiene que ser una de las partes más cuidadas del juego.

## 11.1 Editor de interiores

Permitir:

- Colocar muebles.
- Mover objetos.
- Rotar muebles compatibles.
- Guardar decoraciones.
- Cambiar pisos.
- Cambiar paredes.
- Modificar iluminación.
- Decorar mesas.
- Colocar plantas.
- Colocar cuadros.
- Agregar alfombras.
- Crear rincones temáticos.

Utilizar un sistema de cuadrícula intuitivo.

Mostrar visualmente dónde puede colocarse un objeto.

No permitir bloquear puertas esenciales o rutas que dejarían personajes atrapados.

## 11.2 Catálogo

El juego completo debería incorporar al menos 60 a 80 objetos decorativos diferentes entre muebles, plantas, luces y accesorios.

Organizarlos en categorías:

- Dormitorio.
- Cocina.
- Restaurante.
- Jardín.
- Baño decorativo.
- Iluminación.
- Plantas.
- Paredes.
- Pisos.
- Decoración pequeña.
- Objetos especiales.

## 11.3 Estilos decorativos

- Japonés tradicional.
- Cozy moderno.
- Natural.
- Rosa pastel.
- Oscuro elegante.
- Cottagecore.
- Minimalista.
- Bosque encantado.
- Nocturno.
- Temático de mapaches.

No obligar a seguir un único estilo.

## 11.4 Habitaciones de mapaches

Cada mapache tiene su habitación.

Pip prefiere un ambiente cómodo con peluches.

Spicy Beacon prefiere colores intensos y objetos culinarios.

Rigg prefiere libros, iluminación cálida y muebles antiguos.

Sin embargo, la jugadora puede decorar libremente.

Los mapaches deben reaccionar a algunos muebles y objetos especiales.

---

# 12. ACTIVIDADES SECUNDARIAS Y MINIJUEGOS

Quiero muchas actividades, pero con mecánicas claras y tiempos cortos.

Cada minijuego debe durar aproximadamente entre 30 segundos y 3 minutos, según la actividad.

## 12.1 Pesca

En la playa y el lago.

Mecánica sencilla de controlar una barra o indicador.

Sin controles frustrantes.

Incluir peces comunes, raros y especiales.

Agregar un acuario decorativo para exhibir capturas.

## 12.2 Jardinería

Permitir:

- Plantar semillas.
- Regar.
- Cultivar flores.
- Cultivar ingredientes.
- Recolectar.
- Decorar parcelas.

No permitir que plantas importantes mueran por no entrar al juego.

## 12.3 Recolección

Recolectar:

- Hongos.
- Flores.
- Frutas.
- Conchas.
- Piedras especiales.
- Maderas.
- Ingredientes raros.

Las zonas de recolección pueden variar entre días del juego.

## 12.4 Ordenar objetos

Minijuego satisfactorio de organización.

Por ejemplo:

- Ordenar ingredientes en cajones.
- Acomodar una despensa.
- Organizar platos.
- Clasificar paquetes.
- Ordenar libros.

Utilizar drag and drop con animaciones agradables.

## 12.5 Combinar objetos

Minijuego de fusión inspirado en los juegos casuales móviles.

Combinar objetos idénticos para obtener otros más avanzados.

Ejemplo:

Semilla → Brote → Planta → Flor especial.

Debe ser una actividad acotada y conectada con la decoración y la recolección.

No crear un sistema interminable de energía y esperas.

## 12.6 Puzles

Incluir:

- Patrones.
- Llaves.
- Secuencias.
- Objetos ocultos.
- Conexiones.
- Combinaciones.
- Acertijos ambientales.

Incorporar pistas progresivas.

## 12.7 Limpieza y restauración

Permitir restaurar determinados objetos o lugares.

Ejemplos:

- Limpiar una mesa antigua.
- Reparar el cartel del restaurante.
- Restaurar una máquina.
- Ordenar una cabaña.
- Arreglar un jardín.

Utilizar mecánicas táctiles satisfactorias.

## 12.8 Coleccionismo de insectos

Capturar mariposas y otros insectos de forma tranquila.

Crear un pequeño álbum ilustrado.

Agregar rarezas y condiciones de aparición.

## 12.9 Fotografía

Agregar una cámara dentro del juego.

Permitir fotografiar:

- Los mapaches.
- Escenarios.
- Decoraciones.
- Momentos especiales.
- Objetos de interés.

Las fotografías pueden almacenarse en un álbum interno.

## 12.10 Cartas y pequeños juegos de mesa

Crear uno o dos juegos sencillos que puedan jugarse contra los mapaches.

Por ejemplo, un juego de memoria con ingredientes de sushi o cartas coleccionables.

---

# 13. NOVELA VISUAL E HISTORIA

La historia debe tener importancia real.

No quiero un texto introductorio de treinta segundos y después un juego sin argumento.

## 13.1 Sistema de diálogos

Implementar:

- Caja de diálogo elegante.
- Retratos expresivos.
- Nombre del personaje.
- Texto progresivo.
- Botón para mostrar texto completo.
- Historial de conversación.
- Opciones de respuesta.
- Decisiones narrativas.
- Animaciones y sonidos suaves.
- Posibilidad de omitir escenas ya vistas.
- Guardado de decisiones importantes.

Los textos deben sonar naturales.

Evitar diálogos artificiales y exageradamente infantiles.

Los personajes pueden ser adorables sin hablar como bebés.

## 13.2 Relaciones

Cada NPC importante debe tener:

- Afinidad.
- Personalidad.
- Preferencias.
- Eventos.
- Recuerdos.
- Diálogos desbloqueables.

La afinidad puede tener cinco niveles.

Al aumentar la relación se desbloquean:

- Nuevas conversaciones.
- Historias personales.
- Regalos.
- Escenas.
- Objetos.
- Ayudas.
- Recuerdos.

No se debe perder amistad por no jugar durante un tiempo.

## 13.3 Memoria contextual

Implementar un sistema ligero de recuerdos mediante flags.

Ejemplos:

- Si la jugadora regaló una manta a Pip, Pip puede mencionarla.
- Si preparó muchas recetas picantes, Spicy Beacon puede comentarlo.
- Si resolvió un misterio con Rigg, aparecerán nuevas conversaciones.
- Si decoró una habitación, los personajes podrán reaccionar.
- Si ayudó a un vecino, ese vecino recordará la acción.

No es necesario usar una IA generativa para los diálogos.

Preferir diálogos escritos, ramificados y controlados, con buena calidad narrativa.

---

# 14. HISTORIA PRINCIPAL: LAS TRES ESTRELLAS

Crear una narrativa principal dividida en ocho capítulos completos.

Cada capítulo debe incluir exploración, personajes, diálogos, pistas, acontecimientos y un cierre que motive a continuar.

## Prólogo: Una carta inesperada

La protagonista llega a Villa Nori.

Descubre Midnight Maki y conoce a los tres mapaches.

Aprende las mecánicas básicas.

Encuentra un dibujo antiguo de tres estrellas.

## Capítulo 1: El restaurante olvidado

La protagonista restaura el restaurante.

Conoce a los primeros vecinos.

Descubre que el antiguo dueño desapareció misteriosamente.

Una nota aparece en el depósito.

## Capítulo 2: El extraño pedido

Llega un pedido de sushi sin remitente.

El pedido contiene instrucciones que parecen señalar una ubicación.

Rigg empieza a investigar.

Se descubre un compartimento oculto.

## Capítulo 3: Los recuerdos de Pip

Pip reconoce un objeto que aparentemente nunca había visto.

La jugadora investiga con él.

Se profundiza en su historia personal.

Una antigua fotografía revela una contradicción.

## Capítulo 4: La receta imposible

Spicy Beacon descubre una receta escrita en un cuaderno antiguo.

Al preparar el plato se desbloquea una pista.

El mercado nocturno adquiere protagonismo.

La protagonista descubre que el restaurante era un punto de reunión secreto.

## Capítulo 5: Las mentiras de Villa Nori

Algunos vecinos cuentan versiones contradictorias sobre el pasado.

Implementar escenas de interrogatorio suave.

La jugadora debe analizar pistas y elegir cuál contradicción investigar.

No utilizar violencia extrema.

## Capítulo 6: El secreto de Rigg

Rigg revela por qué ha estado investigando desde antes de conocer a la protagonista.

Su historia debe tener profundidad emocional.

Se descubre la ubicación de una de las estrellas.

## Capítulo 7: La noche sin constelaciones

Ocurre un evento especial en el pueblo.

La protagonista debe reunir las pistas más importantes.

Se abre el acceso al faro.

Los tres mapaches participan activamente.

## Capítulo 8: Las tres estrellas

La protagonista descubre la verdad.

La explicación debe estar preparada por las pistas anteriores, no aparecer de la nada.

La constelación representa una antigua promesa de proteger el pueblo y sus recuerdos.

Las tres estrellas son símbolos vinculados a tres piezas de un antiguo mecanismo del faro.

Al reunirlas se revelan cartas, fotografías y recuerdos que explican la desaparición del antiguo dueño.

El misterio se resuelve de manera satisfactoria.

La jugadora puede tomar decisiones que cambien determinadas escenas del final.

## Finales

Implementar tres variaciones:

**Final de la amistad:** se centra en el vínculo con los mapaches.

**Final del pueblo:** se centra en restaurar la comunidad.

**Final de las estrellas:** se desbloquea al completar ciertos recuerdos especiales y revela una escena adicional.

Todos los finales deben ser positivos y permitir continuar jugando.

No bloquear permanentemente contenido importante por una decisión.

## Después de terminar la historia

El juego sigue funcionando.

Se desbloquean:

- Nuevas recetas.
- Decoraciones.
- NPC.
- Misiones.
- Eventos.
- Una zona especial.
- Nuevos diálogos.

El final narrativo no debe ser el final de la partida.

---

# 15. INVESTIGACIÓN Y MISTERIOS

Inspirarse en el placer de investigar de las novelas de misterio.

## Sistema de pistas

Crear un cuaderno donde guardar:

- Fotografías.
- Testimonios.
- Cartas.
- Objetos.
- Lugares.
- Contradicciones.
- Hipótesis.

## Mecánicas

La jugadora puede:

- Inspeccionar un escenario.
- Encontrar objetos.
- Hablar con testigos.
- Revisar documentos.
- Comparar testimonios.
- Relacionar dos pistas.
- Elegir una conclusión.

Crear una pantalla de investigación clara y atractiva.

No obligar a memorizar conversaciones enteras.

Toda información necesaria debe quedar en el cuaderno.

Implementar pistas opcionales en tres niveles:

1. Sugerencia general.
2. Indicación más concreta.
3. Solución guiada.

Las investigaciones deben generar satisfacción intelectual sin bloquear la historia durante horas.

---

# 16. MISIONES Y OBJETIVOS

Implementar tres clases de misiones.

## 16.1 Misiones principales

Avanzan la historia.

Tienen escenas y consecuencias narrativas.

## 16.2 Misiones secundarias

Desarrollan vecinos, mapaches o lugares.

Ejemplos:

- Ayudar a Pip a recuperar un objeto.
- Buscar un ingrediente para Spicy Beacon.
- Encontrar un libro perdido de Rigg.
- Decorar un sector del restaurante.
- Preparar un pedido para un vecino.
- Restaurar una fuente.
- Buscar un mensaje en una botella.

## 16.3 Actividades opcionales

Pequeños objetivos como:

- Preparar tres recetas diferentes.
- Capturar un pez.
- Comprar un accesorio.
- Fotografiar un mapache.
- Descubrir una planta.

Estas actividades deben ofrecer recompensas, pero no ser obligatorias.

Crear al menos 25 misiones secundarias definidas y un sistema de variantes para pequeños encargos.

No generar misiones repetitivas sin límite solo para aparentar cantidad de contenido.

---

# 17. EVENTOS ESPECIALES

Crear un calendario interno de Villa Nori.

No utilizar fechas del mundo real para exigir participación.

Eventos posibles:

## Festival del Sushi

Competencia amistosa de recetas.

Premios decorativos y diálogos.

## Noche de Faroles

El pueblo se ilumina.

Escenas especiales y objetos exclusivos del evento.

## Día de los Mapaches

Celebración dedicada a Pip, Spicy Beacon y Rigg.

Minijuegos, regalos y nuevos atuendos.

## Festival de las Flores

Actividades de jardinería, decoraciones y concursos.

## Mercado de la Luna

Comerciantes especiales y objetos raros.

## Día de la Lluvia

Evento pequeño donde los personajes se reúnen en el restaurante.

No todos los eventos necesitan ser enormes.

Algunos pueden consistir en una escena breve, una pequeña actividad y una recompensa memorable.

Los eventos deben poder repetirse en el calendario interno.

---

# 18. PERSONAJES DEL PUEBLO

Crear un elenco secundario con identidad propia.

Personajes sugeridos:

**Momo, la gata florista:** tranquila, algo tímida, amante de las plantas.

**Taro, el zorro comerciante:** simpático, negociante, siempre conoce rumores.

**Yuki, la coneja costurera:** creativa, perfeccionista, vende ropa y accesorios.

**Kumo, el gato bibliotecario:** reservado, inteligente, conoce la historia del pueblo.

**Nami, la nutria pescadora:** alegre, enseña a pescar y colecciona conchas.

**Hoshi, la lechuza astrónoma:** estudia el cielo y las estrellas.

**Bento, el oso panadero:** amable, enorme y apasionado por cocinar.

**Mika, la zorra artista:** vende pinturas y decoraciones.

**Kiki, la ardilla exploradora:** inquieta, conoce caminos secretos.

**Sora, el perro cartero:** entrega correspondencia y misiones.

Agregar algunos personajes adicionales para completar el pueblo.

Cada NPC principal debe tener:

- Sprite identificable.
- Retrato.
- Nombre.
- Rutina.
- Hogar o lugar habitual.
- Conversaciones.
- Gustos.
- Al menos una misión personal.
- Alguna relación con otros vecinos.

Los NPC deben caminar por el pueblo según horarios razonables.

No permitir que todos se queden inmóviles en el mismo lugar durante todo el juego.

---

# 19. COLECCIONES Y LOGROS

Implementar un menú de colecciones atractivo.

Categorías:

- Recetas descubiertas.
- Peces.
- Insectos.
- Flores.
- Conchas.
- Cartas.
- Fotografías.
- Objetos raros.
- Recuerdos de personajes.
- Muebles obtenidos.
- Atuendos.

Crear logros con nombres simpáticos.

Ejemplos:

- Primer Maki.
- Chef Mapache.
- Amigos Inseparables.
- Detectives Nocturnos.
- Decoradora Profesional.
- Reina del Sushi.
- Coleccionista de Estrellas.
- El Tesoro de Pip.
- Picante, Pero No Tanto.
- Rigg Tenía Razón.

Mostrar avances y porcentajes de manera discreta.

No utilizar notificaciones gigantes cada treinta segundos.

---

# 20. INTERFAZ DE USUARIO

La UI es fundamental.

Quiero una interfaz bonita, limpia, rápida y fácil de comprender.

El videojuego debe ocupar casi toda la pantalla.

Evitar paneles enormes y múltiples barras de estado permanentes.

## Pantalla principal

Debe incluir:

- Logotipo Midnight Maki.
- Continuar.
- Nueva partida.
- Ajustes.
- Créditos.

Fondo animado del restaurante de noche.

## Durante la exploración

Mostrar únicamente:

- Pequeño indicador del momento del día.
- Monedas.
- Botón de mochila.
- Botón de diario.
- Botón de menú.
- Indicadores contextuales cuando corresponda.

No llenar la pantalla de iconos.

## Menú principal del juego

Secciones:

- Mochila.
- Personaje.
- Mapa.
- Misiones.
- Relaciones.
- Colecciones.
- Decoración.
- Configuración.

## Inventario

Debe tener:

- Íconos claros.
- Categorías.
- Información contextual.
- Capacidad razonable o ilimitada para objetos normales.
- Selección táctil sencilla.
- Filtros.
- Uso rápido.

No crear sistemas de inventario frustrantes.

## Diálogos

Utilizar una caja inferior semitransparente o sólida con estilo acorde al juego.

Retratos expresivos.

Texto grande y legible.

Opciones de respuesta fáciles de pulsar.

## Restaurante

Durante la cocina, ocultar elementos de exploración que no sean necesarios.

Cada actividad debe tener su propia interfaz especializada.

## Reglas UX

- Botones táctiles suficientemente grandes.
- No depender de hover.
- Evitar doble clic obligatorio.
- Transiciones rápidas.
- Confirmación para acciones destructivas.
- Cerrar ventanas de forma intuitiva.
- Sin scroll innecesario en pantallas jugables.
- Textos legibles sin zoom.
- Adaptación a notch y zonas seguras del iPhone.
- Feedback visual inmediato en interacciones.
- Deshacer movimientos de decoración cuando sea posible.

---

# 21. CONTROLES

## Celular

Implementar preferentemente movimiento tocando el suelo para caminar hacia una ubicación.

Agregar joystick virtual opcional.

Botón de interacción contextual al acercarse a un objeto.

Permitir arrastrar, soltar y tocar en minijuegos.

El control táctil debe sentirse natural.

Evitar que el personaje se mueva accidentalmente cuando la jugadora intenta desplazar un panel.

## Computadora

- WASD o flechas para caminar.
- E para interactuar.
- Escape para cerrar menús.
- Mouse para seleccionar.
- Click sobre ubicaciones para desplazarse cuando corresponda.

Las acciones importantes deben poder hacerse sin memorizar atajos.

## Orientación

Priorizar diseño vertical en celulares cuando se juega exploración y actividades casuales.

Adaptar el mundo visible a pantallas anchas de escritorio.

Si algún minijuego requiere una disposición diferente, rediseñar su interfaz según el espacio disponible.

No limitarse a achicar una pantalla de PC hasta que resulte ilegible.

---

# 22. DISEÑO PARA EVITAR SOBRESTIMULACIÓN

Este punto tiene una importancia especial.

El juego debe ofrecer varias alternativas para mantener el interés, pero debe ser tranquilo y fácil de procesar.

## Reglas obligatorias

1. No mostrar diez misiones al mismo tiempo.
2. Mostrar una misión activa y permitir revisar las demás.
3. No exigir completar actividades en determinado orden salvo las necesarias para la historia.
4. No usar sonidos estridentes.
5. No mostrar ventanas emergentes constantemente.
6. No utilizar efectos intermitentes o flashes fuertes.
7. No penalizar la inactividad.
8. No incorporar mecánicas de energía que obliguen a esperar.
9. Permitir guardar y salir en cualquier momento.
10. Dar recompensas frecuentes pero razonables.
11. Permitir alternar entre actividades cortas y largas.
12. No usar notificaciones de urgencia engañosas.
13. No introducir monedas premium ni microtransacciones.
14. Permitir reducir movimientos y partículas.
15. Permitir controlar el volumen de música y efectos.
16. Evitar sonidos superpuestos innecesarios.
17. Permitir ampliar textos.
18. Ofrecer pistas para acertijos.
19. Evitar castigos importantes por equivocaciones.
20. Hacer tutoriales cortos e interactivos.

## Sistema de sugerencias

Cuando la protagonista está libre, el juego puede sugerir discretamente tres alternativas.

Por ejemplo:

- Preparar sushi.
- Visitar a Rigg.
- Decorar tu habitación.

Estas sugerencias no son órdenes ni misiones obligatorias.

La jugadora puede ignorarlas sin consecuencias.

---

# 23. MÚSICA Y SONIDO

Crear una identidad sonora coherente.

## Música ambiental

- Tema principal del pueblo.
- Restaurante de día.
- Restaurante de noche.
- Bosque.
- Playa.
- Mercado nocturno.
- Investigación.
- Eventos emotivos.
- Festival.

Estilos musicales:

- Lo-fi suave.
- Piano tranquilo.
- Instrumentos acústicos.
- Melodías japonesas originales.
- Ambientación nocturna acogedora.

Las piezas deben sonar bien en bucle.

No utilizar música comercial sin licencia.

## Efectos

- Pasos.
- Interacciones.
- Cortar ingredientes.
- Colocar muebles.
- Recibir monedas.
- Abrir menús.
- Recoger objetos.
- Agua.
- Lluvia.
- Sonidos suaves de personajes.

No reproducir audio automáticamente antes de la primera interacción permitida por el navegador.

Incluir controles independientes de música, ambiente y efectos.

Si inicialmente no se dispone de todos los archivos de sonido, utilizar efectos propios sintetizados o generados de manera legal y reemplazables posteriormente.

---

# 24. SISTEMA DE GUARDADO

Debe guardar automáticamente:

- Progreso principal.
- Capítulos.
- Misiones.
- Inventario.
- Dinero.
- Recetas.
- Muebles.
- Decoraciones colocadas.
- Personaje.
- Ropa.
- Relaciones.
- Decisiones.
- Colecciones.
- Tiempo interno.
- Eventos completados.
- Configuraciones.

Usar IndexedDB.

Crear un sistema de versiones de datos y migraciones para futuras actualizaciones.

Evitar pérdida de progreso cuando se publica una versión nueva.

Implementar exportación e importación manual de partidas mediante archivo JSON validado.

Esto también permite transferir partidas entre dispositivos, aunque no haya sincronización automática en la nube.

El guardado automático debe ocurrir en puntos seguros y después de cambios importantes.

No guardar partidas incompatibles o incompletas.

---

# 25. ARQUITECTURA DEL PROYECTO

Organizar profesionalmente el código.

Estructura orientativa:

src/
- core/
- game/
- scenes/
- entities/
- characters/
- world/
- systems/
- minigames/
- story/
- dialogue/
- quests/
- restaurant/
- inventory/
- economy/
- decoration/
- customization/
- audio/
- ui/
- data/
- persistence/
- utils/
- tests/

public/
- assets/
- sprites/
- tilesets/
- maps/
- ui/
- audio/
- fonts/

No es obligatorio utilizar exactamente esta estructura si existe una mejor solución, pero sí mantener separación clara de responsabilidades.

## Sistemas independientes

Crear módulos desacoplados para:

- Gestión de escenas.
- Control del jugador.
- Movimiento y colisiones.
- Navegación.
- Interacciones.
- Reloj.
- NPC y rutinas.
- Diálogos.
- Eventos.
- Inventario.
- Moneda.
- Tienda.
- Recetas.
- Cocina.
- Decoración.
- Misiones.
- Relaciones.
- Colecciones.
- Narrativa.
- Guardado.
- Audio.
- Accesibilidad.

Utilizar identificadores estables y datos tipados.

Separar contenido narrativo y parámetros de balance de la lógica de programación.

Agregar validaciones para evitar:

- Items duplicados accidentalmente.
- Guardados corruptos.
- Misiones bloqueadas.
- Diálogos repetidos incorrectamente.
- Dinero negativo.
- Objetos inaccesibles.
- NPC atrapados.
- Errores de colisión.
- Pérdida de progreso narrativo.

No concentrar todo el videojuego en un único archivo gigante.

---

# 26. INTELIGENCIA DE LOS NPC

No necesito una IA generativa dentro del juego.

Prefiero personajes diseñados cuidadosamente.

Implementar máquinas de estado o sistemas de comportamiento simples.

Cada NPC puede:

- Caminar.
- Descansar.
- Trabajar.
- Conversar.
- Visitar lugares.
- Reaccionar a la protagonista.
- Participar en eventos.

Los tres mapaches deben tener rutinas más elaboradas.

## Ejemplo de Pip

Mañana: juega cerca del restaurante.

Tarde: ayuda a atender.

Atardecer: pasea por el jardín.

Noche: vuelve a su habitación.

Ocasionalmente puede iniciar un evento especial.

Las rutinas no deben impedir completar misiones por perder una ventana de tiempo. Siempre debe existir una alternativa para avanzar.

---

# 27. INICIO DEL JUEGO Y TUTORIAL

El inicio debe ser atractivo y breve.

## Secuencia inicial

Pantalla oscura.

Se escucha lluvia suave.

Aparece una carta.

La protagonista llega a Villa Nori.

Se muestra el pueblo con música acogedora.

El jugador camina hasta el restaurante.

Al entrar, encuentra a Pip intentando alcanzar un frasco.

El frasco cae.

Spicy Beacon aparece desde la cocina.

Rigg observa la situación desde una mesa.

Comienza una conversación divertida.

Los mapaches explican que el restaurante está prácticamente abandonado.

La protagonista decide quedarse.

## Tutorial

Enseñar progresivamente:

1. Movimiento.
2. Interacción.
3. Conversaciones.
4. Preparar el primer sushi.
5. Recibir monedas.
6. Comprar un objeto.
7. Decorar.
8. Guardar y descansar.

Cada aprendizaje debe ocurrir mediante situaciones reales.

No mostrar un manual enorme al principio.

Al finalizar el tutorial, dejar que la jugadora explore libremente.

---

# 28. PRIMERAS DOS HORAS DE JUEGO

Diseñar especialmente bien el comienzo.

## Primeros 10 minutos

- Introducción.
- Conocer los tres mapaches.
- Explorar el restaurante.
- Preparar el primer sushi.
- Ganar monedas.
- Conocer el misterio inicial.

## Minutos 10 a 25

- Primeros pedidos.
- Visitar la plaza.
- Comprar decoración.
- Modificar la habitación.
- Conocer dos NPC.

## Minutos 25 a 45

- Desbloquear el primer evento de Pip.
- Acceder a la playa.
- Probar la pesca.
- Encontrar un objeto misterioso.

## Minutos 45 a 75

- Obtener nuevas recetas.
- Desbloquear una misión de Spicy Beacon.
- Ampliar el restaurante.
- Cambiar ropa.
- Iniciar la primera investigación.

## Minutos 75 a 120

- Conocer a Rigg más profundamente.
- Resolver el primer misterio.
- Desbloquear una nueva zona.
- Obtener un recuerdo especial.
- Acceder al siguiente capítulo.

No usar bloqueos artificiales solo para alargar estas duraciones.

Son estimaciones de ritmo, no tiempos obligatorios.

---

# 29. DURACIÓN Y CONTENIDO

El objetivo final es construir un juego con contenido suficiente para varias semanas de partidas tranquilas.

No quiero inflar la duración con tareas repetidas.

Contenido objetivo de la versión completa:

- 8 capítulos principales más prólogo.
- 3 personajes protagonistas centrales.
- 10 a 14 NPC recurrentes.
- 8 zonas explorables.
- 24 recetas.
- 25 o más misiones secundarias.
- 8 a 10 minijuegos.
- 60 a 80 elementos decorativos.
- Varias categorías de ropa.
- 5 niveles de amistad por personaje principal.
- 6 eventos especiales.
- Sistema de colecciones.
- Misterios secundarios.
- Tres variaciones del final.
- Contenido posterior a la historia.

Todo el contenido debe ser funcional.

Un sistema pequeño terminado es mejor que uno grande donde la mitad de las cosas no funcionan.

---

# 30. DETALLES QUE HARÁN ESPECIAL EL JUEGO

Agregar pequeñas interacciones que le den personalidad.

Ideas:

- Pip puede quedarse dormido sobre una mesa.
- Spicy Beacon puede preparar una receta espantosa.
- Rigg puede leer un libro al revés y fingir que no pasa nada.
- Los mapaches pueden reunirse a dormir.
- Algunos personajes se esconden de la lluvia.
- Los NPC comentan la decoración.
- Hay conversaciones diferentes según la hora.
- Al cocinar una receta por primera vez aparece una pequeña celebración.
- Las fotografías importantes se guardan en un álbum.
- Los regalos especiales aparecen en las habitaciones.
- Los mapaches recuerdan sus cumpleaños dentro del calendario del juego.
- Una noche puede haber una lluvia de estrellas.
- Algunos muebles permiten animaciones particulares.
- Los mapaches pueden sentarse juntos en determinados muebles.
- Los NPC pueden hablar entre ellos.
- Algunos secretos requieren regresar a lugares ya visitados.
- Se pueden encontrar cartas escondidas.
- Los logros pueden desbloquear objetos cosméticos.
- Hay un álbum de recuerdos de los tres mapaches.
- El restaurante cambia visualmente a medida que mejora.

No agregar todos estos elementos de manera superficial.

Cada pequeño detalle debe sentirse integrado.

---

# 31. CONTENIDO PERSONALIZADO PARA SOFI

Este juego es un regalo.

Por eso debe tener pequeños detalles personales discretos.

## Inicio

Permitir que el nombre predeterminado de la protagonista sea Sofi, pero que pueda cambiarlo.

## Los mapaches

Pip, Spicy Beacon y Rigg deben conservar exactamente esos nombres.

No modificar ni traducir sus nombres.

## Sorpresas

Añadir objetos personales escondidos.

Ejemplos:

- Un peluche de mapache.
- Una fotografía de los tres protagonistas.
- Una carta especial.
- Una receta llamada "Maki de Sofi".
- Un pequeño rincón secreto decorado con estrellas.

## Escena especial

Después de completar la historia principal y reunir los recuerdos de los tres mapaches, desbloquear una escena en el restaurante.

Los mapaches preparan una cena especial.

Aparece un regalo.

La jugadora puede abrir una carta que contiene:

"Este pequeño mundo es para vos, Sofi.

Para que tengas un lugar al que volver, tres mapaches que siempre te esperen y todas las aventuras que quieras vivir.

Con amor, Santi."

La escena debe ser tierna, breve y cuidada.

No convertir todo el juego en una dedicatoria constante.

La sorpresa funciona mejor si aparece naturalmente.

---

# 32. SISTEMA DE CALIDAD Y PRUEBAS

No dar por terminado un sistema porque su interfaz se vea bien.

Cada mecánica debe funcionar de verdad.

## Verificaciones obligatorias

### Exploración

- El personaje se mueve.
- Las colisiones funcionan.
- Las puertas conectan mapas.
- Los NPC no atraviesan paredes.
- La cámara sigue al personaje.
- Los controles táctiles responden.

### Restaurante

- Se reciben pedidos.
- Se consumen ingredientes.
- Se preparan recetas.
- Se detecta la finalización del minijuego.
- Se entregan platos.
- Se reciben recompensas.
- Se actualizan inventario y economía.

### Historia

- Las misiones se activan.
- Los diálogos aparecen correctamente.
- Las decisiones se guardan.
- Los capítulos se desbloquean.
- No hay bloqueos narrativos.

### Decoración

- Los muebles se compran.
- Se colocan.
- Se mueven.
- No se pierden.
- Persisten después de reiniciar.

### Guardado

- La partida se conserva.
- Las decisiones persisten.
- El inventario se restaura.
- Las misiones vuelven al estado correcto.
- No se duplican recompensas.

### Celular

- No hay elementos fuera de pantalla.
- Los botones se pueden pulsar.
- Los paneles se pueden cerrar.
- No se requieren controles de PC.
- El juego no se rompe al cambiar dimensiones.
- Se respetan las zonas seguras.

### Rendimiento

- No hay pérdidas importantes de memoria.
- No se crean objetos indefinidamente.
- No hay animaciones ejecutándose fuera de pantalla sin necesidad.
- Las texturas se reutilizan.
- El juego puede permanecer abierto durante sesiones largas.

Crear pruebas automatizadas donde corresponda y ejecutar comprobaciones reales.

Corregir errores detectados antes de considerar terminada una etapa.

---

# 33. PLAN DE DESARROLLO OBLIGATORIO

No intentes generar todo el juego de una sola vez con código improvisado.

Quiero que lo construyas progresivamente, manteniendo una versión jugable en cada etapa.

## ETAPA 1: Base técnica y primera experiencia

Crear:

- Proyecto.
- Configuración.
- Motor.
- Pantalla principal.
- Sistema de escenas.
- Escalado.
- Controles.
- Personaje inicial.
- Primer mapa del restaurante.
- Primeras animaciones.
- Sistema de interacciones.
- Guardado básico.

Al finalizar esta etapa debo poder entrar, mover el personaje, interactuar y guardar.

## ETAPA 2: Personajes y vida cotidiana

Agregar:

- Pip.
- Spicy Beacon.
- Rigg.
- Rutinas básicas.
- Diálogos.
- Retratos.
- Relaciones.
- Cambios de horario.
- Eventos contextuales.

Los personajes deben sentirse vivos.

## ETAPA 3: Restaurante funcional

Agregar:

- Pedidos.
- Ingredientes.
- Inventario.
- Cocina.
- Minijuegos iniciales.
- Monedas.
- Clientes.
- Mejoras.
- Primeras recetas.

Debe existir un ciclo completo y entretenido de gestión.

## ETAPA 4: Decoración y personalización

Agregar:

- Editor de personaje.
- Ropa.
- Tienda.
- Muebles.
- Editor de habitaciones.
- Decoración persistente.
- Habitaciones de mapaches.

## ETAPA 5: Pueblo y exploración

Agregar:

- Plaza.
- Playa.
- Bosque.
- NPC.
- Tiendas.
- Recolección.
- Pesca.
- Jardinería.
- Misiones secundarias.

## ETAPA 6: Historia y misterio

Agregar:

- Novela visual.
- Cuaderno.
- Sistema de pistas.
- Investigaciones.
- Decisiones.
- Capítulos narrativos.
- Eventos de los mapaches.

## ETAPA 7: Expansión del contenido

Completar:

- Todas las zonas.
- Recetas.
- Minijuegos.
- NPC.
- Decoraciones.
- Atuendos.
- Capítulos.
- Misiones.
- Colecciones.
- Finales.
- Eventos.

## ETAPA 8: Pulido profesional

Trabajar en:

- Animaciones.
- Audio.
- Balance.
- Transiciones.
- Optimización.
- Accesibilidad.
- Corrección de errores.
- Controles móviles.
- PWA.
- Pruebas finales.

No avanzar dejando errores graves en etapas anteriores.

---

# 34. CRITERIOS DE ACEPTACIÓN

El juego estará terminado cuando:

1. Se pueda iniciar una partida nueva.
2. Se pueda crear y personalizar el personaje.
3. Exista un mundo navegable.
4. Los tres mapaches tengan personalidad y comportamiento.
5. El restaurante pueda administrarse.
6. Los minijuegos funcionen.
7. Sea posible ganar y gastar monedas.
8. La protagonista pueda decorar.
9. El inventario funcione.
10. Los NPC tengan diálogos y eventos.
11. Las relaciones progresen.
12. Se puedan completar misiones.
13. Existan capítulos narrativos jugables.
14. Los misterios puedan resolverse.
15. Las decisiones importantes persistan.
16. Existan actividades secundarias reales.
17. Se puedan obtener coleccionables.
18. Se pueda terminar la historia.
19. Se pueda continuar jugando después del final.
20. La partida se guarde correctamente.
21. El juego funcione en celular.
22. El rendimiento sea adecuado.
23. Los principales errores estén corregidos.
24. La estética sea consistente.
25. Los sistemas se sientan conectados.

No considerar terminada una característica que solamente tenga un botón, una pantalla falsa o datos inventados sin lógica funcional.

---

# 35. INSTRUCCIONES FINALES DE IMPLEMENTACIÓN

Quiero que actúes como un desarrollador responsable de entregar el videojuego.

No te limites a explicar qué habría que programar.

**ESCRIBÍ EL CÓDIGO Y CONSTRUÍ EL PROYECTO.**

Instrucciones:

1. Inspeccioná primero el proyecto si ya existen archivos.
2. Creá una arquitectura clara y mantenible.
3. Establecé una dirección artística consistente.
4. Implementá una base jugable real.
5. Avanzá por etapas de manera ordenada.
6. Utilizá código modular y tipado.
7. Priorizá una buena experiencia móvil.
8. Creá contenido original.
9. Evitá dependencias de recursos inexistentes.
10. Si faltan sprites, producí recursos provisionales coherentes, idealmente sprites pixel art originales generados para el juego. No dejes recursos rotos.
11. Implementá sistemas reales y persistentes.
12. No reemplaces funcionalidades por alertas de JavaScript.
13. No uses botones decorativos que no hagan nada.
14. No declares terminadas funcionalidades incompletas.
15. Ejecutá pruebas y corregí errores.
16. Conservá el progreso entre iteraciones.
17. Documentá las decisiones técnicas principales.
18. Mantené un archivo de tareas y estado de implementación.
19. Si el desarrollo excede el contexto disponible, dejá el proyecto funcionando y documentá exactamente cómo continuar.
20. No sacrifiques calidad ni estabilidad para simular que todo está terminado.

Cuando debas elegir entre implementar veinte sistemas incompletos o cinco sistemas excelentes, priorizá los sistemas excelentes y continuá ampliando después.

Sin embargo, mantené todos los sistemas de este documento como parte del alcance final.

No elimines funcionalidades silenciosamente.

Si una decisión requiere simplificar algo, explicá la razón y mantené documentada la versión completa prevista.

## Entregables del proyecto

El repositorio debe contener:

- Código fuente.
- Recursos gráficos.
- Datos narrativos.
- Configuración.
- Documentación.
- Instrucciones de ejecución.
- Sistema de guardado.
- Pruebas.
- Configuración PWA.
- Registro de funcionalidades terminadas y pendientes.

Crear también un archivo `GAME_DESIGN.md` con la especificación del videojuego, un archivo `ROADMAP.md` con las etapas y un archivo `PROGRESS.md` con avances verificados.

No modificar decisiones de diseño fundamentales sin una razón técnica clara.

## Prioridad de desarrollo

Orden de prioridades:

1. Diversión y sensación de juego real.
2. Personajes memorables.
3. Mecánicas fáciles y satisfactorias.
4. Experiencia táctil.
5. Progresión atractiva.
6. Personalización.
7. Historia.
8. Variedad.
9. Detalles ambientales.
10. Pulido.

Estas prioridades no significan que la historia o la estética deban descuidarse. Significan que primero debe existir una experiencia jugable y estable.

---

# 36. VISIÓN FINAL

Midnight Maki no debe sentirse como una aplicación con varias actividades conectadas mediante menús.

Debe sentirse como un pequeño mundo vivo.

La jugadora debería poder despertarse en su habitación, encontrarse con Pip, bajar al restaurante, preparar sushi con Spicy Beacon, salir a la plaza, comprar un vestido, conocer a un vecino, descubrir una pista con Rigg, pescar en la playa y regresar a decorar antes de dormir.

Y todo eso debe ocurrir de manera fluida, como partes del mismo videojuego.

Quiero que los personajes tengan encanto, que la historia genere curiosidad y que siempre haya alguna actividad interesante disponible.

No busco gráficos hiperrealistas.

No busco complejidad innecesaria.

No busco sistemas exagerados.

Busco una experiencia pixel art hermosa, cómoda, personalizable, entretenida, con profundidad y mucho cariño en los detalles.

**El resultado final tiene que ser un videojuego que Sofi quiera abrir porque disfruta estar en Villa Nori, no simplemente porque todavía tenga misiones pendientes.**

Comenzá inspeccionando el entorno, organizando el proyecto y desarrollando la primera etapa funcional. Si tenés acceso a herramientas de terminal, archivos y navegador, utilizalas para implementar y verificar el juego de verdad.

Continuá progresivamente con las etapas siguientes dentro de los límites de ejecución disponibles, manteniendo siempre una compilación jugable y un registro preciso de lo que todavía falta.
