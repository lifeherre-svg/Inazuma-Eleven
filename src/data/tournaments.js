// Torneos y competiciones. Cada uno tiene requisitos, rondas con dificultad
// progresiva y recompensas (las de la primera victoria y las de repetición).

export const TOURNAMENTS = [
  {
    id: 't_distrito', name: 'Torneo Escolar del Distrito', tier: 'Escolar', icon: '🏫',
    desc: 'El torneo de los institutos del distrito. La primera gran prueba del club.',
    requires: { flag: 'ch1_done', text: 'Derrota a la Academia Cuervo Negro para inscribirte.' },
    roundNames: ['Cuartos de final', 'Semifinal', 'Final'],
    rounds: [{ team: 'club_veteranos', level: 10 }, { team: 'hanazono', level: 13 }, { team: 'vertice', level: 16 }],
    rewards: { money: 1500, items: { carta_especial: 3, pase_bosque: 1 }, flags: ['ch2_done'] },
    repeatable: true, repeatRewards: { money: 900, items: { carta_especial: 1 } },
  },
  {
    id: 't_regional', name: 'Campeonato Regional', tier: 'Regional', icon: '🏔️',
    desc: 'Los mejores equipos de la prefectura se citan en la Cumbre Granito.',
    requires: { flag: 'titanes_beaten', text: 'Vence a los Titanes de Granito en la cumbre.' },
    roundNames: ['Semifinal', 'Final'],
    rounds: [{ team: 'guardianes_bosque', level: 26 }, { team: 'titanes_granito', level: 30 }],
    rewards: { money: 3000, items: { billete_capital: 1, botas_granito: 1 }, flags: ['ch4_done'] },
    repeatable: true, repeatRewards: { money: 1800 },
  },
  {
    id: 't_nacional', name: 'Campeonato Nacional', tier: 'Nacional', icon: '🏆',
    desc: 'El torneo más prestigioso del país, en el Estadio Nacional de la Capital.',
    requires: { flag: 'zenith_decision', text: 'Resuelve el asunto del Proyecto Zenith en la Capital.' },
    minLevel: 30,
    roundNames: ['Cuartos de final', 'Semifinal', 'Final'],
    rounds: [{ team: 'titanes_granito', level: 34 }, { team: 'aguilas_capital', level: 37 }, { team: 'imperio_zenith', level: 42 }],
    rewards: { money: 6000, items: { billete_isla: 1, carta_dorada: 2 }, flags: ['ch5_done'] },
    repeatable: true, repeatRewards: { money: 3500, items: { carta_dorada: 1 } },
  },
  {
    id: 't_internacional', name: 'Copa Internacional Tempestad', tier: 'Internacional', icon: '🌍',
    desc: 'Selecciones de todo el mundo compiten en la Isla Tempestad.',
    requires: { flag: 'ch5_done', text: 'Gana el Campeonato Nacional.' },
    minLevel: 42,
    roundNames: ['Fase de grupos', 'Semifinal', 'Final'],
    rounds: [{ team: 'dragones_oriente', level: 48 }, { team: 'leones_sabana', level: 52 }, { team: 'tormenta_atlantica', level: 55 }],
    rewards: { money: 10000, items: { carta_dorada: 3, colgante_relampago: 1 }, flags: ['ch6_cup'] },
    repeatable: true, repeatRewards: { money: 6000, items: { carta_dorada: 1 } },
  },
  {
    id: 't_relampago', name: 'Copa Relámpago (especial)', tier: 'Especial', icon: '⚡',
    desc: 'Torneo exprés de exhibición. Rivales aleatorios de todo el país. ¡Repetible!',
    requires: { flag: 'ch2_done', text: 'Gana el Torneo Escolar del Distrito.' },
    roundNames: ['Ronda 1', 'Ronda 2'],
    rounds: [{ team: 'halcones_puerto', level: 18 }, { team: 'cuervo_negro', level: 22 }],
    rewards: { money: 1200, items: { video_leyendas: 1, pergamino_tecnica: 1 } },
    repeatable: true, repeatRewards: { money: 900, items: { cuaderno_tactico: 2 } },
  },
  {
    id: 't_leyenda', name: 'Desafío Legendario', tier: 'Legendario', icon: '👑',
    desc: 'Las Leyendas Eternas solo aceptan a quienes han conquistado el mundo.',
    requires: { flag: 'ch6_cup', text: 'Gana la Copa Internacional Tempestad.' },
    minLevel: 50,
    roundNames: ['Duelo de leyendas'],
    rounds: [{ team: 'leyendas_eternas', level: 62 }],
    rewards: { money: 20000, items: { manual_aurora: 1 }, flags: ['game_cleared'] },
    repeatable: true, repeatRewards: { money: 8000, items: { carta_dorada: 2 } },
  },
];

export const TOURNAMENT_MAP = Object.fromEntries(TOURNAMENTS.map((t) => [t.id, t]));
