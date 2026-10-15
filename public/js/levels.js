/* ============================================================
   levels.js: the holes. The page is 1000 × 620. Each hole has a
   tee (where balls start), a hole, and walls as line segments
   [x1, y1, x2, y2]. The page border is added automatically.
   ============================================================ */
(function () {
  const PG = (window.PG = window.PG || {});
  const W = 1000, H = 620, M = 22; // page size and border inset

  const border = [
    [M + 50, M, W - M, M], [W - M, M, W - M, H - M],
    [W - M, H - M, M + 50, H - M], [M + 50, H - M, M + 50, M],
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
      name: "Pinball",
      tee: { x: 150, y: 120 }, hole: { x: 880, y: 520 },
      walls: [[300, 90, 380, 250], [500, 320, 610, 200], [440, 460, 610, 520], [700, 330, 790, 450], [240, 400, 350, 480]],
    },
  ];

  PG.levels = {
    W, H, M,
    holes,
    world(i) {
      const h = holes[i];
      return { name: h.name, tee: h.tee, hole: h.hole, walls: [...border, ...h.walls], ownWalls: h.walls, traps: [] };
    },
    /** Is this a fair spot for a trap? Not on the tee, the hole, a wall or another trap. */
    canPlace(world, type, x, y) {
      const size = PG.traps.types[type].size;
      if (x < M + 50 + 20 || x > W - M - 20 || y < M + 20 || y > H - M - 20) return false;
      if (Math.hypot(x - world.tee.x, y - world.tee.y) < size + 40) return false;
      if (Math.hypot(x - world.hole.x, y - world.hole.y) < size + 30) return false;
      for (const t of world.traps) if (Math.hypot(x - t.x, y - t.y) < size + PG.traps.types[t.type].size - 10) return false;
      for (const w of world.ownWalls) if (distToSegment(x, y, w) < size * 0.6 + 6) return false;
      return true;
    },
  };
})();
