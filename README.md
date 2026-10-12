# 🙈 Escondite 3D

Juego multijugador en 3D para jugar con amigos desde el **navegador** (ordenador o móvil).
Los **escondidos** se disfrazan de cualquier objeto del mapa (una silla, un barril, un patito de goma…) y los
**buscadores** tienen que descubrir qué objetos son jugadores… sin disparar a lo que no debe.
Quien crea la sala es el **administrador** 👑 y tiene un montón de comandos para liarla.

## 🚀 Ponerlo en internet para jugar con tus amigos (una sola vez, gratis)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Zeterpe/Juego)

1. Pulsa el botón de arriba y entra en Render con tu cuenta de GitHub.
2. Pulsa **Apply** (*Deploy Blueprint*). Render instala todo solo y en unos minutos te da una dirección fija,
   algo como `https://escondite-3d.onrender.com`.
3. Abre esa dirección, crea una sala y pasa el enlace a tus amigos con el botón de **WhatsApp**, copiándolo
   o enseñándoles el **código QR**. Ellos solo tienen que abrirlo y pulsar **🎮 ¡Entrar a jugar!**

Cada vez que se añada un cambio a la rama `main`, Render actualiza el juego solo.
El plan gratis se duerme si nadie lo usa durante 15 minutos: al entrar después tarda alrededor de un minuto en despertar.

## Cómo se juega

1. Uno crea la sala (será el admin) y comparte el enlace corto (WhatsApp, copiar o QR).
2. Los demás abren el enlace desde el ordenador o el móvil y pulsan **¡Entrar a jugar!** (también pueden escribir el código de 4 letras).
3. El admin elige mapa y ajustes y pulsa **Empezar**. Si sois pocos, puede añadir bots con **🤖 Añadir bot** (ver abajo).
4. Al empezar cada ronda sale una tarjeta que te dice si te toca **esconderte** o **buscar**.
5. **Escondidos:** tenéis unos segundos para esconderos. Apunta a un objeto y pulsa `E` (o 🎭 en el móvil) para convertirte en él.
   Lo mejor es esconderse junto a objetos iguales. Hacer ruido (`T`) da puntos, pero los buscadores oyen de dónde viene.
6. **Buscadores:** salen cuando acaba la cuenta atrás. Disparad a los objetos sospechosos. Si aciertas a un jugador: +10 por impacto y +100 al pillarlo (3 impactos). Si disparas a un objeto de verdad pierdes vida y, si llegas a 0, te mareas 5 segundos.
7. Si está activada la opción, los pillados (también los bots) se convierten en buscadores y salen a cazar a los demás.
8. En el **último minuto** los escondidos hacen ruido solos cada 20 segundos (se puede desactivar en la sala).
9. Al acabar la ronda sale un **resumen**: quién pilló a quién, quién sobrevivió y de qué iba disfrazado, y cómo va la clasificación.
10. **Gana la partida quien tenga más puntos** al final de todas las rondas (con podio y confeti 🏆).

Durante la partida, `Esc` (o ⚙️ en el móvil) abre el **menú**: marcador, ajustes (sensibilidad, volumen, campo de visión,
calidad gráfica, invertir ratón, FPS), controles e invitar amigos. Los ajustes se guardan en tu navegador.

### Bots 🤖

Los bots juegan de verdad: corren a esconderse junto a objetos del mismo tipo, se disfrazan, huyen si les disparas y hacen
ruido de vez en cuando. Cuando les toca buscar (o los pillan y se convierten en buscadores), patrullan el mapa, se fijan en
lo que se mueve o no encaja, van hacia los ruidos y disparan. Hay tres niveles: **fácil**, **normal** y **difícil**.

Si a alguien se le corta la conexión o recarga la página, vuelve solo a su sitio con sus puntos (se le guarda un minuto).
Quien llega mientras los demás se están escondiendo entra directamente como escondido.

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
| Menú (pausa, ajustes, invitar) | `Esc` | ⚙️ |
| Saltar / correr | `Espacio` / `Shift` | ⤒ |
| Disparar (buscador) | Clic izquierdo | 💦 |
| Disfrazarse (escondido) | `E` o clic derecho | 🎭 |
| Bloquear el giro del objeto | `R` | 🔒 |
| Quitar disfraz | `Q` | 🙍 |
| Hacer ruido | `T` | 📣 |
| Chat / marcador | `Enter` / `Tab` | 💬 / 🏆 |
| Panel de admin | `P` o botón 👑 | 👑 |

## Mapas y objetos

Hay **69 objetos** para disfrazarse: desde una silla o un barril hasta un piano, un gnomo de jardín, una máquina
recreativa, un muñeco de nieve o un rollo de papel higiénico.

- **La Casa:** salón con piano y reloj de pie, cocina, dormitorio, baño, garaje con coche y bici, y jardín con piscina, gnomos y muñeco de nieve.
- **El Almacén:** estanterías enormes llenas de cajas, maletas, peluches y sandías, muelle de carga, oficina con pizarra y zona de descanso con máquinas.
- **El Parque:** árboles, estanque con patitos, quiosco con máquina expendedora, escenario con grupo de música, zona de obras, granja y columpios.

## Comandos de administrador 👑

Desde el botón 👑 (panel con botones) o escribiendo en el chat. Escribe `/ayuda` para ver la lista en el juego.
Donde pone `<nombre>` puedes poner `todos`.

| Comando | Qué hace |
| --- | --- |
| `/empezar` · `/terminar` · `/siguiente` · `/sala` | Empezar, terminar con ganador, saltar ronda, volver a la sala |
| `/tiempo +30` | Suma o resta segundos al reloj |
| `/radar [seg]` | Los buscadores ven dónde está cada escondido |
| `/sonido <nombre>` | Obliga a alguien a hacer ruido (mientras se busca) |
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
| `/bot [n]` · `/quitarbots` | Añade o quita bots (se esconden y, si les toca, buscan) |
| `/dificultad facil\|normal\|dificil` | Lo listos que son los bots |
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

En la sala de espera, el enlace de invitación usa esa dirección de tu wifi automáticamente.

### Jugar por internet sin cuenta (desde tu ordenador)

Lo más cómodo es el botón de Render de arriba. Si prefieres no crear cuenta, con el servidor arrancado abre otra terminal:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

Te dará un enlace `https://….trycloudflare.com`: ábrelo tú también, crea la sala desde ahí y el enlace de invitación
ya saldrá con esa dirección. Funciona mientras tengas el ordenador encendido (y el enlace cambia cada vez).

## Pruebas

```bash
npm test
```

Comprueba que cada objeto tiene su modelo 3D, que nada atraviesa paredes ni se solapa en los mapas y que los bots pueden
llegar andando a cualquier sitio. Después arranca el servidor y simula varios jugadores: crear sala, unirse, roles,
disfraces, disparos, comandos de admin, fin de partida, expulsiones, reconexión, enlace corto y código QR. También juega
con bots: que no atraviesen paredes, que un bot pillado se vuelva buscador, que un bot buscador pille a quien no se
esconde bien, el resumen de la ronda y el ruido automático del último minuto.

## Estructura

- `server.js` — servidor (salas, rondas, puntos y comandos de admin) con Express + Socket.IO.
- `bots.js` — la inteligencia de los bots (esconderse, huir, buscar, oír ruidos y disparar).
- `shared/` — mapas, objetos, colisiones y el mapa de caminos de los bots (los usan servidor y navegador).
- `public/` — la web: menús, HUD y motor 3D con Three.js. Todos los modelos están hechos con figuras básicas, sin archivos externos.
