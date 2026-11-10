// Mapas del mundo explorable (contenido original). Cada mapa se construye con
// world/map-builder.js a partir de operaciones declarativas.
//
// npcs: { id, name, x, y, dir, look | templateId, script, alt?: [{ if, script }],
//         showIf?, hideIf?, sight? (casillas de visión: el NPC te reta al verte),
//         invisible? (puertas/carteles) }
// warps: { x, y, w?, h?, to, tx, ty, requires?: cond, locked? }
// encounters.pool: { id, w, min, max, requires? }
// scoutPool: { id, min, max, x, y }  -> donde aparece la pista del ojeador
// items: { x, y, item, qty?, flag }

import { T } from '../world/tiles.js';

// ---------------------------------------------------------------- helpers
const door = (id, x, y, name, script, extra = {}) => ({ id, name, x, y, invisible: true, script, ...extra });
const sign = (id, x, y, text) => ({ id, name: 'Cartel', x, y, invisible: true, sign: true, script: [{ say: text, who: 'Cartel' }] });
const heal = (who) => [
  { say: '¿Queréis descansar? El equipo recuperará toda su energía.', who },
  { choice: '¿Descansar?', who, options: [
    { text: 'Descansar (avanza un día)', do: [{ heal: true }, { say: '¡El equipo está como nuevo!', who }] },
    { text: 'Ahora no' },
  ] },
];
const facility = (who, text, screen, extra = {}) => [{ say: text, who }, { open: screen, ...extra }];
const LOOKS = {
  oldman: { hair: 'bald', hairColor: '#ddd', skin: '#e8c4a0', shirt: '#6d4c41', accessory: 'beard' },
  kid: { hair: 'short', hairColor: '#4a2f1b', skin: '#f2c9a5', shirt: '#ffb12b' },
  girl: { hair: 'ponytail', hairColor: '#2d1b4e', skin: '#f5d0b0', shirt: '#ff7aa8' },
  clerk: { hair: 'short', hairColor: '#222', skin: '#e8b48f', shirt: '#2a9d8f' },
  coach: { hair: 'swept', hairColor: '#555', skin: '#e0b08a', shirt: '#264653' },
  suit: { hair: 'swept', hairColor: '#cfcfff', skin: '#f0d0c0', shirt: '#2b0b3f' },
  fisher: { hair: 'short', hairColor: '#333', skin: '#c98d6a', shirt: '#2a6fdb', accessory: 'headband' },
  monk: { hair: 'bald', hairColor: '#333', skin: '#d9a77c', shirt: '#e67e22' },
};

// Partido contra un rival del mapa con flag de victoria.
const rivalMatch = (team, level, winFlag, intro, win, lose, onWinExtra = []) => [
  ...intro.map((t) => ({ say: t })),
  { if: { roster: 11 }, then: [
    { match: { team, level, context: 'story', onWin: [{ flag: winFlag }, ...win.map((t) => ({ say: t })), ...onWinExtra], onLose: lose.map((t) => ({ say: t })) } },
  ], else: [{ say: 'Un momento... ¡ni siquiera tenéis once jugadores! Volved cuando tengáis un equipo completo.' }] },
];

const challenge = (player, level, intro, win, lose) => [
  ...intro.map((t) => ({ say: t })),
  { challenge: { player, level, onWin: win.map((t) => ({ say: t })), onLose: lose.map((t) => ({ say: t })) } },
];

