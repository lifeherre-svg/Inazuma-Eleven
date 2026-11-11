// Perfiles de entrenador seleccionables al empezar partida. Cada uno aporta
// una bonificación pasiva al equipo del jugador.

export const COACHES = [
  { id: 'estratega', name: 'El Estratega', icon: '🧠', color: '#4bb8ff', desc: 'Tus jugadores ganan un 15% más de experiencia en los partidos.', perk: { matchXpMul: 1.15 } },
  { id: 'motivador', name: 'El Motivador', icon: '🔥', color: '#ff5a36', desc: 'Tus jugadores empiezan los partidos con +15 PT (energía para técnicas).', perk: { startTpBonus: 15 } },
  { id: 'ojeador', name: 'El Ojeador', icon: '🔭', color: '#3fc35b', desc: 'Convencer jugadores es un 20% más fácil y las búsquedas cuestan menos.', perk: { recruitMul: 1.2, scoutDiscount: 0.7 } },
  { id: 'preparador', name: 'El Preparador', icon: '🏋️', color: '#f0c987', desc: 'Los entrenamientos dan un 25% más de mejora y generan menos fatiga.', perk: { trainingMul: 1.25, trainingFatigueMul: 0.8 } },
];

export const COACH_MAP = Object.fromEntries(COACHES.map((c) => [c.id, c]));

export const AVATAR_PRESETS = [
  { hair: 'spiky', hairColor: '#3b2a1e', skin: '#f5d0b0', shirt: '#1565ff' },
  { hair: 'long', hairColor: '#1e1e2a', skin: '#f2c9a5', shirt: '#ff5a36' },
  { hair: 'swept', hairColor: '#d9a441', skin: '#e8b48f', shirt: '#3fc35b' },
  { hair: 'ponytail', hairColor: '#8b2d2d', skin: '#c98d6a', shirt: '#b25cff' },
  { hair: 'short', hairColor: '#e6e6e6', skin: '#8d5a3c', shirt: '#ffb12b' },
];
