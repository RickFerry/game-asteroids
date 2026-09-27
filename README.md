# Asteroids

Clon del clásico arcade **Asteroids** implementado en canvas HTML5 puro, sin dependencias ni bundler.

## Descripción

Nave espacial en un campo de asteroides con envolvimiento de bordes (el espacio es toroidal). Destruye asteroides para sumar puntos: los grandes se parten en medianos, los medianos en pequeños. Incluye power-ups especiales y tipos de asteroides únicos como la estrella fugaz.

## Tecnologías

- **HTML5 Canvas** — renderizado 2D
- **JavaScript (ES6+)** — lógica del juego en un solo archivo `game.js`
- Sin frameworks, sin bundler, sin dependencias

## Cómo correr

Abre `index.html` directamente en el navegador (doble clic), o usa un servidor local:

```bash
npx serve .
```

Luego visita `http://localhost:3000`.

## Controles

| Tecla     | Acción                  |
| --------- | ----------------------- |
| `←` `→`   | Rotar nave              |
| `↑`       | Propulsar               |
| `Espacio` | Disparar                |
| `1` `2` `3` | Cambiar skin de nave  |

## Puntuación

| Asteroide | Puntos |
| --------- | ------ |
| Grande    | 20     |
| Mediano   | 50     |
| Pequeño   | 100    |

## Características

- 3 vidas con invencibilidad temporal al reaparecer (parpadeo)
- Asteroides se parten en fragmentos más pequeños al ser destruidos
- Partículas de explosión al destruir asteroides
- Power-up **Escudo**: 10% de probabilidad al destruir un asteroide, dura 5 segundos y rodea la nave de una luz verde que pulveriza cualquier meteoro que toque (sin puntuación)
- Power-up **Velocidad**: 12% de probabilidad, duplica la propulsión durante 5 segundos
- Power-up **Triplete**: 12% de probabilidad, dispara tres balas en abanico hasta perder la vida actual o cambiar de nivel
- Estrella fugaz (cometa) que aparece al destruir asteroides grandes y vale 500 puntos
- Tres skins de nave (clásica, delta y caza) seleccionables con `1` `2` `3`; la elección se recuerda entre sesiones