// ================================================================ VILLA RAYO
const villa_rayo = {
  id: 'villa_rayo', name: 'Villa Rayo', zone: 'Villa Rayo', theme: 'town', music: 'town', w: 40, h: 30,
  spawn: { x: 4, y: 13 },
  ops: [
    ['border', T.TREE],
    ['fill', T.PATH, 1, 14, 39, 2], ['fill', T.PATH, 19, 0, 2, 29],
    ['fill', T.PATH, 9, 8, 1, 6], ['fill', T.PATH, 4, 13, 1, 1], ['fill', T.PATH, 14, 13, 1, 1],
    ['building', 3, 2, 12, 6, { label: 'Instituto Rayo Azul', roof: '#1565ff', door: 6 }],
    ['building', 2, 9, 5, 4, { label: 'Casa', roof: '#e76f51', door: 2 }],
    ['building', 11, 9, 6, 4, { label: 'Tienda', roof: '#2a9d8f', door: 3 }],
    ['field', 23, 2, 14, 9, 'Campo del instituto'],
    ['fill', T.FLOWER, 3, 17, 12, 1], ['fill', T.TALL, 3, 18, 12, 8],
    ['fill', T.TALL, 23, 18, 12, 7], ['fill', T.WATER, 35, 25, 3, 3],
    ['scatter', T.TREE, [[22, 12], [37, 12], [17, 3], [17, 6], [2, 27], [16, 27], [22, 27], [30, 27]]],
  ],
  warps: [
    { x: 39, y: 14, h: 2, to: 'ribera', tx: 1, ty: 6 },
    { x: 19, y: 0, w: 2, to: 'distrito', tx: 21, ty: 30, requires: { flag: 'ch1_done' }, locked: 'La carretera al Distrito Escolar está cortada. «Solo para equipos reconocidos» (completa el Capítulo 1).' },
  ],
  encounters: { pool: [
    { id: 'aki_sato', w: 3, min: 3, max: 5 }, { id: 'jun_ito', w: 3, min: 3, max: 5 },
    { id: 'taro_yamada', w: 2, min: 3, max: 5 }, { id: 'nao_fujita', w: 2, min: 3, max: 5 },
    { id: 'koji_saito', w: 1, min: 4, max: 6 },
  ] },
  scoutPool: [{ id: 'rin_hayashi', min: 5, max: 7, x: 30, y: 22 }, { id: 'mei_kobayashi', min: 5, max: 7, x: 8, y: 22 }],
  items: [{ x: 34, y: 3, item: 'bebida_isotonica', flag: 'it_villa_1' }, { x: 13, y: 24, item: 'carta_invitacion', qty: 2, flag: 'it_villa_2' }],
  npcs: [
    { id: 'tetsuo', name: 'Abuelo Tetsuo', x: 10, y: 8, dir: 'down', look: LOOKS.oldman, script: [
      { if: { notFlag: 'got_key' }, then: [
        { title: 'Prólogo', subtitle: 'Un club olvidado' },
        { say: '¡Eh, tú! ¿Eres el nuevo entrenador del que habla todo el instituto?' },
        { say: 'Hace treinta años, el club de fútbol del Instituto Rayo Azul fue leyenda. Hoy apenas quedan siete chicos que entrenan en un campo lleno de hierbajos.' },
        { say: 'Esta llave abre la sala del club. Cuídala. Y cuida de esos chicos.' },
        { give: { item: 'llave_club' } }, { flag: 'got_key' }, { quest: 'mq_once' },
        { fx: 'lightning' },
        { say: 'Para competir necesitáis ONCE jugadores. Recorre la hierba alta del parque y de la Ribera: hay talento escondido por todas partes.' },
        { say: 'Cuando un jugador te rete, gánale el duelo y usa una Carta de invitación para convencerle. Cada persona responde a un enfoque distinto: ¡obsérvalos!' },
        { say: 'Pulsa [ESC] o [M] para abrir el menú del equipo. ¡Ánimo, entrenador!' },
      ], else: [
        { if: { notFlag: 'team_complete' }, then: [{ say: 'Necesitáis 11 jugadores. Busca en la hierba alta (al sur) y en la Ribera (al este).' }],
          else: [{ if: { notFlag: 'halcones_beaten' }, then: [{ say: '¡Ya sois once! Los Halcones del Puerto os esperan en el muelle, al sureste de la Ribera.' }],
            else: [{ if: { notFlag: 'ch1_done' }, then: [{ say: 'La Academia Cuervo Negro quiere vuestro campo. ¡Están en el campo del instituto, al este!' }],
              else: [{ say: 'El Distrito Escolar, al norte, os espera. El Torneo Escolar es vuestro siguiente objetivo.' }] }] }] },
      ] },
    ] },
    door('club', 9, 7, 'Sala del club', [
      { if: { flag: 'got_key' }, then: [
        { say: 'La sala del club huele a cuero viejo y a sueños nuevos.', who: 'Sala del club' },
        { choice: '¿Qué quieres hacer?', who: 'Sala del club', options: [
          { text: 'Gestionar el equipo', do: [{ open: 'team' }] },
          { text: 'Entrenar en el campo del instituto', do: [{ open: 'training' }] },
          { text: 'Guardar la partida', do: [{ save: true }] },
          { text: 'Salir' },
        ] }],
        else: [{ say: 'La puerta está cerrada con llave.', who: 'Sala del club' }] },
    ]),
    door('casa', 4, 12, 'Casa', [...heal('Mamá'), { save: true }]),
    door('tienda_villa', 14, 12, 'Tienda', [{ say: '¡Bienvenido a la tienda del barrio!', who: 'Dependienta' }, { shop: 'tienda_villa' }]),
    sign('sign_villa', 18, 13, 'VILLA RAYO — Norte: Distrito Escolar · Este: Parque Ribera · Sur: parque (¡cuidado con la hierba alta!)'),
    { id: 'goro', name: 'Goro Tanaka', x: 16, y: 13, dir: 'down', templateId: 'goro_tanaka', hideIf: { owns: 'goro_tanaka' }, script: [
      { if: { notFlag: 'goro_helped' }, then: [
        { quest: 'sq_goro' },
        { say: 'Uf... el turno en la pescadería me está matando. Si alguien me trajera 3 bebidas isotónicas...' },
        { if: { item: { id: 'bebida_isotonica', count: 3 } }, then: [
          { choice: '¿Darle 3 bebidas isotónicas?', options: [
            { text: 'Sí, toma', do: [
              { take: { item: 'bebida_isotonica', qty: 3 } }, { flag: 'goro_helped' },
              { say: '¡Eres un salvador! ¿Dices que entrenas un equipo de fútbol? ¡Cuenta conmigo, defenderé como mueve cajas!' },
              { player: { id: 'goro_tanaka', level: 5 } },
            ] },
            { text: 'Ahora no' },
          ] },
        ] },
      ] },
    ] },
    { id: 'kaito_villa', name: 'Kaito Ren', x: 21, y: 12, dir: 'left', templateId: 'kaito_ren', hideIf: { flag: 'ch1_done' }, script: [
      { if: { notFlag: 'halcones_beaten' }, then: [
        { say: '¿Tú eres el nuevo entrenador? Ja. Ese club es un cementerio.' },
        { say: 'Si de verdad queréis jugar, demostradlo en el campo. Aunque dudo que juntéis once.' },
      ], else: [
        { say: 'Así que habéis ganado a los Halcones... No está mal.' },
        { say: 'Pero la Academia Cuervo Negro va a por vuestro campo. Están allí ahora mismo. Veamos si estáis a la altura.' },
      ] },
    ] },
    { id: 'kuro', name: 'Kuro Tsubame', x: 29, y: 6, dir: 'down', templateId: 'kuro_tsubame', showIf: { flag: 'halcones_beaten' }, sight: 4, sightFlag: 'cuervo_beaten', script: [
      { if: { notFlag: 'cuervo_beaten' }, then: rivalMatch('cuervo_negro', 8, 'cuervo_beaten',
        ['¡Je! Así que vosotros sois los "valientes" del Rayo Azul.', 'Este campo será nuestro campo de entrenamiento. A menos que nos ganéis, claro.'],
        ['¡Imposible! ¿Perder contra este club de pacotilla...?', 'Esto no ha terminado. Nos veremos en el Torneo del Distrito.'],
        ['¡Ja! Volved cuando sepáis jugar al fútbol.']),
      else: [{ say: 'Disfrutad mientras podáis. En el Torneo del Distrito os aplastaremos.' }] },
    ] },
    { id: 'nina_villa', name: 'Niña del barrio', x: 22, y: 16, dir: 'down', look: LOOKS.girl, script: [
      { say: '¿Sabías que en la hierba alta aparecen jugadores que te retan a duelos? Si los vences, ¡puedes invitarles a tu equipo!' },
      { say: 'Mi hermano dice que cada jugador tiene una personalidad, y que hay que hablarles de la forma que les gusta.' },
    ] },
  ],
};

