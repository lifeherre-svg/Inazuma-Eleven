// Formaciones disponibles. Cada slot define su rol y posición base relativa
// (x: 0 = portería propia, 1 = portería rival; y: 0 = banda superior, 1 = inferior).

const F = (id, name, desc, slots) => ({ id, name, desc, slots: slots.map(([role, x, y]) => ({ role, x, y })) });

export const FORMATIONS = [
  F('f442', '4-4-2 Clásica', 'Equilibrio entre ataque y defensa. Ideal para empezar.', [
    ['GK', 0.04, 0.5],
    ['DF', 0.2, 0.15], ['DF', 0.18, 0.38], ['DF', 0.18, 0.62], ['DF', 0.2, 0.85],
    ['MF', 0.42, 0.15], ['MF', 0.38, 0.38], ['MF', 0.38, 0.62], ['MF', 0.42, 0.85],
    ['FW', 0.62, 0.38], ['FW', 0.62, 0.62],
  ]),
  F('f433', '4-3-3 Ofensiva', 'Tres delanteros para presionar arriba y atacar por bandas.', [
    ['GK', 0.04, 0.5],
    ['DF', 0.2, 0.15], ['DF', 0.18, 0.38], ['DF', 0.18, 0.62], ['DF', 0.2, 0.85],
    ['MF', 0.38, 0.28], ['MF', 0.35, 0.5], ['MF', 0.38, 0.72],
    ['FW', 0.62, 0.18], ['FW', 0.66, 0.5], ['FW', 0.62, 0.82],
  ]),
  F('f352', '3-5-2 Control', 'Dominio del centro del campo con carrileros largos.', [
    ['GK', 0.04, 0.5],
    ['DF', 0.18, 0.28], ['DF', 0.16, 0.5], ['DF', 0.18, 0.72],
    ['MF', 0.42, 0.1], ['MF', 0.36, 0.32], ['MF', 0.32, 0.5], ['MF', 0.36, 0.68], ['MF', 0.42, 0.9],
    ['FW', 0.62, 0.4], ['FW', 0.62, 0.6],
  ]),
  F('f532', '5-3-2 Muralla', 'Defensa de cinco. Difícil de romper, peligrosa al contragolpe.', [
    ['GK', 0.04, 0.5],
    ['DF', 0.22, 0.1], ['DF', 0.16, 0.3], ['DF', 0.14, 0.5], ['DF', 0.16, 0.7], ['DF', 0.22, 0.9],
    ['MF', 0.36, 0.3], ['MF', 0.34, 0.5], ['MF', 0.36, 0.7],
    ['FW', 0.6, 0.4], ['FW', 0.6, 0.6],
  ]),
  F('f343', '3-4-3 Relámpago', 'Ataque total. Para equipos con delanteros veloces.', [
    ['GK', 0.04, 0.5],
    ['DF', 0.2, 0.25], ['DF', 0.17, 0.5], ['DF', 0.2, 0.75],
    ['MF', 0.4, 0.15], ['MF', 0.36, 0.4], ['MF', 0.36, 0.6], ['MF', 0.4, 0.85],
    ['FW', 0.64, 0.2], ['FW', 0.68, 0.5], ['FW', 0.64, 0.8],
  ]),
  F('f4231', '4-2-3-1 Diamante', 'Un mediapunta creativo detrás del delantero centro.', [
    ['GK', 0.04, 0.5],
    ['DF', 0.2, 0.15], ['DF', 0.18, 0.38], ['DF', 0.18, 0.62], ['DF', 0.2, 0.85],
    ['MF', 0.33, 0.38], ['MF', 0.33, 0.62],
    ['MF', 0.5, 0.18], ['MF', 0.52, 0.5], ['MF', 0.5, 0.82],
    ['FW', 0.68, 0.5],
  ]),
];

export const FORMATION_MAP = Object.fromEntries(FORMATIONS.map((f) => [f.id, f]));

// Estrategias: modifican parámetros de la IA de equipo (propio y rival).
export const OFFENSE_STRATEGIES = {
  posesion:     { label: 'Posesión',       desc: 'Pases cortos y paciencia.', params: { passBias: 0.25, shootRangeMul: 0.9, tempo: 0.9, forwardRun: 0.9 } },
  contraataque: { label: 'Contraataque',   desc: 'Robar y salir rápido.',      params: { passBias: -0.05, shootRangeMul: 1.05, tempo: 1.15, forwardRun: 1.2 } },
  directo:      { label: 'Ataque directo', desc: 'Balones largos a los delanteros.', params: { passBias: -0.15, shootRangeMul: 1.15, tempo: 1.1, forwardRun: 1.15 } },
  bandas:       { label: 'Juego por bandas', desc: 'Abrir el campo y centrar.',  params: { passBias: 0.1, shootRangeMul: 1.0, tempo: 1.0, forwardRun: 1.0, width: 1.2 } },
};

export const DEFENSE_STRATEGIES = {
  presion:  { label: 'Presión alta', desc: 'Defender en campo rival.',       params: { lineHeight: 0.12, pressers: 2, compact: 0.9 } },
  bloque:   { label: 'Bloque bajo',  desc: 'Cerrar espacios cerca del área.', params: { lineHeight: -0.1, pressers: 1, compact: 1.15 } },
  marcaje:  { label: 'Marcaje',      desc: 'Seguir a los atacantes rivales.', params: { lineHeight: 0, pressers: 1, compact: 1.0, marking: true } },
};

export const PLAY_STYLES = {
  equilibrado: { label: 'Equilibrado', desc: 'Sin riesgos innecesarios.', shift: 0 },
  ofensivo:    { label: 'Ofensivo',    desc: 'Todo el equipo adelanta líneas.', shift: 0.08 },
  defensivo:   { label: 'Defensivo',   desc: 'El equipo se repliega.', shift: -0.08 },
};
