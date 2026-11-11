# Lenguaje de guiones

Los diálogos, cinemáticas y eventos de historia se escriben como listas de comandos JSON (en `src/data/maps.js`) que ejecuta `src/systems/script.js`. La lógica (flags, objetos, recompensas) se aplica en el intérprete; la presentación la pone la escena del mundo. Esto permite probar la historia completa sin navegador (ver `tests/story.test.js`).

## Comandos

| Comando | Efecto |
|---|---|
| `{ say: 'texto', who?: 'Nombre', portrait?: id }` | Línea de diálogo. `portrait` acepta id de jugador, clave de `LOOKS` o un objeto de aspecto. Por defecto usa el NPC que habla. `{name}` se sustituye por el nombre del entrenador. |
| `{ choice: 'pregunta', options: [{ text, do: [...] }] }` | Decisión del jugador (teclas 1-9 o clic). |
| `{ if: cond, then: [...], else: [...] }` | Condición. |
| `{ flag: 'x' }` / `{ unflag: 'x' }` | Activa/desactiva un flag (los flags hacen avanzar capítulos y misiones). |
| `{ give: { item, qty } }` / `{ take: { item, qty } }` | Dar/quitar objetos. |
| `{ money: n }` | Sumar o restar dinero. |
| `{ player: { id, level, source? } }` | Añadir un jugador a la plantilla. |
| `{ quest: id }` / `{ completeQuest: id }` | Iniciar/completar misión. |
| `{ match: { team, level?, context?, onWin: [...], onLose: [...] } }` | Partido (con previa, opción de simular y resultados). |
| `{ challenge: { player, level, onWin, onLose } }` | Reto por turnos; si se gana, el jugador se une. |
| `{ title: 'Capítulo 2', subtitle }` | Tarjeta de título cinemática. |
| `{ fx: 'lightning' \| 'flash' \| 'shake' \| 'fade' }` | Efecto de pantalla. |
| `{ warp: { map, x, y } }` | Teletransporte (trenes, ferris, teleféricos). |
| `{ shop: id }` · `{ open: 'team' \| 'training' \| 'scout' \| 'tournaments' }` · `{ heal: true }` · `{ save: true }` | Instalaciones. |
| `{ npcMove: { npc, path: [[dx,dy],...] } }` · `{ wait: ms }` · `{ sfx }` · `{ music }` · `{ notify }` | Cinemática y sonido. |
| `{ talked: npcId }` | Emite el evento de "hablar con" (misiones `talk`). |
| `{ stop: true }` | Termina el guion. |

## Condiciones

```js
{ flag: 'x' }  { notFlag: 'x' }  { item: { id, count } }  { questDone: id }  { questActive: id }
{ roster: 11 } { owns: playerId }  { notOwns: playerId }  { defeated: teamId }  { chapter: 2 }  { money: 500 }
{ all: [c1, c2] }  { any: [c1, c2] }  { not: c }
```

## NPC

```js
{ id: 'umino', name: 'Capitán Umino', x: 36, y: 25, dir: 'left',
  look: LOOKS.fisher,            // o templateId: 'nagi_umino'
  showIf: cond, hideIf: cond,    // visibilidad dinámica
  sight: 4, sightFlag: 'halcones_beaten',  // te reta al verte (una vez)
  script: [ ... ] }
```

Las puertas y carteles son NPC con `invisible: true` colocados sobre la casilla de la puerta (se activan mirando hacia ella). Helpers: `door()`, `sign()`, `heal()`, `facility()`, `rivalMatch()`, `challenge()`.

## Ejemplo completo

```js
script: [
  { title: 'Capítulo 7', subtitle: 'La revancha' },
  { say: '¿Otra vez vosotros?' },
  { choice: '¿Aceptas el reto?', options: [
    { text: 'Sí', do: [
      { match: { team: 'cuervo_negro', level: 30, onWin: [{ flag: 'revancha_ok' }, { give: { item: 'carta_dorada' } }],
                 onLose: [{ say: 'Ja, ja. Volved cuando sepáis jugar.' }] } },
    ] },
    { text: 'Ahora no', do: [{ say: 'Cobarde...' }] },
  ] },
]
```
