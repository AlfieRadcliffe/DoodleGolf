/* ============================================================
   clubs.js: each club is an ability. Players pick one in the
   character creator and keep it for the whole game.
     power      multiplies the maximum shot speed
     wobble     random aim error in degrees (pencil is wild)
     bounce     wall bounciness (default 0.72)
     inkProof   glides through ink blots and coffee rings
     magnet     the hole pulls the ball in when it's close
     preview    the aim line shows where the ball will roll
   ============================================================ */
(function () {
  const PG = (window.PG = window.PG || {});

  const list = [
    { id: "putter", name: "Trusty putter", desc: "No tricks. Steady and reliable.", power: 1 },
    { id: "ruler", name: "Ruler", desc: "Aim line shows where your ball will roll. A bit weaker.", power: 0.9, preview: true },
    { id: "pencil", name: "Pencil driver", desc: "+25% power, but your aim wobbles a little.", power: 1.25, wobble: 4 },
    { id: "highlighter", name: "Highlighter", desc: "Your ball glides straight through ink and coffee.", power: 1, inkProof: true },
    { id: "mallet", name: "Rubber mallet", desc: "Extra bouncy shots off walls and springs.", power: 1, bounce: 0.92 },
    { id: "magnet", name: "Paperclip magnet", desc: "The hole pulls your ball in when it's close.", power: 0.95, magnet: true },
  ];

  PG.clubs = { list };
})();
