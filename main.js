// Skyspire: Tower of Blades - Minimal 3D prototype using Babylon.js
// Controls: WASD move, mouse look (click to lock), LMB attack, E interact, Shift sprint, Space jump

const canvas = document.getElementById('renderCanvas');
/** @type {BABYLON.Engine} */
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, antialias: true, adaptToDeviceRatio: false });

const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0;
const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isMobile = isTouch || isMobileUA;
if (isMobile) document.body.classList.add('mobile');

function applyHardwareScaling() {
  if (isMobile) {
    engine.setHardwareScalingLevel(2); // downscale for performance but avoid extreme values on iOS
  } else {
    engine.setHardwareScalingLevel(1);
  }
}
applyHardwareScaling();
window.addEventListener('resize', () => { applyHardwareScaling(); engine.resize(); });

// Global error handlers to surface issues on devices without consoles
window.onerror = function(msg, url, line, col, error) {
  const m = document.getElementById('message');
  if (m) m.textContent = `Error: ${msg}`;
};
window.onunhandledrejection = function(e) {
  const m = document.getElementById('message');
  if (m) m.textContent = `Uncaught: ${e.reason && e.reason.message ? e.reason.message : e.reason}`;
};

let scene;
let player;
let input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, attack: false, interact: false, axisX: 0, axisY: 0 };
let isPointerLocked = false;
let currentFloor = 1;
let ui = {};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

function updateUI() {
  const hpPct = player.stats.health / player.stats.maxHealth;
  document.getElementById('healthBar').style.width = `${clamp(hpPct, 0, 1) * 100}%`;
  document.getElementById('healthText').textContent = `HP ${Math.ceil(player.stats.health)}/${player.stats.maxHealth}`;

  const xpPct = player.stats.xp / player.stats.xpToLevel;
  document.getElementById('xpBar').style.width = `${clamp(xpPct, 0, 1) * 100}%`;
  document.getElementById('xpText').textContent = `LV ${player.stats.level} | XP ${Math.floor(player.stats.xp)}/${player.stats.xpToLevel}`;

  document.getElementById('floorText').textContent = `Floor ${currentFloor}`;
}

function setMessage(text, timeoutMs = 2000) {
  const el = document.getElementById('message');
  el.textContent = text;
  if (timeoutMs > 0) {
    setTimeout(() => {
      if (el.textContent === text) el.textContent = '';
    }, timeoutMs);
  }
}