// ================================================================ PARQUE RIBERA
const ribera = {
  id: 'ribera', name: 'Parque Ribera', zone: 'Villa Rayo', theme: 'river', music: 'field', w: 40, h: 30,
  spawn: { x: 2, y: 6 },
  ops: [
    ['border', T.TREE],
    ['fill', T.PATH, 0, 6, 39, 2],
    ['fill', T.WATER, 1, 12, 38, 3], ['fill', T.BRIDGE, 19, 12, 2, 3],
    ['fill', T.PATH, 19, 8, 2, 4], ['fill', T.PATH, 19, 15, 2, 2], ['fill', T.PATH, 1, 16, 38, 1],
    ['fill', T.TALL, 4, 2, 10, 3], ['fill', T.TALL, 24, 2, 10, 3],
    ['field', 5, 18, 14, 8, 'Campo de la ribera'],
    ['fill', T.TALL, 24, 18, 11, 5],
    ['fill', T.SAND, 34, 23, 5, 6], ['fill', T.WATER, 37, 17, 2, 6],
    ['scatter', T.TREE, [[2, 9], [16, 10], [30, 10], [22, 24], [26, 26], [2, 27]]],
  ],
  warps: [{ x: 0, y: 6, h: 2, to: 'villa_rayo', tx: 38, ty: 14 }],
  encounters: { pool: [
    { id: 'aki_sato', w: 2, min: 3, max: 6 }, { id: 'jun_ito', w: 2, min: 3, max: 6 },
    { id: 'taro_yamada', w: 2, min: 4, max: 6 }, { id: 'nao_fujita', w: 2, min: 4, max: 6 },
    { id: 'koji_saito', w: 2, min: 4, max: 7 }, { id: 'rin_hayashi', w: 1, min: 5, max: 7 },
    { id: 'mei_kobayashi', w: 1, min: 5, max: 7 },
  ] },
  scoutPool: [{ id: 'nao_fujita', min: 5, max: 7, x: 28, y: 25 }, { id: 'koji_saito', min: 5, max: 7, x: 12, y: 27 }],
  items: [{ x: 37, y: 3, item: 'cuaderno_tactico', flag: 'it_rib_1' }, { x: 3, y: 27, item: 'carta_especial', flag: 'it_rib_2' }],
  npcs: [
    { id: 'midori', name: 'Midori Asahina', x: 10, y: 10, dir: 'down', templateId: 'midori_asahina', hideIf: { owns: 'midori_asahina' }, script: [
      { quest: 'sq_midori' },
      ...challenge('midori_asahina', 5,
        ['...Llevo meses entrenando sola aquí. Nadie me ha pedido nunca que juegue con ellos.', 'Si quieres que me una, demuéstrame que tu fútbol es de verdad. ¡Duelo!'],
        ['Vale... Me has convencido. ¡Contad conmigo!'],
        ['Todavía no estáis listos. Vuelve cuando quieras.']),
    ] },
    { id: 'gota', name: 'Gota (Pandilla del Parque)', x: 25, y: 8, dir: 'left', look: LOOKS.kid, sight: 4, sightFlag: 'pandilla_beaten', script: [
      { if: { notFlag: 'pandilla_beaten' }, then: rivalMatch('pandilla_parque', 3, 'pandilla_beaten',
        ['¡Alto! Este es el territorio de la Pandilla del Parque.', '¿Queréis pasar? ¡Ganadnos un partido!'],
        ['Vaaale, sois buenos. Podéis usar el parque cuando queráis.'],
        ['¡Jajaja! ¡Entrenad más!']),
      else: [{ say: 'Oye, ¿nos dejarás jugar algún día en vuestro campo?' }] },
    ] },
    { id: 'umino', name: 'Capitán Umino', x: 36, y: 25, dir: 'left', look: LOOKS.fisher, script: [
      { if: { notFlag: 'halcones_beaten' }, then: rivalMatch('halcones_puerto', 5, 'halcones_dummy',
        ['¡Ahoy! ¿Venís a jugar contra los Halcones del Puerto?', 'Mis chicos han estado esperando un rival de verdad. ¡Al campo!'],
        ['¡Qué partido! El Rayo Azul vuelve a estar vivo. Contad con nosotros como amigos.'],
        ['¡Buen intento! El mar no perdona... ¡pero siempre podéis volver!']),
      else: [{ say: '¡Os seguimos animando desde el puerto! Si queréis un amistoso, aquí estaremos.' },
        { choice: '¿Jugar un amistoso contra los Halcones?', options: [
          { text: 'Sí', do: [{ match: { team: 'halcones_puerto', level: 12, context: 'friendly' } }] }, { text: 'No' }] }] },
    ] },
    { id: 'saito', name: 'Abuelo Saito', x: 12, y: 17, dir: 'down', look: LOOKS.oldman, script: [
      { if: { notFlag: 'ch1_done' }, then: [{ say: 'Los Veteranos de Ribera no jugamos contra críos verdes. Volved cuando hayáis ganado algo de verdad.' }],
        else: [
          { quest: 'sq_veteranos' },
          ...rivalMatch('club_veteranos', 11, 'veteranos_beaten',
            ['Habéis ganado a Cuervo Negro, ¿eh? Veamos si podéis con la experiencia.'],
            ['Bien jugado, chavales. Me recordáis a nosotros hace cuarenta años.'],
            ['La experiencia es un grado. ¡Volved cuando queráis!']),
        ] },
    ] },
    { id: 'pescador', name: 'Pescador', x: 30, y: 8, dir: 'down', look: LOOKS.fisher, script: [
      { say: 'Los jugadores de fuego dominan a los de bosque, los de bosque a los de montaña, los de montaña al aire... y el aire apaga el fuego.' },
      { say: 'Usa técnicas de un elemento que tenga ventaja sobre el rival y verás qué diferencia.' },
    ] },
  ],
};

