/* ============================================================
   levels.js: the holes. The page is 1000 × 620. Each hole has a
   tee (where balls start), a hole, walls as line segments
   [x1, y1, x2, y2] and optional "movers": spinning rulers, like
   the windmill in crazy golf. The page border is added for you.
   ============================================================ */
(function () {
  const PG = (window.PG = window.PG || {});
  const W = 1000, H = 620, M = 22; // page size and border inset
  const LEFT = M + 50;              // the red margin line is out of bounds

  const border = [
    [LEFT, M, W - M, M], [W - M, M, W - M, H - M],
    [W - M, H - M, LEFT, H - M], [LEFT, H - M, LEFT, M],
  ];

  function distToSegment(px, py, [x1, y1, x2, y2]) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }

  const holes = [
    {
      name: "Warm-up",
      tee: { x: 170, y: 310 }, hole: { x: 850, y: 310 },
      walls: [[500, 170, 500, 450]],
    },
    {
      name: "Snake",
      tee: { x: 160, y: 520 }, hole: { x: 860, y: 120 },
      walls: [[360, H - M, 360, 250], [640, M, 640, 370]],
    },
    {
      name: "Windmill",
      tee: { x: 150, y: 310 }, hole: { x: 880, y: 310 },
      walls: [[520, M, 520, 200], [520, 420, 520, H - M]],
      movers: [{ x: 520, y: 310, len: 190, speed: 1.4, angle0: 0 }],
    },
    {
      name: "Funnel",
      tee: { x: 150, y: 310 }, hole: { x: 905, y: 310 },
      walls: [[560, 50, 820, 268], [560, 570, 820, 352], [400, 270, 400, 350]],
    },
    {
      name: "The Box",
      tee: { x: 160, y: 520 }, hole: { x: 860, y: 320 },
      walls: [[760, 210, 925, 210], [925, 210, 925, 430], [925, 430, 760, 430], [760, 430, 760, 330]],
    },
    {
      name: "Two Rooms",
      tee: { x: 170, y: 150 }, hole: { x: 830, y: 470 },
      walls: [[520, M, 520, 250], [520, 340, 520, H - M], [520, 340, 700, 340], [700, 340, 700, 560]],
    },
    {
      name: "Pinball",
      tee: { x: 150, y: 120 }, hole: { x: 880, y: 520 },
      walls: [[300, 90, 380, 250], [500, 320, 610, 200], [440, 460, 610, 520], [700, 330, 790, 450], [240, 400, 350, 480]],
    },
    {
      name: "Spiral",
      tee: { x: 140, y: 560 }, hole: { x: 560, y: 310 },
      walls: [[230, 90, 880, 90], [880, 90, 880, 530], [880, 530, 320, 530], [320, 530, 320, 190], [320, 190, 760, 190], [760, 190, 760, 430], [760, 430, 450, 430]],
    },
    {
      name: "Zig-zag",
      tee: { x: 140, y: 100 }, hole: { x: 900, y: 540 },
      walls: [[250, M, 250, 450], [430, 170, 430, H - M], [610, M, 610, 450], [790, 170, 790, H - M]],
    },
    {
      name: "Double Trouble",
      tee: { x: 140, y: 310 }, hole: { x: 900, y: 310 },
      walls: [[400, M, 400, 160], [400, 460, 400, H - M], [700, M, 700, 160], [700, 460, 700, H - M]],
      movers: [
        { x: 400, y: 310, len: 260, speed: 1.1, angle0: 0 },
        { x: 700, y: 310, len: 260, speed: -1.3, angle0: Math.PI / 2 },
      ],
    },
  ];

  PG.levels = {
    W, H, M, LEFT,
    holes,
    /** Pick which holes this game uses: always starts with Warm-up, the rest shuffled. */
    pick(count, rand = Math.random) {
      const rest = holes.map((_, i) => i).slice(1);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      return [0, ...rest.slice(0, count - 1)];
    },
    world(i) {
      const h = holes[i];
      return { name: h.name, tee: h.tee, hole: h.hole, walls: [...border, ...h.walls], ownWalls: h.walls, movers: h.movers || [], traps: [], t: 0 };
    },
    /** Does this trap fit here? Not on the tee, the hole, a wall, a spinner or another trap. */
    canPlace(world, trap) {
      const circles = PG.traps.footprint(trap);
      const others = world.traps.flatMap((t) => PG.traps.footprint(t));
      for (const [x, y, r] of circles) {
        if (x < LEFT + r * 0.5 || x > W - M - r * 0.5 || y < M + r * 0.5 || y > H - M - r * 0.5) return false;
        if (Math.hypot(x - world.tee.x, y - world.tee.y) < r + 34) return false;
        if (Math.hypot(x - world.hole.x, y - world.hole.y) < r + 30) return false;
        for (const [ox, oy, or] of others) if (Math.hypot(x - ox, y - oy) < r + or - 6) return false;
        for (const w of world.ownWalls) if (distToSegment(x, y, w) < r * 0.6 + 6) return false;
        for (const m of world.movers) if (Math.hypot(x - m.x, y - m.y) < m.len / 2 + r) return false;
      }
      return true;
    },
  };
})();
