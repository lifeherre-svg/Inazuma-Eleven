// Objetos del juego.
// type: consumable | equipment | invite | manual | key
//  - consumable.effect: { fatigue: -N (recupera), xp: N, techXp: N, morale: ... }
//  - equipment.slot: boots | gloves | accessory ; bonus: { stat: +N }
//  - invite.recruitMul: multiplicador de éxito al convencer
//  - manual.tech: id de técnica que enseña
//  - key: objeto de historia (no se puede vender ni usar)

export const ITEMS = [
  // Consumibles
  { id: 'bebida_isotonica', name: 'Bebida isotónica', type: 'consumable', icon: '🥤', price: 60, effect: { fatigue: -35 }, desc: 'Recupera 35 de fatiga a un jugador.' },
  { id: 'onigiri_especial', name: 'Onigiri especial', type: 'consumable', icon: '🍙', price: 120, effect: { fatigue: -100 }, desc: 'Recupera toda la fatiga de un jugador.' },
  { id: 'bento_equipo', name: 'Bento de equipo', type: 'consumable', icon: '🍱', price: 400, effect: { fatigue: -50, team: true }, desc: 'Recupera 50 de fatiga a toda la plantilla.' },
  { id: 'cuaderno_tactico', name: 'Cuaderno táctico', type: 'consumable', icon: '📓', price: 300, effect: { xp: 250 }, desc: 'Otorga 250 de experiencia a un jugador.' },
  { id: 'video_leyendas', name: 'Vídeo de leyendas', type: 'consumable', icon: '📼', price: 900, effect: { xp: 1200 }, desc: 'Otorga 1200 de experiencia a un jugador.' },
  { id: 'pergamino_tecnica', name: 'Pergamino de técnica', type: 'consumable', icon: '📜', price: 500, effect: { techXp: 100 }, desc: 'Otorga 100 de experiencia a todas las técnicas de un jugador.' },

  // Invitaciones (reclutamiento)
  { id: 'carta_invitacion', name: 'Carta de invitación', type: 'invite', icon: '✉️', price: 80, recruitMul: 1.0, desc: 'Necesaria para convencer a un jugador tras un desafío.' },
  { id: 'carta_especial', name: 'Carta especial', type: 'invite', icon: '💌', price: 250, recruitMul: 1.5, desc: 'Invitación con sello del club. Más convincente.' },
  { id: 'carta_dorada', name: 'Carta dorada', type: 'invite', icon: '📯', price: 900, recruitMul: 2.4, desc: 'Una invitación que ni las leyendas rechazan fácilmente.' },

  // Equipamiento
  { id: 'botas_veloces', name: 'Botas veloces', type: 'equipment', slot: 'boots', icon: '👟', price: 350, bonus: { speed: 6 }, desc: '+6 Velocidad.' },
  { id: 'botas_trueno', name: 'Botas trueno', type: 'equipment', slot: 'boots', icon: '⚡', price: 1200, bonus: { speed: 10, shoot: 8 }, desc: '+10 Velocidad, +8 Tiro.' },
  { id: 'botas_granito', name: 'Botas de granito', type: 'equipment', slot: 'boots', icon: '🥾', price: 900, bonus: { physical: 10, defense: 6 }, desc: '+10 Físico, +6 Defensa.' },
  { id: 'guantes_basicos', name: 'Guantes básicos', type: 'equipment', slot: 'gloves', icon: '🧤', price: 300, bonus: { defense: 6 }, desc: '+6 Defensa (ideal para porteros).' },
  { id: 'guantes_titan', name: 'Guantes titán', type: 'equipment', slot: 'gloves', icon: '🥊', price: 1100, bonus: { defense: 12, physical: 6 }, desc: '+12 Defensa, +6 Físico.' },
  { id: 'cinta_capitan', name: 'Cinta de capitán', type: 'equipment', slot: 'accessory', icon: '🎗️', price: 600, bonus: { control: 5, technique: 5 }, desc: '+5 Control, +5 Técnica.' },
  { id: 'colgante_relampago', name: 'Colgante relámpago', type: 'equipment', slot: 'accessory', icon: '🔱', price: 1500, bonus: { technique: 12, dribble: 6 }, desc: '+12 Técnica, +6 Regate.' },
  { id: 'munequera_fuerza', name: 'Muñequera de fuerza', type: 'equipment', slot: 'accessory', icon: '💪', price: 450, bonus: { stamina: 8 }, desc: '+8 Resistencia.' },

  // Manuales de técnicas
  { id: 'manual_cometa', name: 'Manual: Cometa Carmesí', type: 'manual', tech: 'cometa_carmesi', icon: '📕', price: 1400, desc: 'Enseña Cometa Carmesí.' },
  { id: 'manual_tornado', name: 'Manual: Tornado Celeste', type: 'manual', tech: 'tornado_celeste', icon: '📘', price: 1400, desc: 'Enseña Tornado Celeste.' },
  { id: 'manual_espiral', name: 'Manual: Espiral Esmeralda', type: 'manual', tech: 'espiral_esmeralda', icon: '📗', price: 1400, desc: 'Enseña Espiral Esmeralda.' },
  { id: 'manual_avalancha', name: 'Manual: Avalancha', type: 'manual', tech: 'avalancha', icon: '📙', price: 1400, desc: 'Enseña Avalancha.' },
  { id: 'manual_mano_colosal', name: 'Manual: Mano Colosal', type: 'manual', tech: 'mano_colosal', icon: '📒', price: 2500, desc: 'Enseña Mano Colosal (porteros).' },
  { id: 'manual_espejismo', name: 'Manual: Espejismo', type: 'manual', tech: 'espejismo', icon: '📘', price: 1800, desc: 'Enseña Espejismo.' },
  { id: 'manual_garra', name: 'Manual: Garra de Titán', type: 'manual', tech: 'garra_titan', icon: '📙', price: 1800, desc: 'Enseña Garra de Titán.' },
  { id: 'manual_llamarada_gemela', name: 'Manual: Llamarada Gemela', type: 'manual', tech: 'llamarada_gemela', icon: '📕', price: 2000, desc: 'Enseña la técnica combinada Llamarada Gemela.' },
  { id: 'manual_triangulo', name: 'Manual: Triángulo Tormenta', type: 'manual', tech: 'triangulo_tormenta', icon: '📘', price: 3000, desc: 'Enseña la técnica combinada Triángulo Tormenta.' },
  { id: 'manual_raiz', name: 'Manual sagrado: Raíz Ancestral', type: 'manual', tech: 'raiz_ancestral', icon: '📗', price: 0, desc: 'Enseña Raíz Ancestral. Guardado en el santuario del bosque.' },
  { id: 'manual_aurora', name: 'Manual legendario: Aurora Trinidad', type: 'manual', tech: 'aurora_trinidad', icon: '🌈', price: 0, desc: 'La técnica combinada más poderosa jamás registrada.' },

  // Objetos clave
  { id: 'llave_club', name: 'Llave del club', type: 'key', icon: '🔑', price: 0, desc: 'Abre la sala del club de fútbol del Instituto Rayo Azul.' },
  { id: 'pase_bosque', name: 'Permiso del bosque', type: 'key', icon: '🍃', price: 0, desc: 'Permite entrar en el Bosque Esmeralda.' },
  { id: 'pase_cumbre', name: 'Pase del teleférico', type: 'key', icon: '🚡', price: 0, desc: 'Permite subir a la Cumbre Granito.' },
  { id: 'billete_capital', name: 'Billete a la Capital', type: 'key', icon: '🎫', price: 0, desc: 'Billete de tren a la Ciudad Capital.' },
  { id: 'billete_isla', name: 'Billete de ferry', type: 'key', icon: '⛴️', price: 0, desc: 'Billete a la Isla Tempestad.' },
  { id: 'insignia_zenith', name: 'Insignia Zenith', type: 'key', icon: '🟣', price: 0, desc: 'Prueba del acuerdo con el Proyecto Zenith.' },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const SHOPS = {
  tienda_villa: ['bebida_isotonica', 'onigiri_especial', 'carta_invitacion', 'carta_especial', 'botas_veloces', 'guantes_basicos', 'munequera_fuerza', 'cuaderno_tactico'],
  tienda_distrito: ['bebida_isotonica', 'onigiri_especial', 'bento_equipo', 'carta_invitacion', 'carta_especial', 'cinta_capitan', 'cuaderno_tactico', 'pergamino_tecnica', 'manual_cometa', 'manual_tornado', 'manual_espiral', 'manual_avalancha'],
  tienda_capital: ['onigiri_especial', 'bento_equipo', 'carta_especial', 'carta_dorada', 'botas_trueno', 'botas_granito', 'guantes_titan', 'colgante_relampago', 'video_leyendas', 'pergamino_tecnica', 'manual_mano_colosal', 'manual_espejismo', 'manual_garra', 'manual_llamarada_gemela', 'manual_triangulo'],
};
