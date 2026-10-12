# 🙈 Escondite 3D

Juego multijugador en 3D para jugar con amigos desde el **navegador** (ordenador o móvil).
Los **escondidos** se disfrazan de cualquier objeto del mapa (una silla, un barril, un patito de goma…) y los
**buscadores** tienen que descubrir qué objetos son jugadores… sin disparar a lo que no debe.
Quien crea la sala es el **administrador** 👑 y tiene un montón de comandos para liarla.

## Cómo se juega

1. Uno crea la sala (será el admin) y comparte el enlace o el código de 4 letras.
2. Los demás entran con el código desde el ordenador o el móvil.
3. El admin elige mapa y ajustes y pulsa **Empezar**.
4. **Escondidos:** tenéis unos segundos para esconderos. Apunta a un objeto y pulsa `E` (o 🎭 en el móvil) para convertirte en él.
5. **Buscadores:** salen cuando acaba la cuenta atrás. Disparad a los objetos sospechosos. Si aciertas a un jugador: +10 por impacto y +100 al pillarlo (3 impactos). Si disparas a un objeto de verdad pierdes vida y, si llegas a 0, te mareas 5 segundos.
6. Si está activada la opción, los pillados se convierten en buscadores.
7. Gana la ronda el equipo que cumpla su objetivo, y **gana la partida quien tenga más puntos** al final de todas las rondas (con podio y confeti 🏆).

### Puntos

| Acción | Puntos |
| --- | --- |
| Escondido: cada 10 s sin que te pillen | +5 |
| Escondido: hacer ruido (`T`) | +15 |
| Escondido: sobrevivir a la ronda | +100 |
| Buscador: impacto en un jugador | +10 |
| Buscador: pillar a alguien | +100 |
| Buscadores: pillar a todos | +50 cada uno |

### Controles

| | Ordenador | Móvil |
| --- | --- | --- |
| Moverse | `WASD` / flechas | Joystick (lado izquierdo) |
| Mirar | Ratón (haz clic para capturarlo) | Arrastra en el lado derecho |
| Saltar / correr | `Espacio` / `Shift` | ⤒ |
| Disparar (buscador) | Clic izquierdo | 💦 |
| Disfrazarse (escondido) | `E` o clic derecho | 🎭 |
| Bloquear el giro del objeto | `R` | 🔒 |
| Quitar disfraz | `Q` | 🙍 |
| Hacer ruido | `T` | 📣 |
| Chat / marcador | `Enter` / `Tab` | 💬 / 🏆 |
| Panel de admin | `P` o botón 👑 | 👑 |

## Mapas

- **La Casa:** salón, cocina, dormitorio, baño, garaje con coche y jardín con piscina.
- **El Almacén:** estanterías enormes llenas de cajas y barriles, muelle de carga y oficina.
- **El Parque:** exterior con árboles, arbustos, estanque con patitos, quiosco, columpios y escenario.

## Comandos de administrador 👑

Desde el botón 👑 (panel con botones) o escribiendo en el chat. Escribe `/ayuda` para ver la lista en el juego.
Donde pone `<nombre>` puedes poner `todos`.

| Comando | Qué hace |
| --- | --- |
| `/empezar` · `/terminar` · `/siguiente` · `/sala` | Empezar, terminar con ganador, saltar ronda, volver a la sala |
| `/tiempo +30` | Suma o resta segundos al reloj |
| `/radar [seg]` | Los buscadores ven dónde está cada escondido |
| `/sonido <nombre>` | Obliga a alguien a hacer ruido |
| `/apagarluces [seg]` · `/encenderluces` | Apagón (los buscadores llevan linterna) |
| `/fiesta [seg]` | Modo discoteca 🪩 |
| `/congelar <nombre> [seg]` · `/descongelar <nombre>` | Congela a alguien |
| `/velocidad <nombre> <x>` | Más rápido o más lento (0.2 a 4) |
| `/tamano <nombre> <x>` | Gigante o mini (0.3 a 3) |
| `/gravedad baja\|normal\|alta` | Cambia la gravedad |
| `/disfrazar <nombre> <objeto>` | Disfraza a alguien a la fuerza (ej. `/disfrazar Ana patito`) |
| `/buscador <nombre>` · `/escondido <nombre>` | Cambia el rol de alguien |
| `/pillar <nombre>` · `/revivir <nombre>` | Elimina o revive a un escondido |
| `/traer <nombre>` · `/ir <nombre>` | Teletransportes |
| `/darpuntos <nombre> <n>` · `/quitarpuntos <nombre> <n>` | Puntos |
| `/expulsar <nombre>` | Echa a alguien |
| `/mapa casa\|almacen\|parque` · `/rondas <n>` | Ajustes |
| `/bot [n]` · `/quitarbots` | Bots escondidos para practicar solo |
| `/anuncio <texto>` | Mensaje gigante en la pantalla de todos |
| `/admin <nombre>` | Pasa el mando a otro jugador |

## Ponerlo en marcha

Necesitas [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install
npm start
```

Abre `http://localhost:3000`. En la consola aparece también la dirección para tus amigos si estáis
en la **misma wifi** (algo como `http://192.168.1.20:3000`).

### Jugar por internet (cada uno desde su casa)

**Opción rápida (sin cuenta):** con el servidor arrancado, en otra terminal:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Te dará un enlace `https://….trycloudflare.com` que puedes pasar a tus amigos. Funciona mientras tengas el ordenador encendido.

**Opción permanente (gratis):** sube el repositorio a [Render](https://render.com) → *New* → *Blueprint* y elige este repositorio (ya incluye `render.yaml`). Te dará una dirección fija tipo `https://escondite-3d.onrender.com`.

## Pruebas

```bash
npm test
```

Arranca el servidor y simula varios jugadores: crear sala, unirse, roles, disfraces, disparos, comandos de admin, fin de partida y expulsiones.

## Estructura

- `server.js` — servidor (salas, rondas, puntos y comandos de admin) con Express + Socket.IO.
- `shared/` — mapas, objetos y colisiones (los usan servidor y navegador).
- `public/` — la web: menús, HUD y motor 3D con Three.js. Todos los modelos están hechos con figuras básicas, sin archivos externos.
