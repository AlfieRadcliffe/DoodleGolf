/* ============================================================
   traps.js: the five traps players place on the course.
   Each trap type can define:
     size      how much room it takes up when placing it
     field()   a force or slowdown while the ball is nearby
     segments  solid walls the ball bounces off
     bumper    a round bouncy bumper
     draw()    its placeholder hand-drawn art (to be replaced
               by Alfie's scanned drawings)
   ============================================================ */
(function () {
  const PG = (window.PG = window.PG || {});
  const S = () => PG.sketch;

  const near = (ball, t) => {
    const dx = t.x - ball.x, dy = t.y - ball.y;
    return { dx, dy, d: Math.hypot(dx, dy) };
  };

  const types = {
    ink: {
      name: "Ink blot",
      desc: "Sticky. Balls slow right down.",
      size: 46,
      field(ball, t) {
        if (near(ball, t).d < 44) return { drag: 5.5, touched: true };
      },
      draw(ctx, t) {
        const s = S();
        ctx.save();
        ctx.fillStyle = "#1d1b22"; ctx.globalAlpha = 0.85;
        const pts = s.circlePts(t.x, t.y, 40, t.seed, 0.18, 0);
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.fill();
        // splatter dots
        [[50, -18, 5], [-46, 26, 4], [30, 44, 3], [-20, -50, 4]].forEach(([dx, dy, r]) => {
          ctx.beginPath(); ctx.arc(t.x + dx, t.y + dy, r, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
      },
    },

    eraser: {
      name: "Eraser",
      desc: "A solid block. Balls bounce off it.",
      size: 56,
      corners(t) {
        const w = 52, h = 19, c = Math.cos(t.angle || 0), s = Math.sin(t.angle || 0);
        return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => [t.x + x * c - y * s, t.y + x * s + y * c]);
      },
      segments(t) {
        const k = types.eraser.corners(t);
        return k.map((p, i) => [p[0], p[1], k[(i + 1) % 4][0], k[(i + 1) % 4][1]]);
      },
      draw(ctx, t) {
        const s = S(), k = types.eraser.corners(t);
        s.poly(ctx, k, { fill: "#ffb7d5", width: 3, seed: t.seed });
        // the cardboard sleeve
        const mid = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        s.poly(ctx, [mid(k[0], k[1], 0.45), k[1], k[2], mid(k[3], k[2], 0.45)], { fill: "#9cc3f0", width: 2.5, seed: t.seed + 3 });
        s.text(ctx, "eraser", (k[0][0] + k[2][0]) / 2 - 12 * Math.cos(t.angle || 0), (k[0][1] + k[2][1]) / 2 - 12 * Math.sin(t.angle || 0), { size: 17, tilt: ((t.angle || 0) * 180) / Math.PI });
      },
    },

    spring: {
      name: "Spring",
      desc: "Bouncy bumper. Fires balls off fast.",
      size: 34,
      bumper: { r: 20, boost: 1.35, minSpeed: 720 },
      draw(ctx, t) {
        const s = S();
        s.circle(ctx, t.x, t.y, 21, { fill: "#fff06a", width: 3, seed: t.seed });
        // zigzag coil
        const pts = [];
        for (let i = 0; i <= 6; i++) pts.push([t.x - 12 + i * 4, t.y + (i % 2 ? -9 : 9)]);
        for (let i = 0; i < pts.length - 1; i++) s.line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], { width: 2.4, passes: 1, seed: t.seed + i });
      },
    },

    sharpener: {
      name: "Pencil sharpener",
      desc: "Sucks nearby balls towards it.",
      size: 40,
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
        // the pull zone, drawn as faint dashed rings
        [70, 110, 140].forEach((r, i) => s.circle(ctx, t.x, t.y, r, { width: 1.3, alpha: 0.22, passes: 1, seed: t.seed + i }));
        s.poly(ctx, [[t.x - 17, t.y - 15], [t.x + 17, t.y - 15], [t.x + 17, t.y + 15], [t.x - 17, t.y + 15]], { fill: "#c9c3d6", width: 3, seed: t.seed });
        s.circle(ctx, t.x, t.y, 7, { fill: "#262123", width: 2, seed: t.seed + 9 });
      },
    },

    coffee: {
      name: "Coffee ring",
      desc: "Curves balls round in a circle.",
      size: 62,
      field(ball, t, dt) {
        const { dx, dy, d } = near(ball, t);
        if (d < 62 && d > 16) {
          const a = 900;
          ball.vx += (-dy / d) * a * dt; ball.vy += (dx / d) * a * dt; // push sideways = curve
          return { touched: true };
        }
      },
      draw(ctx, t) {
        const s = S();
        s.circle(ctx, t.x, t.y, 58, { color: "#8a5a2b", width: 6, alpha: 0.55, seed: t.seed, wobble: 0.04 });
        s.circle(ctx, t.x + 2, t.y - 1, 50, { color: "#8a5a2b", width: 2.5, alpha: 0.4, seed: t.seed + 4, wobble: 0.05 });
        ctx.save(); ctx.fillStyle = "#8a5a2b"; ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.arc(t.x + 44, t.y + 46, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      },
    },
  };

  PG.traps = {
    types,
    ids: Object.keys(types),
    /** Deal n different random trap types. */
    deal(n, rand) {
      const ids = Object.keys(types).slice();
      const out = [];
      while (out.length < n && ids.length) out.push(ids.splice(Math.floor(rand() * ids.length), 1)[0]);
      return out;
    },
  };
})();
