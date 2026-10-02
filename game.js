/* PAC-MAN — remake fedele all'arcade originale (mappa 28x36, 8px/tile).
   Riferimenti: The Pac-Man Dossier; mappa e costanti da remake accurati open-source. */
(function () {
  'use strict';

  var TILE = 8, COLS = 28, ROWS = 36, W = COLS * TILE, H = ROWS * TILE;
  var BASE_SPEED = 75.757576; // px/s a velocita' piena

  // '|' '_' = muro, '.' = pallino, 'o' = power pellet, '-' = porta casa fantasmi, ' ' = vuoto
  var MAP = [
    '____________________________',
    '____________________________',
    '____________________________',
    '||||||||||||||||||||||||||||',
    '|............||............|',
    '|.||||.|||||.||.|||||.||||.|',
    '|o||||.|||||.||.|||||.||||o|',
    '|.||||.|||||.||.|||||.||||.|',
    '|..........................|',
    '|.||||.||.||||||||.||.||||.|',
    '|.||||.||.||||||||.||.||||.|',
    '|......||....||....||......|',
    '||||||.||||| || |||||.||||||',
    '_____|.||||| || |||||.|_____',
    '_____|.||          ||.|_____',
    '_____|.|| |||--||| ||.|_____',
    '||||||.|| |______| ||.||||||',
    '      .   |______|   .      ',
    '||||||.|| |______| ||.||||||',
    '_____|.|| |||||||| ||.|_____',
    '_____|.||          ||.|_____',
    '_____|.|| |||||||| ||.|_____',
    '||||||.|| |||||||| ||.||||||',
    '|............||............|',
    '|.||||.|||||.||.|||||.||||.|',
    '|.||||.|||||.||.|||||.||||.|',
    '|o..||.......  .......||..o|',
    '|||.||.||.||||||||.||.||.|||',
    '|||.||.||.||||||||.||.||.|||',
    '|......||....||....||......|',
    '|.||||||||||.||.||||||||||.|',
    '|.||||||||||.||.||||||||||.|',
    '|..........................|',
    '||||||||||||||||||||||||||||',
    '____________________________',
    '____________________________'
  ];

  // Direzioni (priorita' tie-break: su, sinistra, giu', destra)
  var UP = { dx: 0, dy: -1 }, LEFT = { dx: -1, dy: 0 },
      DOWN = { dx: 0, dy: 1 }, RIGHT = { dx: 1, dy: 0 };
  var DIR_ORDER = [UP, LEFT, DOWN, RIGHT];
  function sameDir(a, b) { return a.dx === b.dx && a.dy === b.dy; }
  function opp(d) {
    if (d.dx === 0 && d.dy === -1) return DOWN;
    if (d.dx === 0 && d.dy === 1) return UP;
    if (d.dx === -1 && d.dy === 0) return RIGHT;
    return LEFT;
  }
  function dirAngle(d) {
    return (d.dx === 1) ? 0 : (d.dy === 1) ? Math.PI / 2 : (d.dx === -1) ? Math.PI : -Math.PI / 2;
  }

  // Casa fantasmi (coordinate in px)
  var DOOR_X = 112, DOOR_FRONT_Y = 116, HOUSE_Y = 140;
  var SEAT = { pinky: 112, inky: 96, clyde: 128 };
  var PACE_MIN = 133, PACE_MAX = 147;

  // No-up tiles (i fantasmi non svoltano verso l'alto qui)
  var NO_UP = { '12,14': 1, '15,14': 1, '12,26': 1, '15,26': 1 };

  // ---- Stato labirinto ----
  var grid = [], dotsTotal = 0, dotsLeft = 0;

  function initGrid() {
    grid = [];
    dotsTotal = 0;
    for (var r = 0; r < ROWS; r++) {
      var row = MAP[r].split('');
      grid.push(row);
      for (var c = 0; c < COLS; c++) if (row[c] === '.' || row[c] === 'o') dotsTotal++;
    }
    dotsLeft = dotsTotal;
  }

  function tileAt(c, r) {
    if (r < 0 || r >= ROWS) return '#';
    if (c < 0 || c >= COLS) return r === 17 ? ' ' : '#';
    return grid[r][c];
  }
  function walkable(c, r) {
    var t = tileAt(c, r);
    return t === ' ' || t === '.' || t === 'o';
  }
  function isTunnel(x, r) {
    return r === 17 && (x < 48 || x > 176);
  }

  // ---- Canvas ----
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---- Audio (sintesi WebAudio, essenziale) ----
  var audio = (function () {
    var ac = null;
    function ctxA() {
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(freq, dur, type, vol, when) {
      var a = ctxA(); if (!a) return;
      var t = a.currentTime + (when || 0);
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + dur);
    }
    var wakaFlip = false;
    return {
      unlock: function () { ctxA(); },
      waka: function () { wakaFlip = !wakaFlip; tone(wakaFlip ? 500 : 350, 0.06, 'square', 0.03); },
      energizer: function () { tone(120, 0.3, 'square', 0.06); },
      eatGhost: function () {
        for (var i = 0; i < 6; i++) tone(600 - i * 70, 0.08, 'sawtooth', 0.05, i * 0.05);
      },
      fruit: function () { tone(700, 0.08, 'square', 0.06); tone(900, 0.1, 'square', 0.06, 0.09); },
      death: function () {
        for (var i = 0; i < 12; i++) tone(700 - i * 45, 0.1, 'sawtooth', 0.05, i * 0.09);
      },
      extraLife: function () {
        for (var i = 0; i < 8; i++) tone(880 + (i % 2) * 220, 0.08, 'square', 0.05, i * 0.08);
      },
      start: function () {
        var mel = [523, 784, 659, 784, 1047, 784, 659, 523, 587, 698, 587, 698];
        for (var i = 0; i < mel.length; i++) tone(mel[i], 0.11, 'square', 0.05, i * 0.14);
      }
    };
  })();

  // ---- Entita' ----
  var pac = { x: 0, y: 0, dir: LEFT, nextDir: LEFT, mouthPhase: 0, moving: false, eatPause: 0 };

  function makeGhost(id, color, cornerC, cornerR) {
    return {
      id: id, color: color,
      cornerC: cornerC, cornerR: cornerR,
      x: 0, y: 0, dir: LEFT, mode: 'house',
      scared: false, reverse: false,
      seatX: SEAT[id] || DOOR_X, paceDir: DOWN, elroy: 0
    };
  }
  var ghosts = [
    makeGhost('blinky', '#ff0000', 25, 0),
    makeGhost('pinky', '#ffb8ff', 2, 0),
    makeGhost('inky', '#00ffff', 27, 34),
    makeGhost('clyde', '#ffb852', 0, 34)
  ];

  function resetActors() {
    pac.x = 112; pac.y = 212; pac.dir = LEFT; pac.nextDir = LEFT;
    pac.mouthPhase = 0; pac.moving = false; pac.eatPause = 0;

    var starts = { blinky: [112, DOOR_FRONT_Y, 'outside', LEFT],
                   pinky: [SEAT.pinky, HOUSE_Y, 'house', UP],
                   inky: [SEAT.inky, HOUSE_Y, 'house', UP],
                   clyde: [SEAT.clyde, HOUSE_Y, 'house', DOWN] };
    ghosts.forEach(function (g) {
      var s = starts[g.id];
      g.x = s[0]; g.y = s[1]; g.mode = s[2]; g.dir = s[3];
      g.scared = false; g.reverse = false; g.paceDir = DOWN; g.elroy = 0;
    });
  }

  // ---- Stato gioco ----
  var ST = 'attract'; // attract | ready | playing | dying | levelclear | gameover
  var score = 0, highScore = parseInt(localStorage.getItem('pacman-hi') || '0', 10);
  var lives = 10, level = 1, eatenDots = 0;
  var globalTime = 0, readyTimer = 0, pauseFlag = false;
  var extraLifeGiven = false;

  // modalita' scatter/chase
  var modeIndex = 0, modeTimer = 0, modePhases = [];
  function setModePhases() {
    if (level === 1) modePhases = [7, 20, 7, 20, 5, 20, 5, Infinity];
    else if (level <= 4) modePhases = [7, 20, 7, 20, 5, 1033, 1 / 60, Infinity];
    else modePhases = [5, 20, 7, 20, 5, 1037, 1 / 60, Infinity];
    modeIndex = 0; modeTimer = 0;
  }
  function currentMode() { return modeIndex % 2 === 0 ? 'scatter' : 'chase'; }

  // fright
  var frightOn = false, frightTimer = 0, ghostChain = 0;
  function frightTimeForLevel(l) {
    var t = [6, 5, 4, 3, 2, 5, 2, 2, 2, 1, 5, 2, 1, 1, 1, 1, 1, 1, 1, 1];
    return t[Math.min(l - 1, t.length - 1)];
  }

  // velocita' in % della piena
  function pacPct(fright) {
    var n = fright ? [0.90, 0.95, 1.0] : [0.80, 0.90, 1.0];
    var i = level === 1 ? 0 : level <= 4 ? 1 : level <= 20 ? 2 : 1;
    return n[i];
  }
  function ghostPct() {
    return level === 1 ? 0.75 : level <= 4 ? 0.85 : 0.95;
  }
  function elroyThreshold() {
    var d1 = level === 1 ? 20 : level <= 4 ? 30 : 40;
    return d1;
  }

  // rilascio fantasmi
  var releaseTimer = 0;
  function releaseLimit(g) {
    if (g.id === 'pinky') return 0;
    if (g.id === 'inky') return level === 1 ? 30 : 0;
    return level === 1 ? 60 : level === 2 ? 50 : 0; // clyde
  }
  function updateReleases(dt) {
    releaseTimer += dt;
    var force = level < 5 ? 4 : 3;
    ghosts.forEach(function (g) {
      if (g.mode !== 'house') return;
      if (eatenDots >= releaseLimit(g) || releaseTimer >= force) {
        g.mode = 'leaving';
        releaseTimer = 0;
      }
    });
  }

  // frutta
  var fruitActive = false, fruitTimer = 0, fruitType = 0, fruitPopup = null, fruitPopupTimer = 0;
  var FRUIT_DEFS = [
    { name: 'cherry', pts: 100 }, { name: 'strawberry', pts: 300 },
    { name: 'orange', pts: 500 }, { name: 'apple', pts: 700 },
    { name: 'melon', pts: 1000 }, { name: 'galaxian', pts: 2000 },
    { name: 'bell', pts: 3000 }, { name: 'key', pts: 5000 }
  ];
  var fruitsCollected = [];
  function fruitForLevel(l) {
    return l === 1 ? 0 : l === 2 ? 1 : l <= 4 ? 2 : l <= 6 ? 3 : l <= 8 ? 4 : l <= 10 ? 5 : l <= 12 ? 6 : 7;
  }
  var FRUIT_X = 112, FRUIT_Y = 164;

  // popup punteggio fantasmi
  var ghostPopup = null, ghostPopupTimer = 0;

  // morte
  var deathPhase = 0, deathTimer = 0;

  // livello completato
  var clearTimer = 0;

  function addScore(n) {
    score += n;
    if (!extraLifeGiven && score >= 10000) {
      extraLifeGiven = true;
      if (lives < 5) lives++;
      audio.extraLife();
    }
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem('pacman-hi', String(highScore)); } catch (e) {}
    }
  }

  // ---- Movimento su griglia (decisioni ai centri tile) ----
  // Sposta l'entita' di dist px lungo dir; chiama onCenter() ai centri tile.
  // onCenter ritorna false per fermarsi (bloccato).
  function moveActor(a, dist, onCenter, canEnter) {
    var guard = 0;
    while (dist > 0.0001 && guard++ < 64) {
      var col = Math.floor(a.x / TILE), row = Math.floor(a.y / TILE);
      var cx = col * TILE + 4, cy = row * TILE + 4;
      var toC = a.dir.dx ? (cx - a.x) * a.dir.dx : (cy - a.y) * a.dir.dy;
      var tx, ty, d;
      if (toC > 0.0001) {
        tx = cx; ty = cy; d = toC;
      } else {
        // prossimo centro: verifica che il tile prossimo sia percorribile
        var nCol = col + a.dir.dx, nRow = row + a.dir.dy;
        if (canEnter && !canEnter(nCol, nRow)) return; // fermati al centro corrente
        tx = cx + a.dir.dx * TILE; ty = cy + a.dir.dy * TILE; d = toC + TILE;
      }
      if (dist >= d - 0.0001) {
        a.x = tx; a.y = ty; dist -= d;
        wrapX(a);
        if (!onCenter()) return;
      } else {
        a.x += a.dir.dx * dist; a.y += a.dir.dy * dist; dist = 0;
      }
      wrapX(a);
    }
  }
  function wrapX(a) {
    // wrap solo nel tunnel (riga 17)
    if (Math.floor(a.y / TILE) !== 17) {
      // blocca ai bordi fuori dal tunnel (sicurezza)
      if (a.x < 4) a.x = 4;
      else if (a.x > 220) a.x = 220;
      return;
    }
    if (a.x < -4.001) a.x += 232;
    else if (a.x > 228.001) a.x -= 232;
  }
  function atCenter(a) {
    var col = Math.floor(a.x / TILE), row = Math.floor(a.y / TILE);
    return Math.abs(a.x - (col * TILE + 4)) < 0.01 &&
           Math.abs(a.y - (row * TILE + 4)) < 0.01;
  }

  // ---- Pac-Man ----
  function pacSpeed() { return BASE_SPEED * pacPct(frightOn); }

  function eatTile() {
    var col = Math.floor(pac.x / TILE), row = Math.floor(pac.y / TILE);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    var t = grid[row][col];
    if (t === '.') {
      grid[row][col] = ' '; dotsLeft--; eatenDots++;
      addScore(10); pac.eatPause = 1 / 60; audio.waka();
      afterDot();
    } else if (t === 'o') {
      grid[row][col] = ' '; dotsLeft--; eatenDots++;
      addScore(50); pac.eatPause = 3 / 60; audio.energizer();
      startFright();
      afterDot();
    }
  }

  function pacCenter() {
    // svolta
    if (!sameDir(pac.nextDir, pac.dir) && walkable(Math.floor(pac.x / TILE) + pac.nextDir.dx,
                                            Math.floor(pac.y / TILE) + pac.nextDir.dy)) {
      pac.dir = pac.nextDir;
    }
    // frutta
    if (fruitActive && Math.abs(pac.x - FRUIT_X) < 6 && Math.abs(pac.y - FRUIT_Y) < 6) {
      var f = FRUIT_DEFS[fruitType];
      fruitActive = false;
      addScore(f.pts);
      if (fruitsCollected[fruitsCollected.length - 1] !== fruitType || fruitsCollected.length === 0) {
        fruitsCollected.push(fruitType);
      }
      fruitPopup = { text: String(f.pts), x: FRUIT_X, y: FRUIT_Y };
      fruitPopupTimer = 1;
      audio.fruit();
    }
    if (!walkable(Math.floor(pac.x / TILE) + pac.dir.dx,
                  Math.floor(pac.y / TILE) + pac.dir.dy)) {
      pac.moving = false;
      return false;
    }
    pac.moving = true;
    return true;
  }

  function afterDot() {
    // Elroy
    var d1 = elroyThreshold();
    if (dotsLeft <= d1 / 2) ghosts[0].elroy = 2;
    else if (dotsLeft <= d1) ghosts[0].elroy = 1;
    // frutta
    if (eatenDots === 70 || eatenDots === 170) {
      fruitActive = true;
      fruitTimer = 9 + Math.random();
      fruitType = fruitForLevel(level);
    }
    if (dotsLeft === 0) {
      ST = 'levelclear';
      clearTimer = 3;
      ghosts.forEach(function (g) { g.elroy = 0; });
    }
  }

  function startFright() {
    ghostChain = 0;
    var t = frightTimeForLevel(level);
    ghosts.forEach(function (g) {
      if (g.mode === 'outside') { g.reverse = true; if (t > 0) g.scared = true; }
      else if ((g.mode === 'house' || g.mode === 'leaving') && t > 0) g.scared = true;
    });
    if (t > 0) { frightOn = true; frightTimer = t; }
  }

  function updatePac(dt) {
    if (pac.eatPause > 0) {
      pac.eatPause -= dt;
      if (pac.eatPause > 0) return;
      pac.eatPause = 0;
    }
    // svolta immediata: inversione di direzione sempre possibile
    if (sameDir(pac.nextDir, opp(pac.dir))) {
      pac.dir = pac.nextDir;
    }
    // cornering: svolta perpendicolare quando si e' vicini al centro del tile
    // (finestra +-2px attorno al centro, come nell'arcade originale)
    if (!sameDir(pac.nextDir, pac.dir) && !sameDir(pac.nextDir, opp(pac.dir))) {
      var cc = Math.floor(pac.x / TILE), cr = Math.floor(pac.y / TILE);
      var ccx = cc * TILE + 4, ccy = cr * TILE + 4;
      if (Math.abs(pac.x - ccx) <= 2 && Math.abs(pac.y - ccy) <= 2 &&
          walkable(cc + pac.nextDir.dx, cr + pac.nextDir.dy)) {
        pac.x = ccx; pac.y = ccy;
        pac.dir = pac.nextDir;
      }
    }
    eatTile();
    var before = pac.moving;
    moveActor(pac, pacSpeed() * dt, pacCenter, walkable);
    eatTile();
    if (pac.moving || before) pac.mouthPhase += dt * 12;
  }

  // ---- IA Fantasmi ----
  function ghostTarget(g) {
    if (g.mode === 'eyes') return { c: 13, r: 14 };
    if (currentMode() === 'scatter' && g.elroy === 0) {
      return { c: g.cornerC, r: g.cornerR };
    }
    var pc = Math.floor(pac.x / TILE), pr = Math.floor(pac.y / TILE);
    switch (g.id) {
      case 'blinky':
        return { c: pc, r: pr };
      case 'pinky': {
        var c = pc + pac.dir.dx * 4, r = pr + pac.dir.dy * 4;
        if (pac.dir.dy === -1) c -= 4; // bug originale
        return { c: c, r: r };
      }
      case 'inky': {
        var b = ghosts[0];
        var px = pc + pac.dir.dx * 2, py = pr + pac.dir.dy * 2;
        if (pac.dir.dy === -1) px -= 2;
        return { c: px + (px - Math.floor(b.x / TILE)), r: py + (py - Math.floor(b.y / TILE)) };
      }
      case 'clyde': {
        var gc = Math.floor(g.x / TILE), gr = Math.floor(g.y / TILE);
        var dc = pc - gc, dr = pr - gr;
        if (dc * dc + dr * dr > 64) return { c: pc, r: pr };
        return { c: g.cornerC, r: g.cornerR };
      }
    }
  }

  function ghostCenter(g) {
    var col = Math.floor(g.x / TILE), row = Math.floor(g.y / TILE);
    if (g.mode === 'eyes') {
      // arrivato davanti alla porta: entra (scripted)
      if (row === 14 && (col === 13 || col === 14)) {
        g.x = 112; g.y = 116;
        g.mode = 'entering';
        return false;
      }
    } else if (g.reverse) {
      g.reverse = false;
      g.dir = opp(g.dir);
      return true;
    }
    var options = [];
    for (var i = 0; i < DIR_ORDER.length; i++) {
      var d = DIR_ORDER[i];
      if (d === opp(g.dir)) continue;
      if (g.mode !== 'eyes' && !g.scared && NO_UP[col + ',' + row] && d.dy === -1 && d.dx === 0) continue;
      if (!walkable(col + d.dx, row + d.dy)) continue;
      options.push(d);
    }
    if (options.length === 0) { g.dir = opp(g.dir); return true; }
    if (g.mode === 'outside' && g.scared) {
      g.dir = options[Math.floor(Math.random() * options.length)];
      return true;
    }
    var t = ghostTarget(g), best = options[0], bestD = Infinity;
    for (var j = 0; j < options.length; j++) {
      var nc = col + options[j].dx, nr = row + options[j].dy;
      var dc2 = nc - t.c, dr2 = nr - t.r;
      var dd = dc2 * dc2 + dr2 * dr2;
      if (dd < bestD) { bestD = dd; best = options[j]; }
    }
    g.dir = best;
    return true;
  }

  function ghostSpeed(g) {
    if (g.mode === 'eyes' || g.mode === 'entering') return BASE_SPEED * 1.5;
    if (g.mode === 'house') return BASE_SPEED * 0.35;
    if (g.mode === 'leaving') return BASE_SPEED * 0.4;
    if (g.scared) return BASE_SPEED * 0.5;
    if (isTunnel(g.x, Math.floor(g.y / TILE))) return BASE_SPEED * 0.4;
    if (g.elroy === 1) return BASE_SPEED * (ghostPct() + 0.05);
    if (g.elroy === 2) return BASE_SPEED * (ghostPct() + 0.10);
    return BASE_SPEED * ghostPct();
  }

  // movimento scriptato dentro casa
  function stepToward(g, target, s, dt) {
    var d = target - g;
    var step = s * dt;
    if (Math.abs(d) <= step) { return true; }
    return false;
  }

  function updateGhost(g, dt) {
    var s = ghostSpeed(g);
    if (g.mode === 'house') {
      // pacing verticale
      g.y += g.paceDir.dy * s * dt;
      if (g.y <= PACE_MIN) { g.y = PACE_MIN; g.paceDir = DOWN; }
      else if (g.y >= PACE_MAX) { g.y = PACE_MAX; g.paceDir = UP; }
      g.dir = g.paceDir;
      return;
    }
    if (g.mode === 'leaving') {
      var step = s * dt;
      if (Math.abs(g.x - DOOR_X) > 0.5) {
        g.dir = g.x < DOOR_X ? RIGHT : LEFT;
        g.x += g.dir.dx * Math.min(step, Math.abs(g.x - DOOR_X));
      } else {
        g.x = DOOR_X;
        if (g.y > DOOR_FRONT_Y) { g.dir = UP; g.y -= Math.min(step, g.y - DOOR_FRONT_Y); }
        if (g.y <= DOOR_FRONT_Y) {
          g.y = DOOR_FRONT_Y;
          g.mode = 'outside';
          g.dir = LEFT;
        }
      }
      return;
    }
    if (g.mode === 'entering') {
      var st = s * dt;
      if (Math.abs(g.x - DOOR_X) > 0.5) {
        g.dir = g.x < DOOR_X ? RIGHT : LEFT;
        g.x += g.dir.dx * Math.min(st, Math.abs(g.x - DOOR_X));
      } else if (g.y < HOUSE_Y) {
        g.x = DOOR_X; g.dir = DOWN;
        g.y += Math.min(st, HOUSE_Y - g.y);
      } else if (Math.abs(g.x - g.seatX) > 0.5) {
        g.y = HOUSE_Y;
        g.dir = g.x < g.seatX ? RIGHT : LEFT;
        g.x += g.dir.dx * Math.min(st, Math.abs(g.x - g.seatX));
      } else {
        g.x = g.seatX; g.y = HOUSE_Y;
        g.mode = 'leaving'; // risorto: esce subito (come Blinky originale)
        g.scared = false;
      }
      return;
    }
    // outside / eyes: movimento su griglia
    moveActor(g, s * dt, function () { return ghostCenter(g); }, walkable);
  }

  // ---- Modalita' scatter/chase ----
  function updateModes(dt) {
    if (frightOn) {
      frightTimer -= dt;
      if (frightTimer <= 0) {
        frightOn = false; ghostChain = 0;
        ghosts.forEach(function (g) { g.scared = false; });
      }
      return; // timer globale in pausa durante il fright
    }
    modeTimer += dt;
    if (modeTimer >= modePhases[modeIndex] && modeIndex < modePhases.length - 1) {
      modeTimer = 0;
      modeIndex++;
      ghosts.forEach(function (g) { if (g.mode === 'outside') g.reverse = true; });
    }
  }

  // ---- Collisioni ----
  function checkCollisions() {
    for (var i = 0; i < ghosts.length; i++) {
      var g = ghosts[i];
      if (g.mode !== 'outside') continue;
      var dx = g.x - pac.x, dy = g.y - pac.y;
      if (dx * dx + dy * dy < 36) {
        if (g.scared) {
          var pts = [200, 400, 800, 1600][Math.min(ghostChain, 3)];
          ghostChain++;
          addScore(pts);
          g.scared = false;
          g.mode = 'eyes';
          ghostPopup = { text: String(pts), x: g.x, y: g.y };
          ghostPopupTimer = 0.7;
          audio.eatGhost();
          return; // pausa breve
        } else if (!g.scared) {
          ST = 'dying';
          deathPhase = 0; deathTimer = 0;
          audio.death();
          return;
        }
      }
    }
  }

  // ---- Flusso partita ----
  function startLevel(resetDots) {
    if (resetDots) initGrid();
    eatenDots = dotsTotal - dotsLeft;
    if (resetDots) eatenDots = 0;
    resetActors();
    setModePhases();
    frightOn = false; frightTimer = 0; ghostChain = 0;
    fruitActive = false; fruitPopup = null; ghostPopup = null; ghostPopupTimer = 0;
    releaseTimer = 0;
    ST = 'ready';
    readyTimer = 2;
  }

  function newGame() {
    score = 0; lives = 10; level = 1; extraLifeGiven = false;
    fruitsCollected = [];
    startLevel(true);
    audio.start();
  }

  function afterDeath() {
    lives--;
    if (lives <= 0) {
      ST = 'gameover';
      readyTimer = 4;
    } else {
      // conserva pallini, riposiziona attori
      eatenDots = dotsTotal - dotsLeft;
      resetActors();
      setModePhases();
      frightOn = false; frightTimer = 0; ghostChain = 0;
      fruitActive = false; releaseTimer = 0;
      ST = 'ready';
      readyTimer = 2;
    }
  }

  // ---- Input ----
  var KEYMAP = {
    ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
    w: UP, s: DOWN, a: LEFT, d: RIGHT, W: UP, S: DOWN, A: LEFT, D: RIGHT
  };
  window.addEventListener('keydown', function (e) {
    audio.unlock();
    if (KEYMAP[e.key]) {
      pac.nextDir = KEYMAP[e.key];
      e.preventDefault();
    } else if (e.key === 'p' || e.key === 'P') {
      if (ST === 'playing' || ST === 'ready') pauseFlag = !pauseFlag;
    } else if (e.key === 'Enter') {
      if (ST === 'attract' || ST === 'gameover') newGame();
    }
  });
  canvas.addEventListener('click', function () {
    audio.unlock();
    if (ST === 'attract' || ST === 'gameover') newGame();
  });
  function bindBtn(id, dir) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('touchstart', function (e) { e.preventDefault(); audio.unlock(); pac.nextDir = dir; });
  }
  bindBtn('btn-up', UP); bindBtn('btn-down', DOWN);
  bindBtn('btn-left', LEFT); bindBtn('btn-right', RIGHT);

  var touchStart = null;
  canvas.addEventListener('touchstart', function (e) { touchStart = e.touches[0]; }, { passive: true });
  canvas.addEventListener('touchend', function (e) {
    audio.unlock();
    if (ST === 'attract' || ST === 'gameover') { newGame(); return; }
    if (!touchStart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.clientX, dy = t.clientY - touchStart.clientY;
    if (Math.abs(dx) > Math.abs(dy)) pac.nextDir = dx > 0 ? RIGHT : LEFT;
    else pac.nextDir = dy > 0 ? DOWN : UP;
    touchStart = null;
  }, { passive: true });

  // ---- Rendering ----
  var MAZE_COLOR = '#2121ff';
  var PELLET_COLOR = '#ffb8ae';

  function drawMaze(flash) {
    var color = flash ? '#ffffff' : MAZE_COLOR;
    ctx.fillStyle = color;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var ch = grid[r][c];
        if (ch !== '|' && ch !== '_') continue;
        var x = c * TILE, y = r * TILE;
        // bordo disegnato sul lato adiacente a tile percorribili o porta
        var up = tileAt(c, r - 1), down = tileAt(c, r + 1),
            left = tileAt(c - 1, r), right = tileAt(c + 1, r);
        function open(t) { return t === ' ' || t === '.' || t === 'o' || t === '-'; }
        if (open(up)) ctx.fillRect(x, y, TILE, 1);
        if (open(down)) ctx.fillRect(x, y + TILE - 1, TILE, 1);
        if (open(left)) ctx.fillRect(x, y, 1, TILE);
        if (open(right)) ctx.fillRect(x + TILE - 1, y, 1, TILE);
      }
    }
    // porta casa fantasmi
    ctx.fillStyle = flash ? '#ffffff' : '#ffb8de';
    ctx.fillRect(13 * TILE, 15 * TILE + 3, 2 * TILE, 2);
  }

  function drawDots() {
    ctx.fillStyle = PELLET_COLOR;
    var blink = Math.floor(globalTime * 4) % 2 === 0;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var ch = grid[r][c];
        var x = c * TILE + 4, y = r * TILE + 4;
        if (ch === '.') {
          ctx.fillRect(x - 1, y - 1, 2, 2);
        } else if (ch === 'o' && blink) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawPacShape(x, y, openAngle, angleCenter) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, 6.5, angleCenter + openAngle, angleCenter - openAngle + Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawPac() {
    if (ST === 'dying') {
      var t = Math.min(deathTimer / 1.3, 1);
      if (t >= 1) return;
      var open = 0.3 + t * (Math.PI - 0.3);
      drawPacShape(pac.x, pac.y, open, -Math.PI / 2);
      return;
    }
    var open = pac.moving ? 0.35 + Math.abs(Math.sin(pac.mouthPhase)) * 0.75 : 0.35;
    drawPacShape(pac.x, pac.y, open, dirAngle(pac.dir));
  }

  function drawGhost(g) {
    var x = g.x, y = g.y;
    if (g.mode === 'eyes' || g.mode === 'entering') {
      drawGhostEyes(x, y, g.dir);
      return;
    }
    var flashing = g.scared && frightOn && frightTimer < 2 && Math.floor(frightTimer * 4) % 2 === 0;
    var body = g.scared ? (flashing ? '#ffffff' : '#2121de') : g.color;
    var r = 6.5;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y - 1, r, Math.PI, 0);
    var top = y - 1, bottom = y + 6;
    ctx.lineTo(x + r, bottom);
    // gonna ondulata
    var wob = Math.floor(globalTime * 10) % 2 === 0 ? 0 : 1;
    var seg = (r * 2) / 6;
    for (var i = 0; i < 3; i++) {
      var x0 = x + r - i * 2 * seg;
      ctx.lineTo(x0 - seg, bottom - (wob ? 0 : 2));
      ctx.lineTo(x0 - 2 * seg, bottom);
    }
    ctx.closePath();
    ctx.fill();
    if (g.scared) {
      // faccia spaventata
      ctx.fillStyle = flashing ? '#ff0000' : '#ffffff';
      ctx.fillRect(x - 3.5, y - 4, 2, 2);
      ctx.fillRect(x + 1.5, y - 4, 2, 2);
      ctx.beginPath();
      ctx.moveTo(x - 4, y + 3);
      for (var z = 0; z < 4; z++) {
        ctx.lineTo(x - 4 + z * 2 + 1, y + 3 + (z % 2 === 0 ? 0 : -1.5));
      }
      ctx.lineTo(x + 4, y + 3);
      ctx.strokeStyle = flashing ? '#ff0000' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      drawGhostEyes(x, y, g.dir);
    }
  }

  function drawGhostEyes(x, y, dir) {
    var ox = dir.dx * 1.5, oy = dir.dy * 1.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 2.5, y - 2, 2.3, 0, Math.PI * 2);
    ctx.arc(x + 2.5, y - 2, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2121de';
    ctx.beginPath();
    ctx.arc(x - 2.5 + ox, y - 2 + oy, 1.3, 0, Math.PI * 2);
    ctx.arc(x + 2.5 + ox, y - 2 + oy, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFruitAt(x, y, type) {
    switch (type) {
      case 0: // ciliegia
        ctx.fillStyle = '#ff0000';
        ctx.beginPath(); ctx.arc(x - 2.5, y + 2.5, 3, 0, Math.PI * 2);
        ctx.arc(x + 2.5, y + 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#00b000'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 2, y + 1); ctx.quadraticCurveTo(x - 1, y - 5, x + 4, y - 4);
        ctx.moveTo(x + 2.5, y + 1); ctx.quadraticCurveTo(x + 3.5, y - 2, x + 4, y - 4);
        ctx.stroke();
        break;
      case 1: // fragola
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(x, y + 5);
        ctx.quadraticCurveTo(x - 5.5, y + 1, x - 4, y - 2);
        ctx.quadraticCurveTo(x - 4, y - 5, x, y - 4);
        ctx.quadraticCurveTo(x + 4, y - 5, x + 4, y - 2);
        ctx.quadraticCurveTo(x + 5.5, y + 1, x, y + 5);
        ctx.fill();
        ctx.fillStyle = '#00b000'; ctx.fillRect(x - 3.5, y - 5, 7, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 2, y - 1, 1.5, 1.5); ctx.fillRect(x + 0.5, y + 1, 1.5, 1.5); ctx.fillRect(x - 2.5, y + 2.5, 1.5, 1.5);
        break;
      case 2: // arancia
        ctx.fillStyle = '#ffb831';
        ctx.beginPath(); ctx.arc(x, y + 1, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#00b000'; ctx.fillRect(x - 1, y - 5, 2, 2.5);
        break;
      case 3: // mela
        ctx.fillStyle = '#e03c31';
        ctx.beginPath(); ctx.arc(x - 2, y + 1.5, 3.5, 0, Math.PI * 2);
        ctx.arc(x + 2, y + 1.5, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#de9751'; ctx.beginPath();
        ctx.moveTo(x, y - 1); ctx.quadraticCurveTo(x + 1, y - 5, x + 3, y - 5); ctx.stroke();
        break;
      case 4: // melone
        ctx.fillStyle = '#7bf24c';
        ctx.beginPath(); ctx.arc(x, y + 1, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#008000'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 1); ctx.lineTo(x + 4, y - 1);
        ctx.moveTo(x - 4, y + 2); ctx.lineTo(x + 4, y + 2);
        ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y - 3);
        ctx.stroke();
        break;
      case 5: // galaxian
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(x, y - 5); ctx.lineTo(x + 2, y + 1); ctx.lineTo(x - 2, y + 1);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(x - 5, y + 5); ctx.lineTo(x - 1, y + 1); ctx.lineTo(x, y + 3);
        ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x, y + 3);
        ctx.closePath(); ctx.fill();
        break;
      case 6: // campana
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.quadraticCurveTo(x + 5.5, y + 1, x + 4.5, y + 4);
        ctx.lineTo(x - 4.5, y + 4);
        ctx.quadraticCurveTo(x - 5.5, y + 1, x, y - 5);
        ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1.5, y + 4, 3, 2);
        ctx.fillRect(x - 1, y - 6, 2, 2);
        break;
      case 7: // chiave
        ctx.fillStyle = '#b8d8e8';
        ctx.beginPath(); ctx.arc(x, y - 3, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - 1, y - 1, 2, 8);
        ctx.fillRect(x + 1, y + 3, 2.5, 1.5);
        ctx.fillRect(x + 1, y + 6, 2.5, 1.5);
        break;
    }
  }

  function drawFruit() {
    if (fruitActive) drawFruitAt(FRUIT_X, FRUIT_Y, fruitType);
  }

  function drawFruitHistory() {
    var n = Math.min(fruitsCollected.length, 7);
    for (var i = 0; i < n; i++) {
      var idx = fruitsCollected.length - 1 - i;
      drawFruitAt(W - 10 - i * 14, 276, fruitsCollected[idx]);
    }
  }

  function drawLives() {
    var n = Math.max(0, lives - 1);
    var perRow = 6;
    for (var i = 0; i < n && i < 12; i++) {
      drawPacShape(14 + (i % perRow) * 16, 276 + Math.floor(i / perRow) * 14, 0.6, Math.PI);
    }
  }

  function text(str, x, y, color) {
    ctx.fillStyle = color || '#ffffff';
    ctx.font = 'bold 8px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(str, x, y);
    ctx.textAlign = 'left';
  }

  function drawHud() {
    var blink = Math.floor(globalTime * 3) % 3 !== 2;
    if (blink || ST !== 'playing') text('1UP', 24, 0);
    text('HIGH SCORE', 112, 0);
    var s = String(score);
    if (score < 10) s = '0' + s;
    text(s, 40 - s.length * 4 + 4, 8);
    var hs = String(highScore);
    if (highScore < 10) hs = '0' + hs;
    text(hs, 112, 8);
  }

  function render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    var flash = ST === 'levelclear' && Math.floor(clearTimer * 6) % 2 === 0;
    drawMaze(flash);
    if (ST !== 'levelclear' || Math.floor(clearTimer * 6) % 2 === 0) drawDots();
    drawHud();
    drawFruit();
    drawLives();
    drawFruitHistory();

    if (ST === 'attract') {
      text('PAC-MAN', 112, 136, '#ffff00');
      text('PREMI ENTER', 112, 156, '#00ffff');
      return;
    }

    if (ST !== 'levelclear') {
      if (ST === 'dying') {
        if (deathPhase === 0) {
          ghosts.forEach(drawGhost);
          drawPac();
        } else {
          drawPac();
        }
      } else if (ST !== 'gameover') {
        ghosts.forEach(drawGhost);
        drawPac();
      }
    }

    if (ST === 'ready') text('READY!', 112, 162, '#ffff00');
    if (ST === 'gameover') text('GAME  OVER', 112, 162, '#ff0000');
    if (pauseFlag) text('PAUSA', 112, 176, '#00ffff');
    if (ghostPopup && ghostPopupTimer > 0) text(ghostPopup.text, ghostPopup.x, ghostPopup.y - 4, '#00ffff');
    if (fruitPopup && fruitPopupTimer > 0) text(fruitPopup.text, FRUIT_X, FRUIT_Y - 4, '#00ffff');
  }

  // ---- Loop ----
  function update(dt) {
    globalTime += dt;
    if (ghostPopupTimer > 0) {
      ghostPopupTimer -= dt;
      if (ghostPopupTimer <= 0) ghostPopup = null;
      return; // congela durante il popup fantasmi mangiato
    }
    if (fruitPopupTimer > 0) fruitPopupTimer -= dt;
    if (fruitPopupTimer <= 0) fruitPopup = null;

    switch (ST) {
      case 'attract':
        break;
      case 'ready':
        readyTimer -= dt;
        if (readyTimer <= 0) ST = 'playing';
        break;
      case 'playing':
        updatePac(dt);
        if (ST !== 'playing') break; // livello completato o morte durante il movimento
        updateModes(dt);
        updateReleases(dt);
        ghosts.forEach(function (g) { updateGhost(g, dt); });
        checkCollisions();
        if (fruitActive) {
          fruitTimer -= dt;
          if (fruitTimer <= 0) fruitActive = false;
        }
        break;
      case 'dying':
        deathTimer += dt;
        if (deathPhase === 0 && deathTimer >= 0.8) { deathPhase = 1; deathTimer = 0; }
        else if (deathPhase === 1 && deathTimer >= 1.4) { deathPhase = 2; deathTimer = 0; }
        else if (deathPhase === 2 && deathTimer >= 0.5) afterDeath();
        break;
      case 'levelclear':
        clearTimer -= dt;
        if (clearTimer <= 0) {
          level++;
          startLevel(true);
        }
        break;
      case 'gameover':
        readyTimer -= dt;
        if (readyTimer <= 0) ST = 'attract';
        break;
    }
  }

  var last = performance.now();
  function loop(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!pauseFlag) update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // init
  initGrid();
  resetActors();
  requestAnimationFrame(loop);
})();
