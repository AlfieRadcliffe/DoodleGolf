/* ============================================================
   game.js: the game flow, input and drawing.

   Phases of a hole:
     trap-pick   a player chooses 1 of 3 dealt traps
     trap-place  ...and clicks to place it (R / right-click rotates)
     putt        the current player drags back from anywhere and lets go
     rolling     the ball moves until it stops or drops in
     hole-end    scores for the hole
   This version is pass-and-play on one device. Online play
   (milestones 4–5) will send the same actions over the network.
   ============================================================ */
(function () {
  const PG = window.PG;
  const S = PG.sketch, P = PG.physics, L = PG.levels, T = PG.traps;

  const COLORS = ["#2b59c3", "#d63b3b", "#1f8a4c", "#7a3cc2", "#e07a1f", "#d64ba1"];
  const COLOR_NAMES = ["blue", "red", "green", "purple", "orange", "pink"];
  const MAX_STROKES = 4;
  const WIN_SCORE = 15;

  const canvas = document.getElementById("course");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  const g = {
    phase: "setup",
    players: [],
    holeIndex: 0,
    world: null,
    balls: [],
    trapQueue: [],
    trapper: -1,
    hand: [],
    placing: null,
    turnOrder: [],
    turn: 0,
    drag: null,
    pointer: null,
    lastHole: null,
  };

  /* ---------------- Game flow ---------------- */

  function startGame(names) {
    g.players = names.map((name, i) => ({ name, color: COLORS[i], score: 0 }));
    g.holeIndex = 0;
    startHole();
  }

  function startHole() {
    g.world = L.world(g.holeIndex);
    g.balls = g.players.map((p, i) => ({
      player: i, x: g.world.tee.x, y: g.world.tee.y, vx: 0, vy: 0,
      sunk: false, strokes: 0, done: false, touched: {},
    }));
    // A different player goes first each hole
    const n = g.players.length, first = g.holeIndex % n;
    g.trapQueue = g.players.map((_, i) => (first + i) % n);
    g.turnOrder = g.trapQueue.slice();
    show(null);
    toast(`Hole ${g.holeIndex + 1}: ${g.world.name}`);
    nextTrapper();
  }

  function nextTrapper() {
    if (!g.trapQueue.length) return startPutting();
    g.trapper = g.trapQueue.shift();
    g.hand = T.deal(3, Math.random);
    g.phase = "trap-pick";
    showCards();
    hud();
  }

  function pickTrap(type) {
    g.placing = { type, angle: 0, owner: g.trapper, seed: 1 + Math.floor(Math.random() * 9999) };
    g.phase = "trap-place";
    show(null);
    const p = g.players[g.trapper];
    status(`<b style="color:${p.color}">${esc(p.name)}</b>: click the page to place your <b>${T.types[type].name.toLowerCase()}</b>` +
      (type === "eraser" ? " · press <kbd>R</kbd> or right-click to rotate" : ""));
  }

  function placeTrap(x, y) {
    if (!L.canPlace(g.world, g.placing.type, x, y)) { toast("Can't put it there!", 900); return; }
    g.world.traps.push({ ...g.placing, x, y });
    g.placing = null;
    nextTrapper();
  }

  function startPutting() {
    g.phase = "putt";
    g.turn = 0;
    toast("Traps set. Tee off!");
    beginTurn();
  }

  const current = () => g.balls[g.turnOrder[g.turn]];

  function beginTurn() {
    const b = current(), p = g.players[b.player];
    g.phase = "putt";
    status(`<b style="color:${p.color}">${esc(p.name)}</b>'s shot · stroke ${b.strokes + 1} of ${MAX_STROKES} · drag back from anywhere and let go`);
    hud();
  }

  function shoot(shot) {
    const b = current();
    b.vx = shot.vx; b.vy = shot.vy;
    b.strokes++;
    g.phase = "rolling";
    status(`<b style="color:${g.players[b.player].color}">${esc(g.players[b.player].name)}</b> putts…`);
    hud();
  }

  function endShot() {
    const b = current(), p = g.players[b.player];
    if (b.sunk) { b.done = true; toast(`${p.name} sinks it in ${b.strokes}!`); }
    else if (b.strokes >= MAX_STROKES) { b.done = true; toast(`${p.name} is out of strokes`); }
    // Next player who still has strokes left
    const n = g.turnOrder.length;
    for (let k = 1; k <= n; k++) {
      const i = (g.turn + k) % n;
      if (!g.balls[g.turnOrder[i]].done) { g.turn = i; return beginTurn(); }
    }
    endHole();
  }

  function endHole() {
    g.phase = "hole-end";
    const n = g.players.length;
    const sinkers = g.balls.filter((b) => b.sunk);
    const tooEasy = sinkers.length === n;
    const gained = g.players.map(() => ({ sink: 0, trap: 0 }));
    if (!tooEasy) for (const b of sinkers) gained[b.player].sink = 3 + (MAX_STROKES - b.strokes);
    // Trap bonus: +1 to a trap's owner for each other player it touched who then missed
    for (const b of g.balls) {
      if (b.sunk) continue;
      for (const owner of Object.keys(b.touched)) if (+owner !== b.player) gained[owner].trap += 1;
    }
    g.players.forEach((p, i) => (p.score += gained[i].sink + gained[i].trap));
    g.lastHole = { gained, tooEasy };
    showScores();
    hud();
  }

  function nextHole() {
    g.holeIndex++;
    const someoneWon = g.players.some((p) => p.score >= WIN_SCORE);
    if (someoneWon || g.holeIndex >= L.holes.length) return gameOver();
    startHole();
  }

  function gameOver() {
    g.phase = "game-over";
    const best = Math.max(...g.players.map((p) => p.score));
    const winners = g.players.filter((p) => p.score === best);
    $("win-title").textContent = winners.length > 1 ? "It's a tie!" : `${winners[0].name} wins!`;
    $("win-sub").textContent = winners.length > 1 ? winners.map((w) => w.name).join(" & ") + ` with ${best} points` : `with ${best} points`;
    $("win-table").innerHTML = scoreRows(g.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score), false);
    show("panel-win");
    status("Game over");
  }

  /* ---------------- UI panels ---------------- */

  function show(id) {
    ["panel-setup", "panel-cards", "panel-scores", "panel-win"].forEach((p) => ($(p).hidden = p !== id));
  }

  let toastTimer = null;
  function toast(msg, ms = 1600) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
  }

  function status(html) { $("status").innerHTML = html; }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function hud() {
    $("hole-name").textContent = g.world ? `hole ${g.holeIndex + 1} of ${L.holes.length}: ${g.world.name}` : "";
    const active = g.phase === "putt" || g.phase === "rolling" ? current().player : g.phase.startsWith("trap") ? g.trapper : -1;
    $("players").innerHTML = g.players.map((p, i) => {
      const b = g.balls[i];
      const state = !b ? "" : b.sunk ? "⛳ in!" : b.done ? "✗" : b.strokes ? `${b.strokes}/${MAX_STROKES}` : "";
      return `<li class="${i === active ? "active" : ""}"><span class="dot" style="background:${p.color}"></span>` +
        `<span class="nm">${esc(p.name)}</span><span class="st">${state}</span><b>${p.score}</b></li>`;
    }).join("");
  }

  function showCards() {
    const p = g.players[g.trapper];
    $("cards-title").innerHTML = `<span style="color:${p.color}">${esc(p.name)}</span>, pick a trap`;
    const box = $("cards");
    box.innerHTML = "";
    g.hand.forEach((type, i) => {
      const def = T.types[type];
      const b = document.createElement("button");
      b.className = "card";
      b.style.setProperty("--tilt", [-3, 1.5, -1][i] + "deg");
      const c = document.createElement("canvas");
      c.width = 150; c.height = 110;
      drawIcon(c, type);
      b.append(c);
      b.insertAdjacentHTML("beforeend", `<b>${def.name}</b><small>${def.desc}</small>`);
      b.onclick = () => pickTrap(type);
      box.append(b);
    });
    status(`<b style="color:${p.color}">${esc(p.name)}</b> is choosing a trap… (everyone else, no peeking)`);
    show("panel-cards");
  }

  function drawIcon(c, type) {
    const x = c.getContext("2d");
    const scale = { coffee: 0.75, sharpener: 0.55 }[type] || 0.95;
    x.translate(c.width / 2, c.height / 2); x.scale(scale, scale);
    T.types[type].draw(x, { type, x: 0, y: 0, angle: 0, seed: 7 });
  }

  function scoreRows(list, withGained) {
    return list.map(({ p, i }) => {
      const gn = withGained && g.lastHole.gained[i];
      const parts = gn ? [gn.sink && `+${gn.sink} sunk`, gn.trap && `+${gn.trap} traps`].filter(Boolean).join(", ") || "–" : "";
      return `<tr><td><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</td>` +
        (withGained ? `<td class="gain">${parts}</td>` : "") + `<td class="pts">${p.score}</td></tr>`;
    }).join("");
  }

  function showScores() {
    $("scores-title").textContent = g.lastHole.tooEasy ? "Too easy! Everyone sank it, so no sink points" : `Hole ${g.holeIndex + 1} done`;
    $("scores-table").innerHTML = scoreRows(g.players.map((p, i) => ({ p, i })), true);
    const last = g.holeIndex + 1 >= L.holes.length || g.players.some((p) => p.score >= WIN_SCORE);
    $("next-hole").textContent = last ? "see who won →" : "next hole →";
    show("panel-scores");
    status("Scores");
  }

  /* ---------------- Setup screen ---------------- */

  function buildSetup(count) {
    const box = $("names");
    const old = [...box.querySelectorAll("input")].map((i) => i.value);
    box.innerHTML = "";
    for (let i = 0; i < count; i++) {
      box.insertAdjacentHTML("beforeend",
        `<label><span class="dot" style="background:${COLORS[i]}"></span>` +
        `<input maxlength="14" value="${esc(old[i] || "")}" placeholder="${COLOR_NAMES[i]} player"></label>`);
    }
    document.querySelectorAll("#count button").forEach((b) => b.classList.toggle("on", +b.textContent === count));
  }
  document.querySelectorAll("#count button").forEach((b) => (b.onclick = () => buildSetup(+b.textContent)));
  $("start").onclick = () => {
    const names = [...$("names").querySelectorAll("input")].map((inp, i) => inp.value.trim() || `${COLOR_NAMES[i][0].toUpperCase()}${COLOR_NAMES[i].slice(1)}`);
    startGame(names);
  };
  $("next-hole").onclick = nextHole;
  $("again").onclick = () => { g.phase = "setup"; g.world = null; g.players.forEach((p) => (p.score = 0)); show("panel-setup"); status("Set up a new game"); hud(); };
  buildSetup(2);

  /* ---------------- Input ---------------- */

  function toCourse(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
  }
  canvas.addEventListener("pointermove", (e) => { g.pointer = toCourse(e); });
  canvas.addEventListener("pointerleave", () => { if (!g.drag) g.pointer = null; });
  canvas.addEventListener("pointerdown", (e) => {
    const pt = toCourse(e);
    g.pointer = pt;
    if (g.phase === "trap-place") {
      if (e.button === 2) return rotatePlacing();
      return placeTrap(pt.x, pt.y);
    }
    if (g.phase === "putt") {
      g.drag = { x0: pt.x, y0: pt.y };
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!g.drag || g.phase !== "putt") { g.drag = null; return; }
    const pt = toCourse(e);
    const shot = P.shotFromDrag(pt.x - g.drag.x0, pt.y - g.drag.y0);
    g.drag = null;
    if (shot) shoot(shot);
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  addEventListener("keydown", (e) => {
    if ((e.key === "r" || e.key === "R") && g.phase === "trap-place") rotatePlacing();
    if (e.key === "Escape") g.drag = null;
  });
  function rotatePlacing() { if (g.placing) g.placing.angle = (g.placing.angle + Math.PI / 6) % Math.PI; }

  /* ---------------- Drawing ---------------- */

  function draw(now) {
    S.tick(now);
    S.paper(ctx, canvas.width, canvas.height);
    if (!g.world) { drawTitlePage(); return; }
    const w = g.world;

    for (const [x1, y1, x2, y2] of w.walls) S.line(ctx, x1, y1, x2, y2, { width: 5.5, seed: x1 * 3 + y1 * 7 + x2 + y2 });

    // tee
    S.line(ctx, w.tee.x - 8, w.tee.y - 8, w.tee.x + 8, w.tee.y + 8, { width: 2.5, seed: 11 });
    S.line(ctx, w.tee.x + 8, w.tee.y - 8, w.tee.x - 8, w.tee.y + 8, { width: 2.5, seed: 12 });
    S.text(ctx, "tee", w.tee.x, w.tee.y + 26, { size: 20, color: "#5d5960", tilt: -4 });

    // traps, each labelled with its owner's initial in their pen colour
    for (const t of w.traps) {
      T.types[t.type].draw(ctx, t);
      const o = g.players[t.owner];
      S.text(ctx, o.name.slice(0, 10), t.x, t.y + T.types[t.type].size * 0.8 + 12, { size: 17, color: o.color, tilt: -3 });
    }

    // hole + flag
    const h = w.hole;
    S.circle(ctx, h.x, h.y, P.HOLE_R, { fill: "#262123", width: 2.5, seed: 21, wobble: 0.08 });
    S.line(ctx, h.x, h.y, h.x, h.y - 64, { width: 3, seed: 22 });
    S.poly(ctx, [[h.x, h.y - 64], [h.x + 36, h.y - 53], [h.x, h.y - 42]], { fill: "#ff8f8f", width: 2.5, seed: 23 });
    S.text(ctx, String(g.holeIndex + 1), h.x + 12, h.y - 53, { size: 16 });

    // ghost of the trap being placed
    if (g.phase === "trap-place" && g.pointer) {
      const t = { ...g.placing, x: g.pointer.x, y: g.pointer.y };
      const ok = L.canPlace(w, t.type, t.x, t.y);
      ctx.save(); ctx.globalAlpha = ok ? 0.6 : 0.3; T.types[t.type].draw(ctx, t); ctx.restore();
      if (!ok) {
        S.line(ctx, t.x - 16, t.y - 16, t.x + 16, t.y + 16, { color: "#d63b3b", width: 4, seed: 31 });
        S.line(ctx, t.x + 16, t.y - 16, t.x - 16, t.y + 16, { color: "#d63b3b", width: 4, seed: 32 });
      }
    }

    // balls: everyone still playing; the current player's ball on top
    const showBalls = g.phase === "putt" || g.phase === "rolling" || g.phase === "hole-end";
    if (showBalls) {
      const cur = g.phase === "hole-end" ? null : current();
      for (const b of g.balls) if (b !== cur && !b.sunk) drawBall(b, false);
      if (cur && !cur.sunk) drawBall(cur, true);
    }

    // aiming
    if (g.phase === "putt" && g.drag && g.pointer) {
      const b = current(), col = g.players[b.player].color;
      const shot = P.shotFromDrag(g.pointer.x - g.drag.x0, g.pointer.y - g.drag.y0);
      S.line(ctx, g.drag.x0, g.drag.y0, g.pointer.x, g.pointer.y, { width: 1.5, alpha: 0.35, passes: 1, seed: 41 });
      if (shot) {
        const len = 30 + shot.power * 150, sp = Math.hypot(shot.vx, shot.vy);
        const ux = shot.vx / sp, uy = shot.vy / sp;
        for (let d = 16; d < len; d += 16) S.line(ctx, b.x + ux * d, b.y + uy * d, b.x + ux * (d + 8), b.y + uy * (d + 8), { color: col, width: 3, passes: 1, seed: d });
        const ex = b.x + ux * len, ey = b.y + uy * len;
        S.line(ctx, ex, ey, ex - ux * 12 - uy * 8, ey - uy * 12 + ux * 8, { color: col, width: 3, seed: 51 });
        S.line(ctx, ex, ey, ex - ux * 12 + uy * 8, ey - uy * 12 - ux * 8, { color: col, width: 3, seed: 52 });
        S.text(ctx, Math.round(shot.power * 100) + "%", ex + ux * 22, ey + uy * 22, { size: 20, color: col });
      }
    }
  }

  function drawBall(b, isCurrent) {
    const col = g.players[b.player].color;
    S.circle(ctx, b.x, b.y, P.BALL_R, { fill: "#fffefa", color: col, width: 3, seed: 60 + b.player });
    S.hatch(ctx, (c) => c.arc(b.x, b.y, P.BALL_R - 2, 0, Math.PI * 2), [b.x - 12, b.y - 12, b.x + 12, b.y + 12], { color: col, gap: 5, alpha: 0.5 });
    if (isCurrent && g.phase === "putt") {
      S.text(ctx, g.players[b.player].name.slice(0, 10), b.x, b.y - 26, { size: 19, color: col, tilt: -3 });
    }
  }

  function drawTitlePage() {
    S.text(ctx, "Pen Golf", 520, 150, { size: 96, font: "'Rock Salt', cursive", weight: 400, tilt: -4 });
    S.text(ctx, "mini golf on your notebook, with traps for your friends", 520, 238, { size: 30, color: "#5d5960" });
    const t = performance.now() / 1000;
    const bx = 340 + ((t * 120) % 360);
    S.circle(ctx, 720, 470, P.HOLE_R, { fill: "#262123", seed: 3 });
    S.line(ctx, 720, 470, 720, 406, { width: 3, seed: 4 });
    S.poly(ctx, [[720, 406], [756, 417], [720, 428]], { fill: "#ff8f8f", width: 2.5, seed: 5 });
    S.circle(ctx, bx, 470, P.BALL_R, { fill: "#fffefa", color: "#2b59c3", width: 3, seed: 6 });
  }

  /* ---------------- Main loop ---------------- */

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    if (g.phase === "rolling") {
      while (acc >= P.DT && g.phase === "rolling") {
        acc -= P.DT;
        const ev = P.step(current(), g.world);
        if (ev === "sunk" || ev === "stopped") { hud(); endShot(); }
      }
    } else acc = 0;
    draw(now);
    requestAnimationFrame(frame);
  }
  status("Set up a new game");
  requestAnimationFrame(frame);

  // ?demo sets up a mid-game scene (used for screenshots)
  if (/[?&]demo\b/.test(location.search)) {
    startGame(["Alfie", "Sam", "Jo"]);
    g.holeIndex = 1; g.world = L.world(1);
    g.world.traps = [
      { type: "ink", x: 500, y: 170, owner: 1, seed: 3, angle: 0 },
      { type: "spring", x: 500, y: 470, owner: 2, seed: 4, angle: 0 },
      { type: "coffee", x: 820, y: 330, owner: 0, seed: 5, angle: 0 },
    ];
    g.balls = g.players.map((p, i) => ({ player: i, x: [470, 250, 760][i], y: [300, 470, 470][i], vx: 0, vy: 0, sunk: false, strokes: [1, 2, 1][i], done: false, touched: {} }));
    g.turnOrder = [0, 1, 2]; g.turn = 0;
    show(null); beginTurn();
    g.drag = { x0: 560, y0: 330 }; g.pointer = { x: 640, y: 420 };
  }

  // Exposed for debugging in the browser console
  PG.game = g;
})();
