/* ============================================================
   traps.js: everything players can place on the course.
   Each trap type can define:
     rarity     "common" | "uncommon" | "rare" (sets how often it's dealt)
     rotates    true if R / right-click turns it while placing
     footprint  circles [x, y, r] used to check it fits on the page
     field()    a force or slowdown while the ball is nearby
     segments() solid walls the ball bounces off ([x1,y1,x2,y2,thickness])
     bumper     a round bouncy bumper
     special()  something drastic (teleport, back to the tee)
     draw()     its placeholder hand-drawn art
   ============================================================ */
(function () {
  const PG = (window.PG = window.PG || {});
  const S = () => PG.sketch;
  const now = () => PG.now || 0;

  const near = (ball, t) => {
    const dx = t.x - ball.x, dy = t.y - ball.y;
    return { dx, dy, d: Math.hypot(dx, dy) };
  };
  const dir = (t) => [Math.cos(t.angle || 0), Math.sin(t.angle || 0)];
  const along = (t, len, n, r) => {
    const [c, s] = dir(t), out = [];
    for (let i = 0; i < n; i++) { const k = -len / 2 + (len * i) / (n - 1); out.push([t.x + c * k, t.y + s * k, r]); }
    return out;
  };
  const segAlong = (t, len, thick) => {
    const [c, s] = dir(t);
    return [[t.x - (c * len) / 2, t.y - (s * len) / 2, t.x + (c * len) / 2, t.y + (s * len) / 2, thick]];
  };
  // Rectangle corners around the trap, rotated by its angle
  const box = (t, hw, hh) => {
    const [c, s] = dir(t);
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [t.x + x * c - y * s, t.y + x * s + y * c]);
  };
  const holePunchExit = (t) => { const [c, s] = dir(t); return { x: t.x + c * 230, y: t.y + s * 230 }; };

  const types = {
    /* ---------- common ---------- */
    wall: {
      name: "Pencil wall", desc: "A pencil lying across the page. Blocks the way.", rarity: "common", rotates: true,
      footprint: (t) => along(t, 120, 5, 12),
      segments: (t) => segAlong(t, 112, 6),
      draw(ctx, t) {
        const s = S(), k = box(t, 52, 6);
        s.poly(ctx, k, { fill: "#ffd23f", width: 2.4, seed: t.seed });
        const [c, sn] = dir(t);
        const tip = [t.x + c * 66, t.y + sn * 66];
        s.poly(ctx, [k[1], tip, k[2]], { fill: "#e9c9a0", width: 2.2, seed: t.seed + 1 });
        s.poly(ctx, [k[0], [k[0][0] - c * 9, k[0][1] - sn * 9], [k[3][0] - c * 9, k[3][1] - sn * 9], k[3]], { fill: "#ffb7d5", width: 2, seed: t.seed + 2 });
      },
    },
    ruler: {
      name: "Ruler", desc: "A long, straight wall. Good for cutting off shortcuts.", rarity: "common", rotates: true,
      footprint: (t) => along(t, 220, 8, 14),
      segments: (t) => segAlong(t, 216, 9),
      draw(ctx, t) {
        const s = S(), k = box(t, 110, 11);
        s.poly(ctx, k, { fill: "#cfe6ff", fillAlpha: 0.85, width: 2.4, seed: t.seed });
        const [c, sn] = dir(t);
        for (let i = -100; i <= 100; i += 10) {
          const len = i % 50 === 0 ? 9 : 5;
          const x = t.x + c * i - sn * -11, y = t.y + sn * i + c * -11;
          s.line(ctx, x, y, x - sn * len, y + c * len, { width: 1.2, passes: 1, seed: i + 300 });
        }
      },
    },
    ink: {
      name: "Ink blot", desc: "Sticky. Balls slow right down.", rarity: "common", sticky: true,
      footprint: (t) => [[t.x, t.y, 44]],
      field(ball, t) { if (near(ball, t).d < 44) return { drag: 5.5, touched: true }; },
      draw(ctx, t) {
        const s = S();
        ctx.save(); ctx.fillStyle = "#1d1b22"; ctx.globalAlpha = 0.85;
        const pts = s.circlePts(t.x, t.y, 40, t.seed, 0.18, 0);
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.fill();
        [[50, -18, 5], [-46, 26, 4], [30, 44, 3], [-20, -50, 4]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(t.x + dx, t.y + dy, r, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore();
      },
    },

    /* ---------- uncommon ---------- */
    eraser: {
      name: "Eraser", desc: "A chunky block. Balls bounce off it.", rarity: "uncommon", rotates: true,
      footprint: (t) => along(t, 90, 3, 24),
      segments(t) { const k = box(t, 52, 19); return k.map((p, i) => [p[0], p[1], k[(i + 1) % 4][0], k[(i + 1) % 4][1], 3]); },
      draw(ctx, t) {
        const s = S(), k = box(t, 52, 19);
        s.poly(ctx, k, { fill: "#ffb7d5", width: 3, seed: t.seed });
        const mid = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        s.poly(ctx, [mid(k[0], k[1], 0.45), k[1], k[2], mid(k[3], k[2], 0.45)], { fill: "#9cc3f0", width: 2.5, seed: t.seed + 3 });
        const [c, sn] = dir(t);
        s.text(ctx, "eraser", t.x - 12 * c, t.y - 12 * sn, { size: 17, tilt: ((t.angle || 0) * 180) / Math.PI });
      },
    },
    spring: {
      name: "Spring", desc: "Bouncy bumper. Fires balls off fast.", rarity: "uncommon",
      footprint: (t) => [[t.x, t.y, 30]],
      bumper: { r: 20, boost: 1.35, minSpeed: 720 },
      draw(ctx, t) {
        const s = S();
        // squashes for a moment after it's hit
        const squash = t.hitAt && now() - t.hitAt < 0.25 ? 0.8 : 1;
        s.circle(ctx, t.x, t.y, 21 * squash, { fill: "#fff06a", width: 3, seed: t.seed });
        for (let i = 0; i < 6; i++) s.line(ctx, t.x - 12 + i * 4, t.y + (i % 2 ? -9 : 9) * squash, t.x - 8 + i * 4, t.y + (i % 2 ? 9 : -9) * squash, { width: 2.4, passes: 1, seed: t.seed + i });
      },
    },
    highlighter: {
      name: "Highlighter streak", desc: "A speed strip. Shoves balls along it.", rarity: "uncommon", rotates: true,
      footprint: (t) => along(t, 150, 5, 18),
      field(ball, t, dt) {
        const [c, s] = dir(t);
        const rx = ball.x - t.x, ry = ball.y - t.y;
        const u = rx * c + ry * s, v = -rx * s + ry * c;
        if (Math.abs(u) < 75 && Math.abs(v) < 18) { ball.vx += c * 1200 * dt; ball.vy += s * 1200 * dt; return { touched: true }; }
      },
      draw(ctx, t) {
        const s = S(), [c, sn] = dir(t);
        ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = "#f2e600"; ctx.lineWidth = 34; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(t.x - c * 70, t.y - sn * 70); ctx.lineTo(t.x + c * 70, t.y + sn * 70); ctx.stroke(); ctx.restore();
        // chevrons that creep along slowly to show which way it pushes
        const off = ((now() * 30) % 30);
        for (let k = -60 + off; k < 60; k += 30) {
          const x = t.x + c * k, y = t.y + sn * k;
          s.line(ctx, x - c * 7 - sn * 9, y - sn * 7 + c * 9, x + c * 3, y + sn * 3, { width: 2.6, passes: 1, seed: 400 });
          s.line(ctx, x - c * 7 + sn * 9, y - sn * 7 - c * 9, x + c * 3, y + sn * 3, { width: 2.6, passes: 1, seed: 401 });
        }
      },
    },

    /* ---------- rare ---------- */
    coffee: {
      name: "Coffee ring", desc: "Curves balls round in a circle.", rarity: "rare", sticky: true,
      footprint: (t) => [[t.x, t.y, 60]],
      field(ball, t, dt) {
        const { dx, dy, d } = near(ball, t);
        if (d < 62 && d > 16) { ball.vx += (-dy / d) * 900 * dt; ball.vy += (dx / d) * 900 * dt; return { touched: true }; }
      },
      draw(ctx, t) {
        const s = S();
        s.circle(ctx, t.x, t.y, 58, { color: "#8a5a2b", width: 6, alpha: 0.55, seed: t.seed, wobble: 0.04 });
        s.circle(ctx, t.x + 2, t.y - 1, 50, { color: "#8a5a2b", width: 2.5, alpha: 0.4, seed: t.seed + 4, wobble: 0.05 });
        ctx.save(); ctx.fillStyle = "#8a5a2b"; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(t.x + 44, t.y + 46, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      },
    },
    sharpener: {
      name: "Pencil sharpener", desc: "Sucks nearby balls towards it.", rarity: "rare",
      footprint: (t) => [[t.x, t.y, 40]],
      field(ball, t, dt) {
        const { dx, dy, d } = near(ball, t);
        if (d < 140 && d > 1) {
          const a = 1150 * (1 - d / 140);
          ball.vx += (dx / d) * a * dt; ball.vy += (dy / d) * a * dt;
          return { drag: d < 22 ? 3 : 0, touched: d < 50 };
        }
      },
      draw(ctx, t) {
        const s = S();
        [70, 110, 140].forEach((r, i) => s.circle(ctx, t.x, t.y, r, { width: 1.3, alpha: 0.22, passes: 1, seed: t.seed + i }));
        s.poly(ctx, [[t.x - 17, t.y - 15], [t.x + 17, t.y - 15], [t.x + 17, t.y + 15], [t.x - 17, t.y + 15]], { fill: "#c9c3d6", width: 3, seed: t.seed });
        s.circle(ctx, t.x, t.y, 7, { fill: "#262123", width: 2, seed: t.seed + 9 });
      },
    },
    scissors: {
      name: "Scissors", desc: "Snip! Touch them and you're back at the tee.", rarity: "rare",
      footprint: (t) => [[t.x, t.y, 32]],
      special(ball, t, world) {
        if (near(ball, t).d < 24) {
          ball.x = world.tee.x; ball.y = world.tee.y; ball.vx = ball.vy = 0;
          return "snip";
        }
      },
      draw(ctx, t) {
        const s = S();
        // the blades open and close a little
        const open = Math.floor(now() * 3) % 2 ? 0.32 : 0.22;
        [-1, 1].forEach((side, i) => {
          const a = -Math.PI / 2 + side * open;
          s.line(ctx, t.x, t.y + 4, t.x + Math.cos(a) * 26, t.y + Math.sin(a) * 26, { width: 3.4, color: "#7a7486", seed: t.seed + i });
          const ha = Math.PI / 2 + side * 0.5;
          s.circle(ctx, t.x + Math.cos(ha) * 14, t.y + Math.sin(ha) * 14 + 4, 7, { fill: "#d63b3b", width: 2.2, seed: t.seed + 3 + i });
        });
        s.circle(ctx, t.x, t.y + 4, 2.5, { fill: "#262123", width: 1.2, passes: 1, seed: t.seed + 6 });
      },
    },
    holepunch: {
      name: "Hole punch", desc: "Two linked holes. In one, out the other!", rarity: "rare", rotates: true,
      footprint: (t) => { const e = holePunchExit(t); return [[t.x, t.y, 22], [e.x, e.y, 22]]; },
      special(ball, t) {
        if (ball.portalCd > 0) { ball.portalCd--; return null; }
        if (near(ball, t).d < 14) {
          const e = holePunchExit(t), sp = Math.hypot(ball.vx, ball.vy) || 1;
          ball.x = e.x + (ball.vx / sp) * 22; ball.y = e.y + (ball.vy / sp) * 22;
          ball.portalCd = 40;
          return "teleport";
        }
      },
      draw(ctx, t) {
        const s = S(), e = holePunchExit(t);
        for (let k = 0.12; k < 0.88; k += 0.1) s.line(ctx, t.x + (e.x - t.x) * k, t.y + (e.y - t.y) * k, t.x + (e.x - t.x) * (k + 0.04), t.y + (e.y - t.y) * (k + 0.04), { width: 1.4, passes: 1, alpha: 0.35, seed: k * 100 });
        [[t.x, t.y, "in"], [e.x, e.y, "out"]].forEach(([x, y, label], i) => {
          s.circle(ctx, x, y, 14, { fill: "#e8e2d2", width: 2.6, seed: t.seed + i });
          s.circle(ctx, x - 1, y + 1, 8, { fill: "#c9c1ad", width: 1, passes: 1, seed: t.seed + 5 + i });
          s.text(ctx, label, x, y + 26, { size: 15, color: "#5d5960" });
        });
      },
    },
  };

  const WEIGHT = { common: 0, uncommon: 0, rare: 0 };
  const weights = { wall: 30, ruler: 18, ink: 14, eraser: 10, spring: 9, highlighter: 8, coffee: 5, sharpener: 4, scissors: 3, holepunch: 3 };

  PG.traps = {
    types,
    ids: Object.keys(types),
    weights,
    /** Deal n different trap types, weighted so walls are common and gadgets are rare. */
    deal(n, rand) {
      const pool = Object.keys(types);
      const out = [];
      while (out.length < n && pool.length) {
        const total = pool.reduce((a, id) => a + weights[id], 0);
        let r = rand() * total;
        let i = 0;
        while (r >= weights[pool[i]]) { r -= weights[pool[i]]; i++; }
        out.push(pool.splice(i, 1)[0]);
      }
      return out;
    },
    footprint: (t) => (types[t.type].footprint ? types[t.type].footprint(t) : [[t.x, t.y, 30]]),
    WEIGHT,
  };
})();
