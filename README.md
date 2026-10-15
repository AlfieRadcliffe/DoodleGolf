# Pen Golf ⛳✏️

An online party game: mini golf on notebook pages, where every player sabotages the course with hand-drawn traps.
Inspired by Ultimate Chicken Horse. Made by **Alfie Radcliffe**: code, game design and all the art (drawn on paper, scanned in).

> Status: early development. See the milestones below.

## The rules (first draft, to be changed by playtesting)

**Players:** 2–6, joining from any browser with a room code.

Each hole has three phases:

1. **Trap phase (30 seconds).** Everyone is dealt 3 random traps, secretly picks one and places it on the page.
   All traps are revealed at the same time.
2. **Putt phase.** Players take turns hitting their ball, one stroke at a time, with **4 strokes max** each.
   Drag back from your ball and let go to shoot, like a slingshot. A longer drag is a harder hit.
3. **Scoring.**
   - Sink the ball → **+3**, plus **+1** for each stroke you had left.
   - **If everyone sinks it, nobody scores.** The hole was too easy, so make your traps meaner.
   - Your trap stops a ball from going in → **+1** for you.

First to **15 points** wins.

### Traps (each one drawn by hand)

| Trap | What it does |
|---|---|
| Ink blot | Sticky: the ball slows right down |
| Eraser | A solid wall the ball bounces off |
| Spring | Bouncy bumper that fires the ball off fast |
| Pencil sharpener | Pulls the ball towards it like a tiny black hole |
| Coffee ring | Curves the ball round in a circle |

## Milestones

- [x] Pick the game idea and sketch the rules
- [ ] **1. Single player:** a ball on a canvas you can drag to putt, with friction and wall bounces
- [ ] **2. Courses:** walls and a hole loaded from a level file; sinking the ball
- [ ] **3. Traps:** place traps and make them affect the ball
- [ ] **4. Lobby:** a Node.js server; create a room, share a code, see who's joined
- [ ] **5. Multiplayer:** turns and shots synced between everyone's browsers over WebSockets
- [ ] **6. Rounds and scoring:** trap phase → putt phase → scores → next hole → winner
- [ ] **7. Art:** hand-drawn sprites and pages scanned in, with a choppy hand-drawn animation style
- [ ] **8. Playtest and deploy:** play with friends, fix what confuses people, put it online

## How the code will be laid out

```
pen-golf/
  public/            ← everything the browser loads
    index.html
    game.js          ← the game loop, drawing and physics
    art/             ← scanned black-and-white drawings
  server/            ← added at milestone 4: the Node.js multiplayer server
```

Built with plain JavaScript and the HTML `<canvas>`, with no game engine, so every part of the physics and
networking is written (and understood) by hand.

## Running it

Until milestone 4 there's no server: open `public/index.html` in a browser.
