/* ============================================================
   game.js: the game flow, input and drawing.

   Flow: setup → character creator (one per player) → holes.
   Phases of a hole:
     trap-pick   a player chooses 1 of 3 dealt traps
     trap-place  ...and clicks to place it (R / right-click rotates)
     putt        the current player drags back from anywhere
     swing       their golfer swings the club (a few choppy frames)
     rolling     the ball moves until it stops or drops in
     hole-end    scores for the hole
   This version is pass-and-play on one device. Online play will
   send the same actions over the network.
   ============================================================ */
(function () {
  const PG = window.PG;
  const S = PG.sketch, P = PG.physics, L = PG.levels, T = PG.traps, C = PG.character, CLUBS = PG.clubs.list;

  const COLORS = ["#2b59c3", "#d63b3b", "#1f8a4c", "#7a3cc2", "#e07a1f", "#d64ba1"];
  const COLOR_NAMES = ["blue", "red", "green", "purple", "orange", "pink"];
  const MAX_STROKES = 4;
  const WIN_SCORE = 15;
  const SWING = { back: 150, hit: 270, done: 560 }; // ms timings of the swing animation
  const RARITY_LABEL = { common: "common", uncommon: "uncommon", rare: "★ rare" };

  const canvas = document.getElementById("course");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);

  const g = {
    phase: "setup",
    players: [],
    holeCount: 5,
    holeList: [],
    holeNo: 0,
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
    swing: null,
    creating: 0,
    lastHole: null,
  };

  /* ---------------- Game flow ---------------- */

  function startCreator(names) {
    g.players = names.map((name, i) => ({ name, color: COLORS[i], score: 0, look: C.randomLook() }));
    g.creating = 0;
    showCreator();
  }

  function startGame() {
    g.holeList = L.pick(g.holeCount);
    g.holeNo = 0;
    g.players.forEach((p) => (p.score = 0));
    startHole();
  }

  function startHole() {
    g.world = L.world(g.holeList[g.holeNo]);
    g.balls = g.players.map((p, i) => ({
      player: i, x: g.world.tee.x, y: g.world.tee.y, vx: 0, vy: 0,
      sunk: false, strokes: 0, done: false, touched: {},
    }));
    // A different player goes first each hole
    const n = g.players.length, first = g.holeNo % n;
    g.trapQueue = g.players.map((_, i) => (first + i) % n);
    g.turnOrder = g.trapQueue.slice();
    g.swing = null;
    show(null);
    toast(`Hole ${g.holeNo + 1}: ${g.world.name}`);
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
      (T.types[type].rotates ? " · <kbd>R</kbd> or right-click to rotate" : ""));
  }

  function placeTrap(x, y) {
    const trap = { ...g.placing, x, y };
    if (!L.canPlace(g.world, trap)) { toast("Can't put it there!", 900); return; }
    g.world.traps.push(trap);
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
  const clubOf = (b) => CLUBS[g.players[b.player].look.club];

  function beginTurn() {
    const b = current(), p = g.players[b.player];
    g.phase = "putt";
    g.swing = null;
    status(`<b style="color:${p.color}">${esc(p.name)}</b>'s shot · stroke ${b.strokes + 1} of ${MAX_STROKES} · ${clubOf(b).name.toLowerCase()} · drag back from anywhere and let go`);
    hud();
  }

  function shoot(shot) {
    const b = current(), club = clubOf(b);
    // Pencil driver: the aim wobbles a little
    if (club.wobble) {
      const a = ((Math.random() * 2 - 1) * club.wobble * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      shot = { ...shot, vx: shot.vx * c - shot.vy * s, vy: shot.vx * s + shot.vy * c };
    }
    g.phase = "swing";
    g.swing = { start: performance.now(), shot, facing: shot.vx >= 0 ? 1 : -1, x: b.x, y: b.y, launched: false };
    status(`<b style="color:${g.players[b.player].color}">${esc(g.players[b.player].name)}</b> swings…`);
  }

  function launch() {
    const b = current(), club = clubOf(b), shot = g.swing.shot;
    b.vx = shot.vx; b.vy = shot.vy;
    b.bounce = club.bounce; b.inkProof = !!club.inkProof; b.magnet = !!club.magnet;
    b.strokes++;
    g.swing.launched = true;
    g.phase = "rolling";
    hud();
  }

  function endShot() {
    const b = current(), p = g.players[b.player];
    if (b.sunk) { b.done = true; toast(`${p.name} sinks it in ${b.strokes}!`); }
    else if (b.strokes >= MAX_STROKES) { b.done = true; toast(`${p.name} is out of strokes`); }
    const n = g.turnOrder.length;
    for (let k = 1; k <= n; k++) {
      const i = (g.turn + k) % n;
      if (!g.balls[g.turnOrder[i]].done) { g.turn = i; return beginTurn(); }
    }
    endHole();
  }

  function endHole() {
    g.phase = "hole-end";
    g.swing = null;
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
    g.holeNo++;
    const someoneWon = g.players.some((p) => p.score >= WIN_SCORE);
    if (someoneWon || g.holeNo >= g.holeList.length) return gameOver();
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
    portraits();
  }

  /* ---------------- UI panels ---------------- */

  function show(id) {
    ["panel-setup", "panel-create", "panel-cards", "panel-scores", "panel-win"].forEach((p) => ($(p).hidden = p !== id));
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
    $("hole-name").textContent = g.world ? `hole ${g.holeNo + 1} of ${g.holeList.length}: ${g.world.name}` : "";
    const active = g.phase === "putt" || g.phase === "rolling" || g.phase === "swing" ? current().player
      : g.phase.startsWith("trap") ? g.trapper : g.phase === "create" ? g.creating : -1;
    $("players").innerHTML = g.players.map((p, i) => {
      const b = g.balls[i];
      const state = !b || !g.world ? "" : b.sunk ? "⛳ in!" : b.done ? "✗" : b.strokes ? `${b.strokes}/${MAX_STROKES}` : "";
      return `<li class="${i === active ? "active" : ""}"><canvas class="face" width="44" height="44" data-i="${i}"></canvas>` +
        `<span class="nm" style="color:${p.color}">${esc(p.name)}</span><span class="st">${state}</span><b>${p.score}</b></li>`;
    }).join("");
    portraits();
  }

  function portraits() {
    document.querySelectorAll("canvas.face[data-i]").forEach((c) => {
      const p = g.players[+c.dataset.i], x = c.getContext("2d");
      x.clearRect(0, 0, c.width, c.height);
      C.drawPortrait(x, 22, 25, p.look, p.color, 0.95);
    });
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
      b.insertAdjacentHTML("beforeend", `<span class="rarity ${def.rarity}">${RARITY_LABEL[def.rarity]}</span><b>${def.name}</b><small>${def.desc}</small>`);
      b.onclick = () => pickTrap(type);
      box.append(b);
    });
    status(`<b style="color:${p.color}">${esc(p.name)}</b> is choosing a trap… (everyone else, no peeking)`);
    show("panel-cards");
  }

  function drawIcon(c, type) {
    const x = c.getContext("2d");
    const scale = { coffee: 0.75, sharpener: 0.55, ruler: 0.6, holepunch: 0.42, highlighter: 0.8 }[type] || 0.95;
    x.translate(c.width / 2, c.height / 2); x.scale(scale, scale);
    const t = { type, x: 0, y: 0, angle: type === "holepunch" ? 0 : 0, seed: 7 };
    if (type === "holepunch") t.x = -115;
    T.types[type].draw(x, t);
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
    $("scores-title").textContent = g.lastHole.tooEasy ? "Too easy! Everyone sank it, so no sink points" : `Hole ${g.holeNo + 1} done`;
    $("scores-table").innerHTML = scoreRows(g.players.map((p, i) => ({ p, i })), true);
    const last = g.holeNo + 1 >= g.holeList.length || g.players.some((p) => p.score >= WIN_SCORE);
    $("next-hole").textContent = last ? "see who won →" : "next hole →";
    show("panel-scores");
    status("Scores");
  }

  /* ---------------- Character creator ---------------- */

  const ROWS = [
    { key: "hair", label: "hair / hat", options: () => C.PARTS.hair },
    { key: "face", label: "face", options: () => C.PARTS.face },
    { key: "shirt", label: "shirt", options: () => C.PARTS.shirt },
    { key: "trousers", label: "trousers", options: () => C.PARTS.trousers },
    { key: "club", label: "club", options: () => CLUBS.map((c) => c.name) },
  ];

  function showCreator() {
    g.phase = "create";
    g.world = null;
    const p = g.players[g.creating];
    $("create-title").innerHTML = `<span style="color:${p.color}">${esc(p.name)}</span>, make your golfer`;
    $("create-step").textContent = `player ${g.creating + 1} of ${g.players.length}`;
    $("create-done").textContent = g.creating + 1 < g.players.length ? "next player →" : "let's play →";
    renderCreatorRows();
    show("panel-create");
    status("Use the arrows to dress up your golfer, then pick a club");
    hud();
  }

  function renderCreatorRows() {
    const p = g.players[g.creating];
    $("create-rows").innerHTML = ROWS.map((r, i) => {
      const opts = r.options();
      return `<div class="row"><span class="lbl">${r.label}</span>` +
        `<button class="arrow" data-row="${i}" data-d="-1" aria-label="previous ${r.label}">◀</button>` +
        `<span class="val">${esc(opts[p.look[r.key]])}</span>` +
        `<button class="arrow" data-row="${i}" data-d="1" aria-label="next ${r.label}">▶</button></div>`;
    }).join("") + `<p class="club-desc">${esc(CLUBS[p.look.club].desc)}</p>`;
    $("create-rows").querySelectorAll(".arrow").forEach((b) => (b.onclick = () => {
      const r = ROWS[+b.dataset.row], n = r.options().length;
      p.look[r.key] = (p.look[r.key] + +b.dataset.d + n) % n;
      renderCreatorRows();
      hud();
    }));
  }

  function drawPreview(now) {
    const c = $("preview"), x = c.getContext("2d");
    S.paper(x, c.width, c.height);
    const p = g.players[g.creating];
    const bob = Math.floor(now / 400) % 2 ? -2 : 0;          // a slow, choppy idle bounce
    const sway = Math.floor(now / 600) % 2 ? 0.25 : 0.4;     // and a little club waggle
    S.line(x, 40, 222, 200, 222, { width: 2, alpha: 0.6, seed: 5 });
    C.drawCharacter(x, 120, 220, p.look, { color: p.color, scale: 2, bob, clubAngle: sway });
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
  document.querySelectorAll("#holes button").forEach((b) => (b.onclick = () => {
    g.holeCount = +b.textContent;
    document.querySelectorAll("#holes button").forEach((x) => x.classList.toggle("on", x === b));
  }));
  $("start").onclick = () => {
    const names = [...$("names").querySelectorAll("input")].map((inp, i) => inp.value.trim() || `${COLOR_NAMES[i][0].toUpperCase()}${COLOR_NAMES[i].slice(1)}`);
    startCreator(names);
  };
  $("create-random").onclick = () => { g.players[g.creating].look = C.randomLook(); renderCreatorRows(); hud(); };
  $("create-done").onclick = () => {
    g.creating++;
    if (g.creating < g.players.length) showCreator(); else startGame();
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
    const shot = P.shotFromDrag(pt.x - g.drag.x0, pt.y - g.drag.y0, clubOf(current()));
    g.drag = null;
    if (shot) shoot(shot);
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  addEventListener("keydown", (e) => {
    if ((e.key === "r" || e.key === "R") && g.phase === "trap-place") rotatePlacing();
    if (e.key === "Escape") g.drag = null;
  });
  function rotatePlacing() {
    if (g.placing && T.types[g.placing.type].rotates) g.placing.angle = (g.placing.angle + Math.PI / 6) % (Math.PI * 2);
  }

  /* ---------------- Drawing ---------------- */

  function draw(now) {
    S.tick(now);
    S.paper(ctx, canvas.width, canvas.height);
    if (g.phase === "create") drawPreview(now);
    if (!g.world) { drawTitlePage(now); return; }
    const w = g.world;

    for (const [x1, y1, x2, y2] of w.walls) S.line(ctx, x1, y1, x2, y2, { width: 5.5, seed: x1 * 3 + y1 * 7 + x2 + y2 });

    // spinning rulers, on a drawing pin
    for (const m of w.movers) {
      const [x1, y1, x2, y2] = P.moverSegment(m, w.t);
      const a = Math.atan2(y2 - y1, x2 - x1);
      T.types.ruler.draw(ctx, { x: m.x, y: m.y, angle: a, seed: 900 + m.x });
      S.circle(ctx, m.x, m.y, 7, { fill: "#d63b3b", width: 2, seed: 901 });
    }

    // tee
    S.line(ctx, w.tee.x - 8, w.tee.y - 8, w.tee.x + 8, w.tee.y + 8, { width: 2.5, seed: 11 });
    S.line(ctx, w.tee.x + 8, w.tee.y - 8, w.tee.x - 8, w.tee.y + 8, { width: 2.5, seed: 12 });
    S.text(ctx, "tee", w.tee.x, w.tee.y + 26, { size: 20, color: "#5d5960", tilt: -4 });

    // traps, each labelled with its owner's name in their pen colour
    for (const t of w.traps) {
      T.types[t.type].draw(ctx, t);
      const o = g.players[t.owner], fp = T.footprint(t), lowest = fp.reduce((a, c) => (c[1] + c[2] > a[1] + a[2] ? c : a));
      S.text(ctx, o.name.slice(0, 10), lowest[0], lowest[1] + lowest[2] + 12, { size: 17, color: o.color, tilt: -3 });
    }

    // hole + flag (the flag flaps between two drawings)
    const h = w.hole, flap = Math.floor(now / 500) % 2 ? 4 : 0;
    S.circle(ctx, h.x, h.y, P.HOLE_R, { fill: "#262123", width: 2.5, seed: 21, wobble: 0.08 });
    S.line(ctx, h.x, h.y, h.x, h.y - 64, { width: 3, seed: 22 });
    S.poly(ctx, [[h.x, h.y - 64], [h.x + 36, h.y - 53 + flap], [h.x, h.y - 42]], { fill: "#ff8f8f", width: 2.5, seed: 23 });
    S.text(ctx, String(g.holeNo + 1), h.x + 12, h.y - 53 + flap / 2, { size: 16 });

    // ghost of the trap being placed
    if (g.phase === "trap-place" && g.pointer) {
      const t = { ...g.placing, x: g.pointer.x, y: g.pointer.y };
      const ok = L.canPlace(w, t);
      ctx.save(); ctx.globalAlpha = ok ? 0.6 : 0.3; T.types[t.type].draw(ctx, t); ctx.restore();
      if (!ok) {
        S.line(ctx, t.x - 16, t.y - 16, t.x + 16, t.y + 16, { color: "#d63b3b", width: 4, seed: 31 });
        S.line(ctx, t.x + 16, t.y - 16, t.x - 16, t.y + 16, { color: "#d63b3b", width: 4, seed: 32 });
      }
    }

    // balls: everyone still playing; the current player's ball on top
    const playing = ["putt", "swing", "rolling", "hole-end"].includes(g.phase);
    if (playing) {
      const cur = g.phase === "hole-end" ? null : current();
      for (const b of g.balls) if (b !== cur && !b.sunk) drawBall(b);
      drawGolfer(now);
      if (cur && !cur.sunk) drawBall(cur);
    }

    if (g.phase === "putt" && g.drag && g.pointer) drawAim();
  }

  /** The current player's golfer: aiming, swinging, or watching their shot. */
  function drawGolfer(now) {
    if (g.phase === "hole-end") return;
    const b = current(), p = g.players[b.player];
    let x, y, facing = 1, angle = 0.35;
    if (g.swing) {
      ({ x, y, facing } = g.swing);
      const t = now - g.swing.start;
      // Three drawings, held for a moment each: backswing → hit → follow-through
      angle = t < SWING.back ? -1.7 : t < SWING.hit ? 0.5 : t < SWING.done ? 2.3 : 0.4;
    } else {
      x = b.x; y = b.y;
      if (g.drag && g.pointer) {
        const shot = P.shotFromDrag(g.pointer.x - g.drag.x0, g.pointer.y - g.drag.y0, clubOf(b));
        if (shot) { facing = shot.vx >= 0 ? 1 : -1; angle = 0.5 - shot.power * 2.1; }
      }
    }
    // Stand beside the ball so the club head meets it
    const sc = 1.3;
    C.drawCharacter(ctx, x - 21 * sc * facing, y + 3 * sc, p.look, { color: p.color, facing, clubAngle: angle, scale: sc });
  }

  function drawAim() {
    const b = current(), col = g.players[b.player].color, club = clubOf(b);
    const shot = P.shotFromDrag(g.pointer.x - g.drag.x0, g.pointer.y - g.drag.y0, club);
    S.line(ctx, g.drag.x0, g.drag.y0, g.pointer.x, g.pointer.y, { width: 1.5, alpha: 0.35, passes: 1, seed: 41 });
    if (!shot) return;
    const len = 30 + shot.power * 150, sp = Math.hypot(shot.vx, shot.vy);
    const ux = shot.vx / sp, uy = shot.vy / sp;
    for (let d = 16; d < len; d += 16) S.line(ctx, b.x + ux * d, b.y + uy * d, b.x + ux * (d + 8), b.y + uy * (d + 8), { color: col, width: 3, passes: 1, seed: d });
    const ex = b.x + ux * len, ey = b.y + uy * len;
    S.line(ctx, ex, ey, ex - ux * 12 - uy * 8, ey - uy * 12 + ux * 8, { color: col, width: 3, seed: 51 });
    S.line(ctx, ex, ey, ex - ux * 12 + uy * 8, ey - uy * 12 - ux * 8, { color: col, width: 3, seed: 52 });
    S.text(ctx, Math.round(shot.power * 100) + "%", ex + ux * 22, ey + uy * 22, { size: 20, color: col });

    // Ruler ability: dotted pencil line showing where the ball will roll
    if (club.preview) {
      const ghost = { ...b, vx: shot.vx, vy: shot.vy, touched: {}, bounce: club.bounce, sunk: false };
      const world = { ...g.world, traps: g.world.traps.map((t) => ({ ...t })) };
      for (let i = 0; i < 110; i++) {
        const ev = P.step(ghost, world);
        if (i % 7 === 0) { ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ghost.x, ghost.y, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        if (ev) break;
      }
    }
  }

  function drawBall(b) {
    const col = g.players[b.player].color;
    S.circle(ctx, b.x, b.y, P.BALL_R, { fill: "#fffefa", color: col, width: 3, seed: 60 + b.player });
    S.hatch(ctx, (c) => c.arc(b.x, b.y, P.BALL_R - 2, 0, Math.PI * 2), [b.x - 12, b.y - 12, b.x + 12, b.y + 12], { color: col, gap: 5, alpha: 0.5 });
  }

  function drawTitlePage(now) {
    S.text(ctx, "Pen Golf", 520, 130, { size: 96, font: "'Rock Salt', cursive", weight: 400, tilt: -4 });
    S.text(ctx, "mini golf on your notebook, with traps for your friends", 520, 218, { size: 30, color: "#5d5960" });
    // a little golfer taking a swing every couple of seconds
    const t = (now % 2400);
    const angle = t < 900 ? 0.35 : t < 1100 ? -1.7 : t < 1250 ? 0.5 : 2.3;
    const flying = t >= 1250;
    const bx = flying ? 560 + Math.min(1, (t - 1250) / 900) * 160 : 560;
    S.circle(ctx, 720, 470, P.HOLE_R, { fill: "#262123", seed: 3 });
    S.line(ctx, 720, 470, 720, 406, { width: 3, seed: 4 });
    S.poly(ctx, [[720, 406], [756, 417], [720, 428]], { fill: "#ff8f8f", width: 2.5, seed: 5 });
    C.drawCharacter(ctx, 560 - 21 * 1.4, 470 + 4, { hair: 0, face: 1, shirt: 1, trousers: 2, club: 0 }, { color: "#2b59c3", clubAngle: angle, scale: 1.4 });
    if (bx < 712) S.circle(ctx, bx, 470, P.BALL_R, { fill: "#fffefa", color: "#2b59c3", width: 3, seed: 6 });
  }

  /* ---------------- Main loop ---------------- */

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    PG.now = now / 1000;
    if (g.phase === "swing" && now - g.swing.start >= SWING.back + 20) launch();
    if (g.phase === "rolling") {
      acc += dt;
      while (acc >= P.DT && g.phase === "rolling") {
        acc -= P.DT;
        const ev = P.step(current(), g.world);
        if (ev === "snip") { toast("Snip! Back to the tee", 1200); hud(); endShot(); }
        else if (ev === "sunk" || ev === "stopped") { hud(); endShot(); }
      }
    } else {
      acc = 0;
      if (g.world) g.world.t += dt; // keep the spinning rulers turning between shots
    }
    draw(now);
    requestAnimationFrame(frame);
  }
  status("Set up a new game");
  requestAnimationFrame(frame);

  // ?demo sets up a mid-game scene (used for screenshots)
  if (/[?&]demo\b/.test(location.search)) {
    g.players = ["Alfie", "Sam", "Jo"].map((name, i) => ({ name, color: COLORS[i], score: [4, 2, 5][i],
      look: [{ hair: 0, face: 5, shirt: 2, trousers: 2, club: 1 }, { hair: 4, face: 1, shirt: 1, trousers: 0, club: 2 }, { hair: 6, face: 4, shirt: 4, trousers: 3, club: 3 }][i] }));
    g.holeList = [2, 1, 0]; g.holeNo = 0; g.world = L.world(2);
    g.world.traps = [
      { type: "ink", x: 330, y: 140, owner: 1, seed: 3, angle: 0 },
      { type: "spring", x: 700, y: 470, owner: 2, seed: 4, angle: 0 },
      { type: "highlighter", x: 720, y: 160, owner: 0, seed: 5, angle: 0.4 },
      { type: "wall", x: 760, y: 330, owner: 2, seed: 6, angle: 1.6 },
    ];
    g.balls = g.players.map((p, i) => ({ player: i, x: [300, 250, 640][i], y: [330, 470, 420][i], vx: 0, vy: 0, sunk: false, strokes: [1, 2, 1][i], done: false, touched: {} }));
    g.turnOrder = [0, 1, 2]; g.turn = 0;
    show(null); beginTurn();
    g.drag = { x0: 400, y0: 330 }; g.pointer = { x: 330, y: 300 };
  }

  // Exposed for debugging in the browser console
  PG.game = g;
})();
