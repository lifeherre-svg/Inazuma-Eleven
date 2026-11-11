// Base de datos de futbolistas con nombre propio (contenido original).
//
// Formato compacto de fila (se convierte en objetos con parsePlayerRow):
// [id, nombre, apellido, equipo, posición, elemento, rareza, personalidad,
//  [TIR, REG, DEF, CTR, TEC, VEL, RES, FIS],  // estadísticas base a nivel 1 (antes de rareza)
//  'nivel:técnica, nivel:técnica',             // técnicas que aprende al subir de nivel
//  'historia personal', { look opcional }]
//
// Los equipos rivales completan su plantilla con jugadores generados
// automáticamente (ver systems/database.js), así que aquí solo figuran las estrellas.

import { STATS } from '../config.js';

const ROWS = [
  // ===== INSTITUTO RAYO AZUL (miembros iniciales del club) =====
  ['takumi_ono', 'Takumi', 'Ono', 'rayo_azul', 'GK', 'mountain', 'common', 'amable', [14, 12, 33, 24, 22, 22, 30, 32], '1:mano_rocosa,12:guardian_bosque', 'El único que nunca dejó de entrenar en el club abandonado. Sueña con una portería imbatible.', { hair: 'short', hairColor: '#6b3e1f', accessory: 'headband' }],
  ['yuto_mori', 'Yuto', 'Mori', 'rayo_azul', 'DF', 'wood', 'common', 'calmado', [14, 18, 32, 24, 22, 24, 28, 28], '5:red_de_lianas,16:muralla_arborea', 'Estudiante de botánica que defiende con paciencia infinita.'],
  ['shin_arai', 'Shin', 'Arai', 'rayo_azul', 'DF', 'mountain', 'common', 'orgulloso', [16, 16, 33, 22, 20, 22, 28, 32], '1:barrida_terrestre,8:escudo_roca', 'Corpulento y testarudo. Presume de no haber perdido nunca un pulso.'],
  ['haru_kimura', 'Haru', 'Kimura', 'rayo_azul', 'MF', 'wind', 'common', 'amable', [22, 28, 22, 30, 26, 30, 26, 18], '6:paso_fantasma,14:cuchilla_viento', 'El organizador del grupo: siempre tiene una sonrisa y un pase preparado.'],
  ['ren_matsuda', 'Ren', 'Matsuda', 'rayo_azul', 'MF', 'fire', 'common', 'apasionado', [26, 26, 20, 28, 24, 28, 26, 22], '8:estela_ignea,15:tiro_llamarada', 'Grita más que nadie en los partidos. Su energía es contagiosa.'],
  ['kei_nakano', 'Kei', 'Nakano', 'rayo_azul', 'DF', 'wind', 'common', 'rebelde', [16, 22, 30, 22, 22, 32, 26, 22], '8:ciclon_ladron,12:pared_viento', 'Velocista del club de atletismo que se pasó al fútbol por una apuesta.'],
  ['sota_ueda', 'Sota', 'Ueda', 'rayo_azul', 'FW', 'mountain', 'common', 'calmado', [30, 22, 18, 22, 22, 24, 26, 30], '1:roca_bala,14:avalancha', 'Delantero tanque. Tranquilo fuera del campo, imparable dentro del área.'],

  // ===== TRÍO INICIAL (el jugador elige uno) =====
  ['kenta_hoshino', 'Kenta', 'Hoshino', 'rayo_azul', 'FW', 'fire', 'rare', 'apasionado', [38, 30, 16, 26, 28, 30, 28, 26], '1:tiro_llamarada,9:estela_ignea,15:cometa_carmesi,15:llamarada_gemela,30:fenix_ascendente', 'Llegó al instituto con un balón quemado y la promesa de convertirse en leyenda.', { hair: 'spiky', hairColor: '#ff7b2e', accessory: 'headband' }],
  ['sora_minase', 'Sora', 'Minase', 'rayo_azul', 'MF', 'wind', 'rare', 'calmado', [28, 36, 20, 34, 32, 34, 26, 18], '1:paso_fantasma,5:cuchilla_viento,15:tornado_celeste,22:espejismo,26:triangulo_tormenta', 'Un estratega que lee el partido como si fuera una partida de ajedrez.', { hair: 'swept', hairColor: '#7fd6ff' }],
  ['daigo_iwata', 'Daigo', 'Iwata', 'rayo_azul', 'DF', 'mountain', 'rare', 'amable', [18, 20, 38, 26, 26, 24, 32, 36], '1:barrida_terrestre,4:escudo_roca,18:impacto_gaia,24:garra_titan', 'Hijo de un cantero. Su cuerpo es una muralla y su corazón, aún más grande.', { hair: 'mohawk', hairColor: '#4a3426' }],

  // ===== VILLA RAYO / PARQUE RIBERA (agentes libres) =====
  ['midori_asahina', 'Midori', 'Asahina', 'free', 'FW', 'wood', 'uncommon', 'amable', [32, 28, 16, 24, 26, 28, 24, 20], '1:disparo_hoja,6:danza_hojas,14:espiral_esmeralda,28:raiz_ancestral', 'Entrena sola junto al río cada mañana. Nadie le había pedido nunca que jugara en equipo.', { hair: 'ponytail', hairColor: '#3fae5a' }],
  ['goro_tanaka', 'Goro', 'Tanaka', 'free', 'DF', 'mountain', 'common', 'orgulloso', [14, 14, 32, 20, 18, 18, 28, 34], '3:barrida_terrestre,10:escudo_roca', 'Trabaja en la pescadería del barrio. Dice que mover cajas es mejor que cualquier gimnasio.'],
  ['aki_sato', 'Aki', 'Sato', 'free', 'MF', 'wind', 'common', 'amable', [22, 28, 20, 30, 26, 30, 26, 16], '5:paso_fantasma,12:cuchilla_viento', 'Reparte periódicos en bicicleta. Conoce cada atajo de la ciudad.'],
  ['jun_ito', 'Jun', 'Ito', 'free', 'FW', 'fire', 'common', 'apasionado', [32, 24, 14, 20, 22, 28, 24, 24], '1:tiro_llamarada,12:estela_ignea', 'Siempre dispara. Siempre. Aunque esté en su propia área.'],
  ['nao_fujita', 'Nao', 'Fujita', 'free', 'GK', 'wood', 'common', 'calmado', [12, 14, 30, 26, 24, 22, 28, 28], '4:mano_rocosa,15:guardian_bosque', 'Portera del equipo de balonmano que busca un nuevo reto.'],
  ['mei_kobayashi', 'Mei', 'Kobayashi', 'free', 'MF', 'wood', 'uncommon', 'calmado', [24, 30, 22, 34, 30, 26, 28, 18], '4:danza_hojas,12:disparo_hoja,20:senda_bosque', 'Presidenta del club de ajedrez. Ve el campo en tres dimensiones.'],
  ['taro_yamada', 'Taro', 'Yamada', 'free', 'DF', 'fire', 'common', 'rebelde', [16, 18, 30, 20, 20, 24, 28, 30], '6:muralla_llamas,14:barrida_terrestre', 'Expulsado de tres equipos por pelear. Busca alguien que crea en él.'],
  ['rin_hayashi', 'Rin', 'Hayashi', 'free', 'FW', 'wind', 'uncommon', 'ambicioso', [32, 30, 14, 24, 26, 34, 24, 18], '1:cuchilla_viento,8:paso_fantasma,18:tornado_celeste', 'Quiere ser profesional antes de los 18 y no piensa esperar.'],
  ['koji_saito', 'Koji', 'Saito', 'free', 'MF', 'mountain', 'common', 'calmado', [22, 22, 26, 28, 24, 22, 30, 28], '6:paso_sismico,14:roca_bala', 'El mediocentro del equipo de veteranos del barrio. Lleva 20 años sin faltar a un entrenamiento.'],

  // ===== DISTRITO ESCOLAR =====
  ['yuki_shimizu', 'Yuki', 'Shimizu', 'free', 'MF', 'wind', 'rare', 'orgulloso', [28, 36, 22, 34, 34, 32, 26, 18], '1:paso_fantasma,10:pared_viento,18:espejismo,24:tornado_celeste', 'Antigua estrella juvenil que dejó el fútbol tras una lesión. ¿Volverá a brillar?', { hair: 'long', hairColor: '#e8f4ff' }],
  ['ryo_kondo', 'Ryo', 'Kondo', 'free', 'DF', 'mountain', 'uncommon', 'calmado', [16, 18, 36, 24, 22, 22, 30, 34], '1:barrida_terrestre,9:escudo_roca,24:garra_titan', 'Capitán del equipo de rugby. Su placaje es legendario en el distrito.'],
  ['hana_ishii', 'Hana', 'Ishii', 'free', 'FW', 'fire', 'uncommon', 'ambicioso', [34, 28, 14, 24, 28, 30, 24, 20], '1:tiro_llamarada,12:cometa_carmesi,15:llamarada_gemela', 'Máxima goleadora de la liga femenina juvenil. Busca un reto mayor.', { hair: 'ponytail', hairColor: '#ff4d4d' }],
  ['eiji_mura', 'Eiji', 'Mura', 'free', 'GK', 'mountain', 'uncommon', 'orgulloso', [12, 14, 34, 24, 26, 22, 28, 34], '1:mano_rocosa,10:cupula_viento,26:mano_colosal', 'Portero suplente eterno de un gran colegio. Está harto de calentar banquillo.'],
  ['kaito_ren', 'Kaito', 'Ren', 'free', 'FW', 'fire', 'epic', 'rebelde', [40, 34, 16, 28, 32, 34, 28, 24], '1:tiro_llamarada,8:estela_ignea,14:cometa_carmesi,15:llamarada_gemela,26:fenix_ascendente,40:torbellino_dorado', 'El rival de la infancia del protagonista. Orgulloso, solitario y brillante.', { hair: 'spiky', hairColor: '#2b2b3a', accessory: 'bandana' }],

  // ===== BOSQUE ESMERALDA =====
  ['aoi_morikawa', 'Aoi', 'Morikawa', 'free', 'MF', 'wood', 'rare', 'amable', [28, 34, 24, 36, 32, 28, 30, 20], '1:danza_hojas,10:red_de_lianas,18:espiral_esmeralda,26:senda_bosque', 'Creció en el santuario del bosque. Habla con los árboles... o eso dice.', { hair: 'long', hairColor: '#2f7d4a' }],
  ['fuyu_hayama', 'Fuyu', 'Hayama', 'free', 'DF', 'wood', 'uncommon', 'calmado', [16, 20, 34, 26, 24, 26, 30, 28], '1:red_de_lianas,16:muralla_arborea', 'Guardabosques en prácticas. Silencioso como el bosque en invierno.'],
  ['shizuka_kiri', 'Shizuka', 'Kiri', 'free', 'FW', 'wood', 'epic', 'calmado', [40, 34, 16, 30, 36, 30, 26, 20], '1:disparo_hoja,10:espiral_esmeralda,24:raiz_ancestral,35:aurora_trinidad', 'Dicen que apareció entre la niebla del bosque y nunca ha fallado un penalti.', { hair: 'long', hairColor: '#c8f5d6', accessory: 'cape' }],
  ['tsubasa_kino', 'Tsubasa', 'Kino', 'free', 'FW', 'wind', 'rare', 'ambicioso', [36, 32, 14, 26, 28, 38, 24, 18], '1:cuchilla_viento,12:tornado_celeste,25:triangulo_tormenta,32:rayo_divino', 'El chico más rápido de la prefectura. Corre descalzo por los senderos del bosque.'],

  // ===== CUMBRE GRANITO =====
  ['gen_ishikawa', 'Gen', 'Ishikawa', 'free', 'DF', 'mountain', 'rare', 'orgulloso', [18, 18, 40, 26, 24, 24, 32, 40], '1:barrida_terrestre,10:escudo_roca,18:impacto_gaia,22:garra_titan', 'Escalador que entrena cargando piedras montaña arriba.'],
  ['iwao_dan', 'Iwao', 'Dan', 'free', 'GK', 'mountain', 'epic', 'calmado', [14, 14, 42, 28, 30, 22, 34, 42], '1:mano_rocosa,14:guardian_bosque,24:mano_colosal,42:muralla_celestial', 'El monje portero del templo de la cumbre. Medita bajo cascadas heladas.', { hair: 'bald', hairColor: '#333', accessory: 'beads' }],
  ['kazuki_tobe', 'Kazuki', 'Tobe', 'free', 'MF', 'mountain', 'uncommon', 'rebelde', [26, 26, 26, 28, 24, 24, 30, 30], '1:paso_sismico,14:avalancha', 'Hijo del dueño del refugio de montaña. Odia que le digan lo que tiene que hacer.'],
  ['yamato_kurogane', 'Yamato', 'Kurogane', 'free', 'FW', 'mountain', 'epic', 'orgulloso', [42, 26, 20, 26, 30, 26, 30, 36], '1:roca_bala,10:avalancha,18:impacto_gaia,28:meteoro_granito', 'El "Meteoro de la Cumbre". Su disparo ha agrietado más de un larguero.', { hair: 'spiky', hairColor: '#5c5c66' }],

  // ===== CIUDAD CAPITAL =====
  ['ryu_kanzaki', 'Ryu', 'Kanzaki', 'free', 'MF', 'fire', 'epic', 'ambicioso', [34, 36, 22, 38, 36, 32, 28, 22], '1:estela_ignea,12:muralla_llamas,20:cometa_carmesi,30:torbellino_dorado', 'Heredero de una dinastía futbolística. Busca un equipo digno de su apellido.', { hair: 'swept', hairColor: '#b31c2e', accessory: 'goggles' }],
  ['sei_aoyama', 'Sei', 'Aoyama', 'free', 'DF', 'wind', 'rare', 'calmado', [18, 24, 38, 30, 28, 32, 28, 26], '1:ciclon_ladron,10:pared_viento,30:tempestad_negra', 'Defensa elegante que nunca necesita hacer una falta.'],
  ['mika_tachibana', 'Mika', 'Tachibana', 'free', 'FW', 'wind', 'rare', 'apasionado', [38, 32, 14, 26, 30, 36, 24, 18], '1:cuchilla_viento,14:tornado_celeste,30:rayo_divino', 'Idol de televisión y delantera de verdad. Odia que la subestimen.', { hair: 'ponytail', hairColor: '#ffd1f0' }],

  // ===== ISLA TEMPESTAD (legendarios y míticos) =====
  ['raiden_hokuto', 'Raiden', 'Hokuto', 'free', 'FW', 'wind', 'legendary', 'orgulloso', [46, 36, 18, 30, 38, 40, 30, 24], '1:cuchilla_viento,1:tornado_celeste,20:rayo_divino,25:triangulo_tormenta,50:trueno_final', 'El delantero que domó el rayo. Lleva años esperando un rival digno en la isla.', { hair: 'spiky', hairColor: '#ffe94a', accessory: 'cape' }],
  ['homura_akatsuki', 'Homura', 'Akatsuki', 'free', 'FW', 'fire', 'legendary', 'apasionado', [46, 34, 18, 30, 36, 34, 32, 28], '1:tiro_llamarada,1:cometa_carmesi,22:fenix_ascendente,40:volcan_supremo', 'Su espíritu arde tanto que el césped humea a su paso.', { hair: 'spiky', hairColor: '#ff3b1f', accessory: 'headband' }],
  ['takeshi_gando', 'Takeshi', 'Gando', 'free', 'GK', 'mountain', 'legendary', 'amable', [14, 16, 46, 30, 34, 24, 36, 46], '1:mano_rocosa,1:mano_colosal,40:muralla_celestial', 'El guardián legendario. Ningún disparo le ha superado en un año entero.'],
  ['sylva_ines', 'Sylva', 'Inés', 'free', 'MF', 'wood', 'legendary', 'calmado', [34, 40, 26, 42, 40, 32, 32, 22], '1:danza_hojas,1:espiral_esmeralda,20:senda_bosque,35:aurora_trinidad', 'Maga del centro del campo llegada de ultramar. Sus pases parecen teletransportarse.', { hair: 'long', hairColor: '#9cf2b0' }],
  ['zero_amane', 'Zero', 'Amane', 'free', 'FW', 'wind', 'mythic', 'rebelde', [50, 42, 20, 34, 42, 44, 32, 26], '1:cuchilla_viento,1:rayo_divino,1:espejismo,40:trueno_final', 'El Relámpago Eterno. Una leyenda de la que nadie conoce el origen.', { hair: 'long', hairColor: '#f2f2ff', accessory: 'cape' }],
  ['aurora_valen', 'Aurora', 'Valen', 'free', 'MF', 'wood', 'mythic', 'amable', [42, 44, 28, 46, 46, 34, 34, 22], '1:senda_bosque,1:raiz_ancestral,35:aurora_trinidad', 'La capitana de las Leyendas Eternas. Su fútbol hace florecer el campo.', { hair: 'long', hairColor: '#ffb6e1', accessory: 'cape' }],

  // ===== ESTRELLAS DE EQUIPOS RIVALES (reclutables tras vencerles) =====
  ['nagi_umino', 'Nagi', 'Umino', 'halcones_puerto', 'FW', 'wind', 'uncommon', 'apasionado', [32, 28, 14, 22, 24, 30, 24, 20], '1:cuchilla_viento,10:tornado_celeste', 'Delantero del puerto, huele a salitre y a gol.'],
  ['kai_minato', 'Kai', 'Minato', 'halcones_puerto', 'GK', 'wind', 'common', 'amable', [12, 14, 30, 24, 22, 22, 28, 30], '1:cupula_viento', 'Hijo de pescadores. Atrapa el balón como si fuera una red.'],
  ['kuro_tsubame', 'Kuro', 'Tsubame', 'cuervo_negro', 'FW', 'fire', 'rare', 'rebelde', [36, 30, 14, 24, 28, 32, 24, 22], '1:tiro_llamarada,12:cometa_carmesi', 'Capitán de la Academia Cuervo Negro. Juega sucio... pero juega bien.', { hair: 'spiky', hairColor: '#1b1b24' }],
  ['karasu_mido', 'Karasu', 'Mido', 'cuervo_negro', 'DF', 'fire', 'uncommon', 'orgulloso', [16, 18, 34, 22, 22, 24, 28, 32], '1:muralla_llamas', 'Defensa intimidante con ojeras permanentes.'],
  ['ichika_hanazono', 'Ichika', 'Hanazono', 'hanazono', 'MF', 'wood', 'rare', 'amable', [28, 34, 22, 34, 32, 28, 28, 18], '1:danza_hojas,12:espiral_esmeralda,20:senda_bosque', 'Capitana del Colegio Hanazono. Juega como si bailara.', { hair: 'long', hairColor: '#ff9ec7' }],
  ['tetsu_kurama', 'Tetsu', 'Kurama', 'vertice', 'DF', 'mountain', 'rare', 'calmado', [18, 18, 38, 30, 32, 22, 30, 34], '1:barrida_terrestre,1:escudo_roca,22:garra_titan', 'Cerebro defensivo del Instituto Tecnológico Vértice. Calcula cada ángulo.', { hair: 'short', hairColor: '#8a93a6', accessory: 'glasses' }],
  ['ken_vertex', 'Ken', 'Hagane', 'vertice', 'FW', 'mountain', 'rare', 'calmado', [36, 26, 18, 28, 32, 26, 28, 30], '1:roca_bala,14:avalancha', 'Delantero analítico: dispara solo cuando la probabilidad supera el 70%.'],
  ['sakaki_moriya', 'Sakaki', 'Moriya', 'guardianes_bosque', 'GK', 'wood', 'epic', 'calmado', [14, 16, 40, 30, 32, 24, 32, 38], '1:guardian_bosque,24:mano_colosal', 'El guardián del santuario. Nadie ha marcado en su bosque.'],
  ['ganseki_oka', 'Ganseki', 'Oka', 'titanes_granito', 'DF', 'mountain', 'epic', 'orgulloso', [20, 18, 42, 26, 26, 22, 34, 44], '1:barrida_terrestre,1:garra_titan,18:impacto_gaia', 'El titán. Mide casi dos metros y nunca sonríe.'],
  ['hayate_tsuji', 'Hayate', 'Tsuji', 'aguilas_capital', 'FW', 'wind', 'epic', 'ambicioso', [40, 34, 16, 28, 32, 38, 26, 20], '1:tornado_celeste,24:rayo_divino', 'La estrella mediática de la capital. Tiene más seguidores que goles... y tiene muchos goles.'],
  ['shion_zenith', 'Shion', 'Kuze', 'imperio_zenith', 'FW', 'fire', 'legendary', 'ambicioso', [46, 34, 18, 30, 36, 34, 30, 26], '1:cometa_carmesi,1:fenix_ascendente,40:volcan_supremo', 'El producto estrella del Proyecto Zenith. ¿Talento o algo más?', { hair: 'swept', hairColor: '#d4d4ff', accessory: 'goggles' }],
  ['marco_bellini', 'Marco', 'Bellini', 'dragones_oriente', 'MF', 'fire', 'epic', 'orgulloso', [34, 38, 22, 38, 36, 32, 28, 22], '1:estela_ignea,1:cometa_carmesi,30:torbellino_dorado', 'Fantasista internacional. Sus taconazos tienen club de fans propio.'],
  ['liam_oconnor', "Liam", "O'Connor", 'tormenta_atlantica', 'DF', 'wind', 'epic', 'rebelde', [20, 22, 40, 28, 28, 34, 32, 30], '1:ciclon_ladron,1:pared_viento,30:tempestad_negra', 'Defensa que juega con la furia del Atlántico.'],
  ['kwame_mensah', 'Kwame', 'Mensah', 'leones_sabana', 'FW', 'mountain', 'epic', 'apasionado', [42, 32, 18, 28, 30, 36, 32, 34], '1:roca_bala,1:avalancha,30:meteoro_granito', 'El león de la sabana. Potencia y velocidad en un solo jugador.'],
];

export function parsePlayerRow(row) {
  const [id, name, surname, team, position, element, rarity, personality, statArr, learnStr, bio, look] = row;
  const base = Object.fromEntries(STATS.map((s, i) => [s, statArr[i]]));
  const learnset = (learnStr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [lvl, tech] = s.split(':');
      return { level: Number(lvl), tech: tech.trim() };
    });
  return { id, name, surname, team, position, element, rarity, personality, base, learnset, bio, look: look || null, generated: false };
}

export const PLAYERS = ROWS.map(parsePlayerRow);
export const STARTER_IDS = ['kenta_hoshino', 'sora_minase', 'daigo_iwata'];
export const INITIAL_CLUB_IDS = ['takumi_ono', 'yuto_mori', 'shin_arai', 'haru_kimura', 'ren_matsuda', 'kei_nakano', 'sota_ueda'];
