// Equipos rivales (contenido original). Las plantillas se completan hasta 16
// jugadores con jugadores generados de forma determinista (systems/database.js).
//
// Campos: id, name, short, element (tendencia), level, formation,
// offense/defense/style (estrategias), colors, stars (ids de players.js),
// namePool ('jp' | 'intl'), techTier (1-4: calidad de técnicas de los generados),
// money (recompensa base), coach, desc.

export const TEAMS = [
  { id: 'pandilla_parque', name: 'Pandilla del Parque', short: 'PDP', element: 'wind', level: 3, formation: 'f442', offense: 'directo', defense: 'bloque', style: 'equilibrado', colors: { primary: '#7a8b99', secondary: '#f2f2f2' }, stars: [], namePool: 'jp', techTier: 1, money: 120, coach: 'Gota', desc: 'Chavales del barrio que juegan cada tarde en el parque.' },
  { id: 'halcones_puerto', name: 'Halcones del Puerto', short: 'HDP', element: 'wind', level: 5, formation: 'f442', offense: 'bandas', defense: 'bloque', style: 'equilibrado', colors: { primary: '#2a6fdb', secondary: '#ffffff' }, stars: ['nagi_umino', 'kai_minato'], namePool: 'jp', techTier: 1, money: 200, coach: 'Capitán Umino', desc: 'El equipo del puerto pesquero. Rápidos y alegres.' },
  { id: 'cuervo_negro', name: 'Academia Cuervo Negro', short: 'ACN', element: 'fire', level: 8, formation: 'f433', offense: 'contraataque', defense: 'presion', style: 'ofensivo', colors: { primary: '#1d1d26', secondary: '#c0232f' }, stars: ['kuro_tsubame', 'karasu_mido'], namePool: 'jp', techTier: 1, money: 320, coach: 'Sr. Kurobane', desc: 'La academia rival de Villa Rayo. Arrogantes y agresivos.' },
  { id: 'club_veteranos', name: 'Veteranos de Ribera', short: 'VDR', element: 'mountain', level: 11, formation: 'f532', offense: 'posesion', defense: 'bloque', style: 'defensivo', colors: { primary: '#5b4636', secondary: '#e8d8b0' }, stars: ['koji_saito'], namePool: 'jp', techTier: 2, money: 300, coach: 'Abuelo Saito', desc: 'Leyendas locales con más experiencia que piernas.' },
  { id: 'hanazono', name: 'Colegio Hanazono', short: 'HAN', element: 'wood', level: 13, formation: 'f352', offense: 'posesion', defense: 'marcaje', style: 'equilibrado', colors: { primary: '#ff9ec7', secondary: '#ffffff' }, stars: ['ichika_hanazono'], namePool: 'jp', techTier: 2, money: 420, coach: 'Profesora Yanagi', desc: 'Un colegio de élite famoso por su fútbol elegante.' },
  { id: 'vertice', name: 'Instituto Tecnológico Vértice', short: 'ITV', element: 'mountain', level: 16, formation: 'f4231', offense: 'posesion', defense: 'marcaje', style: 'defensivo', colors: { primary: '#8a93a6', secondary: '#1ee3cf' }, stars: ['tetsu_kurama', 'ken_vertex'], namePool: 'jp', techTier: 2, money: 520, coach: 'Dr. Kanade', desc: 'Juegan basándose en análisis de datos y probabilidades.' },
  { id: 'guardianes_bosque', name: 'Guardianes del Bosque', short: 'GDB', element: 'wood', level: 22, formation: 'f532', offense: 'contraataque', defense: 'bloque', style: 'defensivo', colors: { primary: '#245c32', secondary: '#c8f5d6' }, stars: ['sakaki_moriya', 'fuyu_hayama'], namePool: 'jp', techTier: 3, money: 700, coach: 'Anciano Moriya', desc: 'Un equipo misterioso que protege el santuario del bosque.' },
  { id: 'titanes_granito', name: 'Titanes de Granito', short: 'TDG', element: 'mountain', level: 28, formation: 'f532', offense: 'directo', defense: 'presion', style: 'equilibrado', colors: { primary: '#6f6f78', secondary: '#f0c987' }, stars: ['ganseki_oka', 'gen_ishikawa'], namePool: 'jp', techTier: 3, money: 900, coach: 'Maestro Dan', desc: 'Entrenan en la cumbre. Su defensa es una cordillera.' },
  { id: 'aguilas_capital', name: 'Águilas de la Capital', short: 'ADC', element: 'wind', level: 34, formation: 'f433', offense: 'bandas', defense: 'presion', style: 'ofensivo', colors: { primary: '#f2c94c', secondary: '#1f3a93' }, stars: ['hayate_tsuji', 'sei_aoyama'], namePool: 'jp', techTier: 3, money: 1100, coach: 'Sra. Takane', desc: 'Campeones nacionales vigentes y favoritos de la prensa.' },
  { id: 'imperio_zenith', name: 'Imperio Zenith', short: 'ZEN', element: 'fire', level: 42, formation: 'f343', offense: 'directo', defense: 'presion', style: 'ofensivo', colors: { primary: '#2b0b3f', secondary: '#d4d4ff' }, stars: ['shion_zenith', 'ryu_kanzaki'], namePool: 'jp', techTier: 4, money: 1500, coach: 'Director Kuze', desc: 'Un equipo financiado por una corporación con métodos dudosos.' },
  { id: 'dragones_oriente', name: 'Dragones de Oriente', short: 'DRA', element: 'fire', level: 48, formation: 'f4231', offense: 'posesion', defense: 'marcaje', style: 'equilibrado', colors: { primary: '#c62828', secondary: '#ffd54f' }, stars: ['marco_bellini'], namePool: 'intl', techTier: 4, money: 1800, coach: 'Míster Valerio', desc: 'Selección internacional con jugadores de técnica exquisita.' },
  { id: 'tormenta_atlantica', name: 'Tormenta Atlántica', short: 'TAT', element: 'wind', level: 52, formation: 'f433', offense: 'bandas', defense: 'presion', style: 'ofensivo', colors: { primary: '#0d47a1', secondary: '#80deea' }, stars: ['liam_oconnor'], namePool: 'intl', techTier: 4, money: 2000, coach: 'Coach Reilly', desc: 'Un vendaval de juego físico y velocidad.' },
  { id: 'leones_sabana', name: 'Leones de la Sabana', short: 'LDS', element: 'mountain', level: 55, formation: 'f442', offense: 'contraataque', defense: 'bloque', style: 'equilibrado', colors: { primary: '#e6a23c', secondary: '#3e2723' }, stars: ['kwame_mensah'], namePool: 'intl', techTier: 4, money: 2100, coach: 'Mzee Abasi', desc: 'Potencia y garra. Nunca dan un balón por perdido.' },
  { id: 'leyendas_eternas', name: 'Leyendas Eternas', short: 'LEY', element: 'wind', level: 65, formation: 'f343', offense: 'posesion', defense: 'presion', style: 'ofensivo', colors: { primary: '#f5f5ff', secondary: '#ffcf33' }, stars: ['aurora_valen', 'zero_amane', 'raiden_hokuto', 'homura_akatsuki', 'takeshi_gando', 'sylva_ines'], namePool: 'intl', techTier: 4, money: 5000, coach: '???', desc: 'El equipo de leyenda que aparece cada cien años en la Isla Tempestad.' },
];

export const TEAM_MAP = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

// Equipo del jugador.
export const PLAYER_TEAM = {
  id: 'rayo_azul', name: 'Instituto Rayo Azul', short: 'IRA', element: 'wind',
  colors: { primary: '#1565ff', secondary: '#ffd400' },
};
