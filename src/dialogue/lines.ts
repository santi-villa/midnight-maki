/**
 * Everyday conversation lines. Each entry may have conditions; the talk system picks the most
 * specific unused line. `e` is the portrait expression.
 */
import type { Expr } from '../art/characters';

export interface Line {
  t: string;           // text ({name} -> player)
  e?: Expr;
  p?: number[];        // periods allowed
  rain?: boolean;
  lvl?: number;        // min friendship level
  flag?: string;       // requires flag (memory)
  noflag?: string;
  zone?: string;
  weight?: number;     // higher = preferred when valid (memories get higher)
  set?: string;        // flag set after saying (so it's said once)
  reply?: string;      // optional follow-up line by same speaker
}

export const LINES: Record<string, Line[]> = {
  pip: [
    { t: '¡{name}! ¿Sabías que las nubes de hoy parecen onigiris? Bueno, algunas. Una parecía un pato.', e: 'happy' },
    { t: 'Estoy practicando para atender mesas. Ya aprendí a decir "bienvenidos" sin tropezarme. Casi siempre.', e: 'smug' },
    { t: 'Encontré una piedra que brilla. La voy a guardar en mi caja de tesoros. Tiene tres tesoros. Ahora cuatro.', e: 'happy' },
    { t: 'Mmm... ¿Spicy está cocinando algo raro otra vez? Huele a picante y a peligro.', e: 'surprised', p: [0, 1] },
    { t: 'De noche el restaurante suena distinto. Cruje como si contara historias.', p: [3] },
    { t: 'Tengo un poquito de sueño... pero si me voy a dormir me pierdo cosas.', e: 'blink', p: [3] },
    { t: '¡Llueve! Me gusta escuchar la lluvia desde adentro. Es como un aplauso suave.', rain: true, e: 'happy' },
    { t: 'Hoy en la plaza un pájaro me miró fijo. Creo que le caí bien.', zone: 'plaza' },
    { t: 'El jardín de noche tiene luciérnagas. Intenté contarlas y me mareé.', zone: 'garden' },
    { t: '¿Te conté que antes de que llegaras, el restaurante estaba muy silencioso? Ahora no. Me gusta así.', lvl: 1, e: 'happy' },
    { t: 'A veces sueño con un faro. No sé por qué. Nunca fui a uno.', lvl: 2, e: 'sad', flag: 'ch2_started' },
    { t: '¡La mantita que me regalaste es la mejor! La uso de capa, de manta y de carpa.', flag: 'gift_pip_g_blanket', e: 'happy', weight: 5, set: 'mem_pip_blanket' },
    { t: 'Sos mi persona favorita. Bueno, empate con Spicy y Rigg. Pero ganás por un poquito.', lvl: 4, e: 'happy' },
    { t: 'Rigg dice que soy desordenado. Yo digo que mis cosas están "repartidas con amor".', e: 'smug' },
    { t: 'Quiero aprender a pescar. Pero los peces me dan un poquito de miedo cuando se mueven.', flag: 'unlock_beach' },
  ],
  spicy: [
    { t: '¡{name}! Hoy el arroz salió PERFECTO. Brillante. Glorioso. Casi lloro.', e: 'happy' },
    { t: 'Estoy trabajando en una receta nueva. Tiene ají, tiene wasabi, tiene... coraje.', e: 'smug' },
    { t: 'La cocina es un escenario y yo soy su estrella. Vos sos... la directora. Sí, me gusta eso.', e: 'happy' },
    { t: '¿Sabés cuál es el secreto de un buen maki? Apretar firme, pero con cariño. Como un abrazo.', p: [0, 1] },
    { t: 'De noche pienso recetas. A veces las sueño. Una vez soñé un sushi que cantaba.', p: [3] },
    { t: '¡Lluvia! Día perfecto para algo calentito. O picante. O las dos cosas.', rain: true },
    { t: 'En la playa venden un pescado fresquísimo. Nami tiene buen ojo, no se lo digas.', zone: 'beach' },
    { t: 'Ya serviste varios platos picantes. Me hacés muy feliz. MUY feliz.', flag: 'many_spicy', e: 'happy', weight: 4, set: 'mem_spicy_spicy' },
    { t: 'Antes cocinaba para nadie. Bueno, para Pip y Rigg, que comen cualquier cosa. Ahora cocino para el pueblo.', lvl: 2, e: 'sad' },
    { t: 'Ese cuaderno viejo del depósito... tenía letra de alguien que cocinaba mejor que yo. No me gusta admitirlo.', flag: 'ch4_started', lvl: 1 },
    { t: 'Si alguna vez me ves triste, traeme algo picante. Funciona siempre. Casi siempre.', lvl: 3 },
    { t: 'La salsa volcánica que me trajiste... la estoy dosificando. Una gota por día. Es arte.', flag: 'gift_spicy_g_hotsauce', e: 'happy', weight: 5, set: 'mem_spicy_sauce' },
  ],
  rigg: [
    { t: 'Hola, {name}. Estaba leyendo. No, no estaba al revés. Bueno, un poco.', e: 'smug' },
    { t: 'Villa Nori tiene más secretos de los que parece. Lo noto en cómo la gente cambia de tema.', p: [0, 1, 2] },
    { t: 'Las estrellas de esta zona están mal ubicadas. O el mapa está mal. Una de dos.', p: [3] },
    { t: 'La lluvia borra huellas. Pero también deja otras nuevas. Interesante.', rain: true },
    { t: 'La biblioteca tiene un estante que nadie usa. Lo revisé. Polvo y una receta de galletitas.', zone: 'plaza' },
    { t: 'No soy muy de hablar. Pero me gusta que estés acá. Eso.', lvl: 2 },
    { t: 'Resolvimos lo del pedido sin remitente juntos. Admito que fue... entretenido.', flag: 'ch2_done', weight: 4, e: 'happy', set: 'mem_rigg_ch2' },
    { t: 'Pip cree que no me doy cuenta cuando me esconde las medias. Me doy cuenta.', e: 'smug' },
    { t: 'Llevo un cuaderno con todo lo raro que pasa en el pueblo. Es un cuaderno grueso.', lvl: 1 },
    { t: 'El té que me regalaste me ayuda a pensar. Gracias. En serio.', flag: 'gift_rigg_g_tea', weight: 5, set: 'mem_rigg_tea' },
    { t: 'Hay cosas que todavía no te conté. No es desconfianza. Es que no sé cómo empezar.', lvl: 3, noflag: 'ch6_done', e: 'sad' },
  ],
  momo: [
    { t: 'Ah... hola. Las camelias abrieron hoy. ¿Querés verlas? No, perdón, no hace falta.', e: 'happy' },
    { t: 'Las flores no te apuran. Por eso me gustan.', p: [0, 1] },
    { t: 'La lluvia es buena para el jardín. Y para quedarse adentro con té.', rain: true },
    { t: 'Si plantás algo y lo regás, crece. Si te olvidás, espera. Las plantas son pacientes.', flag: 'unlock_garden' },
    { t: 'La abuela Ume me enseñó a cuidar plantas. Dice que el antiguo dueño del restaurante también tenía buena mano.', lvl: 1 },
    { t: 'Gracias por pasar a saludar. No mucha gente lo hace.', lvl: 2, e: 'happy' },
  ],
  taro: [
    { t: '¡Bienvenida! Precios justos, rumores gratis. ¿Querés uno? Dicen que de noche aparecen luces en el torii.', e: 'smug' },
    { t: 'Si necesitás arroz, nori o muebles, ya sabés dónde estoy. Siempre estoy.', p: [0, 1] },
    { t: '¿El mercado nocturno? Ah... digamos que algunas noches el pueblo se pone generoso.', p: [2, 3] },
    { t: 'Lluvia: malo para el negocio, bueno para los paraguas. Lástima que no vendo paraguas.', rain: true },
    { t: 'Te lo digo porque me caés bien: Kumo sabe más del faro de lo que admite.', lvl: 2, flag: 'ch1_done' },
  ],
  yuki: [
    { t: 'Hola, {name}. Ese conjunto te queda lindo. Yo le cambiaría el dobladillo, pero lindo.', e: 'happy' },
    { t: 'Estoy cosiendo un vestido nuevo. Si sale bien, lo vendo. Si sale mal, también, pero más barato.', e: 'smug' },
    { t: 'Los días de lluvia son para coser. Y para mirar por la ventana pensando en botones.', rain: true },
    { t: 'Hice unos gorritos para mapaches. No me preguntes por qué, simplemente me nació.', lvl: 1 },
  ],
  kumo: [
    { t: 'Silencio en la biblioteca, por favor. Ah, estamos afuera. Igual, silencio es lindo.', e: 'smug' },
    { t: 'Villa Nori fue fundada por pescadores que se guiaban con tres estrellas. Eso dicen los libros.', p: [0, 1] },
    { t: 'El antiguo dueño de Midnight Maki venía a leer los martes. Siempre el mismo libro de astronomía.', lvl: 1, flag: 'ch1_started' },
    { t: 'No me gustan las preguntas difíciles. Me gustan las respuestas fáciles. Rara vez coinciden.', lvl: 2 },
    { t: 'La lluvia y los libros se llevan bien. Las goteras y los libros, no.', rain: true },
  ],
  nami: [
    { t: '¡Hola! ¿Venís a pescar? Paciencia, muñeca suelta y no mirar al pez a los ojos.', e: 'happy' },
    { t: 'Junté treinta conchas esta semana. Treinta y una, si cuento la que se parece a una oreja.', e: 'smug' },
    { t: 'De noche salen peces raros. Uno brilla como la luna. Lo vi una sola vez.', p: [2, 3] },
    { t: 'Las botellas que trae el mar a veces tienen mensajes. La mayoría dicen "hola". Algunas no.', flag: 'ch2_started' },
  ],
  hoshi: [
    { t: 'Buenas noches... o buenos días. Para mí siempre es un poco las dos cosas.', e: 'blink' },
    { t: 'Falta algo en el cielo de Villa Nori. Tres puntitos. Lo noto como se nota un diente que falta.', p: [3] },
    { t: 'Las estrellas no se pierden. Se esconden. Como los gatos.', lvl: 1 },
    { t: 'Si alguna vez ves una mariposa con constelaciones en las alas, avisame. Por favor.', lvl: 2 },
  ],
  bento: [
    { t: '¡Hola, hola! ¿Probaste el pan de leche? Hoy salió esponjoso como una nube.', e: 'happy' },
    { t: 'Madrugar es duro, pero el olor del horno lo arregla todo.', p: [0] },
    { t: 'Me gusta cenar en Midnight Maki. Es como en los viejos tiempos, pero con mapaches.', p: [2], zone: 'restaurant', e: 'happy' },
    { t: 'Con lluvia, la masa leva distinto. Todo es más lento. A mí me gusta lento.', rain: true },
    { t: 'Yo... nunca estuve en el faro. Nunca. ¿Por qué preguntás?', flag: 'ch5_started', e: 'surprised' },
  ],
  sumi: [
    { t: 'La luz de esta hora es perfecta. Mirá cómo se pone rosa todo.', e: 'happy', p: [2] },
    { t: 'Estoy pintando el pueblo entero, de a un rincón por día.', p: [0, 1] },
    { t: 'Si querés un cuadro para tu restaurante, tengo algunos. Los mejores no están en venta. Todavía.', lvl: 1 },
    { t: 'Pinté una vez el faro con luz. Nunca lo vi encendido. Lo inventé... creo.', lvl: 2, flag: 'ch3_started' },
  ],
  kiki: [
    { t: '¡Ey! Encontré un atajo nuevo. No lleva a ningún lado, pero es muy rápido.', e: 'happy' },
    { t: 'El bosque cambia cada día. Los hongos se mudan. En serio.', zone: 'forest' },
    { t: 'Detrás de los árboles del este hay un sendero que nadie usa. Bueno, yo sí.', lvl: 1 },
    { t: 'Con lluvia los caracoles salen a pasear. Tienen sus rutas. Las respeto.', rain: true },
  ],
  sora: [
    { t: '¡Buen día! Hoy no tengo carta para vos... ¿o sí? No. ¿Sí? Dejame revisar. No.', e: 'happy' },
    { t: 'Correo llueva o truene. Bueno, si truena mucho me escondo un ratito.', rain: true },
    { t: 'Una vez entregué una carta sin remitente al restaurante. Fue hace años. Nunca supe de quién era.', lvl: 1, flag: 'ch1_started' },
  ],
  ume: [
    { t: 'Ay, querida. Me hacés acordar a alguien que conocí hace mucho.', e: 'happy' },
    { t: 'El té se toma despacio. Las respuestas, también.', p: [0, 1] },
    { t: 'Ese restaurante tuvo días muy alegres. Me alegra que vuelva a tenerlos.', zone: 'restaurant', e: 'happy' },
    { t: 'Las promesas viejas no se rompen: esperan. Como las semillas.', lvl: 2, flag: 'ch3_started' },
  ],
};

