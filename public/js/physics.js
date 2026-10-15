/* ============================================================
   physics.js: ball movement, friction and collisions.

   Runs on a fixed time step (1/120 s), so the same shot always
   gives exactly the same result. That matters later: for online
   play, players only need to send each other the shot and every
   browser can replay it identically.

   A ball can carry modifiers from its club:
     bounce    wall bounciness   inkProof  ignore sticky traps
     magnet    the hole pulls it in when close
   ============================================================ */
(function () {
  const PG = (window.PG = window.PG || {});

  const P = {
    BALL_R: 10,
    HOLE_R: 15,
    DT: 1 / 120,
    MAX_SPEED: 1150,       // px/s for a full-power shot
    DRAG: 0.9,             // proportional slowdown per second
    ROLL: 55,              // constant rolling slowdown, px/s²
    BOUNCE: 0.72,          // energy kept when hitting a wall
    SINK_SPEED: 430,       // faster than this and the ball skips over the hole
    STOP_SPEED: 7,

    /** Advance one ball by one fixed step. Returns an event name or null. */
    step(ball, world) {
      const dt = P.DT;
      world.t = (world.t || 0) + dt;
      let extraDrag = 0;

      // Traps that push or slow the ball
      for (const t of world.traps) {
        const def = PG.traps.types[t.type];
        if (def.field && !(def.sticky && ball.inkProof)) {
          const r = def.field(ball, t, dt);
          if (r) { extraDrag += r.drag || 0; if (r.touched) touch(ball, t); }
        }
      }

      // Paperclip magnet: the hole pulls the ball in from close range
      if (ball.magnet) {
        const dx = world.hole.x - ball.x, dy = world.hole.y - ball.y, d = Math.hypot(dx, dy);
        if (d < 55 && d > 1) { ball.vx += (dx / d) * 700 * dt; ball.vy += (dy / d) * 700 * dt; }
      }

      // Friction: a little proportional drag plus a constant rolling resistance
      const speed0 = Math.hypot(ball.vx, ball.vy);
      if (speed0 > 0) {
        const k = Math.exp(-(P.DRAG + extraDrag) * dt);
        let s = speed0 * k - P.ROLL * dt;
        if (s < 0) s = 0;
        ball.vx *= s / speed0; ball.vy *= s / speed0;
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Walls: the course, then any wall-like traps, then spinning rulers
      const bounce = ball.bounce ?? P.BOUNCE;
      for (const w of world.walls) collideSegment(ball, w, bounce, 0, 0);
      for (const t of world.traps) {
        const def = PG.traps.types[t.type];
        if (def.segments) for (const s of def.segments(t)) if (collideSegment(ball, s, bounce, 0, 0)) touch(ball, t);
        if (def.bumper && collideBumper(ball, t, def.bumper, bounce)) { touch(ball, t); t.hitAt = PG.now; }
        if (def.special) {
          const ev = def.special(ball, t, world);
          if (ev) { touch(ball, t); if (ev === "snip") return "snip"; }
        }
      }
      for (const m of world.movers || []) {
        const seg = P.moverSegment(m, world.t);
        // the ruler's speed where it touches the ball, so it can whack it
        const cx = (seg[0] + seg[2]) / 2, cy = (seg[1] + seg[3]) / 2;
        collideSegment(ball, seg, bounce, -(ball.y - cy) * m.speed, (ball.x - cx) * m.speed);
      }

      // The hole: slow enough and close enough means it drops in
      const hx = ball.x - world.hole.x, hy = ball.y - world.hole.y;
      const speed = Math.hypot(ball.vx, ball.vy);
      if (hx * hx + hy * hy < P.HOLE_R * P.HOLE_R && speed < P.SINK_SPEED) {
        ball.x = world.hole.x; ball.y = world.hole.y; ball.vx = ball.vy = 0;
        ball.sunk = true;
        return "sunk";
      }

      if (speed < P.STOP_SPEED) { ball.vx = ball.vy = 0; return "stopped"; }
      return null;
    },

    /** Where a spinning ruler is at time t: [x1, y1, x2, y2, thickness]. */
    moverSegment(m, t) {
      const a = m.angle0 + m.speed * t, c = Math.cos(a), s = Math.sin(a);
      return [m.x - c * m.len / 2, m.y - s * m.len / 2, m.x + c * m.len / 2, m.y + s * m.len / 2, 8];
    },

    /** Turn a drag (in px) into a shot velocity, pulling back like a slingshot. */
    shotFromDrag(dx, dy, club) {
      const len = Math.hypot(dx, dy);
      if (len < 4) return null;
      const power = Math.min(1, len / 190);
      const s = power * P.MAX_SPEED * ((club && club.power) || 1);
      return { vx: (-dx / len) * s, vy: (-dy / len) * s, power };
    },
  };

  function touch(ball, trap) { ball.touched[trap.owner] = true; }

  // Circle vs thick line segment: push the ball out and reflect its velocity.
  // (wx, wy) is the wall's own velocity at the contact (for spinning rulers).
  function collideSegment(ball, [x1, y1, x2, y2, thick = 3], bounce, wx, wy) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((ball.x - x1) * dx + (ball.y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + dx * t, cy = y1 + dy * t;
    let nx = ball.x - cx, ny = ball.y - cy;
    const d = Math.hypot(nx, ny);
    const r = P.BALL_R + thick;
    if (d >= r || d === 0) return false;
    nx /= d; ny /= d;
    ball.x = cx + nx * r; ball.y = cy + ny * r;
    const vn = (ball.vx - wx) * nx + (ball.vy - wy) * ny;
    if (vn < 0) {
      ball.vx -= (1 + bounce) * vn * nx;
      ball.vy -= (1 + bounce) * vn * ny;
    }
    return true;
  }

  // Round bouncy bumper (the spring trap): reflects and adds speed
  function collideBumper(ball, t, b, bounce) {
    let nx = ball.x - t.x, ny = ball.y - t.y;
    const d = Math.hypot(nx, ny), r = b.r + P.BALL_R;
    if (d >= r || d === 0) return false;
    nx /= d; ny /= d;
    ball.x = t.x + nx * r; ball.y = t.y + ny * r;
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) { ball.vx -= 2 * vn * nx; ball.vy -= 2 * vn * ny; }
    const s = Math.hypot(ball.vx, ball.vy);
    const extra = bounce > P.BOUNCE ? 1.2 : 1; // the rubber mallet makes springs even stronger
    const target = Math.max(s * b.boost, b.minSpeed) * extra;
    if (s > 0) { ball.vx *= target / s; ball.vy *= target / s; }
    else { ball.vx = nx * target; ball.vy = ny * target; }
    return true;
  }

  PG.physics = P;
})();
