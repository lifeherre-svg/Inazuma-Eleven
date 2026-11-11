// Los cuatro elementos clásicos y su ciclo de efectividades.
// Ciclo: Fuego > Bosque > Montaña > Aire > Fuego
//  - El fuego quema el bosque.
//  - Las raíces del bosque agrietan la montaña.
//  - La montaña frena el viento.
//  - El viento apaga el fuego.

export const ELEMENTS = {
  fire:     { id: 'fire',     label: 'Fuego',   icon: '🔥', color: '#ff5a36', glow: '#ffb347', beats: 'wood' },
  wood:     { id: 'wood',     label: 'Bosque',  icon: '🌿', color: '#3fc35b', glow: '#a6f07a', beats: 'mountain' },
  mountain: { id: 'mountain', label: 'Montaña', icon: '⛰️', color: '#b8834a', glow: '#f0c987', beats: 'wind' },
  wind:     { id: 'wind',     label: 'Aire',    icon: '🌪️', color: '#4bb8ff', glow: '#bdf0ff', beats: 'fire' },
};

export const ELEMENT_IDS = Object.keys(ELEMENTS);