// ---- extra lines: memories of finished requests, events and the story's aftermath
const more: Record<string, Line[]> = {
  momo: [
    { t: 'Las flores que me trajiste siguen en el florero. Les hablo todas las mañanas. Creo que me escuchan.', flag: 'unlock_garden', weight: 3, set: 'mem_momo_flowers' },
    { t: 'Desde que se encendió el faro, las camelias florecen antes. No sé si es ciencia o magia.', flag: 'story_done' },
    { t: 'Si un día no sabés qué hacer, sentate en el banco del jardín. A veces no hacer nada es hacer mucho.', lvl: 3 },
  ],
  taro: [
    { t: 'Gracias por la amatista, socia. El cliente lloró de alegría. Yo también, pero por la plata.', flag: 'q_sq_taro_amethyst_done', weight: 3, set: 'mem_taro_gem' },
    { t: 'Rumor del día: dicen que Akio cocina mejor que Spicy. No le digas a Spicy que lo dije.', flag: 'akio_visit' },
    { t: 'Un buen negocio es como un buen sushi: frescura, cariño y que el cliente vuelva.', lvl: 2 },
  ],
  yuki: [
    { t: '¡Te vi con el atuendo de mapache! Te queda adorable. Lo cosí pensando en vos. Bueno, en los mapaches. Y en vos.', flag: 'fest_raccoons_1', weight: 3 },
    { t: 'Estoy aprendiendo a bordar estrellas. La primera parecía una papa. La segunda, una papa con puntas.', lvl: 2 },
  ],
  kumo: [
    { t: 'La botella que me trajiste tenía un mensaje de hace veinte años. Era una receta de galletitas. La humanidad es maravillosa.', flag: 'q_sq_kumo_bottle_done', weight: 3, set: 'mem_kumo_bottle' },
    { t: 'Ahora que el faro brilla, viene más gente a la biblioteca a buscar libros de estrellas. Me tienen agotado. Me encanta.', flag: 'story_done' },
  ],
  nami: [
    { t: '¡Pescaste un atún! Ya sos oficialmente pescadora de Villa Nori. No hay diploma, pero te aplaudo.', flag: 'q_sq_nami_tuna_done', weight: 3, set: 'mem_nami_tuna' },
    { t: 'Con el faro encendido los barcos vuelven a casa más tranquilos. Mi papá era pescador, ¿sabés?', flag: 'story_done', e: 'sad' },
  ],
  hoshi: [
    { t: 'Le escribí a mi mamá contándole que el faro brilla otra vez. Me contestó con tres estrellitas dibujadas.', flag: 'story_done', e: 'happy' },
    { t: 'Cada noche anoto el cielo. Desde que llegaste, mis notas tienen más estrellas. Coincidencia, seguro.', lvl: 2 },
  ],
  bento: [
    { t: 'Ya no tengo que guardar secretos. ¡Qué alivio! El pan me sale más esponjoso desde entonces.', flag: 'bento_confessed', weight: 3, set: 'mem_bento_free' },
    { t: 'Akio pasó por la panadería y me pidió un pan de leche. Como antes. Casi lloro en la masa.', flag: 'akio_visit', e: 'happy' },
  ],
  sumi: [
    { t: 'Pinté el faro encendido. Esta vez no lo inventé: lo vi. Es todavía más lindo de lo que imaginaba.', flag: 'story_done', e: 'happy' },
    { t: 'Las fotos que me mandaste me inspiraron. Hay una tuya con los mapaches que quiero pintar.', flag: 'q_sq_sumi_photos_done', weight: 3 },
  ],
  kiki: [
    { t: '¡Lograste abrir el tocón! Yo lo intenté cien veces. Bueno, tres. Pero fueron tres veces intensas.', flag: 'stump_solved', weight: 3, set: 'mem_kiki_stump' },
    { t: '¿Conocés el rincón secreto del bosque? Si no, seguí buscando. Si sí, no se lo digas a nadie.', flag: 'secret_corner' },
  ],
  sora: [
    { t: '¡Fuiste la mejor cartera suplente de la historia! Momo me contó que su carta la hizo llorar de alegría.', flag: 'q_sq_sora_mail_done', weight: 3, set: 'mem_sora_mail' },
    { t: 'Llevé una carta tuya a la Ciudad del Puerto. Bueno, la llevó el tren. Pero la puse yo en el tren.', flag: 'akio_visit' },
  ],
  ume: [
    { t: 'El club volvió a reunirse los martes. Esta vez con mapaches. Akio dice que es una mejora.', flag: 'story_done', e: 'happy' },
    { t: 'Gracias por el té, querida. Me acordé de tardes muy lindas.', flag: 'q_sq_ume_tea_done', weight: 3, set: 'mem_ume_tea' },
  ],
  pip: [
    { t: 'Akio me reconoció enseguida. Dijo "Pip, seguís igual de grandote". ¡Es mi tamaño perfecto para abrazar!', flag: 'akio_visit', e: 'happy', weight: 3, set: 'mem_pip_akio' },
  ],
  spicy: [
    { t: 'Akio probó mi Spicy Beacon Roll. Lloró. Dice que fue el picante. YO DIGO QUE FUE LA EMOCIÓN.', flag: 'akio_visit', e: 'happy', weight: 3, set: 'mem_spicy_akio' },
  ],
  rigg: [
    { t: 'Cerré el cuaderno de casos. Empecé uno nuevo. Se llama "Cosas lindas que pasan". Ya tiene muchas páginas.', flag: 'story_done', e: 'happy' },
  ],
};
for (const [id, list] of Object.entries(more)) LINES[id] = [...(LINES[id] ?? []), ...list];
if (LINES.sumi) LINES.mika = LINES.sumi; // legacy save alias