// ================================================================ DISTRITO ESCOLAR
const distrito = {
  id: 'distrito', name: 'Distrito Escolar', zone: 'Distrito Escolar', theme: 'school', music: 'town', w: 44, h: 32,
  spawn: { x: 21, y: 29 },
  ops: [
    ['border', T.TREE],
    ['fill', T.PATH, 21, 8, 2, 24], ['fill', T.PATH, 0, 15, 44, 2],
    ['building', 16, 2, 12, 6, { label: 'Pabellón del Torneo', roof: '#f2c94c', door: 6 }],
    ['building', 3, 2, 10, 6, { label: 'Colegio Hanazono', roof: '#ff9ec7', door: 5 }],
    ['building', 33, 2, 8, 5, { label: 'Estación', roof: '#6c757d', door: 4 }],
    ['building', 11, 9, 6, 5, { label: 'Tienda', roof: '#2a9d8f', door: 3 }],
    ['building', 28, 9, 6, 5, { label: 'Ojeadores', roof: '#3fc35b', door: 3 }],
    ['building', 36, 9, 6, 5, { label: 'Centro de entrenamiento', roof: '#ff5a36', door: 3 }],
    ['building', 3, 19, 10, 6, { label: 'Instituto Vértice', roof: '#8a93a6', door: 5, doorSide: 'top' }],
    ['building', 31, 19, 10, 6, { label: 'Academia Cuervo Negro', roof: '#1d1d26', door: 5, doorSide: 'top' }],
    ['fill', T.PATH, 8, 8, 1, 7], ['fill', T.PATH, 14, 14, 1, 1], ['fill', T.PATH, 31, 14, 1, 1], ['fill', T.PATH, 39, 14, 1, 1],
    ['fill', T.PATH, 37, 7, 1, 8], ['fill', T.PATH, 8, 17, 1, 2], ['fill', T.PATH, 36, 17, 1, 2],
    ['fill', T.TALL, 13, 22, 7, 7], ['fill', T.TALL, 24, 22, 6, 7],
    ['scatter', T.TREE, [[2, 14], [26, 12], [19, 12], [42, 27], [2, 28]]],
  ],
  warps: [
    { x: 21, y: 31, w: 2, to: 'villa_rayo', tx: 19, ty: 1 },
    { x: 43, y: 15, h: 2, to: 'bosque', tx: 1, ty: 15, requires: { item: { id: 'pase_bosque' } }, locked: 'Un guarda bloquea el camino: «Sin el Permiso del bosque no se pasa». (Gana el Torneo del Distrito.)' },
  ],
  encounters: { pool: [
    { id: 'yuki_shimizu', w: 1, min: 10, max: 13 }, { id: 'ryo_kondo', w: 2, min: 9, max: 12 },
    { id: 'hana_ishii', w: 2, min: 9, max: 12 }, { id: 'eiji_mura', w: 2, min: 9, max: 12 },
    { id: 'mei_kobayashi', w: 2, min: 8, max: 11 }, { id: 'rin_hayashi', w: 2, min: 8, max: 11 },
  ] },
  scoutPool: [
    { id: 'yuki_shimizu', min: 12, max: 14, x: 27, y: 27 }, { id: 'hana_ishii', min: 11, max: 13, x: 16, y: 20 },
    { id: 'eiji_mura', min: 11, max: 13, x: 4, y: 27 }, { id: 'ryo_kondo', min: 11, max: 13, x: 40, y: 27 },
  ],
  items: [{ x: 42, y: 2, item: 'carta_especial', flag: 'it_dis_1' }, { x: 15, y: 28, item: 'onigiri_especial', flag: 'it_dis_2' }],
  npcs: [
    door('pabellon', 22, 7, 'Pabellón', facility('Recepcionista', '¡Bienvenidos al Pabellón! Aquí se celebran los torneos del distrito.', 'tournaments')),
    door('estacion', 37, 6, 'Estación', [
      { if: { item: { id: 'billete_capital' } }, then: [{ say: 'Tren con destino a la Ciudad Capital. ¡Viajeros al tren!', who: 'Revisor' }, { warp: { map: 'capital', x: 7, y: 7 } }],
        else: [{ say: 'Sin billete no se puede subir. Dicen que los campeones regionales reciben uno...', who: 'Revisor' }] },
    ]),
    door('tienda_dis', 14, 13, 'Tienda', [{ say: '¡Material deportivo de calidad!', who: 'Dependiente' }, { shop: 'tienda_distrito' }]),
    door('ojeadores', 31, 13, 'Ojeadores', facility('Ojeadora Rumi', 'Nuestra red de ojeadores encuentra talento en cualquier zona que conozcas. Dime qué buscas.', 'scout')),
    door('centro', 39, 13, 'Centro de entrenamiento', facility('Preparador', 'Instalaciones de primera. ¡A sudar!', 'training')),
    door('hanazono_door', 8, 7, 'Colegio Hanazono', [{ say: 'El Colegio Hanazono. Se oye música clásica desde el patio.', who: 'Colegio Hanazono' }]),
    door('vertice_door', 8, 19, 'Instituto Vértice', [{ say: 'Una pantalla en la puerta muestra estadísticas de todos los equipos del distrito... incluido el tuyo.', who: 'Instituto Vértice' }]),
    door('cuervo_door', 36, 19, 'Academia Cuervo Negro', [
      { say: '¿Una revancha? ¡Cuando queráis!', who: 'Kuro Tsubame', portrait: 'kuro_tsubame' },
      { choice: '¿Jugar contra Cuervo Negro?', options: [{ text: 'Sí', do: [{ match: { team: 'cuervo_negro', level: 15, context: 'friendly' } }] }, { text: 'No' }] },
    ]),
    { id: 'ichika', name: 'Ichika Hanazono', x: 9, y: 9, dir: 'down', templateId: 'ichika_hanazono', showIf: { flag: 'ch2_done' }, hideIf: { owns: 'ichika_hanazono' }, script: [
      { quest: 'sq_hanazono' },
      ...rivalMatch('hanazono', 18, 'hanazono_rematch',
        ['Perdimos en el torneo, pero aprendí mucho de vosotros.', '¿Una revancha amistosa? Si ganáis... quizá me lo piense.'],
        ['Vuestro fútbol tiene alma. Me encantaría jugar con vosotros.'],
        ['¡Ha sido precioso! Cuando queráis, otra.']),
    ] },
    { id: 'kaito_dis', name: 'Kaito Ren', x: 23, y: 12, dir: 'down', templateId: 'kaito_ren', showIf: { flag: 'ch1_done' }, hideIf: { any: [{ flag: 'kaito_respect' }, { owns: 'kaito_ren' }] }, script: [
      { say: 'Ganasteis a Cuervo Negro. Pero un equipo no es nada sin un delantero de verdad.' },
      { say: 'Ponme a prueba. Si me ganas en un duelo... reconoceré que vas en serio.' },
      { challenge: { player: 'kaito_ren', level: 12, onWin: [
        { flag: 'kaito_respect' },
        { say: '...Tch. Vale, lo reconozco. Pero no me uniré a nadie hasta ver de qué estás hecho de verdad.' },
        { say: 'Te estaré observando. Nos veremos en la Capital.' },
      ], onLose: [{ say: 'Lo sabía. Todavía te falta mucho.' }] } },
    ] },
    { id: 'chica_dis', name: 'Estudiante', x: 18, y: 17, dir: 'down', look: LOOKS.girl, script: [
      { say: 'El Torneo Escolar tiene tres rondas: Veteranos, Hanazono y Vértice. ¡El campeón recibe el Permiso del bosque!' },
      { say: 'Vértice juega con marcaje y elemento Montaña. Los jugadores de Bosque les vienen genial.' },
    ] },
    { id: 'guarda_bosque', name: 'Guarda', x: 41, y: 14, dir: 'left', look: LOOKS.coach, script: [
      { say: 'El Bosque Esmeralda es un lugar sagrado. Solo los campeones del distrito pueden entrar.' },
    ] },
  ],
};

