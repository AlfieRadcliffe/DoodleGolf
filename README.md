# Doodle Golf ⛳✏️

An online party game: mini golf on notebook pages, where every player sabotages the course with hand-drawn traps.
Inspired by Ultimate Chicken Horse. By **Alfie Radcliffe**. All the art will be drawn by hand on paper and scanned in.

> Status: **playable pass-and-play prototype**: 2–6 players on one device, a character creator, 6 clubs,
> 10 holes and 10 traps. Online multiplayer is next.

## How a game goes

1. **Set up:** choose 2–6 players and 5, 7 or 10 holes.
2. **Make your golfer:** each player uses the arrows to pick a hair/hat, face, shirt and trousers
   (tinted in their pen colour), plus a **club**. Every club has its own ability.
3. **Each hole:**
   1. **Trap phase.** Everyone is dealt 3 traps, picks one and places it on the page. Some traps rotate (<kbd>R</kbd> or right-click).
   2. **Putt phase.** Take turns, one stroke at a time, **4 strokes max** each. Drag back from anywhere and let go,
      like a slingshot. Your golfer swings the club for you.
   3. **Scoring.**
      - Sink the ball → **+3**, plus **+1** for each stroke you had left.
      - **If everyone sinks it, nobody scores.** The hole was too easy, so make your traps meaner.
      - Your trap touches someone who then misses → **+1** for you.
4. First to **15 points**, or the most points after the last hole, wins.

### Clubs

| Club | Ability |
|---|---|
| Trusty putter | No tricks. Steady and reliable |
| Ruler | The aim line shows where your ball will roll (a bit weaker) |
| Pencil driver | +25% power, but your aim wobbles a little |
| Highlighter | Glides straight through ink blots and coffee rings |
| Rubber mallet | Extra bouncy off walls and springs |
| Paperclip magnet | The hole pulls your ball in when it's close |

### Traps

Basic walls are dealt most often; the nastiest gadgets are rare.

| Trap | Rarity | What it does |
|---|---|---|
| Pencil wall | common | A pencil lying across the page. Blocks the way |
| Ruler | common | A long straight wall |
| Ink blot | common | Sticky: the ball slows right down |
| Eraser | uncommon | A chunky block the ball bounces off |
| Spring | uncommon | Bouncy bumper that fires the ball off fast |
| Highlighter streak | uncommon | A speed strip that shoves the ball along it |
| Coffee ring | rare | Curves the ball round in a circle |
| Pencil sharpener | rare | Pulls the ball towards it like a tiny black hole |
| Scissors | rare | Snip! Touch them and you're back at the tee |
| Hole punch | rare | Two linked holes: in one, out the other |

### Holes

Warm-up, Snake, Windmill, Funnel, The Box, Two Rooms, Pinball, Spiral, Zig-zag and Double Trouble.
Windmill and Double Trouble have spinning rulers pinned to the page, like crazy-golf windmills.

## Milestones

- [x] Pick the game idea and sketch the rules
- [x] **1. Single player:** a ball on a canvas you can drag to putt, with friction and wall bounces
- [x] **2. Courses:** walls and a hole loaded from a level file; sinking the ball
- [x] **3. Traps:** place traps and make them affect the ball
- [x] **Golfers:** character creator, clubs with abilities, swing animation
- [ ] **4. Lobby:** a Node.js server; create a room, share a code, see who's joined
- [ ] **5. Multiplayer:** turns and shots synced between everyone's browsers over WebSockets
- [x] **6. Rounds and scoring:** trap phase → putt phase → scores → next hole → winner
- [ ] **7. Art:** hand-drawn sprites and pages scanned in, with a choppy hand-drawn animation style
- [ ] **8. Playtest and deploy:** play with friends, fix what confuses people, put it online

## How the code is laid out

```
public/              ← everything the browser loads
  index.html, style.css
  js/
    sketch.js        ← hand-drawn rendering: wobbly pen lines that "boil"
    character.js     ← golfer parts, clubs and the swing poses
    clubs.js         ← club abilities
    physics.js       ← fixed-step ball physics and collisions
    traps.js         ← every trap: rarity, effect and placeholder art
    levels.js        ← the holes
    game.js          ← game flow, input, drawing
  art/               ← scanned black-and-white drawings (coming soon)
server/              ← milestone 4: the Node.js multiplayer server
```

Built with plain JavaScript and the HTML `<canvas>`, with no game engine. The physics runs on a fixed time step,
so a shot plays out exactly the same in every browser, which is what will make online play simple.

## Running it

Until milestone 4 there's no server: open `public/index.html` in a browser and pass the mouse around.
Add `?demo` to the URL to jump straight to a mid-game scene.

All art is placeholder doodles drawn in code until it's replaced with scanned drawings.
