# ⚡ ULTIMATE LEGENDS — Fútbol RPG

RPG de fútbol con **exploración**, **colección de jugadores**, **supertécnicas elementales**, **partidos jugables en tiempo real**, historia por capítulos, misiones y torneos. Inspirado en la estructura de los juegos de colección y exploración (tipo *PokeLike*) y en los RPG de fútbol con técnicas especiales.

> **Sobre la propiedad intelectual:** todos los personajes, equipos, técnicas, escenarios, gráficos y música de este proyecto son **originales** y generados por código. El juego no incluye nombres, personajes ni recursos protegidos. Toda la información de contenido está separada de la lógica (`src/data/`), de modo que si cuentas con una licencia puedes sustituir nombres, retratos y técnicas sin tocar el motor (ver [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md)).

![tecnología](https://img.shields.io/badge/HTML5-Canvas-orange) ![deps](https://img.shields.io/badge/dependencias-0-brightgreen) ![tests](https://img.shields.io/badge/tests-38%20unit%20%2B%20e2e-blue) ![android](https://img.shields.io/badge/Android-APK-3ddc84)

---

## 🚀 Instalación y ejecución

Requisitos: **Node.js 18+** (solo para el servidor local y los tests; el juego en sí no tiene dependencias).

```bash
git clone <repo>
cd Inazuma-Eleven
npm start            # abre http://localhost:8080
```

También funciona en cualquier hosting estático (GitHub Pages, Netlify, `python3 -m http.server`…). **No** se puede abrir con doble clic (`file://`) porque usa módulos ES.

| Comando | Qué hace |
|---|---|
| `npm start` | Servidor estático en `http://localhost:8080` (puerto configurable con `PORT=`) |
| `npm test` | 38 tests unitarios y de integración (incluye una **campaña completa automática**) |
| `npm run check` | Valida todos los datos: referencias cruzadas, mapas alcanzables, NPC en casillas válidas… |
| `npm run e2e` | Prueba de extremo a extremo en Chromium con Playwright (requiere `playwright` instalado). Con `-- --shots=dir` guarda capturas |
| `npm run e2e:touch` | Prueba e2e táctil emulando un móvil Android: joystick, botones contextuales, botón Atrás, escala de interfaz |
| `npm run audit` | Auditoría responsive: 14 pantallas × 7 dispositivos (móvil vertical/horizontal, tablet, portátil, Full HD); detecta desbordamientos, elementos fuera de pantalla y botones demasiado pequeños para el dedo |
| `npm run apk` | Compila la APK de Android en `dist/UltimateLegends.apk` (ver [android/README.md](android/README.md)) |

No hay paso de compilación: el código fuente es lo que se ejecuta.

## 📱 Android y cualquier pantalla

- **APK lista para instalar** en `dist/UltimateLegends.apk` (Android 8.0+), funciona sin conexión. Detalles en [android/README.md](android/README.md).
- **Interfaz adaptable** a móvil en vertical y horizontal, tablet, portátil y monitores grandes: tamaños que escalan con la pantalla, márgenes seguros para notch, ventanas con botones siempre visibles y menú que se convierte en barra de iconos en pantallas bajas.
- **Controles táctiles**: joystick analógico y botones contextuales (Pase/Cambiar, Tiro/Entrada, Técnica, Regate+/Defensa+, Correr); en el mundo, Hablar y Correr. Se ocultan solos con menús, diálogos y cinemáticas.
- **Ajustes**: tamaño de la interfaz (4 niveles) y vibración háptica.

## 🎮 Controles

| Acción | Teclado | Táctil |
|---|---|---|
| Moverse | Flechas / WASD | Joystick |
| Correr / sprint | Shift | Correr (mantener) |
| Hablar / confirmar | Espacio / Enter / E | Hablar · tocar el diálogo |
| Menú / volver | Esc / M | Botón Menú · botón Atrás de Android |
| **Partido** – Pase (atacando) / Cambiar jugador (defendiendo) | J | J |
| **Partido** – Tiro (atacando) / Entrada (defendiendo) | K | K |
| **Partido** – Técnica de tiro o combinada | I | I |
| **Partido** – Técnica de regate (atacando) / defensiva (defendiendo) | U | U |
| **Partido** – Regate normal en un duelo | L | Botón del duelo |
| **Partido** – Pausa, tácticas y cambios | P / Esc | Botón Pausa · botón Atrás |

## ✨ Qué incluye

- **Mundo explorable**: 7 zonas (Villa Rayo, Parque Ribera, Distrito Escolar, Bosque Esmeralda, Cumbre Granito, Ciudad Capital, Isla Tempestad) con colegios, campos, tiendas, posadas, NPC, rivales que te retan al verte, objetos ocultos, zonas bloqueadas por la historia y viaje rápido.
- **Colección**: 55 jugadores con nombre (más los generados para los equipos rivales), 6 rarezas (Común → Mítico), 6 personalidades, historia personal, retrato anime procedural y libreta de ojeador (enciclopedia).
- **Reclutamiento sin sobres aleatorios**: desafíos en la hierba alta, retos de agentes libres, convencer a rivales tras ganarles, recompensas de misiones y torneos, eventos de historia y la **red de ojeadores** (búsqueda por posición/elemento que coloca pistas en el mapa). Para convencer hay que elegir el **enfoque** adecuado a la personalidad.
- **Elementos**: Fuego > Bosque > Montaña > Aire > Fuego, afectan a duelos, tiros y técnicas (+bonificación por técnica del mismo elemento).
- **8 estadísticas** que influyen en cada acción del partido (velocidad real, potencia de tiro, éxito de regates, entradas, pases, paradas, resistencia).
- **41 técnicas** en 6 categorías (tiro, regate, defensa, bloqueo, portero, combinadas) con potencia, coste de PT, elemento, requisitos, 5 niveles de mejora, animación y cinemática.
- **Partidos 11 contra 11 en tiempo real** con IA completa, cinemáticas de técnicas, **duelos tácticos** (elige regate/técnica/pase/tiro cuando te presionan), marcador, cronómetro, descanso, sustituciones, cambios de estrategia y simulación rápida.
- **Formaciones y tácticas**: 6 formaciones, titulares/suplentes, capitán, estrategias ofensiva/defensiva/estilo y tácticas guardadas.
- **Entrenamiento** con minijuego de precisión, fatiga y recuperación, y descubrimiento de técnicas por inspiración.
- **Historia** en 6 capítulos + epílogo, con cinemáticas, diálogos con retrato, jefes y **decisiones** (p. ej. aceptar o rechazar al Proyecto Zenith cambia quién se une a tu equipo).
- **18 misiones** (principales y secundarias) y **6 competiciones** (escolar, regional, nacional, internacional, especial y desafío legendario).
- **Guardado fiable**: 3 ranuras + autoguardado, copia de seguridad automática, detección de corrupción con checksum, migraciones de versión, exportar/importar.
- **Audio procedural**: música original generada por secuenciador y efectos sintetizados (Web Audio).

## 📚 Documentación

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura, estructura de carpetas y sistemas.
- [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) — cómo añadir jugadores, técnicas, equipos, misiones, mapas y modificar estadísticas.
- [docs/SCRIPTING.md](docs/SCRIPTING.md) — lenguaje de guiones para diálogos, cinemáticas y eventos.
- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — diseño de juego y fórmulas de balance.
- [docs/PROGRESS.md](docs/PROGRESS.md) — lista de tareas, estado, QA y siguientes pasos (documento de continuidad).