// ================================================================ BOSQUE ESMERALDA
const bosque = {
  id: 'bosque', name: 'Bosque Esmeralda', zone: 'Bosque Esmeralda', theme: 'forest', music: 'forest', w: 40, h: 32,
  spawn: { x: 2, y: 15 },
  ops: [
    ['border', T.TREE, 2],
    ['fill', T.PATH, 0, 15, 31, 2], ['fill', T.PATH, 29, 8, 2, 21],
    ['building', 25, 2, 10, 6, { label: 'Santuario', roof: '#245c32', door: 5 }],
    ['building', 4, 3, 7, 5, { label: 'Teleférico', roof: '#8d6e63', door: 3 }],
    ['fill', T.PATH, 7, 8, 1, 7],
    ['fill', T.WATER, 15, 4, 6, 4],
    ['fill', T.TALL, 3, 10, 3, 4], ['fill', T.TALL, 9, 10, 9, 4],
    ['fill', T.TALL, 3, 19, 12, 9], ['fill', T.TALL, 17, 19, 10, 9], ['fill', T.TALL, 33, 11, 5, 12],
    ['scatter', T.TREE, [[12, 21], [8, 24], [20, 23], [23, 20], [35, 15], [33, 26], [36, 27], [24, 9], [13, 6]]],
  ],
  warps: [{ x: 0, y: 15, h: 2, to: 'distrito', tx: 42, ty: 15 }],
  encounters: { pool: [
    { id: 'aoi_morikawa', w: 1, min: 18, max: 22 }, { id: 'fuyu_hayama', w: 3, min: 17, max: 20 },
    { id: 'tsubasa_kino', w: 1, min: 19, max: 22 }, { id: 'mei_kobayashi', w: 2, min: 16, max: 19 },
    { id: 'hana_ishii', w: 1, min: 16, max: 19 },
  ] },
  scoutPool: [{ id: 'aoi_morikawa', min: 20, max: 22, x: 22, y: 25 }, { id: 'tsubasa_kino', min: 20, max: 23, x: 35, y: 24 }, { id: 'fuyu_hayama', min: 19, max: 21, x: 5, y: 26 }],
  items: [{ x: 3, y: 27, item: 'pergamino_tecnica', flag: 'it_bos_1' }, { x: 36, y: 12, item: 'carta_especial', qty: 2, flag: 'it_bos_2' }],
  npcs: [
    { id: 'guardian_1', name: 'Guardián del Bosque', x: 29, y: 9, dir: 'down', look: { ...LOOKS.monk, shirt: '#245c32' }, hideIf: { flag: 'ch3_done' }, sight: 3, sightFlag: 'ch3_done', script: [
      { title: 'Capítulo 3', subtitle: 'El santuario esmeralda' },
      ...rivalMatch('guardianes_bosque', 22, 'guardianes_beaten',
        ['Alto. El santuario custodia el Manual sagrado de la Raíz Ancestral.', 'Solo quien vence a los Guardianes puede contemplarlo.'],
        ['El bosque os reconoce. Pasad, campeones.'],
        ['El bosque no os considera dignos todavía. Entrenad y volved.']),
    ] },
    { id: 'guardian_2', name: 'Guardián del Bosque', x: 30, y: 9, dir: 'down', look: { ...LOOKS.monk, shirt: '#245c32' }, hideIf: { flag: 'ch3_done' }, script: [
      { say: 'Habla con mi compañero si buscas el desafío del santuario.' },
    ] },
    { id: 'moriya', name: 'Anciano Moriya', x: 31, y: 8, dir: 'down', look: LOOKS.oldman, showIf: { flag: 'ch3_done' }, script: [
      { say: 'El manual de la Raíz Ancestral es vuestro. Que un jugador del bosque lo aprenda y honre su poder.' },
      { say: 'El Permiso del teleférico os llevará a la Cumbre Granito. Los Titanes os esperan.' },
      ...heal('Anciano Moriya'),
    ] },
    door('santuario', 30, 7, 'Santuario', [{ say: 'Un altar de piedra cubierto de musgo. Se respira paz.', who: 'Santuario' }]),
    door('teleferico', 7, 7, 'Teleférico', [
      { if: { item: { id: 'pase_cumbre' } }, then: [{ say: '¡Sujétense bien! Subiendo a la Cumbre Granito.', who: 'Operario' }, { warp: { map: 'cumbre', x: 6, y: 22 } }],
        else: [{ say: 'Necesitas el Pase del teleférico. Los Guardianes del santuario lo custodian.', who: 'Operario' }] },
    ]),
    { id: 'shizuka', name: 'Shizuka Kiri', x: 36, y: 25, dir: 'left', templateId: 'shizuka_kiri', showIf: { flag: 'ch3_done' }, hideIf: { owns: 'shizuka_kiri' }, script: challenge('shizuka_kiri', 24,
      ['La niebla me dijo que vendrías.', 'Si tu fútbol es tan puro como dicen... supérame.'],
      ['El bosque ha hablado. Caminaré a tu lado.'],
      ['La niebla aún no se ha disipado para ti.']) },
  ],
};

