# Plan de mejoras, segunda lista (31/10/2026)

Orden: de lo más acotado a lo más grande, con un commit por punto y tests existentes en cada paso.

1. **Zonas de pesca rotas.** Hoy hay lugares sin agua cerca (río del este, playa), lugares dentro del agua (estanque
   del bosque, koi del jardín) y pares duplicados en los muelles. Cada lugar de pesca se mueve a la baldosa caminable
   más cercana que toca agua; los duplicados se eliminan.
2. **Un tipo de árbol por zona.** Bosque, Bosque profundo y estación: árbol oscuro con movimiento. Jardín, centro y barrio:
   árbol verde con movimiento. Santuario: pino japonés (los cerezos quedan como acento en santuario y centro).
3. **Cámara en interiores.** La cámara puede pasar unas baldosas más allá del borde del cuarto, así las esquinas no quedan
   bajo la interfaz.
4. **Restaurante.** Menos objetos y cada uno en su lugar; un solo piso en el salón; sin sillas sueltas; una escalera
   a las habitaciones que se lea como escalera.
5. **Exterior sin transiciones.** Las zonas vecinas se ven alrededor de la actual y cruzar un borde no hace fundido:
   se pasa caminando. Las escaleras entre zonas se ensanchan y quedan alineadas con su camino.
6. **Luz.** Noche con color (luna fría arriba, calor cerca de las luces) en vez de un tinte plano; charcos de luz
   elípticos sobre el piso con caída suave y color según la fuente; más cosas que emiten luz (faroles de piedra y papel,
   puestos, máquinas expendedoras, el faro con su haz, ventanas, la fuente, luciérnagas).

## Estado al cierre

Hecho, un commit por punto: pesca (cada lugar sobre la baldosa caminable más cercana que toca agua; fuera los
duplicados), un árbol por zona, cámara de interiores con margen, restaurante ordenado (escalera ancha con baranda,
cocina con baldosa, una sola madera, tatami con borde), exterior sin transiciones (zonas vecinas dibujadas alrededor,
cruce sin fundido) y luz nueva (canvas en lugar del render texture que nunca mostraba los charcos; cada fuente con su
color y alcance, faro con haz).

Pendiente: las escaleras entre zonas (santuario, playa) siguen siendo las mismas; con el cruce sin fundido se pasan
caminando, pero al cruzar el borde se avanza una baldosa de golpe. Las barandas de un puente partido entre dos zonas se
ven solo del lado de la zona actual. En las zonas vecinas no se ven los personajes ni sus luces de noche.
