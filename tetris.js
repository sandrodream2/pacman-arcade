'use strict';
(function () {
  const COLS = 10, ROWS = 20, CELL = 24;
  const LINE_SCORES = [0, 40, 100, 300, 1200];
  const boardCanvas = document.getElementById('board');
  const bctx = boardCanvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nctx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highscoreEl = document.getElementById('highscore');
  const levelEl = document.getElementById('level');
  const linesEl = document.getElementById('lines');

  const GRAVITY_MS = [800, 720, 630, 550, 470, 380, 300, 220, 130, 100,
                      80, 80, 70, 70, 70, 50, 50, 50, 30, 30, 30, 20];

  const COLORS = {
    I: '#00e0f0', O: '#f0d000', T: '#a040e0', S: '#40e040',
    Z: '#f04040', J: '#4060f0', L: '#f08020'
  };
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };

  function rotateMatrix(m) {
    const n = m.length;
    const r = [];
    for (let y = 0; y < n; y++) {
      r.push([]);
      for (let x = 0; x < n; x++) r[y].push(m[n - 1 - x][y]);
    }
    return r;
  }

  function newPiece(type) {
    return { type: type, m: SHAPES[type].map(row => row.slice()), x: 3, y: type === 'I' ? -1 : 0 };
  }

  let grid, piece, next, score, level, lines, high, running, paused, over;
  let dropTimer, lockTimer, dropInterval, lastTime;
  let clearing = null, particles = [], shakeT = 0, flashT = 0;
  let softDropping = false, moveDir = 0, moveTimer = 0, repeatDelayMet = false;

  high = parseInt(localStorage.getItem('tetris-high') || '0', 10) || 0;

  function reset() {
    grid = [];
    for (let y = 0; y < ROWS; y++) grid.push(new Array(COLS).fill(null));
    score = 0; level = 0; lines = 0;
    dropInterval = GRAVITY_MS[0];
    bag = [];
    next = bagNext();
    spawn();
    updateHUD();
  }

  let bag = [];
  function bagNext() {
    if (bag.length === 0) {
      bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function spawn() {
    piece = newPiece(next);
    next = bagNext();
    lockTimer = 0; dropTimer = 0;
    if (collide(piece, piece.x, piece.y)) {
      over = true; running = false;
      saveHigh();
    }
  }

  function collide(p, nx, ny, m) {
    m = m || p.m;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const gx = nx + x, gy = ny + y;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    }
    return false;
  }

  function tryMove(dx, dy) {
    if (!collide(piece, piece.x + dx, piece.y + dy)) {
      piece.x += dx; piece.y += dy;
      return true;
    }
    return false;
  }

  function tryRotate() {
    const r = rotateMatrix(piece.m);
    for (const k of [0, -1, 1, -2, 2]) {
      if (!collide(piece, piece.x + k, piece.y, r)) {
        piece.m = r; piece.x += k;
        lockTimer = 0;
        return true;
      }
    }
    return false;
  }

  function hardDrop() {
    let d = 0;
    while (tryMove(0, 1)) d++;
    score += d * 2;
    lockPiece();
  }

  function lockPiece() {
    for (let y = 0; y < piece.m.length; y++) {
      for (let x = 0; x < piece.m[y].length; x++) {
        if (piece.m[y][x]) {
          const gy = piece.y + y, gx = piece.x + x;
          if (gy < 0) { over = true; running = false; saveHigh(); return; }
          grid[gy][gx] = piece.type;
        }
      }
    }
    const full = [];
    for (let y = 0; y < ROWS; y++) if (grid[y].every(c => c)) full.push(y);
    if (full.length > 0) {
      startClear(full);
    } else {
      spawn();
    }
    updateHUD();
  }

  function startClear(full) {
    clearing = { rows: full, t: 0 };
    for (const y of full) {
      for (let x = 0; x < COLS; x++) {
        for (let i = 0; i < 3; i++) {
          particles.push({
            x: x * CELL + CELL / 2, y: y * CELL + CELL / 2,
            vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 180 - 40,
            life: 1, color: COLORS[grid[y][x]]
          });
        }
      }
    }
    flashT = 0.12;
    if (full.length === 4) shakeT = 0.25;
    const pts = LINE_SCORES[full.length] * (level + 1);
    score += pts;
    lines += full.length;
    const newLevel = Math.floor(lines / 10);
    if (newLevel > level) {
      level = newLevel;
      dropInterval = GRAVITY_MS[Math.min(level, GRAVITY_MS.length - 1)];
    }
    if (score > high) { high = score; saveHigh(); }
    updateHUD();
  }

  function finishClear() {
    const full = clearing.rows;
    for (const y of full) {
      grid.splice(y, 1);
      grid.unshift(new Array(COLS).fill(null));
    }
    clearing = null;
    spawn();
  }

  function saveHigh() {
    if (score > high) high = score;
    try { localStorage.setItem('tetris-high', String(high)); } catch (e) {}
    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = String(score).padStart(6, '0');
    highscoreEl.textContent = String(high).padStart(6, '0');
    levelEl.textContent = String(level).padStart(2, '0');
    linesEl.textContent = String(lines).padStart(3, '0');
  }

  function update(dt) {
    if (clearing) {
      clearing.t += dt;
      if (clearing.t > 0.25) finishClear();
    } else if (running && !paused && !over) {
      dropTimer += dt * 1000;
      const interval = softDropping ? Math.min(50, dropInterval) : dropInterval;
      if (dropTimer >= interval) {
        dropTimer = 0;
        if (!tryMove(0, 1)) {
          lockTimer += interval;
          if (lockTimer >= 500) lockPiece();
        } else {
          if (softDropping) score += 1;
          lockTimer = 0;
        }
      }
      if (moveDir !== 0) {
        moveTimer += dt * 1000;
        if (!repeatDelayMet) {
          if (moveTimer >= 170) { repeatDelayMet = true; moveTimer = 0; tryMove(moveDir, 0); lockTimer = 0; }
        } else if (moveTimer >= 50) {
          moveTimer = 0; tryMove(moveDir, 0); lockTimer = 0;
        }
      }
    }
    for (const p of particles) {
      p.life -= dt * 1.6;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt;
    }
    particles = particles.filter(p => p.life > 0);
    if (shakeT > 0) shakeT -= dt;
    if (flashT > 0) flashT -= dt;
  }

  function drawCell(ctx, x, y, type, size, alpha) {
    const c = COLORS[type];
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x, y, size, 3);
    ctx.fillRect(x, y, 3, size);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, y + size - 3, size, 3);
    ctx.fillRect(x + size - 3, y, 3, size);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
    ctx.globalAlpha = 1;
  }

  function ghostY() {
    let gy = piece.y;
    while (!collide(piece, piece.x, gy + 1)) gy++;
    return gy;
  }

  function draw() {
    const w = boardCanvas.width, h = boardCanvas.height;
    bctx.save();
    if (shakeT > 0) bctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    bctx.clearRect(-6, -6, w + 12, h + 12);
    bctx.fillStyle = '#0a0a14';
    bctx.fillRect(-6, -6, w + 12, h + 12);
    bctx.strokeStyle = 'rgba(40, 50, 90, 0.35)';
    bctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      bctx.beginPath(); bctx.moveTo(x * CELL + 0.5, 0); bctx.lineTo(x * CELL + 0.5, h); bctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      bctx.beginPath(); bctx.moveTo(0, y * CELL + 0.5); bctx.lineTo(w, y * CELL + 0.5); bctx.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) {
          if (clearing && clearing.rows.includes(y)) {
            const fade = 1 - clearing.t / 0.25;
            bctx.globalAlpha = fade;
            drawCell(bctx, x * CELL, y * CELL, grid[y][x], CELL);
            bctx.globalAlpha = 1;
          } else {
            drawCell(bctx, x * CELL, y * CELL, grid[y][x], CELL);
          }
        }
      }
    }
    if (running && !paused && !over && !clearing && piece) {
      const gy = ghostY();
      for (let y = 0; y < piece.m.length; y++) {
        for (let x = 0; x < piece.m[y].length; x++) {
          if (piece.m[y][x]) {
            bctx.strokeStyle = 'rgba(255,255,255,0.25)';
            bctx.lineWidth = 2;
            bctx.strokeRect((piece.x + x) * CELL + 2, (gy + y) * CELL + 2, CELL - 4, CELL - 4);
          }
        }
      }
      for (let y = 0; y < piece.m.length; y++) {
        for (let x = 0; x < piece.m[y].length; x++) {
          if (piece.m[y][x] && piece.y + y >= 0) {
            drawCell(bctx, (piece.x + x) * CELL, (piece.y + y) * CELL, piece.type, CELL);
          }
        }
      }
    }
    for (const p of particles) {
      bctx.globalAlpha = Math.max(0, p.life);
      bctx.fillStyle = p.color;
      bctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    bctx.globalAlpha = 1;
    if (flashT > 0) {
      bctx.fillStyle = 'rgba(255,255,255,' + (flashT * 2) + ')';
      bctx.fillRect(0, 0, w, h);
    }
    bctx.restore();
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (next && !over) {
      const m = SHAPES[next];
      let minX = 4, maxX = -1, minY = 4, maxY = -1;
      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
          if (m[y][x]) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
        }
      }
      const s = 16;
      const ox = (nextCanvas.width - (maxX - minX + 1) * s) / 2 - minX * s;
      const oy = (nextCanvas.height - (maxY - minY + 1) * s) / 2 - minY * s;
      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
          if (m[y][x]) drawCell(nctx, ox + x * s, oy + y * s, next, s);
        }
      }
    }
    bctx.textAlign = 'center';
    if (over) {
      bctx.fillStyle = 'rgba(0,0,0,0.75)';
      bctx.fillRect(0, h / 2 - 60, w, 120);
      bctx.fillStyle = '#ff4050';
      bctx.font = 'bold 28px "Courier New", monospace';
      bctx.fillText('GAME OVER', w / 2, h / 2 - 10);
      bctx.fillStyle = '#ffffff';
      bctx.font = '14px "Courier New", monospace';
      bctx.fillText('Enter per riprovare', w / 2, h / 2 + 25);
    } else if (!running) {
      bctx.fillStyle = 'rgba(0,0,0,0.7)';
      bctx.fillRect(0, h / 2 - 60, w, 120);
      bctx.fillStyle = '#66ff88';
      bctx.font = 'bold 28px "Courier New", monospace';
      bctx.fillText('TETRIS', w / 2, h / 2 - 10);
      bctx.fillStyle = '#ffffff';
      bctx.font = '14px "Courier New", monospace';
      bctx.fillText('Enter per iniziare', w / 2, h / 2 + 25);
    } else if (paused) {
      bctx.fillStyle = 'rgba(0,0,0,0.7)';
      bctx.fillRect(0, h / 2 - 40, w, 80);
      bctx.fillStyle = '#ffffff';
      bctx.font = 'bold 22px "Courier New", monospace';
      bctx.fillText('PAUSA', w / 2, h / 2 + 8);
    }
  }

  function loop(t) {
    const dt = Math.min((t - lastTime) / 1000, 0.05);
    lastTime = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    reset();
    running = true; paused = false; over = false;
    clearing = null; particles = []; softDropping = false; moveDir = 0;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (!running || over)) { start(); e.preventDefault(); return; }
    if (!running || paused || over || clearing) {
      if (e.key === 'p' || e.key === 'P') paused = !paused;
      return;
    }
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A':
        moveDir = -1; moveTimer = 0; repeatDelayMet = false; tryMove(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D':
        moveDir = 1; moveTimer = 0; repeatDelayMet = false; tryMove(1, 0); e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S':
        softDropping = true; e.preventDefault(); break;
      case 'ArrowUp': case 'w': case 'W':
        tryRotate(); e.preventDefault(); break;
      case ' ':
        hardDrop(); e.preventDefault(); break;
      case 'p': case 'P':
        paused = !paused; e.preventDefault(); break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A':
        if (moveDir === -1) moveDir = 0; break;
      case 'ArrowRight': case 'd': case 'D':
        if (moveDir === 1) moveDir = 0; break;
      case 'ArrowDown': case 's': case 'S':
        softDropping = false; break;
    }
  });

  function bindButton(id, down, up) {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); down(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); if (up) up(); }, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', () => { if (up) up(); });
    el.addEventListener('mouseleave', () => { if (up) up(); });
  }

  bindButton('btn-left', () => { if (running && !paused && !over) { moveDir = -1; moveTimer = 0; repeatDelayMet = false; tryMove(-1, 0); } });
  bindButton('btn-right', () => { if (running && !paused && !over) { moveDir = 1; moveTimer = 0; repeatDelayMet = false; tryMove(1, 0); } });
  bindButton('btn-down', () => { if (running && !paused && !over) softDropping = true; }, () => { softDropping = false; });
  bindButton('btn-up', () => { if (running && !paused && !over) tryRotate(); });
  bindButton('btn-drop', () => { if (running && !paused && !over) hardDrop(); });

  reset();
  running = false; paused = false; over = false;
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();