// ================================================================ CUMBRE GRANITO
const cumbre = {
  id: 'cumbre', name: 'Cumbre Granito', zone: 'Cumbre Granito', theme: 'mountain', music: 'mountain', w: 40, h: 30,
  spawn: { x: 6, y: 22 },
  ops: [
    ['border', T.ROCK, 2],
    ['fill', T.PATH, 6, 8, 2, 15], ['fill', T.PATH, 6, 8, 28, 2], ['fill', T.PATH, 32, 7, 1, 1],
    ['building', 3, 23, 7, 5, { label: 'Teleférico', roof: '#8d6e63', door: 3, doorSide: 'top' }],
    ['field', 14, 12, 14, 8, 'Campo de la cumbre'],
    ['building', 28, 2, 9, 5, { label: 'Templo', roof: '#e67e22', door: 4 }],
    ['building', 30, 21, 6, 4, { label: 'Refugio', roof: '#5d4037', door: 3, doorSide: 'top' }],
    ['fill', T.PATH, 33, 10, 1, 11],
    ['fill', T.TALL, 9, 12, 4, 8], ['fill', T.TALL, 29, 11, 3, 9], ['fill', T.TALL, 13, 22, 13, 5],
    ['scatter', T.ROCK, [[11, 4], [15, 5], [22, 4], [25, 6], [36, 12], [36, 16], [28, 23], [12, 24], [19, 21]]],
  ],
  warps: [],
  encounters: { pool: [
    { id: 'gen_ishikawa', w: 1, min: 26, max: 29 }, { id: 'kazuki_tobe', w: 3, min: 24, max: 27 },
    { id: 'yamato_kurogane', w: 1, min: 27, max: 30 }, { id: 'ryo_kondo', w: 2, min: 24, max: 27 },
    { id: 'eiji_mura', w: 1, min: 24, max: 27 },
  ] },
  scoutPool: [{ id: 'gen_ishikawa', min: 28, max: 30, x: 26, y: 25 }, { id: 'yamato_kurogane', min: 29, max: 31, x: 10, y: 19 }, { id: 'kazuki_tobe', min: 26, max: 28, x: 30, y: 18 }],
  items: [{ x: 36, y: 26, item: 'video_leyendas', flag: 'it_cum_1' }, { x: 3, y: 4, item: 'carta_dorada', flag: 'it_cum_2' }],
  npcs: [
    door('tele_cumbre', 6, 23, 'Teleférico', [{ say: 'Bajando al Bosque Esmeralda.', who: 'Operario' }, { warp: { map: 'bosque', x: 7, y: 8 } }]),
    door('refugio', 33, 21, 'Refugio', [...heal('Encargado del refugio'), { save: true }]),
    door('templo', 32, 6, 'Templo', [{ say: 'Incienso y silencio. Una inscripción dice: «La portería es un estado de la mente».', who: 'Templo' }]),
    { id: 'ganseki', name: 'Ganseki Oka', x: 20, y: 11, dir: 'down', templateId: 'ganseki_oka', script: [
      { if: { notFlag: 'titanes_beaten' }, then: [
        { title: 'Capítulo 4', subtitle: 'La cumbre de los titanes' },
        ...rivalMatch('titanes_granito', 28, 'titanes_beaten',
          ['...', 'Los Titanes de Granito no hablan. Juegan.'],
          ['...Sois dignos. El Campeonato Regional se juega aquí. Habla con el Maestro Dan.'],
          ['...Demasiado blandos.']),
      ], else: [{ say: '...Nos veremos en el Campeonato Regional.' }] },
    ] },
    { id: 'dan', name: 'Maestro Dan', x: 13, y: 10, dir: 'right', look: LOOKS.monk, script: [
      { if: { flag: 'titanes_beaten' }, then: [
        { say: 'Habéis vencido a mis Titanes. El Campeonato Regional os espera.' }, { open: 'tournaments' },
      ], else: [{ say: 'Esta montaña forja a los mejores defensas del país. Demostrad vuestro valor ante los Titanes.' }] },
    ] },
    { id: 'iwao', name: 'Iwao Dan', x: 33, y: 8, dir: 'down', templateId: 'iwao_dan', hideIf: { owns: 'iwao_dan' }, script: [
      { quest: 'sq_iwao' },
      ...challenge('iwao_dan', 26, ['He meditado bajo la cascada durante mil días.', 'Si tu disparo atraviesa mi calma... te seguiré.'], ['Mi mente está en paz. Protegeré tu portería.'], ['Tu disparo aún tiembla.']),
    ] },
  ],
};

