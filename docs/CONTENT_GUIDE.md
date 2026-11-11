# Guía de contenido

Todo el contenido vive en `src/data/`. Después de cualquier cambio ejecuta:

```bash
npm run check   # valida referencias, mapas y alcanzabilidad
npm test        # tests, incluida la campaña completa
```

---

## Añadir un jugador

Edita `src/data/players.js` y añade una fila al array `ROWS`:

```js
['hikari_sol', 'Hikari', 'Sol', 'free', 'FW', 'fire', 'rare', 'ambicioso',
  [36, 30, 14, 26, 28, 34, 26, 20],               // TIR REG DEF CTR TEC VEL RES FIS (nivel 1)
  '1:tiro_llamarada,12:cometa_carmesi,30:fenix_ascendente',
  'Historia personal del jugador.',
  { hair: 'spiky', hairColor: '#ff7b2e', accessory: 'headband' }],
```

| Campo | Valores |
|---|---|
| id | único, `snake_case` |
| equipo | `free` (agente libre), `rayo_azul` o id de equipo rival |
| posición | `GK`, `DF`, `MF`, `FW` |
| elemento | `fire`, `wood`, `mountain`, `wind` |
| rareza | `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic` |
| personalidad | `apasionado`, `calmado`, `orgulloso`, `amable`, `ambicioso`, `rebelde` |
| stats | 8 valores a nivel 1 **antes** del multiplicador de rareza (referencia: 30-40 en su punto fuerte, 14-20 en el débil) |
| learnset | `nivel:técnica` separados por comas |
| look (opcional) | `hair` (spiky, messy, short, swept, long, ponytail, mohawk, bowl, bald), `hairColor`, `skin`, `eyes`, `accessory` (headband, bandana, goggles, glasses, cape, beads, beard) |

Para que **aparezca en el juego**, elige una o varias vías:
- **Hierba alta**: añade `{ id, w, min, max }` a `encounters.pool` de un mapa (`w` = peso relativo, `requires` opcional).
- **Red de ojeadores**: añade `{ id, min, max, x, y }` a `scoutPool` de un mapa (casilla transitable).
- **Reto en el mapa**: un NPC con `templateId` y un guion con `challenge` (ver `maps.js`, p. ej. Midori).
- **Recompensa**: `rewards.player` en misiones o torneos, o el comando de guion `{ player: { id, level } }`.
- **Equipo rival**: añádelo a `stars` de un equipo; tras ganarles se podrá ojear.

### Sustituir por contenido con licencia
Cambia `name`, `surname`, `bio` y `look`; para usar ilustraciones reales, modifica `portrait()` en `src/ui/components.js` para devolver un `<img src="assets/portraits/<id>.png">` cuando exista el archivo.

## Añadir una técnica

`src/data/techniques.js`:

```js
{ id: 'ola_magma', name: 'Ola de Magma', category: 'shoot', element: 'fire',
  power: 88, tp: 26, anim: 'flame', desc: '...',
  requires: { level: 24, stats: { shoot: 85 } } },
```

- `category`: `shoot`, `dribble`, `defense`, `block`, `keeper`, `combo`.
- `anim` (efecto visual): `flame`, `phoenix`, `leaf`, `rock`, `meteor`, `wind`, `lightning`, `hand`, `aurora`. Para un efecto nuevo añade una entrada a `ANIM_FX` en `src/render/vfx.js`.
- `requires`: `level`, `stats`, `positions`, `element`.
- Combinadas: `combo: { participants: 2 }`; todos los participantes deben conocerla y estar a < 300 unidades.
- Potencia efectiva = `power × (1 + 0.12 × (nivel − 1))`. Para que alguien la aprenda: learnset, manual (`items.js`, tipo `manual`) o entrenamiento de técnicas (se descubre si es de su elemento y categoría).

## Crear un equipo rival

`src/data/teams.js`:

```js
{ id: 'tiburones', name: 'Tiburones del Sur', short: 'TDS', element: 'wind', level: 20,
  formation: 'f433', offense: 'contraataque', defense: 'presion', style: 'ofensivo',
  colors: { primary: '#006d77', secondary: '#ffffff' },
  stars: ['nagi_umino'], namePool: 'jp', techTier: 3, money: 600, coach: 'Sr. X', desc: '...' },
```

