// Configuración centralizada del juego. Todos los valores de balance viven aquí
// para poder ajustar el juego sin tocar la lógica.

export const GAME = {
  title: 'ULTIMATE LEGENDS',
  subtitle: 'Fútbol RPG · Leyendas del Relámpago',
  version: '1.1.0',
  saveVersion: 1,
  maxRoster: 40,
  minPlayersForMatch: 11,
  startingMoney: 500,
};

export const STATS = ['shoot', 'dribble', 'defense', 'control', 'technique', 'speed', 'stamina', 'physical'];
export const STAT_LABELS = {
  shoot: 'Tiro', dribble: 'Regate', defense: 'Defensa', control: 'Control',
  technique: 'Técnica', speed: 'Velocidad', stamina: 'Resistencia', physical: 'Físico',
};
export const STAT_SHORT = {
  shoot: 'TIR', dribble: 'REG', defense: 'DEF', control: 'CTR',
  technique: 'TEC', speed: 'VEL', stamina: 'RES', physical: 'FIS',
};

export const POSITIONS = ['GK', 'DF', 'MF', 'FW'];
export const POSITION_LABELS = { GK: 'Portero', DF: 'Defensa', MF: 'Centrocampista', FW: 'Delantero' };
export const POSITION_SHORT = { GK: 'POR', DF: 'DEF', MF: 'MED', FW: 'DEL' };

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY = {
  common:    { label: 'Común',       color: '#9aa4b2', statMul: 1.00, growthMul: 1.00, recruitBase: 0.75, xpMul: 1.0 },
  uncommon:  { label: 'Poco común',  color: '#4cc96b', statMul: 1.08, growthMul: 1.04, recruitBase: 0.60, xpMul: 1.0 },
  rare:      { label: 'Raro',        color: '#3b9cff', statMul: 1.16, growthMul: 1.08, recruitBase: 0.45, xpMul: 1.05 },
  epic:      { label: 'Épico',       color: '#b25cff', statMul: 1.26, growthMul: 1.12, recruitBase: 0.30, xpMul: 1.1 },
  legendary: { label: 'Legendario',  color: '#ffb12b', statMul: 1.38, growthMul: 1.16, recruitBase: 0.16, xpMul: 1.2 },
  mythic:    { label: 'Mítico',      color: '#ff4d6d', statMul: 1.50, growthMul: 1.20, recruitBase: 0.08, xpMul: 1.3 },
};

export const PROGRESSION = {
  maxLevel: 99,
  growthPerLevel: 0.035,      // +3.5% del valor base por nivel
  xpBase: 40,                 // xp para pasar de nivel 1 a 2
  xpExponent: 1.55,
  maxTrainedPerStat: 60,      // puntos máximos ganados entrenando por estadística
  techMaxLevel: 5,
  techXpPerLevel: 100,        // xp de técnica = 100 * nivel actual
  techPowerPerLevel: 0.12,    // +12% potencia por nivel de técnica
  maxTechniques: 6,           // técnicas equipables por jugador
};

export const ELEMENT_MULT = { advantage: 1.2, disadvantage: 0.85, neutral: 1.0, sameElementBonus: 1.1 };

export const FATIGUE = {
  max: 100,
  matchCost: 25,
  restRecovery: 100,
  dailyRecovery: 10,
  penaltyThreshold: 50,       // a partir de aquí, rinde peor
};

export const MATCH = {
  fieldW: 1050,
  fieldH: 680,
  goalWidth: 110,
  goalDepth: 30,
  halfDurationSec: 150,       // duración real de cada parte (configurable en ajustes)
  gameMinutesPerHalf: 45,
  playerRadius: 11,
  ballRadius: 5,
  pickupRadius: 16,
  tackleRange: 26,
  tackleCooldown: 1.1,
  stunTackled: 0.7,
  stunBeaten: 0.9,
  ballFriction: 1.35,
  passSpeedBase: 420,
  shotSpeedBase: 620,
  techShotSpeed: 760,
  shootRange: 380,
  baseSpeed: 92,
  speedPerStat: 1.25,
  sprintMul: 1.35,
  carryMul: 0.9,
  staminaDrain: 2.2,
  sprintDrain: 7,
  staminaRegen: 1.5,
  tpRegenPerSec: 0.25,
  duelPromptRadius: 46,
  duelPromptCooldown: 5,
  duelSlowmo: 0.12,
  duelPromptTime: 2.6,
  maxSubs: 3,
  cinematicTime: 1.6,
  aiThinkInterval: 0.22,
};

export const DIFFICULTY = {
  easy:   { label: 'Fácil',   aiStatMul: 0.88, aiReaction: 0.35, aiTechChance: 0.35 },
  normal: { label: 'Normal',  aiStatMul: 1.0,  aiReaction: 0.22, aiTechChance: 0.55 },
  hard:   { label: 'Difícil', aiStatMul: 1.1,  aiReaction: 0.12, aiTechChance: 0.8 },
};

export const ENCOUNTER = {
  stepChance: 0.085,          // probabilidad por paso en hierba alta
  graceSteps: 6,              // pasos sin encuentros tras uno
  maxMorale: 100,
  playerStaminaPool: 100,
};

export const ECONOMY = {
  matchWinMoneyPerLevel: 40,
  matchDrawMoneyPerLevel: 15,
  scoutSearchCost: 150,
  trainingCost: 0,
};

export const DEFAULT_SETTINGS = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  difficulty: 'normal',
  halfDurationSec: 150,
  duelPrompts: true,
  autoSwitch: true,
  showFps: false,
  textSpeed: 2,
  screenShake: true,
  vibration: true,
  uiScale: 1,
};

export const TILE = 32;
