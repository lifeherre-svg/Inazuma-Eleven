# Arquitectura

## Elección tecnológica

| Opción | Motivo de descarte / elección |
|---|---|
| Unity / Godot | Requieren editor y compilación que no se pueden ejecutar ni verificar en el entorno de desarrollo; el resultado no sería comprobable. |
| **HTML5 + JavaScript (módulos ES) + Canvas 2D + Web Audio** | ✅ Ejecutable en cualquier navegador y móvil, sin instalación ni compilación, testeable en Node (lógica) y Chromium (e2e). Cero dependencias. |

Principios: **separación de datos y lógica**, **lógica sin DOM** (todos los sistemas y el motor de partido se ejecutan en Node para los tests), **comunicación por eventos** y **configuración centralizada** (`src/config.js`).

## Estructura de carpetas

```
index.html              Punto de entrada HTML
styles/main.css         Estilos de toda la interfaz (tokens en :root)
src/
  main.js               Arranque
  config.js             ⚙ Configuración y balance centralizados
  core/                 Infraestructura genérica
    rng.js              RNG con semilla (partidos reproducibles)
    events.js           EventBus + catálogo de eventos (EVT)
    input.js            Teclado + controles táctiles
  data/                 📦 CONTENIDO (solo datos, sin lógica)
    elements.js         Elementos y ciclo de efectividad
    players.js          Jugadores con nombre (formato de fila compacto)
    names.js            Nombres para jugadores generados
    personalities.js    Personalidades y enfoques de persuasión
    techniques.js       Técnicas especiales
    teams.js            Equipos rivales y equipo del jugador
    formations.js       Formaciones y estrategias
    items.js            Objetos y tiendas
    trainings.js        Ejercicios de entrenamiento
    coaches.js          Perfiles de entrenador y aspectos
    quests.js           Misiones
    tournaments.js      Torneos
    story.js            Capítulos
    maps.js             Mapas, NPC, guiones, encuentros
  systems/              🧠 LÓGICA DE JUEGO (pura, testeable)
    database.js         Registro de datos + generación de plantillas rivales
    player.js           Instancias de jugador, stats, XP, técnicas, equipo, fatiga
    elements.js         Multiplicadores elementales
    game-state.js       Estado de partida (JSON) y contexto {state, bus, rng}
    team.js             Alineación, formaciones, capitán, estrategias, presets
    inventory.js        Inventario, uso de objetos, tienda
    training.js         Entrenamiento, inspiración de técnicas, descanso
    recruitment.js      Probabilidad de convencer, ojeo, red de ojeadores
    encounter.js        Desafíos por turnos
    match-rewards.js    Aplicar resultado de partido (XP, dinero, fatiga)
    quests.js           Misiones dirigidas por eventos
    tournaments.js      Torneos
    story.js            Capítulo actual a partir de flags
    script.js           Intérprete de guiones (diálogos/cinemáticas)
    save.js             Guardado con checksum, backup y migraciones
  match/                ⚽ MOTOR DE PARTIDO (sin DOM)
    duel.js             Fórmulas de duelo (stats × técnica × elemento)
    match-engine.js     Simulación en tiempo real, reglas, control del usuario
    match-ai.js         IA de equipo (ataque, defensa, portero, adaptación)
    match-setup.js      Construye especificaciones de equipo
  world/                🗺 MUNDO (sin DOM)
    tiles.js            Catálogo de casillas
    map-builder.js      Mapas declarativos → rejilla de casillas
    world.js            Movimiento, colisiones, NPC, warps, encuentros
  render/               🎨 RENDERIZADO (canvas)
    sprites.js          Retratos anime y sprites chibi procedurales
    vfx.js              Partículas y cinemáticas de técnicas
    match-renderer.js   Campo, jugadores, balón, minimapa, efectos
    world-renderer.js   Mapa pre-renderizado + capas animadas
  audio/audio.js        Música generativa y efectos (Web Audio)
  ui/                   🖥 INTERFAZ (DOM)
    dom.js, components.js
    app.js              Orquestador: escenas, bucle, autoguardado
    screens/            title, newgame, world-scene, encounter-scene,
                        match-scene, menu, facilities, settings
tests/                  Tests node:test (unitarios + campaña completa)
tools/                  server.js, validate-data.js, e2e.js
docs/                   Documentación
```