// ================================================================ CIUDAD CAPITAL
const capital = {
  id: 'capital', name: 'Ciudad Capital', zone: 'Ciudad Capital', theme: 'city', music: 'city', base: 'PLAZA', w: 44, h: 32,
  spawn: { x: 7, y: 7 },
  ops: [
    ['border', T.WALL],
    ['fill', T.PATH, 1, 11, 42, 2], ['fill', T.PATH, 21, 1, 2, 25],
    ['building', 3, 2, 8, 5, { label: 'Estación', roof: '#6c757d', door: 4 }],
    ['building', 15, 1, 14, 9, { label: 'Estadio Nacional', roof: '#f2c94c', door: 7 }],
    ['building', 33, 1, 7, 9, { label: 'Torre Zenith', roof: '#2b0b3f', door: 3 }],
    ['building', 3, 14, 7, 5, { label: 'Tienda', roof: '#2a9d8f', door: 3 }],
    ['building', 13, 19, 7, 5, { label: 'Hotel', roof: '#c0392b', door: 3, doorSide: 'top' }],
    ['building', 3, 22, 7, 5, { label: 'Gimnasio', roof: '#ff5a36', door: 3, doorSide: 'top' }],
    ['fill', T.GRASS, 25, 14, 10, 7], ['fill', T.TALL, 26, 15, 8, 5],
    ['fill', T.WATER, 28, 26, 15, 5], ['fill', T.BRIDGE, 36, 23, 2, 3], ['fill', T.SAND, 24, 22, 19, 1],
    ['fill', T.PATH, 6, 13, 1, 1], ['fill', T.PATH, 16, 13, 1, 6], ['fill', T.PATH, 6, 20, 1, 2], ['fill', T.PATH, 36, 10, 1, 1],
    ['scatter', T.TREE, [[25, 14], [34, 14], [25, 20], [34, 20], [12, 28], [18, 28]]],
  ],
  warps: [],
  encounters: { pool: [
    { id: 'sei_aoyama', w: 2, min: 30, max: 33 }, { id: 'mika_tachibana', w: 1, min: 31, max: 34 },
    { id: 'ryu_kanzaki', w: 1, min: 33, max: 35, requires: { flag: 'ch5_done' } }, { id: 'hana_ishii', w: 2, min: 28, max: 31 },
    { id: 'yuki_shimizu', w: 2, min: 28, max: 31 },
  ] },
  scoutPool: [{ id: 'sei_aoyama', min: 32, max: 34, x: 40, y: 18 }, { id: 'mika_tachibana', min: 33, max: 35, x: 12, y: 9 }, { id: 'ryu_kanzaki', min: 35, max: 37, x: 41, y: 17 }],
  items: [{ x: 42, y: 2, item: 'carta_dorada', flag: 'it_cap_1' }, { x: 2, y: 29, item: 'video_leyendas', flag: 'it_cap_2' }],
  npcs: [
    door('estacion_cap', 7, 6, 'Estación', [{ say: 'Tren de vuelta al Distrito Escolar.', who: 'Revisor' }, { warp: { map: 'distrito', x: 37, y: 7 } }]),
    door('estadio', 22, 9, 'Estadio Nacional', facility('Organizadora', 'El Estadio Nacional. Aquí se decide quién es el mejor equipo del país.', 'tournaments')),
    door('tienda_cap', 6, 18, 'Tienda', [{ say: 'Equipamiento de élite para equipos de élite.', who: 'Dependienta' }, { shop: 'tienda_capital' }]),
    door('hotel', 16, 19, 'Hotel', [...heal('Recepcionista'), { save: true }]),
    door('gimnasio', 6, 22, 'Gimnasio', facility('Preparador', 'El mejor gimnasio del país.', 'training')),
    door('zenith', 36, 9, 'Torre Zenith', [
      { if: { notFlag: 'zenith_decision' }, then: [
        { title: 'Capítulo 5', subtitle: 'La sombra de Zenith' },
        { say: 'Bienvenido. Soy el Director Kuze, del Proyecto Zenith.', who: 'Director Kuze', portrait: 'suit' },
        { say: 'Tu equipo tiene potencial. Nosotros tenemos recursos: 5000 monedas, equipamiento y un programa de "entrenamiento intensivo" para tus jugadores.', who: 'Director Kuze', portrait: 'suit' },
        { say: 'A cambio, llevaréis nuestra insignia y jugaréis... a nuestra manera.', who: 'Director Kuze', portrait: 'suit' },
        { fx: 'shake' },
        { choice: '¿Aceptas la oferta del Proyecto Zenith?', who: 'Director Kuze', options: [
          { text: 'Aceptar el trato', do: [
            { flag: 'zenith_accepted' }, { flag: 'zenith_decision' }, { money: 5000 }, { give: { item: 'insignia_zenith' } }, { give: { item: 'video_leyendas', qty: 2 } },
            { say: 'Sabia decisión. El futuro pertenece a quienes saben adaptarse.', who: 'Director Kuze', portrait: 'suit' },
            { say: '...Así que te has vendido. Pensé que eras diferente. No vuelvas a buscarme.', who: 'Kaito Ren', portrait: 'kaito_ren' },
          ] },
          { text: 'Rechazar: jugamos a nuestra manera', do: [
            { flag: 'zenith_refused' }, { flag: 'zenith_decision' },
            { say: 'Lo lamentarás en el Campeonato Nacional.', who: 'Director Kuze', portrait: 'suit' },
            { fx: 'lightning' },
            { say: '¡Ja! Sabía que no te venderías. Te he estado observando desde el distrito.', who: 'Kaito Ren', portrait: 'kaito_ren' },
            { say: 'Vamos a tumbar a Zenith juntos. Cuenta conmigo, entrenador.', who: 'Kaito Ren', portrait: 'kaito_ren' },
            { if: { notOwns: 'kaito_ren' }, then: [{ player: { id: 'kaito_ren', level: 32, source: 'historia' } }] },
          ] },
        ] },
      ], else: [{ say: 'Las puertas de la torre están cerradas.', who: 'Torre Zenith' }] },
    ]),
    { id: 'hayate', name: 'Hayate Tsuji', x: 24, y: 13, dir: 'down', templateId: 'hayate_tsuji', script: [
      { say: '¡Hola, fans! ¿Un amistoso contra las Águilas? Me vendría bien para mis redes.' },
      { choice: '¿Jugar contra las Águilas de la Capital?', options: [{ text: 'Sí', do: [{ match: { team: 'aguilas_capital', level: 34, context: 'friendly' } }] }, { text: 'No' }] },
    ] },
    { id: 'ferry', name: 'Marinero', x: 36, y: 22, dir: 'down', look: LOOKS.fisher, script: [
      { if: { item: { id: 'billete_isla' } }, then: [{ say: '¡Zarpamos hacia la Isla Tempestad!' }, { warp: { map: 'isla', x: 20, y: 25 } }],
        else: [{ say: 'El ferry a la Isla Tempestad solo lleva a los campeones nacionales.' }] },
    ] },
    { id: 'ryu', name: 'Ryu Kanzaki', x: 40, y: 13, dir: 'left', templateId: 'ryu_kanzaki', showIf: { flag: 'zenith_refused' }, hideIf: { owns: 'ryu_kanzaki' }, script: challenge('ryu_kanzaki', 34,
      ['Rechazaste a Zenith. Interesante.', 'Mi familia también les dijo que no. Demuéstrame que tu equipo merece mi apellido.'],
      ['Acepto. El apellido Kanzaki jugará en el Rayo Azul.'],
      ['No es suficiente.']) },
  ],
};

