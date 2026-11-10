// Capítulos de la campaña. Un capítulo se completa cuando se activa su flag.
// El progreso del capítulo actual se calcula a partir de los flags (systems/story.js).

export const CHAPTERS = [
  { id: 0, title: 'Prólogo: Un club olvidado', goal: 'Habla con el Abuelo Tetsuo en la puerta del Instituto Rayo Azul.', completeFlag: 'got_key' },
  { id: 1, title: 'Capítulo 1: Once corazones', goal: 'Reúne a 11 jugadores, vence a los Halcones y defiende el campo contra Cuervo Negro.', completeFlag: 'ch1_done' },
  { id: 2, title: 'Capítulo 2: El torneo del distrito', goal: 'Gana el Torneo Escolar en el Pabellón del Distrito.', completeFlag: 'ch2_done' },
  { id: 3, title: 'Capítulo 3: El santuario esmeralda', goal: 'Vence a los Guardianes del Bosque en el santuario.', completeFlag: 'ch3_done' },
  { id: 4, title: 'Capítulo 4: La cumbre de los titanes', goal: 'Vence a los Titanes y gana el Campeonato Regional.', completeFlag: 'ch4_done' },
  { id: 5, title: 'Capítulo 5: La sombra de Zenith', goal: 'Decide sobre el Proyecto Zenith y gana el Campeonato Nacional.', completeFlag: 'ch5_done' },
  { id: 6, title: 'Capítulo 6: Leyendas de la tormenta', goal: 'Gana la Copa Internacional y supera el Desafío Legendario.', completeFlag: 'game_cleared' },
  { id: 7, title: 'Epílogo: Leyenda eterna', goal: 'Completa la libreta de ojeador y recluta a los jugadores míticos.', completeFlag: null },
];