function createScene() {
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.01, 0.02, 0.05, 1);

  const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 1.8, -6), scene);
  scene.activeCamera = camera;
  camera.attachControl(canvas, true);
  camera.inertia = 0.15;
  camera.angularSensibility = isMobile ? 1200 : 1800;
  camera.minZ = 0.05;

  // Pointer lock (desktop only)
  if (!isMobile) {
    canvas.addEventListener('click', () => {
      if (!isPointerLocked) {
        canvas.requestPointerLock();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = document.pointerLockElement === canvas;
    });
  }

  // Lighting
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 1.1;
  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.5, -1, 0.2), scene);
  dir.intensity = 0.85;

  // Ground/arena for a floor
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 50, height: 50 }, scene);
  const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.12, 0.14, 0.18);
  groundMat.specularColor = BABYLON.Color3.Black();
  ground.material = groundMat;

  // Simple walls
  const wallMat = new BABYLON.StandardMaterial('wallMat', scene);
  wallMat.diffuseColor = new BABYLON.Color3(0.12, 0.14, 0.18);
  const wall1 = BABYLON.MeshBuilder.CreateBox('wall1', { width: 50, height: 6, depth: 1 }, scene);
  wall1.position = new BABYLON.Vector3(0, 3, 25);
  const wall2 = wall1.clone('wall2'); wall2.position = new BABYLON.Vector3(0, 3, -25);
  const wall3 = BABYLON.MeshBuilder.CreateBox('wall3', { width: 1, height: 6, depth: 50 }, scene); wall3.position = new BABYLON.Vector3(25, 3, 0);
  const wall4 = wall3.clone('wall4'); wall4.position = new BABYLON.Vector3(-25, 3, 0);
  wall1.material = wall2.material = wall3.material = wall4.material = wallMat;

  // Visible marker cube
  const marker = BABYLON.MeshBuilder.CreateBox('marker', { size: 0.5 }, scene);
  marker.position = new BABYLON.Vector3(0, 1, -2);
  const markerMat = new BABYLON.StandardMaterial('markerMat', scene);
  markerMat.emissiveColor = new BABYLON.Color3(0.1, 0.9, 0.2);
  marker.material = markerMat;

  // Player entity
  player = {
    camera,
    mesh: BABYLON.MeshBuilder.CreateCapsule('player', { height: 1.7, radius: 0.4 }, scene),
    velocity: new BABYLON.Vector3(0, 0, 0),
    onGround: false,
    stats: {
      level: 1,
      xp: 0,
      xpToLevel: 100,
      health: 100,
      maxHealth: 100,
      attack: 12,
      critChance: 0.1,
      critMultiplier: 1.8,
    },
  };
  player.mesh.isVisible = false; // use camera view

  // Sword (simple box) parented to camera
  const sword = BABYLON.MeshBuilder.CreateBox('sword', { width: 0.06, height: 0.7, depth: 0.12 }, scene);
  sword.parent = camera;
  sword.position = new BABYLON.Vector3(0.45, -0.4, 0.8);
  sword.rotation = new BABYLON.Vector3(0.2, -0.8, 0.1);
  const swordMat = new BABYLON.StandardMaterial('swordMat', scene);
  swordMat.diffuseColor = new BABYLON.Color3(0.8, 0.9, 1);
  swordMat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.7);
  sword.material = swordMat;

  // Sword hitbox
  const swordHitbox = BABYLON.MeshBuilder.CreateBox('swordHitbox', { width: 0.3, height: 0.8, depth: 0.6 }, scene);
  swordHitbox.parent = camera;
  swordHitbox.position = new BABYLON.Vector3(0.6, -0.35, 1.35);
  swordHitbox.isVisible = false;

  // Enemies management
  /** @type {{root: BABYLON.AbstractMesh, parts: Record<string,BABYLON.AbstractMesh>, health: number, maxHealth: number, damage: number, speed: number, xp: number, t:number}[]} */
  const enemies = [];

  function createHumanoid(scene, name = 'enemy') {
    const root = new BABYLON.TransformNode(name, scene);
    const torso = BABYLON.MeshBuilder.CreateBox(`${name}_torso`, { width: 0.7, height: 0.9, depth: 0.35 }, scene);
    const head = BABYLON.MeshBuilder.CreateSphere(`${name}_head`, { diameter: 0.45 }, scene);
    const legL = BABYLON.MeshBuilder.CreateBox(`${name}_legL`, { width: 0.18, height: 0.7, depth: 0.18 }, scene);
    const legR = legL.clone(`${name}_legR`);
    const armL = BABYLON.MeshBuilder.CreateBox(`${name}_armL`, { width: 0.16, height: 0.6, depth: 0.16 }, scene);
    const armR = armL.clone(`${name}_armR`);

    torso.parent = root; head.parent = root; legL.parent = root; legR.parent = root; armL.parent = root; armR.parent = root;
    torso.position = new BABYLON.Vector3(0, 1.1, 0);
    head.position = new BABYLON.Vector3(0, 1.7, 0);
    legL.position = new BABYLON.Vector3(-0.18, 0.55, 0);
    legR.position = new BABYLON.Vector3(0.18, 0.55, 0);
    armL.position = new BABYLON.Vector3(-0.5, 1.2, 0);
    armR.position = new BABYLON.Vector3(0.5, 1.2, 0);

    const mat = new BABYLON.StandardMaterial(`${name}_mat`, scene);
    mat.diffuseColor = new BABYLON.Color3(0.85, 0.25, 0.25);
    mat.emissiveColor = new BABYLON.Color3(0.25, 0.05, 0.05);
    torso.material = head.material = legL.material = legR.material = armL.material = armR.material = mat;

    return { root, parts: { torso, head, legL, legR, armL, armR } };
  }

  function spawnEnemy(pos) {
    const humanoid = createHumanoid(scene, `enemy_${enemies.length}`);
    humanoid.root.position.copyFrom(pos);
    const enemy = { root: humanoid.root, parts: humanoid.parts, health: 60, maxHealth: 60, damage: 10, speed: 3.2, xp: 30, t: Math.random() * Math.PI * 2 };
    // collision proxy for hits
    const hitProxy = BABYLON.MeshBuilder.CreateCapsule(`${humanoid.root.name}_col`, { height: 1.8, radius: 0.4 }, scene);
    hitProxy.position = pos.clone();
    hitProxy.isVisible = false;
    enemy.root.metadata = { proxy: hitProxy };
    enemies.push(enemy);
    return enemy;
  }

  function spawnChest(pos) {
    const chest = BABYLON.MeshBuilder.CreateBox('chest', { width: 0.8, height: 0.6, depth: 0.6 }, scene);
    chest.position.copyFrom(pos);
    const mat = new BABYLON.StandardMaterial('chestMat', scene);
    mat.diffuseColor = new BABYLON.Color3(0.7, 0.5, 0.2);
    mat.emissiveColor = new BABYLON.Color3(0.2, 0.15, 0.05);
    chest.material = mat;
    chest.metadata = { type: 'chest', opened: false };
    return chest;
  }

  function openChest(chest) {
    if (chest.metadata.opened) return;
    chest.metadata.opened = true;
    chest.material.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    // Loot: heal and chance for attack bonus
    const heal = Math.floor(15 + Math.random() * 20);
    player.stats.health = clamp(player.stats.health + heal, 0, player.stats.maxHealth);
    if (Math.random() < 0.4) {
      player.stats.attack += 3;
      setMessage(`Chest: +${heal} HP, Sword att +3`);
    } else {
      setMessage(`Chest: +${heal} HP`);
    }
    updateUI();
  }

  function grantXP(amount) {
    player.stats.xp += amount;
    while (player.stats.xp >= player.stats.xpToLevel) {
      player.stats.xp -= player.stats.xpToLevel;
      player.stats.level += 1;
      player.stats.xpToLevel = Math.floor(player.stats.xpToLevel * 1.35);
      player.stats.maxHealth += 20;
      player.stats.health = player.stats.maxHealth;
      player.stats.attack += 5;
      setMessage(`Level Up! Level ${player.stats.level}`);
    }
    updateUI();
  }

  // Override earlier spawn loop uses this spawnEnemy
  // Populate floor
  const chestA = spawnChest(new BABYLON.Vector3(3, 0.3, 3));
  const chestB = spawnChest(new BABYLON.Vector3(-8, 0.3, -4));

  for (let i = 0; i < 6; i++) {
    const x = (Math.random() - 0.5) * 36;
    const z = (Math.random() - 0.5) * 36;
    spawnEnemy(new BABYLON.Vector3(x, 0.8, z));
  }

  // Portal to next floor
  const portal = BABYLON.MeshBuilder.CreateTorus('portal', { diameter: 2.2, thickness: 0.18, tessellation: 32 }, scene);
  portal.position = new BABYLON.Vector3(0, 1.3, 20);
  const portalMat = new BABYLON.StandardMaterial('portalMat', scene);
  portalMat.emissiveColor = new BABYLON.Color3(0.2, 0.7, 1);
  portal.material = portalMat;

  // Keyboard
  const keyDown = (e) => {
    switch (e.code) {
      case 'KeyW': input.forward = true; break;
      case 'KeyS': input.back = true; break;
      case 'KeyA': input.left = true; break;
      case 'KeyD': input.right = true; break;
      case 'ShiftLeft': input.sprint = true; break;
      case 'Space': input.jump = true; break;
      case 'KeyE': input.interact = true; break;
    }
  };
  const keyUp = (e) => {
    switch (e.code) {
      case 'KeyW': input.forward = false; break;
      case 'KeyS': input.back = false; break;
      case 'KeyA': input.left = false; break;
      case 'KeyD': input.right = false; break;
      case 'ShiftLeft': input.sprint = false; break;
      case 'Space': input.jump = false; break;
      case 'KeyE': input.interact = false; break;
    }
  };
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);

  // Mouse attack
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) tryAttack();
  });
  // Touch attack for mobile (tap anywhere)
  if (isMobile) {
    canvas.addEventListener('touchstart', (e) => {
      // ignore touches that start inside joystick or buttons; they have their own handlers
      const touchedEl = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
      if (touchedEl && (touchedEl.id === 'joyLeft' || touchedEl.id === 'joyLeftStick' || touchedEl.closest && touchedEl.closest('#rightButtons'))) return;
      tryAttack();
    }, { passive: true });
  }

  // Simple physics params
  const moveSpeed = 6.5;
  const sprintMultiplier = 1.8;
  const gravity = -22;
  const jumpSpeed = 8.2;
  const friction = 10;

  // Collisions
  scene.collisionsEnabled = true;
  camera.checkCollisions = true;
  camera.applyGravity = true;
  ground.checkCollisions = true;
  wall1.checkCollisions = wall2.checkCollisions = wall3.checkCollisions = wall4.checkCollisions = true;
  camera.ellipsoid = new BABYLON.Vector3(0.5, 0.9, 0.5);

  // Attack timing and combo
  let canAttack = true;
  let comboStep = 0;
  let attackCooldownMs = 260;

  function tryAttack() {
    if (!canAttack) return;
    canAttack = false;
    comboStep = (comboStep + 1) % 3;
    playAttackAnimation(comboStep);

    // Damage window mid-swing
    setTimeout(() => applySwordDamage(), 120);
    setTimeout(() => { canAttack = true; }, attackCooldownMs);
  }

  function applySwordDamage() {
    const hits = enemies.filter((e) => !e.root.isDisposed() && swordHitbox.intersectsMesh(e.root.metadata.proxy, false));
    if (hits.length === 0) return;
    const base = player.stats.attack;
    const isCrit = Math.random() < player.stats.critChance;
    const dmg = isCrit ? Math.floor(base * player.stats.critMultiplier) : base;
    hits.forEach((e) => {
      e.health -= dmg;
      const p = e.root.position.clone(); p.y += 1.6;
      floatingText(`-${dmg}${isCrit ? '!' : ''}`, p, isCrit ? '#ff4081' : '#ffd740');
      if (e.health <= 0) {
        grantXP(e.xp);
        e.root.metadata.proxy.dispose();
        e.root.getChildMeshes().forEach(m => m.dispose());
        e.root.dispose();
      }
    });
  }

  function playAttackAnimation(step) {
    const base = sword.rotationQuaternion || BABYLON.Quaternion.FromEulerVector(sword.rotation);
    sword.rotationQuaternion = base.clone();
    const anim = new BABYLON.Animation('atk', 'rotationQuaternion', 60, BABYLON.Animation.ANIMATIONTYPE_QUATERNION, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    const q0 = sword.rotationQuaternion.clone();
    const swings = [
      BABYLON.Quaternion.FromEulerAngles(0.25, -1.2, 0.2),
      BABYLON.Quaternion.FromEulerAngles(0.05, -0.9, -0.4),
      BABYLON.Quaternion.FromEulerAngles(0.35, -1.4, 0.6),
    ];
    const q1 = swings[step];
    anim.setKeys([
      { frame: 0, value: q0 },
      { frame: 6, value: q1 },
      { frame: 12, value: q0 },
    ]);
    sword.animations = [anim];
    scene.beginAnimation(sword, 0, 12, false, 1.8);
  }

  // Floating damage text using GUI
  const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');
  function floatingText(text, worldPos, color = '#fff') {
    // iOS: avoid linking to non-mesh; compute screen coords instead
    const label = new BABYLON.GUI.TextBlock();
    label.text = text;
    label.color = color;
    label.fontSize = 18;
    label.outlineColor = 'black';
    label.outlineWidth = 2;
    advancedTexture.addControl(label);
    let t = 0;
    const start = worldPos.clone();
    const obs = scene.onBeforeRenderObservable.add(() => {
      t += scene.getEngine().getDeltaTime() / 1000;
      const pos = start.add(new BABYLON.Vector3(0, t * 1.2, 0));
      const proj = BABYLON.Vector3.Project(pos, BABYLON.Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
      label.left = proj.x - engine.getRenderWidth() / 2;
      label.top = proj.y - engine.getRenderHeight() / 2;
      label.alpha = Math.max(0, 1 - t);
      if (t > 1.2) {
        advancedTexture.removeControl(label);
        scene.onBeforeRenderObservable.remove(obs);
        label.dispose();
      }
    });
  }

  // Enemy idle/bob and proxy sync
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;
    enemies.forEach((e) => {
      if (e.root.isDisposed()) return;
      e.t += dt * 2.5;
      const bob = Math.sin(e.t) * 0.05;
      e.parts.legL.rotation.x = Math.sin(e.t * 3) * 0.3;
      e.parts.legR.rotation.x = Math.cos(e.t * 3) * 0.3;
      e.parts.armL.rotation.x = Math.cos(e.t * 3) * 0.2;
      e.parts.armR.rotation.x = Math.sin(e.t * 3) * 0.2;
      e.root.position.y = 0 + bob + 0.8;
      if (e.root.metadata && e.root.metadata.proxy) {
        e.root.metadata.proxy.position.copyFrom(e.root.position);
      }
    });
  });

  // Update loop modifications: include analog axes
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;

    const forward = camera.getDirection(BABYLON.Axis.Z);
    const right = camera.getDirection(BABYLON.Axis.X);
    forward.y = 0; right.y = 0; forward.normalize(); right.normalize();

    // Use digital or analog
    let analog = new BABYLON.Vector3(right.x * input.axisX + forward.x * input.axisY, 0, right.z * input.axisX + forward.z * input.axisY);
    let desired = analog;
    if (input.forward) desired.addInPlace(forward);
    if (input.back) desired.addInPlace(forward.scale(-1));
    if (input.right) desired.addInPlace(right);
    if (input.left) desired.addInPlace(right.scale(-1));

    let speed = moveSpeed * (input.sprint ? sprintMultiplier : 1);
    if (desired.length() > 0.001) desired = desired.normalize().scale(speed);

    // Y velocity and jump
    player.velocity.y += gravity * dt;
    if (input.jump && player.onGround) { player.velocity.y = jumpSpeed; player.onGround = false; }

    // Horizontal smoothing
    const horizontalVel = new BABYLON.Vector3(player.velocity.x, 0, player.velocity.z);
    const targetHorizontal = new BABYLON.Vector3(desired.x, 0, desired.z);
    const accel = 26;
    const diff = targetHorizontal.subtract(horizontalVel);
    const step = clamp(diff.length(), 0, accel * dt);
    if (diff.length() > 0.0001) {
      const delta = diff.normalize().scale(step);
      player.velocity.x += delta.x;
      player.velocity.z += delta.z;
    }

    // Friction
    player.velocity.x -= clamp(player.velocity.x, -friction, friction) * dt;
    player.velocity.z -= clamp(player.velocity.z, -friction, friction) * dt;

    camera.cameraDirection.addInPlace(player.velocity.scale(dt));

    if (camera.position.y <= 1.8) { camera.position.y = 1.8; if (player.velocity.y < 0) player.velocity.y = 0; player.onGround = true; } else { player.onGround = false; }

    // Enemy chase
    enemies.forEach((e) => {
      if (e.root.isDisposed()) return;
      const toPlayer = camera.position.subtract(e.root.position);
      const distance = toPlayer.length();
      if (distance < 20) {
        const dirN = toPlayer.normalize();
        e.root.moveWithCollisions(dirN.scale(e.speed * dt));
        e.root.lookAt(camera.position.add(new BABYLON.Vector3(0, 1.4, 0)));
      }
      if (distance < 1.7 && Math.random() < 0.015) {
        player.stats.health -= e.damage;
        floatingText(`-${e.damage}`, camera.position.add(new BABYLON.Vector3(0, 1.6, 0)), '#ff5252');
        updateUI();
      }
    });
  });

  // Interactions (chests, portal)
  scene.onBeforeRenderObservable.add(() => {
    if (input.interact) {
      const origin = camera.position.clone();
      const dirRay = camera.getDirection(BABYLON.Axis.Z);
      const ray = new BABYLON.Ray(origin, dirRay, 3);
      const pick = scene.pickWithRay(ray, (m) => m.metadata && (m.metadata.type === 'chest' || m.name === 'portal'));
      if (pick && pick.hit && pick.pickedMesh) {
        const m = pick.pickedMesh;
        if (m.metadata && m.metadata.type === 'chest') openChest(m);
        if (m.name === 'portal') nextFloor();
      }
    }
  });

  function nextFloor() {
    currentFloor += 1;
    setMessage(`Ascend to Floor ${currentFloor}`);
    // Clean enemies
    enemies.slice().forEach((e) => e.root.dispose());
    enemies.length = 0;

    // Spawn tougher enemies
    for (let i = 0; i < 6 + currentFloor; i++) {
      const x = (Math.random() - 0.5) * 36;
      const z = (Math.random() - 0.5) * 36;
      const enemy = spawnEnemy(new BABYLON.Vector3(x, 0.8, z));
      enemy.health += currentFloor * 10;
      enemy.maxHealth = enemy.health;
      enemy.damage += Math.floor(currentFloor * 1.5);
      enemy.speed += Math.min(currentFloor * 0.1, 1.5);
      enemy.xp += currentFloor * 6;
    }

    // Move portal and chests
    portal.position = new BABYLON.Vector3(0, 1.3, 20 - (currentFloor % 2) * 10);
    chestA.position = new BABYLON.Vector3(8 - currentFloor, 0.3, -6 + currentFloor);
    chestA.metadata.opened = false; chestA.material.diffuseColor = new BABYLON.Color3(0.7, 0.5, 0.2);
    chestB.position = new BABYLON.Vector3(-7 - currentFloor, 0.3, 7);
    chestB.metadata.opened = false; chestB.material.diffuseColor = new BABYLON.Color3(0.7, 0.5, 0.2);

    updateUI();
  }

  updateUI();
  return scene;
}