// ================================================================ ISLA TEMPESTAD
const isla = {
  id: 'isla', name: 'Isla Tempestad', zone: 'Isla Tempestad', theme: 'island', music: 'legend', base: 'SAND', w: 40, h: 30,
  spawn: { x: 20, y: 25 },
  ops: [
    ['border', T.WATER, 2],
    ['fill', T.GRASS, 3, 3, 34, 19],
    ['fill', T.PATH, 19, 10, 2, 17], ['fill', T.PATH, 4, 11, 32, 1],
    ['building', 14, 3, 12, 7, { label: 'Estadio Internacional', roof: '#0d47a1', door: 6 }],
    ['building', 31, 3, 6, 5, { label: 'Ruinas Eternas', roof: '#ffcf33', door: 3 }],
    ['building', 4, 4, 6, 4, { label: 'Cabaña', roof: '#8d6e63', door: 3 }],
    ['fill', T.PATH, 7, 8, 1, 3], ['fill', T.PATH, 34, 8, 1, 3],
    ['fill', T.TALL, 3, 13, 14, 8], ['fill', T.TALL, 23, 13, 13, 8],
    ['fill', T.BRIDGE, 19, 27, 2, 1],
    ['scatter', T.TREE, [[12, 4], [28, 5], [3, 21], [36, 21], [11, 14], [30, 16]]],
  ],
  warps: [],
  encounters: { pool: [
    { id: 'tsubasa_kino', w: 3, min: 40, max: 45 }, { id: 'mika_tachibana', w: 3, min: 40, max: 44 },
    { id: 'sei_aoyama', w: 3, min: 40, max: 44 }, { id: 'yamato_kurogane', w: 2, min: 42, max: 46 },
    { id: 'raiden_hokuto', w: 0.4, min: 50, max: 55, requires: { flag: 'ch6_cup' } },
    { id: 'homura_akatsuki', w: 0.4, min: 50, max: 55, requires: { flag: 'ch6_cup' } },
    { id: 'takeshi_gando', w: 0.4, min: 50, max: 55, requires: { flag: 'ch6_cup' } },
    { id: 'sylva_ines', w: 0.4, min: 50, max: 55, requires: { flag: 'ch6_cup' } },
  ] },
  scoutPool: [
    { id: 'raiden_hokuto', min: 52, max: 55, x: 9, y: 19 }, { id: 'homura_akatsuki', min: 52, max: 55, x: 30, y: 19 },
    { id: 'takeshi_gando', min: 52, max: 55, x: 5, y: 14 }, { id: 'sylva_ines', min: 52, max: 55, x: 34, y: 14 },
  ],
  items: [{ x: 37, y: 4, item: 'carta_dorada', qty: 2, flag: 'it_isl_1' }, { x: 3, y: 4, item: 'botas_trueno', flag: 'it_isl_2' }],
  npcs: [
    { id: 'ferry_isla', name: 'Marinero', x: 22, y: 26, dir: 'left', look: LOOKS.fisher, script: [{ say: '¿Volvemos a la Capital?' }, { choice: '¿Volver a la Capital?', options: [{ text: 'Sí', do: [{ warp: { map: 'capital', x: 36, y: 21 } }] }, { text: 'No' }] }] },
    door('estadio_int', 20, 9, 'Estadio Internacional', [
      { if: { notFlag: 'visited_isla_title' }, then: [{ title: 'Capítulo 6', subtitle: 'Leyendas de la tormenta' }, { flag: 'visited_isla_title' }] },
      ...facility('Organizador', 'Welcome! ¡Bienvenidos a la Copa Internacional Tempestad!', 'tournaments'),
    ]),
    door('cabana', 7, 7, 'Cabaña', [...heal('Ermitaño'), { save: true }]),
    door('ruinas', 34, 7, 'Ruinas Eternas', [
      { if: { flag: 'ch6_cup' }, then: [{ say: 'Una voz resuena entre las piedras: «Campeón del mundo... ¿te atreves con las leyendas?»', who: 'Ruinas Eternas' }, { fx: 'lightning' }, { open: 'tournaments' }],
        else: [{ say: 'Las piedras vibran, pero nada responde. Quizá un campeón del mundo...', who: 'Ruinas Eternas' }] },
    ]),
    { id: 'zero', name: 'Zero Amane', x: 33, y: 9, dir: 'down', templateId: 'zero_amane', showIf: { flag: 'game_cleared' }, hideIf: { owns: 'zero_amane' }, script: challenge('zero_amane', 60,
      ['Venciste a las Leyendas Eternas.', 'Yo soy el relámpago que nunca se apaga. ¿Podrás alcanzarme?'],
      ['...Por fin. Un entrenador digno del rayo.'], ['Todavía eres demasiado lento.']) },
    { id: 'aurora', name: 'Aurora Valen', x: 35, y: 9, dir: 'down', templateId: 'aurora_valen', showIf: { flag: 'game_cleared' }, hideIf: { owns: 'aurora_valen' }, script: challenge('aurora_valen', 62,
      ['Tu equipo ha hecho florecer el fútbol de este país.', 'Juguemos una última vez. Si ganas, te acompañaré.'],
      ['Que florezca el fútbol, entrenador. Juntos.'], ['Las flores necesitan tiempo. Vuelve pronto.']) },
  ],
};

export const MAPS = [villa_rayo, ribera, distrito, bosque, cumbre, capital, isla];
export const MAP_SPECS = Object.fromEntries(MAPS.map((m) => [m.id, m]));
export { LOOKS };
