/* ============================================================
   character.js: the golfers. Each player builds a little doodle
   person from parts: hair/hat, face, shirt and trousers, tinted
   with their pen colour, plus the club they carry.

   drawCharacter(ctx, x, y, look, opts) draws a golfer standing
   with their feet at (x, y). Local coordinates: feet at (0, 0),
   head centre at (0, -54). `facing` flips them left/right and
   `clubAngle` sets the club's swing (radians from straight down).
   ============================================================ */
(function () {
  const PG = (window.PG = window.PG || {});
  const S = () => PG.sketch;

  const PARTS = {
    hair: ["messy hair", "curly hair", "bob", "beanie", "cap", "bucket hat", "party hat", "no hair"],
    face: ["dot eyes", "happy", "glasses", "sleepy", "shades", "determined"],
    shirt: ["t-shirt", "stripy tee", "hoodie", "shirt & tie", "star tee", "vest"],
    trousers: ["shorts", "jeans", "baggy trousers", "skirt", "checked trousers"],
  };

  /** A random look, used for the dice button. */
  function randomLook(rand = Math.random) {
    const pick = (a) => Math.floor(rand() * a.length);
    return { hair: pick(PARTS.hair), face: pick(PARTS.face), shirt: pick(PARTS.shirt), trousers: pick(PARTS.trousers), club: Math.floor(rand() * PG.clubs.list.length) };
  }

  // Helpers that draw in local coordinates (x mirrored by facing)
  function pen(ctx, f, ox, oy) {
    const s = S();
    return {
      line: (x1, y1, x2, y2, o = {}) => s.line(ctx, ox + x1 * f, oy + y1, ox + x2 * f, oy + y2, { width: 2.4, ...o }),
      circle: (x, y, r, o = {}) => s.circle(ctx, ox + x * f, oy + y, r, { width: 2.4, ...o }),
      poly: (pts, o = {}) => s.poly(ctx, pts.map(([x, y]) => [ox + x * f, oy + y]), { width: 2.4, ...o }),
      hatch: (pts, o = {}) => {
        const p = pts.map(([x, y]) => [ox + x * f, oy + y]);
        const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
        s.hatch(ctx, (c) => { p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); },
          [Math.min(...xs) - 4, Math.min(...ys) - 4, Math.max(...xs) + 4, Math.max(...ys) + 4], o);
      },
      dot: (x, y, r, color) => { ctx.save(); ctx.fillStyle = color || s.INK; ctx.beginPath(); ctx.arc(ox + x * f, oy + y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
    };
  }

  /** Light crayon-style fill in the player's colour, a bit offset like colouring outside the lines. */
  function crayon(ctx, f, ox, oy, pts, color, alpha = 0.35) {
    ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * f + 2, oy + y + 1.5) : ctx.moveTo(ox + x * f + 2, oy + y + 1.5)));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function drawTrousers(p, ctx, f, ox, oy, kind, color) {
    const legs = {
      0: [[[-10, -16], [-1, -16], [-2, -6], [-10, -6]], [[1, -16], [10, -16], [10, -6], [2, -6]]],
      1: [[[-10, -16], [-1, -16], [-2, -1], [-9, -1]], [[1, -16], [10, -16], [9, -1], [2, -1]]],
      2: [[[-11, -16], [-1, -16], [-1, -1], [-13, -1]], [[1, -16], [11, -16], [13, -1], [1, -1]]],
      3: [[[-10, -16], [10, -16], [14, -4], [-14, -4]]],
      4: [[[-10, -16], [-1, -16], [-2, -1], [-9, -1]], [[1, -16], [10, -16], [9, -1], [2, -1]]],
    }[kind];
    const trouserCol = kind === 1 ? "#5b7fd1" : kind === 3 ? color : "#6b6570";
    legs.forEach((leg) => { crayon(ctx, f, ox, oy, leg, trouserCol, 0.3); p.poly(leg, { seed: 40 + kind }); });
    if (kind === 2) { p.line(-9, -6, -5, -4, { width: 1.5, passes: 1 }); p.line(5, -5, 10, -3, { width: 1.5, passes: 1 }); }
    if (kind === 4) legs.forEach((leg) => { p.hatch(leg, { gap: 4, alpha: 0.5 }); });
    if (kind === 1) { p.line(-5, -14, -5, -2, { width: 1.2, passes: 1, alpha: 0.6 }); p.line(5, -14, 5, -2, { width: 1.2, passes: 1, alpha: 0.6 }); }
    // legs below shorts / skirt, then shoes
    if (kind === 0) { p.line(-6, -6, -6, -1); p.line(6, -6, 6, -1); }
    if (kind === 3) { p.line(-6, -4, -6, -1); p.line(6, -4, 6, -1); }
    p.poly([[-11, -1], [-2, -1], [-2, 2], [-12, 2]], { fill: "#262123", width: 1.6, seed: 47 });
    p.poly([[2, -1], [11, -1], [12, 2], [2, 2]], { fill: "#262123", width: 1.6, seed: 48 });
  }

  function drawShirt(p, ctx, f, ox, oy, kind, color) {
    const body = kind === 5
      ? [[-8, -38], [8, -38], [11, -16], [-11, -16]]
      : [[-9, -38], [9, -38], [13, -34], [11, -28], [10, -16], [-10, -16], [-11, -28], [-13, -34]];
    crayon(ctx, f, ox, oy, body, color, 0.42);
    p.poly(body, { seed: 50 + kind });
    if (kind === 1) for (let y = -33; y < -17; y += 5) p.line(-10, y, 10, y, { width: 1.6, passes: 1, color });
    if (kind === 2) { p.line(-4, -38, -3, -30, { width: 1.4, passes: 1 }); p.line(4, -38, 3, -30, { width: 1.4, passes: 1 }); p.poly([[-6, -24], [6, -24], [5, -18], [-5, -18]], { width: 1.4, passes: 1, seed: 57 }); }
    if (kind === 3) { p.poly([[-1, -37], [1, -37], [2, -24], [0, -21], [-2, -24]], { fill: "#d63b3b", width: 1.4, seed: 58 }); p.line(-5, -38, 0, -34, { width: 1.6 }); p.line(5, -38, 0, -34, { width: 1.6 }); }
    if (kind === 4) { const st = [[0, -33], [2, -29], [6, -29], [3, -26], [4, -22], [0, -24], [-4, -22], [-3, -26], [-6, -29], [-2, -29]]; p.poly(st, { fill: "#fff06a", width: 1.4, seed: 59 }); }
  }

  function drawHead(p, ctx, f, ox, oy, look, color) {
    const hx = 0, hy = -54, r = 14;
    p.circle(hx, hy, r, { fill: "#fffaf2", seed: 70 });
    // face
    const face = look.face;
    if (face === 0) { p.dot(-5, -54, 1.8); p.dot(5, -55, 1.8); p.line(-3, -47, 4, -47.5, { width: 1.8, passes: 1 }); }
    if (face === 1) { p.line(-7, -53, -5, -56, { width: 1.8, passes: 1 }); p.line(-5, -56, -3, -53, { width: 1.8, passes: 1 }); p.line(3, -53, 5, -56, { width: 1.8, passes: 1 }); p.line(5, -56, 7, -53, { width: 1.8, passes: 1 });
      p.line(-4, -48, 0, -45, { width: 1.8, passes: 1 }); p.line(0, -45, 5, -48, { width: 1.8, passes: 1 }); }
    if (face === 2) { p.circle(-5, -54, 4, { width: 1.6, passes: 1, seed: 71 }); p.circle(6, -54, 4, { width: 1.6, passes: 1, seed: 72 }); p.line(-1, -54, 2, -54, { width: 1.4, passes: 1 }); p.dot(-5, -54, 1.2); p.dot(6, -54, 1.2); p.line(-2, -47, 4, -47, { width: 1.6, passes: 1 }); }
    if (face === 3) { p.line(-8, -54, -3, -54, { width: 1.8, passes: 1 }); p.line(3, -54, 8, -54, { width: 1.8, passes: 1 }); p.circle(1, -47, 2, { width: 1.4, passes: 1, seed: 73 }); }
    if (face === 4) { p.poly([[-10, -57], [-1, -57], [-2, -51], [-9, -51]], { fill: "#262123", width: 1.4, seed: 74 }); p.poly([[2, -57], [11, -57], [10, -51], [3, -51]], { fill: "#262123", width: 1.4, seed: 75 }); p.line(-1, -56, 2, -56, { width: 1.4, passes: 1 }); p.line(-2, -46, 4, -47, { width: 1.8, passes: 1 }); }
    if (face === 5) { p.line(-8, -60, -2, -58, { width: 2, passes: 1 }); p.line(8, -60, 2, -58, { width: 2, passes: 1 }); p.dot(-5, -54, 1.8); p.dot(5, -54, 1.8); p.line(-3, -47, 4, -47, { width: 2, passes: 1 }); }

    // hair or hat
    const h = look.hair;
    if (h === 0) p.poly([[-14, -55], [-17, -64], [-9, -63], [-8, -72], [-1, -66], [4, -74], [6, -65], [14, -70], [12, -61], [17, -58], [13, -54], [9, -61], [2, -59], [-5, -61], [-10, -57]], { fill: "#8a5a2b", fillAlpha: 0.55, width: 2, seed: 80 });
    if (h === 1) [[-12, -60], [-7, -66], [0, -68], [7, -66], [12, -60], [-14, -53], [14, -53]].forEach(([x, y], i) => p.circle(x, y, 4.5, { fill: "#5a3418", fillAlpha: 0.7, width: 1.6, passes: 1, seed: 81 + i }));
    if (h === 2) { p.poly([[-15, -50], [-15, -62], [-8, -69], [8, -69], [15, -62], [15, -50], [11, -50], [10, -59], [-10, -59], [-11, -50]], { fill: "#e0a43a", fillAlpha: 0.6, width: 2, seed: 88 }); }
    if (h === 3) { p.poly([[-14, -60], [-10, -69], [0, -72], [10, -69], [14, -60]], { fill: color, fillAlpha: 0.5, width: 2, seed: 89 }); p.poly([[-15, -60], [15, -60], [15, -56], [-15, -56]], { fill: "#fffaf2", width: 1.8, seed: 90 }); p.circle(0, -75, 4, { fill: "#fff06a", width: 1.6, seed: 91 }); }
    if (h === 4) { p.poly([[-14, -60], [-10, -69], [0, -71], [10, -69], [14, -60]], { fill: color, fillAlpha: 0.55, width: 2, seed: 92 }); p.poly([[8, -60], [26, -60], [24, -56], [8, -57]], { fill: color, fillAlpha: 0.7, width: 1.8, seed: 93 }); }
    if (h === 5) { p.poly([[-11, -62], [-8, -71], [8, -71], [11, -62]], { fill: "#c9e7b5", width: 2, seed: 94 }); p.poly([[-20, -61], [20, -61], [16, -57], [-16, -57]], { fill: "#c9e7b5", width: 1.8, seed: 95 }); }
    if (h === 6) { p.poly([[-10, -63], [0, -88], [10, -63]], { fill: "#ffb7d5", width: 2, seed: 96 }); p.line(-6, -70, 5, -73, { color, width: 2, passes: 1 }); p.line(-3, -78, 3, -80, { color, width: 2, passes: 1 }); p.circle(0, -89, 3, { fill: "#fff06a", width: 1.4, seed: 97 }); }
    if (h === 7) p.line(-6, -66, -2, -67, { width: 1.2, passes: 1, alpha: 0.5 }); // a shiny head
  }

  /** The club, drawn from the hands. angle 0 = hanging straight down. */
  function drawClub(ctx, hx, hy, angle, f, club) {
    const s = S();
    const L = 30;
    const dx = Math.sin(angle) * f, dy = Math.cos(angle);
    const ex = hx + dx * L, ey = hy + dy * L;
    const px = -dy * f, py = dx * f; // perpendicular, pointing "forward"
    const id = PG.clubs.list[club].id;
    if (id === "pencil") {
      s.poly(ctx, [[hx - px * 3, hy - py * 3], [hx + px * 3, hy + py * 3], [ex + px * 3, ey + py * 3], [ex - px * 3, ey - py * 3]], { fill: "#ffd23f", width: 1.6, seed: 101 });
      s.poly(ctx, [[ex - px * 3, ey - py * 3], [ex + px * 3, ey + py * 3], [ex + dx * 9, ey + dy * 9]], { fill: "#e9c9a0", width: 1.6, seed: 102 });
      return;
    }
    if (id === "highlighter") {
      s.poly(ctx, [[hx - px * 4.5, hy - py * 4.5], [hx + px * 4.5, hy + py * 4.5], [ex + px * 4.5, ey + py * 4.5], [ex - px * 4.5, ey - py * 4.5]], { fill: "#fff06a", width: 1.8, seed: 103 });
      s.poly(ctx, [[ex - px * 4, ey - py * 4], [ex + px * 4, ey + py * 4], [ex + px * 2 + dx * 7, ey + py * 2 + dy * 7], [ex - px * 2 + dx * 6, ey - py * 2 + dy * 6]], { fill: "#f2c200", width: 1.6, seed: 104 });
      return;
    }
    if (id === "ruler") {
      s.poly(ctx, [[hx - px * 3.5, hy - py * 3.5], [hx + px * 3.5, hy + py * 3.5], [ex + px * 3.5 + dx * 6, ey + py * 3.5 + dy * 6], [ex - px * 3.5 + dx * 6, ey - py * 3.5 + dy * 6]], { fill: "#cfe6ff", width: 1.6, seed: 105 });
      for (let k = 6; k < L + 4; k += 5) s.line(ctx, hx + dx * k - px * 3.5, hy + dy * k - py * 3.5, hx + dx * k - px * 1, hy + dy * k - py * 1, { width: 1, passes: 1 });
      return;
    }
    // shaft for putter / mallet / magnet
    s.line(ctx, hx, hy, ex, ey, { width: 2.6, seed: 106 });
    if (id === "putter") s.poly(ctx, [[ex - px * 2, ey - py * 2], [ex + px * 9, ey + py * 9], [ex + px * 9 + dx * 5, ey + py * 9 + dy * 5], [ex - px * 2 + dx * 5, ey - py * 2 + dy * 5]], { fill: "#c9c3d6", width: 1.8, seed: 107 });
    if (id === "mallet") s.poly(ctx, [[ex - px * 7, ey - py * 7 - 0], [ex + px * 8, ey + py * 8], [ex + px * 8 + dx * 9, ey + py * 8 + dy * 9], [ex - px * 7 + dx * 9, ey - py * 7 + dy * 9]], { fill: "#ff9f6a", width: 1.8, seed: 108 });
    if (id === "magnet") {
      const c = [ex + dx * 6, ey + dy * 6];
      s.poly(ctx, [[c[0] - px * 8, c[1] - py * 8], [c[0] + px * 8, c[1] + py * 8], [c[0] + px * 8 + dx * 6, c[1] + py * 8 + dy * 6], [c[0] - px * 8 + dx * 6, c[1] - py * 8 + dy * 6]], { fill: "#d63b3b", width: 1.8, seed: 109 });
    }
  }

  /**
   * Draw a golfer with feet at (x, y).
   * opts: { color, facing: 1|-1, scale, clubAngle (radians), bob (px) }
   */
  function drawCharacter(ctx, x, y, look, opts = {}) {
    const f = opts.facing || 1, sc = opts.scale || 1;
    ctx.save();
    ctx.translate(x, y + (opts.bob || 0)); ctx.scale(sc, sc);
    const p = pen(ctx, f, 0, 0);
    const color = opts.color || "#2b59c3";
    drawTrousers(p, ctx, f, 0, 0, look.trousers, color);
    // back arm
    p.line(-10, -34, -6, -24, { width: 2.2 });
    drawShirt(p, ctx, f, 0, 0, look.shirt, color);
    drawHead(p, ctx, f, 0, 0, look, color);
    // front arm reaching to the club grip, then the club
    const hands = [6, -25];
    p.line(9, -34, hands[0], hands[1], { width: 2.4 });
    if (look.club != null && opts.clubAngle != null) drawClub(ctx, hands[0] * f, hands[1], opts.clubAngle, f, look.club);
    p.circle(hands[0], hands[1], 2.6, { fill: "#fffaf2", width: 1.6, passes: 1, seed: 120 });
    ctx.restore();
  }

  /** Just the head, for scoreboard portraits. */
  function drawPortrait(ctx, x, y, look, color, scale = 1) {
    ctx.save(); ctx.translate(x, y + 54 * scale); ctx.scale(scale, scale);
    drawHead(pen(ctx, 1, 0, 0), ctx, 1, 0, 0, look, color);
    ctx.restore();
  }

  PG.character = { PARTS, randomLook, drawCharacter, drawClub, drawPortrait };
})();
