// Personalidades de los jugadores. Influyen en el sistema de reclutamiento
// (enfoques de persuasión) y en pequeñas bonificaciones de rendimiento.

export const APPROACHES = {
  inspirar: { label: 'Inspirar', desc: 'Habla de sueños, amistad y espíritu de equipo.' },
  retar:    { label: 'Retar',    desc: 'Desafíale a demostrar quién es mejor.' },
  razonar:  { label: 'Razonar',  desc: 'Explícale tu plan táctico y su papel en él.' },
  halagar:  { label: 'Halagar',  desc: 'Reconoce su talento delante de todos.' },
  ofrecer:  { label: 'Ofrecer',  desc: 'Ofrécele protagonismo y oportunidades.' },
};

export const PERSONALITIES = {
  apasionado: { label: 'Apasionado', likes: 'inspirar', dislikes: 'razonar', bonus: { shoot: 1.03 }, desc: 'Vive el fútbol con el corazón.' },
  calmado:    { label: 'Calmado',    likes: 'razonar',  dislikes: 'retar',   bonus: { control: 1.03 }, desc: 'Analiza cada jugada con serenidad.' },
  orgulloso:  { label: 'Orgulloso',  likes: 'halagar',  dislikes: 'ofrecer', bonus: { technique: 1.03 }, desc: 'Sabe que es bueno y quiere que se note.' },
  amable:     { label: 'Amable',     likes: 'inspirar', dislikes: 'retar',   bonus: { stamina: 1.03 }, desc: 'Siempre piensa primero en sus compañeros.' },
  ambicioso:  { label: 'Ambicioso',  likes: 'ofrecer',  dislikes: 'halagar', bonus: { speed: 1.03 }, desc: 'Quiere llegar a lo más alto, cueste lo que cueste.' },
  rebelde:    { label: 'Rebelde',    likes: 'retar',    dislikes: 'halagar', bonus: { dribble: 1.03 }, desc: 'No acepta órdenes de cualquiera.' },
};

export const PERSONALITY_IDS = Object.keys(PERSONALITIES);
