/*
  Fish Eats Crackers - HTML5 Canvas game
  - Eat crackers to extend life
  - Avoid obstacles
  - Survive as long as possible
*/

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const uiScore = document.getElementById('score');
  const uiLife = document.getElementById('life');
  const uiLevel = document.getElementById('level');

  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');
  const titleEl = document.getElementById('title');
  const subtitleEl = document.getElementById('subtitle');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const TAU = Math.PI * 2;

  // Game state
  const state = {
    running: false,
    gameTime: 0, // in seconds
    score: 0,
    level: 1,
    lifeRemaining: 5, // seconds
    lifeMaxCap: 20,
    invulnerableUntil: 0,
  };

  // Input
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    keys.add(e.key.toLowerCase());
    if (e.key === ' ' || e.code === 'Space') {
      keys.add('space');
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
    if (e.key === ' ' || e.code === 'Space') {
      keys.delete('space');
    }
  });

  // Entities
  class Fish {
    constructor() {
      this.x = WIDTH * 0.25;
      this.y = HEIGHT * 0.5;
      this.radius = 16;
      this.speed = 220; // px/s
      this.dashSpeed = 420;
      this.dashCooldown = 0.8;
      this.nextDashAt = 0;
      this.velX = 0;
      this.velY = 0;
      this.maxSpeed = 260;
    }

    update(dt, timeNow) {
      const accel = 900; // px/s^2
      const drag = 0.88; // simple drag per frame

      let targetVX = 0;
      let targetVY = 0;

      if (keys.has('arrowleft') || keys.has('a')) targetVX -= this.speed;
      if (keys.has('arrowright') || keys.has('d')) targetVX += this.speed;
      if (keys.has('arrowup') || keys.has('w')) targetVY -= this.speed;
      if (keys.has('arrowdown') || keys.has('s')) targetVY += this.speed;

      const wantsDash = keys.has('space') && timeNow >= this.nextDashAt;
      const dashMult = wantsDash ? (this.dashSpeed / this.speed) : 1;
      if (wantsDash && (targetVX !== 0 || targetVY !== 0)) {
        this.nextDashAt = timeNow + this.dashCooldown;
      }

      // Accelerate towards target vel
      this.velX += (targetVX * dashMult - this.velX) * Math.min(1, accel * dt / 1000);
      this.velY += (targetVY * dashMult - this.velY) * Math.min(1, accel * dt / 1000);

      // Clamp speed
      const v = Math.hypot(this.velX, this.velY);
      const max = this.maxSpeed * (wantsDash ? dashMult : 1);
      if (v > max) {
        const scale = max / v;
        this.velX *= scale;
        this.velY *= scale;
      }

      // Apply movement
      this.x += this.velX * dt / 1000;
      this.y += this.velY * dt / 1000;

      // Simple drag
      this.velX *= drag;
      this.velY *= drag;

      // Constrain to bounds
      if (this.x < this.radius) { this.x = this.radius; this.velX = 0; }
      if (this.y < this.radius) { this.y = this.radius; this.velY = 0; }
      if (this.x > WIDTH - this.radius) { this.x = WIDTH - this.radius; this.velX = 0; }
      if (this.y > HEIGHT - this.radius) { this.y = HEIGHT - this.radius; this.velY = 0; }
    }

    draw(ctx, timeNow) {
      // Cute fish: body + tail + eye
      const angle = Math.atan2(this.velY, this.velX) || 0;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);

      // Body
      const bodyColor = '#ffb703';
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 14, 0, 0, TAU);
      ctx.fill();

      // Tail
      ctx.fillStyle = '#fb8500';
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(-34, -8);
      ctx.lineTo(-34, 8);
      ctx.closePath();
      ctx.fill();

      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(10, -4, 4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(11, -4, 2, 0, TAU);
      ctx.fill();

      ctx.restore();
    }
  }

  class Cracker {
    constructor(speedMult) {
      this.radius = 8;
      // Spawn from random edge, move across
      const edge = Math.floor(Math.random() * 4);
      const margin = 10;
      let x, y, vx, vy;
      const baseSpeed = 60 * speedMult + Math.random() * 60 * speedMult;
      switch (edge) {
        case 0: // left
          x = -margin; y = Math.random() * HEIGHT; vx = baseSpeed; vy = (Math.random() - 0.5) * baseSpeed * 0.6; break;
        case 1: // right
          x = WIDTH + margin; y = Math.random() * HEIGHT; vx = -baseSpeed; vy = (Math.random() - 0.5) * baseSpeed * 0.6; break;
        case 2: // top
          x = Math.random() * WIDTH; y = -margin; vx = (Math.random() - 0.5) * baseSpeed * 0.6; vy = baseSpeed; break;
        default: // bottom
          x = Math.random() * WIDTH; y = HEIGHT + margin; vx = (Math.random() - 0.5) * baseSpeed * 0.6; vy = -baseSpeed; break;
      }
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.rot = Math.random() * TAU;
      this.rotSpeed = (Math.random() - 0.5) * 2;
    }
    update(dt) {
      this.x += this.vx * dt / 1000;
      this.y += this.vy * dt / 1000;
      this.rot += this.rotSpeed * dt / 1000;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.fillStyle = '#f1fa8c';
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, -10, -6, 20, 12, 3, true, true);
      ctx.restore();
    }
    isOffscreen() {
      const m = 20;
      return this.x < -m || this.x > WIDTH + m || this.y < -m || this.y > HEIGHT + m;
    }
  }

  class Obstacle {
    constructor(level) {
      // Moving jellyfish-like obstacles
      this.radius = 18 + Math.random() * 10;
      this.x = Math.random() * WIDTH;
      this.y = Math.random() * HEIGHT;
      const speed = 40 + Math.random() * 30 + level * 6;
      const angle = Math.random() * TAU;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.wobbleT = Math.random() * TAU;
    }
    update(dt) {
      this.x += this.vx * dt / 1000;
      this.y += this.vy * dt / 1000;
      this.wobbleT += dt / 1000;
      // bounce on walls
      if (this.x < this.radius && this.vx < 0) this.vx *= -1;
      if (this.x > WIDTH - this.radius && this.vx > 0) this.vx *= -1;
      if (this.y < this.radius && this.vy < 0) this.vy *= -1;
      if (this.y > HEIGHT - this.radius && this.vy > 0) this.vy *= -1;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const r = this.radius + Math.sin(this.wobbleT * 3) * 2;
      const grd = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
      grd.addColorStop(0, 'rgba(173, 216, 230, 0.9)');
      grd.addColorStop(1, 'rgba(100, 149, 237, 0.4)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // Utility draw
  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // Collision helpers
  function circlesOverlap(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    const rr = (ar + br) * (ar + br);
    return dx * dx + dy * dy <= rr;
  }

  // Systems
  const fish = new Fish();
  const crackers = [];
  const obstacles = [];

  let lastTime = performance.now();
  let spawnCrackerTimer = 0;

  function difficultyAt(timeSec) {
    // Progressively ramp: more crackers speed and spawn, more obstacles
    const level = 1 + Math.floor(timeSec / 20);
    const crackerSpeedMult = 1 + timeSec * 0.02;
    const spawnEveryMs = Math.max(350, 1200 - timeSec * 10);
    const obstacleTarget = Math.min(2 + Math.floor(timeSec / 12), 12);
    return { level, crackerSpeedMult, spawnEveryMs, obstacleTarget };
  }

  function resetGame() {
    state.running = true;
    state.gameTime = 0;
    state.score = 0;
    state.level = 1;
    state.lifeRemaining = 5;
    state.invulnerableUntil = 0;

    crackers.length = 0;
    obstacles.length = 0;

    fish.x = WIDTH * 0.25;
    fish.y = HEIGHT * 0.5;
    fish.velX = 0; fish.velY = 0;

    spawnCrackerTimer = 0;
    overlay.hidden = true;
  }

  function gameOver() {
    state.running = false;
    overlay.hidden = false;
    titleEl.textContent = 'You Became Fish Food :(';
    subtitleEl.textContent = `Final Score ${state.score}. Press Start to try again.`;
  }

  startBtn.addEventListener('click', () => {
    resetGame();
  });

  // Main loop
  function loop(now) {
    const dt = Math.min(50, now - lastTime);
    lastTime = now;

    // Clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (state.running) {
      state.gameTime += dt / 1000;
      const diff = difficultyAt(state.gameTime);
      state.level = diff.level;

      // Spawn obstacles to target
      while (obstacles.length < diff.obstacleTarget) {
        obstacles.push(new Obstacle(state.level));
      }

      // Update fish
      fish.update(dt, now / 1000);

      // Spawn crackers
      spawnCrackerTimer += dt;
      if (spawnCrackerTimer >= diff.spawnEveryMs) {
        spawnCrackerTimer = 0;
        // spawn burst: 1-2 crackers
        const count = 1 + (Math.random() < 0.25 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          crackers.push(new Cracker(diff.crackerSpeedMult));
        }
      }

      // Update crackers
      for (let i = crackers.length - 1; i >= 0; i--) {
        const c = crackers[i];
        c.update(dt);
        if (c.isOffscreen()) crackers.splice(i, 1);
      }

      // Update obstacles
      for (const o of obstacles) o.update(dt);

      // Collisions: fish with crackers
      for (let i = crackers.length - 1; i >= 0; i--) {
        const c = crackers[i];
        if (circlesOverlap(fish.x, fish.y, fish.radius, c.x, c.y, c.radius)) {
          crackers.splice(i, 1);
          state.score += 10;
          state.lifeRemaining = Math.min(state.lifeRemaining + 1.6, state.lifeMaxCap);
        }
      }

      // Collisions: fish with obstacles
      if (now / 1000 > state.invulnerableUntil) {
        for (const o of obstacles) {
          if (circlesOverlap(fish.x, fish.y, fish.radius * 0.9, o.x, o.y, o.radius)) {
            state.lifeRemaining -= 2.5; // penalty
            state.invulnerableUntil = now / 1000 + 1.0;
            break;
          }
        }
      }

      // Life decay
      const baseDrain = 0.8; // per second
      const levelDrain = 0.04 * (state.level - 1);
      state.lifeRemaining -= (baseDrain + levelDrain) * dt / 1000;

      if (state.lifeRemaining <= 0) {
        state.lifeRemaining = 0;
        gameOver();
      }

      // Draw background ambience: bubbles
      drawBubbles(now);

      // Draw entities
      for (const c of crackers) c.draw(ctx);
      for (const o of obstacles) o.draw(ctx);
      fish.draw(ctx, now);

      // UI
      uiScore.textContent = `Score: ${state.score}`;
      uiLife.textContent = `Life: ${state.lifeRemaining.toFixed(1)}s`;
      uiLevel.textContent = `Level: ${state.level}`;

      // Invulnerability blink
      if (now / 1000 < state.invulnerableUntil) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(fish.x, fish.y, fish.radius + 6, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

    } else {
      // Idle background
      drawBubbles(now);
    }

    requestAnimationFrame(loop);
  }

  function drawBubbles(now) {
    const t = now / 1000;
    for (let i = 0; i < 30; i++) {
      const x = (i * 137 + Math.sin(t * (0.2 + i * 0.01)) * 500) % WIDTH;
      const y = (HEIGHT + (t * 20 + i * 80) % (HEIGHT + 120)) - 60;
      const r = 2 + (i % 5);
      ctx.globalAlpha = 0.15 + (i % 5) * 0.05;
      ctx.fillStyle = '#e0fbfc';
      ctx.beginPath();
      ctx.arc(x, HEIGHT - y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Start with overlay visible
  overlay.hidden = false;

  requestAnimationFrame((t) => {
    lastTime = t;
    loop(t);
  });
})();