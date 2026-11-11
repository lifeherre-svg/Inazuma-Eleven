// Base de datos de técnicas especiales (contenido original).
//
// Campos:
//  id, name, category (shoot | dribble | defense | block | keeper | combo),
//  element, power (potencia base), tp (coste de energía),
//  anim (tipo de animación/VFX), desc,
//  requires: { level?, stats?: {stat: valor}, positions?: [], element? (debe coincidir con el del jugador) }
//  combo: { participants: n }  -> solo técnicas combinadas
//  rarity: orientativo para manuales/tienda.

export const TECHNIQUE_CATEGORIES = {
  shoot:   { label: 'Tiro',      icon: '⚡' },
  dribble: { label: 'Regate',    icon: '💨' },
  defense: { label: 'Defensa',   icon: '🛡️' },
  block:   { label: 'Bloqueo',   icon: '🧱' },
  keeper:  { label: 'Portero',   icon: '🧤' },
  combo:   { label: 'Combinada', icon: '✨' },
};

export const TECHNIQUES = [
  // ---------- TIRO ----------
  { id: 'tiro_llamarada', name: 'Tiro Llamarada', category: 'shoot', element: 'fire', power: 45, tp: 12, anim: 'flame', desc: 'Un chut envuelto en llamas que deja un rastro abrasador.', requires: { level: 1 } },
  { id: 'cometa_carmesi', name: 'Cometa Carmesí', category: 'shoot', element: 'fire', power: 70, tp: 20, anim: 'flame', desc: 'El balón se convierte en un cometa rojo que desciende desde el cielo.', requires: { level: 12, stats: { shoot: 55 } } },
  { id: 'fenix_ascendente', name: 'Fénix Ascendente', category: 'shoot', element: 'fire', power: 100, tp: 32, anim: 'phoenix', desc: 'Un fénix de fuego nace del balón y se lanza contra la portería.', requires: { level: 28, stats: { shoot: 95 } } },
  { id: 'volcan_supremo', name: 'Volcán Supremo', category: 'shoot', element: 'fire', power: 135, tp: 45, anim: 'phoenix', desc: 'La técnica definitiva del fuego: la tierra entra en erupción bajo el balón.', requires: { level: 45, stats: { shoot: 140 }, element: 'fire' } },
  { id: 'disparo_hoja', name: 'Disparo Hoja', category: 'shoot', element: 'wood', power: 42, tp: 11, anim: 'leaf', desc: 'Un remate cortante rodeado de hojas afiladas.', requires: { level: 1 } },
  { id: 'espiral_esmeralda', name: 'Espiral Esmeralda', category: 'shoot', element: 'wood', power: 68, tp: 20, anim: 'leaf', desc: 'El balón gira en espiral arrastrando un torbellino verde.', requires: { level: 12, stats: { shoot: 52 } } },
  { id: 'raiz_ancestral', name: 'Raíz Ancestral', category: 'shoot', element: 'wood', power: 98, tp: 32, anim: 'leaf', desc: 'Raíces gigantes emergen y catapultan el balón.', requires: { level: 28, stats: { shoot: 92 } } },
  { id: 'roca_bala', name: 'Roca Bala', category: 'shoot', element: 'mountain', power: 46, tp: 12, anim: 'rock', desc: 'El balón se endurece como una roca y sale disparado.', requires: { level: 1 } },
  { id: 'avalancha', name: 'Avalancha', category: 'shoot', element: 'mountain', power: 72, tp: 22, anim: 'rock', desc: 'Una cascada de piedras acompaña al balón hacia la red.', requires: { level: 14, stats: { shoot: 55, physical: 50 } } },
  { id: 'meteoro_granito', name: 'Meteoro de Granito', category: 'shoot', element: 'mountain', power: 104, tp: 34, anim: 'meteor', desc: 'Un meteoro de granito cae envuelto en polvo dorado.', requires: { level: 30, stats: { shoot: 98 } } },
  { id: 'cuchilla_viento', name: 'Cuchilla de Viento', category: 'shoot', element: 'wind', power: 44, tp: 11, anim: 'wind', desc: 'Un tiro veloz que corta el aire como una cuchilla.', requires: { level: 1 } },
  { id: 'tornado_celeste', name: 'Tornado Celeste', category: 'shoot', element: 'wind', power: 70, tp: 20, anim: 'wind', desc: 'El jugador gira en el aire y libera un tornado.', requires: { level: 12, stats: { shoot: 54 } } },
  { id: 'rayo_divino', name: 'Rayo Divino', category: 'shoot', element: 'wind', power: 108, tp: 35, anim: 'lightning', desc: 'Un relámpago cae sobre el balón y lo lanza a velocidad imposible.', requires: { level: 32, stats: { shoot: 100 } } },
  { id: 'trueno_final', name: 'Trueno Final', category: 'shoot', element: 'wind', power: 140, tp: 48, anim: 'lightning', desc: 'El rugido de la tormenta definitiva. Solo los míticos lo dominan.', requires: { level: 50, stats: { shoot: 150 }, element: 'wind' } },

  // ---------- REGATE ----------
  { id: 'paso_fantasma', name: 'Paso Fantasma', category: 'dribble', element: 'wind', power: 40, tp: 9, anim: 'wind', desc: 'El jugador se desvanece y reaparece detrás del rival.', requires: { level: 1 } },
  { id: 'danza_hojas', name: 'Danza de Hojas', category: 'dribble', element: 'wood', power: 45, tp: 10, anim: 'leaf', desc: 'Una lluvia de hojas confunde al defensor.', requires: { level: 4 } },
  { id: 'estela_ignea', name: 'Estela Ígnea', category: 'dribble', element: 'fire', power: 55, tp: 13, anim: 'flame', desc: 'Una carrera explosiva que deja un camino de fuego.', requires: { level: 8, stats: { dribble: 45 } } },
  { id: 'paso_sismico', name: 'Paso Sísmico', category: 'dribble', element: 'mountain', power: 50, tp: 12, anim: 'rock', desc: 'Un pisotón hace temblar el suelo y desequilibra al rival.', requires: { level: 6 } },
  { id: 'espejismo', name: 'Espejismo', category: 'dribble', element: 'wind', power: 75, tp: 18, anim: 'wind', desc: 'Tres copias del jugador avanzan a la vez.', requires: { level: 18, stats: { dribble: 70 } } },
  { id: 'torbellino_dorado', name: 'Torbellino Dorado', category: 'dribble', element: 'fire', power: 95, tp: 26, anim: 'phoenix', desc: 'Un giro de fuego dorado imposible de seguir.', requires: { level: 30, stats: { dribble: 100 } } },
  { id: 'senda_bosque', name: 'Senda del Bosque', category: 'dribble', element: 'wood', power: 88, tp: 24, anim: 'leaf', desc: 'Los árboles abren camino al portador del balón.', requires: { level: 26, stats: { dribble: 90 } } },

  // ---------- DEFENSA ----------
  { id: 'barrida_terrestre', name: 'Barrida Terrestre', category: 'defense', element: 'mountain', power: 42, tp: 9, anim: 'rock', desc: 'Una entrada que levanta una ola de tierra.', requires: { level: 1 } },
  { id: 'red_de_lianas', name: 'Red de Lianas', category: 'defense', element: 'wood', power: 50, tp: 12, anim: 'leaf', desc: 'Lianas atrapan el balón y lo devuelven al defensor.', requires: { level: 5 } },
  { id: 'muralla_llamas', name: 'Muralla de Llamas', category: 'defense', element: 'fire', power: 60, tp: 14, anim: 'flame', desc: 'Un muro de fuego corta el paso al atacante.', requires: { level: 10, stats: { defense: 50 } } },
  { id: 'ciclon_ladron', name: 'Ciclón Ladrón', category: 'defense', element: 'wind', power: 55, tp: 13, anim: 'wind', desc: 'Un remolino arrebata el balón de los pies rivales.', requires: { level: 8 } },
  { id: 'garra_titan', name: 'Garra de Titán', category: 'defense', element: 'mountain', power: 85, tp: 22, anim: 'rock', desc: 'Una garra de piedra colosal surge del césped.', requires: { level: 22, stats: { defense: 85 } } },
  { id: 'tempestad_negra', name: 'Tempestad Negra', category: 'defense', element: 'wind', power: 95, tp: 25, anim: 'lightning', desc: 'Nubes negras y rayos rodean al atacante.', requires: { level: 30, stats: { defense: 100 } } },

  // ---------- BLOQUEO ----------
  { id: 'escudo_roca', name: 'Escudo de Roca', category: 'block', element: 'mountain', power: 45, tp: 12, anim: 'rock', desc: 'Una losa de roca intercepta el disparo.', requires: { level: 3 } },
  { id: 'pared_viento', name: 'Pared de Viento', category: 'block', element: 'wind', power: 55, tp: 14, anim: 'wind', desc: 'Una corriente de aire frena el tiro.', requires: { level: 9 } },
  { id: 'muralla_arborea', name: 'Muralla Arbórea', category: 'block', element: 'wood', power: 70, tp: 18, anim: 'leaf', desc: 'Árboles centenarios brotan para bloquear el balón.', requires: { level: 16, stats: { defense: 65 } } },
  { id: 'bastion_igneo', name: 'Bastión Ígneo', category: 'block', element: 'fire', power: 90, tp: 24, anim: 'flame', desc: 'Un bastión de magma detiene hasta los tiros más potentes.', requires: { level: 28, stats: { defense: 95 } } },

  // ---------- PORTERO ----------
  { id: 'mano_rocosa', name: 'Mano Rocosa', category: 'keeper', element: 'mountain', power: 45, tp: 10, anim: 'hand', desc: 'Una mano de piedra gigante detiene el disparo.', requires: { level: 1, positions: ['GK'] } },
  { id: 'puno_llameante', name: 'Puño Llameante', category: 'keeper', element: 'fire', power: 55, tp: 13, anim: 'flame', desc: 'Un puñetazo ardiente despeja el balón.', requires: { level: 6, positions: ['GK'] } },
  { id: 'cupula_viento', name: 'Cúpula de Viento', category: 'keeper', element: 'wind', power: 60, tp: 14, anim: 'wind', desc: 'Una cúpula de aire envuelve la portería.', requires: { level: 10, positions: ['GK'] } },
  { id: 'guardian_bosque', name: 'Guardián del Bosque', category: 'keeper', element: 'wood', power: 72, tp: 18, anim: 'leaf', desc: 'Un espíritu del bosque atrapa el balón entre ramas.', requires: { level: 15, positions: ['GK'] } },
  { id: 'mano_colosal', name: 'Mano Colosal', category: 'keeper', element: 'mountain', power: 95, tp: 26, anim: 'hand', desc: 'Una mano dorada del tamaño de la portería.', requires: { level: 26, positions: ['GK'], stats: { defense: 90 } } },
  { id: 'muralla_celestial', name: 'Muralla Celestial', category: 'keeper', element: 'wind', power: 125, tp: 36, anim: 'lightning', desc: 'Las nubes forman una muralla divina frente al portero.', requires: { level: 42, positions: ['GK'], stats: { defense: 130 } } },

  // ---------- COMBINADAS ----------
  { id: 'llamarada_gemela', name: 'Llamarada Gemela', category: 'combo', element: 'fire', power: 110, tp: 30, anim: 'phoenix', combo: { participants: 2 }, desc: 'Dos jugadores chutan a la vez fusionando sus llamas.', requires: { level: 15, stats: { shoot: 60 } } },
  { id: 'impacto_gaia', name: 'Impacto Gaia', category: 'combo', element: 'mountain', power: 118, tp: 32, anim: 'meteor', combo: { participants: 2 }, desc: 'Dos jugadores golpean el balón contra el suelo y lo lanzan como un terremoto.', requires: { level: 18, stats: { physical: 60 } } },
  { id: 'triangulo_tormenta', name: 'Triángulo Tormenta', category: 'combo', element: 'wind', power: 130, tp: 36, anim: 'lightning', combo: { participants: 3 }, desc: 'Tres jugadores forman un triángulo de rayos en el aire.', requires: { level: 25, stats: { shoot: 75 } } },
  { id: 'aurora_trinidad', name: 'Aurora Trinidad', category: 'combo', element: 'wood', power: 150, tp: 40, anim: 'aurora', combo: { participants: 3 }, desc: 'La combinación legendaria: una aurora boreal envuelve el balón.', requires: { level: 35, stats: { shoot: 100 } } },
];

export const TECHNIQUE_MAP = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t]));
