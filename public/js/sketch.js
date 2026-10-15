/* ============================================================
   sketch.js: hand-drawn rendering on <canvas>.
   Every shape is drawn as wobbly pen strokes, inked twice for a
   sketchy look. The wobble is seeded, and the seed changes a few
   times a second ("line boil"), so drawings shimmer like a
   hand-drawn cartoon instead of jittering randomly every frame.
   ============================================================ */
(function () {
  const PG = (window.PG = window.PG || {});
  const INK = "#262123";
  let boil = 0;

  // Small seeded random generator, so a shape looks the same until the boil changes
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  const jit = (r, a) => (r() - 0.5) * 2 * a;

  const S = {
    INK,
    /** Advance the line boil: call once per frame with the time in ms. */
    tick(ms) { boil = Math.floor(ms / 160) % 3; },

    /** A wobbly pen line, slightly bowed, drawn in two passes. */
    line(ctx, x1, y1, x2, y2, o = {}) {
      const r = rng((o.seed || 1) * 31 + boil * 977);
      const a = o.wobble ?? 1.8;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      ctx.save();
      ctx.strokeStyle = o.color || INK;
      ctx.lineCap = "round";
      for (let p = 0; p < (o.passes ?? 2); p++) {
        ctx.lineWidth = (o.width || 3) * (p ? 0.5 : 1);
        ctx.globalAlpha = (o.alpha ?? 1) * (p ? 0.5 : 1);
        const bow = jit(r, Math.min(6, len * 0.03) + a);
        const mx = (x1 + x2) / 2 + nx * bow, my = (y1 + y2) / 2 + ny * bow;
        ctx.beginPath();
        ctx.moveTo(x1 + jit(r, a), y1 + jit(r, a));
        ctx.quadraticCurveTo(mx, my, x2 + jit(r, a), y2 + jit(r, a));
        ctx.stroke();
      }
      ctx.restore();
    },

    /** Points round a wobbly circle; it overshoots its start like a quick pen loop. */
    circlePts(cx, cy, rad, seed, wobble = 0.05, overshoot = 0.35) {
      const r = rng(seed * 17 + boil * 613);
      const start = r() * Math.PI * 2, n = Math.max(14, Math.round(rad / 2.2));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = start + (i / n) * (Math.PI * 2 + overshoot);
        const k = 1 + jit(r, wobble);
        pts.push([cx + Math.cos(t) * rad * k, cy + Math.sin(t) * rad * k]);
      }
      return pts;
    },

    circle(ctx, cx, cy, rad, o = {}) {
      ctx.save();
      ctx.strokeStyle = o.color || INK;
      ctx.lineCap = ctx.lineJoin = "round";
      for (let p = 0; p < (o.passes ?? 2); p++) {
        const pts = S.circlePts(cx, cy, rad, (o.seed || 1) + p * 5, o.wobble ?? 0.05);
        if (o.fill && p === 0) {
          ctx.fillStyle = o.fill;
          ctx.globalAlpha = o.fillAlpha ?? 1;
          ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.fill();
        }
        ctx.lineWidth = (o.width || 3) * (p ? 0.5 : 1);
        ctx.globalAlpha = (o.alpha ?? 1) * (p ? 0.5 : 1);
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
      ctx.restore();
    },

    /** Closed wobbly polygon (rectangles, flags, boxes). */
    poly(ctx, pts, o = {}) {
      if (o.fill) {
        const r = rng((o.seed || 1) * 13 + boil * 101);
        ctx.save(); ctx.fillStyle = o.fill; ctx.globalAlpha = o.fillAlpha ?? 1;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + jit(r, 1.5), y + jit(r, 1.5)) : ctx.moveTo(x + 2, y + 2)));
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length];
        S.line(ctx, p[0], p[1], q[0], q[1], { ...o, seed: (o.seed || 1) * 7 + i });
      });
    },

    /** Diagonal pen hatching clipped to a path-building function. */
    hatch(ctx, clip, box, o = {}) {
      ctx.save();
      ctx.beginPath(); clip(ctx); ctx.clip();
      const gap = o.gap || 7, [x0, y0, x1, y1] = box;
      for (let d = -(y1 - y0); d < x1 - x0; d += gap) {
        S.line(ctx, x0 + d, y1, x0 + d + (y1 - y0), y0, { width: o.width || 1.4, color: o.color, alpha: o.alpha ?? 0.6, passes: 1, wobble: 1, seed: d });
      }
      ctx.restore();
    },

    /** Handwritten text (uses the page's handwriting font). */
    text(ctx, str, x, y, o = {}) {
      ctx.save();
      ctx.font = `${o.weight || 700} ${o.size || 22}px ${o.font || "Caveat, cursive"}`;
      ctx.fillStyle = o.color || INK;
      ctx.textAlign = o.align || "center";
      ctx.textBaseline = "middle";
      ctx.translate(x, y); ctx.rotate(((o.tilt || 0) * Math.PI) / 180);
      ctx.fillText(str, 0, 0);
      ctx.restore();
    },

    /** Lined notebook paper with a red margin. */
    paper(ctx, w, h) {
      ctx.fillStyle = "#fdfbf3";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#c7d9ee"; ctx.lineWidth = 1.5;
      for (let y = 34; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "#f0a3a8"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(56, h); ctx.stroke();
    },
  };

  PG.sketch = S;
})();
