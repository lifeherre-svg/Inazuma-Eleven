// Entrenamientos disponibles. Cada sesión mejora estadísticas (puntos
// entrenados permanentes), da experiencia y genera fatiga.
// gains: estadística -> puntos base (se multiplican por la calidad del minijuego).

export const TRAININGS = [
  { id: 'tiro', name: 'Tiro a puerta', icon: '🥅', gains: { shoot: 3, technique: 1 }, fatigue: 18, xp: 40, desc: 'Disparos contra la máquina lanzadora.' },
  { id: 'regate', name: 'Circuito de conos', icon: '🔶', gains: { dribble: 3, control: 1 }, fatigue: 16, xp: 40, desc: 'Zig-zag entre conos a máxima velocidad.' },
  { id: 'defensa', name: 'Muro de placajes', icon: '🧱', gains: { defense: 3, physical: 1 }, fatigue: 18, xp: 40, desc: 'Placajes contra el muñeco acolchado.' },
  { id: 'control', name: 'Rondo de pases', icon: '🔁', gains: { control: 3, technique: 1 }, fatigue: 14, xp: 40, desc: 'Pases al primer toque en espacios reducidos.' },
  { id: 'resistencia', name: 'Carrera de neumáticos', icon: '🛞', gains: { stamina: 3, physical: 1 }, fatigue: 24, xp: 45, desc: 'Arrastrar un neumático por la ribera del río.' },
  { id: 'velocidad', name: 'Sprints de relevos', icon: '⚡', gains: { speed: 3, stamina: 1 }, fatigue: 20, xp: 40, desc: 'Series de sprints cortos.' },
  { id: 'tecnicas', name: 'Técnicas especiales', icon: '✨', gains: { technique: 2 }, fatigue: 22, xp: 50, techXp: 45, desc: 'Practica técnicas especiales: sube su nivel y desbloquea nuevas.' },
];

export const TRAINING_MAP = Object.fromEntries(TRAININGS.map((t) => [t.id, t]));
