// Punto de entrada del juego.
import { App } from './ui/app.js';

const root = document.getElementById('app');
try {
  const app = new App(root);
  window.__app = app; // acceso para depuración y tests e2e
  app.start();
} catch (err) {
  console.error(err);
  root.innerHTML = `<div class="fatal"><h1>No se pudo iniciar el juego</h1><p>${String(err?.message || err)}</p><p>Abre el juego mediante un servidor (npm start), no con file://</p></div>`;
}
