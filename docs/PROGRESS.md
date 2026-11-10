# Progreso y continuidad

Documento vivo con el estado del proyecto, lo verificado y los siguientes pasos.

## Roles y skills

Las skills disponibles en el entorno de desarrollo (documentos, artefactos, visualización de datos, revisión de código…) **no** incluyen ninguna específica de desarrollo de videojuegos, así que los roles de Game Developer, diseñador, programador de IA, UI/UX, QA, etc. se asumieron directamente. La verificación se hizo con `node:test` y Playwright (Chromium headless).

## Fases

| Fase | Estado | Entregables |
|---|---|---|
| 1. Análisis y arquitectura | ✅ | HTML5/JS/Canvas sin dependencias, `docs/ARCHITECTURE.md` |
| 2. Estructura del proyecto | ✅ | `src/{core,data,systems,match,world,render,ui,audio}`, `tests/`, `tools/` |
| 3. Movimiento, exploración y mundo | ✅ | 7 mapas, warps, NPC, visión, objetos, hierba alta, viaje rápido |
| 4. Jugadores, stats, elementos, reclutamiento | ✅ | 55 jugadores + generados, 6 rarezas, 6 personalidades, 6 vías de reclutamiento |
| 5. Técnicas y entrenamiento | ✅ | 41 técnicas, 5 niveles, combos, minijuego de entrenamiento, fatiga e inspiración |
| 6. Partidos e IA | ✅ | 11v11 en tiempo real, duelos tácticos, cinemáticas, IA adaptativa, subs, tácticas |
| 7. Historia, misiones, torneos | ✅ | 6 capítulos + epílogo, decisión con consecuencias, 18 misiones, 6 torneos |
| 8. Interfaz, animaciones, efectos | ✅ | 16 pantallas, partículas, cinemáticas, retratos anime procedurales, audio generativo |
| 9. Guardado y carga | ✅ | 3 ranuras + auto, backup, checksum, migraciones, exportar/importar |
| 10. Testing, optimización, documentación | ✅ | 38 tests + e2e (18 comprobaciones) + validador de datos; docs completas |

## QA realizado

- `npm test` → 38/38 (incluye una **campaña completa** de prólogo a Desafío Legendario con los guiones reales y ambas ramas de la decisión Zenith).
- `npm run check` → datos válidos; todo lo colocado en mapas es alcanzable desde el punto de aparición.
- `npm run e2e` → 18/18 en Chromium: título, nueva partida, diálogo, 10 pestañas del menú, desafío por turnos, reclutamiento, partido jugable con descanso y resultados, guardado/carga, tienda, minijuego, torneos, ojeadores, vista móvil, sin errores de consola.
- Balance verificado por simulación: el equipo inicial gana a la Pandilla del Parque, empata con Halcones y pierde contra Cuervo Negro (obliga a reclutar y entrenar).

### Errores encontrados y corregidos
- Jugadores generados recibían técnicas por encima de su nivel (porteros nivel 13 con Muralla Celestial) → ahora respetan `requires.level`.
- Demasiados goles con técnicas → ventaja base del portero y potencia de técnica reajustadas.
- Cerrar un modal quitándolo del DOM dejaba promesas sin resolver (bloqueaba el ojeo tras partido) → `closeTopModal()`.
- Escape al cerrar un modal/menú reabría el menú del juego → `stopPropagation`.
- Avisos duplicados (guion + bus) y apilados sin límite → un único origen y máximo 4 visibles.
- Escenario y NPC mal colocados detectados por el validador (pistas sobre NPC, objetos en casillas sólidas).

## Limitaciones conocidas (decisiones conscientes)
- Sin fuera de juego ni faltas (diseño arcade).
- El usuario controla al equipo local; los porteros propios los controla la IA.
- Arte y música procedurales originales (placeholders de calidad sustituibles por recursos con licencia).
- La e2e necesita `playwright` disponible en el sistema.

## Siguientes pasos sugeridos
1. Arte definitivo: sustituir `portrait()` / `drawChibi()` por sprites cuando existan (ver CONTENT_GUIDE).
2. Más contenido: interiores de edificios, más equipos internacionales, eventos por día de la semana.
3. Multijugador local (dos teclados) reutilizando `userTeam` del motor.
4. Ajuste fino de balance con datos de partidas reales (`simulateMatch` permite hacerlo en lote).