La plantilla se completa hasta 16 jugadores con jugadores **generados de forma determinista** según posición, elemento del equipo y `techTier` (1-4: calidad de técnicas). Úsalo en un guion `{ match: { team: 'tiburones', level: 20 } }` o en un torneo.

## Crear una misión

`src/data/quests.js`:

```js
{ id: 'sq_tiburones', type: 'side', name: 'Duelo en el puerto', giver: 'Capitán',
  desc: 'Gana a los Tiburones del Sur.',
  requires: { flag: 'ch2_done' }, autoStart: true,         // opcional
  objectives: [{ type: 'defeat', team: 'tiburones', text: 'Vencer a los Tiburones' }],
  rewards: { money: 500, items: { carta_especial: 2 }, player: { id: 'hikari_sol', level: 20 }, flags: ['tiburones_ok'] } },
```

Objetivos: `defeat`, `play`, `recruit`, `recruitId`, `train`, `talk`, `visit`, `encounters`, `tournament`, `learnTech` (por eventos) y `rosterSize`, `item`, `level`, `flag`, `seen`, `recruitTotal`, `own` (por estado). Se inicia automáticamente (`autoStart`) o desde un guion con `{ quest: 'sq_tiburones' }`.

## Añadir un torneo

`src/data/tournaments.js`: `requires.flag`, `minLevel`, `rounds` (`team`, `level`), `roundNames`, `rewards`, `repeatable` y `repeatRewards`. Las repeticiones suben +4 niveles por título.

## Añadir un mapa

1. En `src/data/maps.js` crea la especificación:

```js
const playa = {
  id: 'playa', name: 'Playa Sol', zone: 'Costa', theme: 'island', music: 'field', w: 30, h: 22,
  spawn: { x: 2, y: 10 },
  ops: [
    ['border', T.WATER],
    ['fill', T.SAND, 1, 1, 28, 20],
    ['fill', T.TALL, 10, 4, 8, 5],
    ['building', 20, 3, 6, 4, { label: 'Chiringuito', roof: '#ff8a00', door: 3 }],
    ['field', 4, 12, 12, 7, 'Campo de arena'],
  ],
  warps: [{ x: 0, y: 10, h: 2, to: 'ribera', tx: 37, ty: 20 }],
  encounters: { pool: [{ id: 'aki_sato', w: 2, min: 10, max: 12 }] },
  scoutPool: [],
  items: [{ x: 25, y: 15, item: 'bebida_isotonica', flag: 'it_playa_1' }],
  npcs: [ door('chiringuito', 23, 6, 'Chiringuito', [{ shop: 'tienda_villa' }]) ],
};
```

2. Añádelo a `MAPS`.
3. Crea un warp de vuelta desde otro mapa.
4. `npm run check` comprueba que el spawn, NPC, objetos, pistas y salidas sean alcanzables.

Temas visuales: `town`, `river`, `school`, `forest`, `mountain`, `city`, `island`. Casillas: ver `src/world/tiles.js` (`TALL` genera encuentros; `WATER`, `TREE`, `ROCK`, `FENCE`, `WALL` son sólidas).

## Modificar estadísticas y balance

Todo está en `src/config.js`:

| Bloque | Qué controla |
|---|---|
| `RARITY` | multiplicador de stats, crecimiento, XP y dificultad de reclutamiento por rareza |
| `PROGRESSION` | curva de XP, crecimiento por nivel, límite de entrenamiento, niveles de técnica |
| `ELEMENT_MULT` | ventaja / desventaja elemental y bonificación del mismo elemento |
| `MATCH` | tamaño del campo, velocidades, radios, enfriamientos, PT, duración |
| `DIFFICULTY` | multiplicador de stats de la IA, tiempo de reacción, uso de técnicas |
| `ENCOUNTER` | probabilidad de encuentros por paso |
| `ECONOMY` / `FATIGUE` | dinero y fatiga |

Las fórmulas de duelo están en `src/match/duel.js` (`ACTION_FORMULAS`, `KEEPER_ADVANTAGE`).

Para comprobar el impacto de un cambio de balance:

```bash
node -e "import('./src/match/match-setup.js').then(async ({buildOpponentSpec})=>{const {simulateMatch}=await import('./src/match/match-engine.js');for(let s=1;s<=5;s++)console.log(simulateMatch({home:buildOpponentSpec('hanazono'),away:buildOpponentSpec('vertice'),seed:s}).score)})"
```