const sceneInstance = createScene();
engine.runRenderLoop(() => {
  scene.render();
});
window.addEventListener('resize', () => engine.resize());

// Reset on R
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') {
    location.reload();
  }
});

// Virtual controls implementation
function setupMobileControls() {
  const area = document.getElementById('joyLeft');
  const stick = document.getElementById('joyLeftStick');
  const btnAtk = document.getElementById('btnAtk');
  const btnUse = document.getElementById('btnUse');
  const btnJump = document.getElementById('btnJump');
  const btnSprint = document.getElementById('btnSprint');

  let center = { x: 0, y: 0 };
  let activeId = null;
  const maxRadius = 60; // px
  const deadZone = 8; // px

  function updateStick(dx, dy) {
    const dist = Math.min(maxRadius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist;
    stick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;

    // Map to movement flags
    input.forward = (sy < -deadZone);
    input.back = (sy > deadZone);
    input.left = (sx < -deadZone);
    input.right = (sx > deadZone);
  }

  function resetStick() {
    stick.style.transform = 'translate(-50%, -50%)';
    input.forward = input.back = input.left = input.right = false;
  }

  area.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    activeId = t.identifier;
    const rect = area.getBoundingClientRect();
    center.x = rect.left + rect.width / 2;
    center.y = rect.top + rect.height / 2;
    updateStick(t.clientX - center.x, t.clientY - center.y);
  }, { passive: true });

  area.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === activeId) {
        updateStick(t.clientX - center.x, t.clientY - center.y);
        break;
      }
    }
  }, { passive: true });

  area.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === activeId) {
        activeId = null;
        resetStick();
        break;
      }
    }
  });

  function press(btn, downFn, upFn) {
    btn.addEventListener('touchstart', (e) => { downFn(); }, { passive: true });
    btn.addEventListener('touchend', (e) => { if (upFn) upFn(); }, { passive: true });
  }

  if (btnAtk) press(btnAtk, () => tryAttack());
  if (btnUse) press(btnUse, () => { input.interact = true; setTimeout(() => input.interact = false, 120); });
  if (btnJump) press(btnJump, () => { input.jump = true; setTimeout(() => input.jump = false, 120); });
  if (btnSprint) press(btnSprint, () => { input.sprint = true; }, () => { input.sprint = false; });

  // Also map stick position to analog axes continuously
  function updateAxesFromStick(dx, dy) {
    const maxRadius = 60;
    const normX = Math.max(-1, Math.min(1, dx / maxRadius));
    const normY = Math.max(-1, Math.min(1, dy / maxRadius));
    input.axisX = normX; // right is +
    input.axisY = -normY; // up is +
  }

  area.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    activeId = t.identifier;
    const rect = area.getBoundingClientRect();
    center.x = rect.left + rect.width / 2;
    center.y = rect.top + rect.height / 2;
    const dx = t.clientX - center.x;
    const dy = t.clientY - center.y;
    updateStick(dx, dy);
    updateAxesFromStick(dx, dy);
  }, { passive: true });

  area.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === activeId) {
        const dx = t.clientX - center.x;
        const dy = t.clientY - center.y;
        updateStick(dx, dy);
        updateAxesFromStick(dx, dy);
        break;
      }
    }
  }, { passive: true });

  area.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === activeId) {
        activeId = null;
        resetStick();
        input.axisX = 0; input.axisY = 0;
        break;
      }
    }
  });
}

if (isMobile) {
  setupMobileControls();
}