LINES.akio = [
  { t: 'Gracias por encender el faro, {name}. Desde la Ciudad del Puerto se veía la luz. Lloré como Spicy con el wasabi.', e: 'happy', weight: 5, set: 'akio_thanks' },
  { t: 'Pip sigue durmiendo en cajones de fruta. Algunas cosas no cambian, y está bien.', e: 'happy' },
  { t: 'El arroz de Spicy está mejor que el mío. No se lo digas: se le va a subir a la cabeza.', e: 'smug' },
  { t: 'Rigg me mostró su cuaderno. Tiene más páginas que mi recetario. Estoy orgulloso de ella.', e: 'happy' },
  { t: 'Este restaurante necesitaba a alguien como vos. Yo solo dejé las luces prendidas.', e: 'happy', lvl: 1 },
  { t: 'De noche me gusta mirar el faro desde la playa. Ahora gira para todos.', p: [2, 3] },
];

/** Gift reactions */
export const GIFT_REACT = {
  love: ['¡¿Para mí?! Es perfecto. De verdad, gracias.', '¡Me encanta! ¿Cómo sabías?'],
  like: ['¡Qué lindo! Gracias, {name}.', 'Oh, me gusta mucho. Gracias.'],
  neutral: ['Gracias. Muy amable.', 'Ah, gracias. Lo voy a guardar.'],
  dislike: ['Eh... gracias. Es la intención lo que cuenta, ¿no?', 'Mmm. Bueno. Gracias igual.'],
};