## Flujo de dependencias

```
data  ←  systems  ←  match / world  ←  render  ←  ui
            ↑                                     │
            └──────── EventBus (game.bus) ────────┘
```

- `data/` no importa nada salvo `config.js` y otros datos.
- `systems/`, `match/` y `world/` no tocan el DOM.
- La UI llama a los sistemas y escucha eventos del bus para mostrar avisos.

## Contexto de juego

Todos los sistemas reciben `game = { state, bus, rng }`:
- `state`: objeto JSON puro (lo que se guarda).
- `bus`: `EventBus` — p. ej. `match:end`, `player:recruited`, `flag:set`.
- `rng`: generador con semilla.

## Sistemas principales

### Motor de partido (`match/match-engine.js`)
- Campo de 1050×680 unidades. El equipo 0 ataca hacia +x.
- Bucle `update(dt, input)`: fases (`kickoff`, `play`, `goal`, `restart`, `halftime`, `fulltime`), *freeze* para cinemáticas, prompt de duelo, IA, control del usuario, integración física, balón.
- Reglas: saques de banda, de esquina, de puerta, goles, descanso, sustituciones (3). Sin fuera de juego ni faltas (decisión de diseño arcade).
- `simulateMatch()` ejecuta un partido IA contra IA sin interfaz (simulación rápida y tests).

### IA (`match/match-ai.js`)
- **Portador**: evalúa tiro (distancia, ángulo, presión), pase (avance, desmarque, línea libre, sesgo de estrategia) o regate con esquiva; planifica técnicas de regate si le presionan.
- **Apoyo**: posición táctica (bloque que se desplaza con el balón, amplitud, desmarques de los delanteros).
- **Defensa**: N presionadores (según estrategia) se colocan entre balón y portería y hacen entradas tras un tiempo de reacción (dificultad); el resto mantiene el bloque o marca al hombre.
- **Portero**: se coloca en la bisectriz, sale a balones sueltos, se lanza a la trayectoria del tiro.
- **Técnicas**: elige la más potente pagable con probabilidad por dificultad; a veces guarda PT; combos si hay compañeros.
- **Adaptación**: cada 15 s revisa marcador/minuto (se vuelca al ataque si pierde, se encierra si gana) y el estilo del rival (carril preferido, abuso del regate → más presión).

### Mundo (`world/`)
Mapas declarativos (`fill`, `border`, `building`, `field`, `scatter`) → rejilla. Movimiento por casillas con interpolación, NPC sólidos, puertas/carteles invisibles, warps con requisitos, objetos, NPC con línea de visión y encuentros en hierba alta. El renderizador pre-dibuja la capa estática en un canvas fuera de pantalla (optimización).

### Guardado (`systems/save.js`)
Sobre `{version, savedAt, checksum, meta, data}`. Al guardar copia la versión previa a `<clave>_bak`. Al cargar verifica el checksum; si falla, recupera la copia. `migrate()` aplica migraciones por versión y `validateState()` repara campos ausentes y elimina referencias a contenido inexistente.

## Gestión de errores
- Búsquedas en base de datos lanzan errores explícitos (`Jugador desconocido: x`).
- El bucle principal captura excepciones, las muestra en un aviso y fuerza un autoguardado.
- `window.onerror` / `unhandledrejection` también autoguardan.
- `npm run check` impide publicar datos rotos.

## Rendimiento
- Mapa estático pre-renderizado; solo agua, NPC y jugador se redibujan.
- Retratos generados una vez y cacheados como data URL.
- Motor de partido O(n²) con n = 22 → un partido completo simulado tarda ~100 ms en Node.
- `devicePixelRatio` limitado a 2.
