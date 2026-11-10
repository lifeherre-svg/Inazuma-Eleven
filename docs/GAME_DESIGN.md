# Documento de diseño

## Bucle de juego

```
Explorar ──► Encontrar jugadores (hierba alta, retos, ojeadores) ──► Reclutar
   ▲                                                                     │
   │                                                                     ▼
Historia / torneos ◄── Partidos (XP, dinero, técnicas) ◄── Entrenar y alinear
```

El jugador alterna exploración (descubrir zonas, NPC, objetos, jugadores), gestión (alineación, técnicas, entrenamiento, fatiga) y competición (partidos de historia, amistosos, torneos). La historia desbloquea zonas nuevas con jugadores más raros y rivales más fuertes.

## Campaña

| Cap. | Zona | Objetivo | Desbloquea |
|---|---|---|---|
| Prólogo | Villa Rayo | Hablar con el Abuelo Tetsuo | Llave del club, misiones |
| 1 | Villa Rayo, Ribera | Reunir 11 jugadores, vencer a Halcones y a Cuervo Negro | Distrito Escolar |
| 2 | Distrito Escolar | Torneo Escolar (Veteranos, Hanazono, Vértice) | Bosque Esmeralda |
| 3 | Bosque Esmeralda | Guardianes del Bosque | Manual sagrado, teleférico |
| 4 | Cumbre Granito | Titanes de Granito + Campeonato Regional | Tren a la Capital |
| 5 | Ciudad Capital | **Decisión Zenith** + Campeonato Nacional | Ferry a la isla |
| 6 | Isla Tempestad | Copa Internacional + Desafío Legendario | Epílogo, jugadores míticos |

**Decisiones**: en el capítulo 5, aceptar la oferta de Zenith da 5000 monedas e insignia, pero Kaito (épico) no se unirá nunca; rechazarla hace que Kaito se una al instante y que Ryu Kanzaki (épico) aparezca como reto.

## Reclutamiento (sin azar puro)

| Vía | Cómo funciona |
|---|---|
| Hierba alta | Encuentro aleatorio con un jugador de la zona → desafío por turnos → convencer |
| Retos de NPC | Agentes libres en el mapa: si ganas el duelo, se unen |
| Ojeo tras partido | Tras ganar, intenta fichar a estrellas/MVP del rival |
| Misiones y torneos | Recompensas con jugadores |
| Historia | Decisiones y eventos (Kaito, Ichika…) |
| Red de ojeadores | Pagas una búsqueda filtrada; aparece una ★ en el mapa |

**Convencer**: `prob = baseRareza × (1.25 − ánimo×0.95) × enfoque × carta × entrenador × factorNivel` (2 %–95 %). Enfoque que le gusta ×1.6, que odia ×0.45.

## Desafío por turnos

- Acciones: **Regate** (regate vs. entrada), **Tiro** (tiro vs. bloqueo/portero), **Técnica** (gasta PT, aplica elemento), **Convencer**, **Cambiar**, **Retirarse**.
- Ganar baja el **Ánimo** del rival; perder baja tu **Resistencia**. A 0 de ánimo el rival se rinde (+XP y convencer es mucho más fácil).

## Fórmulas de duelo (`match/duel.js`)

```
valor = fórmula(stats) × técnica × elemento × resistencia × azar(±25 %)
técnica  = 1 + potencia/85  (× 1.1 si es del mismo elemento que el jugador)
elemento = 1.2 ventaja / 0.85 desventaja (al 30 % si nadie usa técnica)
```

| Acción | Fórmula |
|---|---|
| Tiro | TIR + 0.3·TEC + 0.2·FIS (× caída por distancia 1 → 0.5) |
| Portero | 0.85·DEF + 0.45·FIS + 0.25·TEC + 0.15·CTR (× 1.15 ventaja base) |
| Bloqueo | 0.8·DEF + 0.5·FIS + 0.2·TEC |
| Regate | 0.9·REG + 0.5·CTR + 0.25·VEL + 0.15·TEC |
| Entrada | 0.95·DEF + 0.45·FIS + 0.25·VEL + 0.15·TEC |
| Pase / intercepción | 0.9·CTR + 0.4·TEC / 0.6·DEF + 0.5·VEL + 0.3·CTR |

Velocidad en el campo = `92 + 1.25·VEL` (× sprint 1.35, × 0.9 con balón, × resistencia). La resistencia baja con el esfuerzo según la estadística RES.

## Progresión

- Stat(nivel) = `base × rareza × (1 + (nivel−1)·0.035·crecimiento) × personalidad + entrenado + equipo`.
- XP al siguiente nivel = `40 · nivel^1.55`.
- Entrenamiento: máx. +60 por estadística; la calidad del minijuego multiplica 0.4–1.6.
- Técnicas: 5 niveles (+12 % de potencia cada uno), XP por uso (25 por uso en partido, 15 en desafío) y entrenamiento.
- Fatiga: +25 por partido, +14-24 por entrenamiento; > 50 penaliza stats; descanso = 0.

## Partidos: decisiones de diseño

- **Tiempo real + pausas tácticas**: el usuario controla a un jugador (cambio automático o manual) y la IA mueve al resto con la estrategia elegida.
- **Duelos tácticos**: cuando un rival entra, el juego se congela y eliges regate, técnica, pase o tiro (desactivable).
- **Cinemáticas** cortas (1.2-2 s) para técnicas: congelan la simulación para no penalizar al jugador.
- Sin fuera de juego ni faltas (arcade), con saques de banda, córner y puerta.
- Partes de 2:30 por defecto (configurable de 1:30 a 6:00); opción de simular.
