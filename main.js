// Skyspire: Tower of Blades - Minimal 3D prototype using Babylon.js
// Controls: WASD move, mouse look (click to lock), LMB attack, E interact, Shift sprint, Space jump

const canvas = document.getElementById('renderCanvas');
/** @type {BABYLON.Engine} */
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true });

let scene;
let player;
let input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false, attack: false, interact: false };
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
  camera.attachControl(canvas, true);
  camera.inertia = 0.2;
  camera.angularSensibility = 3000;
  camera.minZ = 0.05;

  // Pointer lock
  canvas.addEventListener('click', () => {
    if (!isPointerLocked) {
      canvas.requestPointerLock();
    }
  });
  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas;
  });

  // Lighting
  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemi.intensity = 0.8;
  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.5, -1, 0.2), scene);
  dir.intensity = 0.6;

  // Ground/arena for a floor
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 50, height: 50 }, scene);
  const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.08, 0.1, 0.13);
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
  const swordHitbox = BABYLON.MeshBuilder.CreateBox('swordHitbox', { width: 0.2, height: 0.7, depth: 0.4 }, scene);
  swordHitbox.parent = camera;
  swordHitbox.position = new BABYLON.Vector3(0.6, -0.4, 1.2);
  swordHitbox.isVisible = false;

  // Enemies management
  /** @type {{mesh: BABYLON.AbstractMesh, health: number, maxHealth: number, damage: number, speed: number, xp: number}[]} */
  const enemies = [];

  function spawnEnemy(pos) {
    const body = BABYLON.MeshBuilder.CreateCapsule('enemy', { height: 1.6, radius: 0.35 }, scene);
    body.position.copyFrom(pos);
    const mat = new BABYLON.StandardMaterial('enemyMat', scene);
    mat.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.2);
    mat.emissiveColor = new BABYLON.Color3(0.3, 0.05, 0.05);
    body.material = mat;
    const enemy = { mesh: body, health: 40, maxHealth: 40, damage: 8, speed: 2.4, xp: 20 };
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

  // Simple physics params
  const moveSpeed = 4.2;
  const sprintMultiplier = 1.6;
  const gravity = -18;
  const jumpSpeed = 7.5;
  const friction = 8;

  // Collisions
  scene.collisionsEnabled = true;
  camera.checkCollisions = true;
  camera.applyGravity = true;
  ground.checkCollisions = true;
  wall1.checkCollisions = wall2.checkCollisions = wall3.checkCollisions = wall4.checkCollisions = true;
  camera.ellipsoid = new BABYLON.Vector3(0.5, 0.9, 0.5);

  // Attack timing
  let canAttack = true;
  let attackCooldownMs = 400;

  function tryAttack() {
    if (!canAttack) return;
    canAttack = false;
    swingSword();
    const enemiesHit = enemies.filter((e) => e.mesh.isDisposed() === false && swordHitbox.intersectsMesh(e.mesh, false));
    if (enemiesHit.length > 0) {
      const base = player.stats.attack;
      const isCrit = Math.random() < player.stats.critChance;
      const dmg = isCrit ? Math.floor(base * player.stats.critMultiplier) : base;
      enemiesHit.forEach((e) => {
        e.health -= dmg;
        floatingText(`-${dmg}${isCrit ? '!' : ''}`, e.mesh.position, isCrit ? '#ff4081' : '#ffd740');
        if (e.health <= 0) {
          floatingText('+XP', e.mesh.position, '#00e676');
          grantXP(e.xp);
          e.mesh.dispose();
          e.health = 0;
        }
      });
    }
    setTimeout(() => { canAttack = true; }, attackCooldownMs);
  }

  function swingSword() {
    // quick tween by rotating the sword around Y
    const anim = new BABYLON.Animation('swing', 'rotation.y', 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    const start = sword.rotation.y;
    const keys = [
      { frame: 0, value: start },
      { frame: 6, value: start - 1.1 },
      { frame: 12, value: start - 0.2 },
    ];
    anim.setKeys(keys);
    sword.animations = [anim];
    scene.beginAnimation(sword, 0, 12, false, 1.5);
  }

  // Floating damage text using GUI
  const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');
  function floatingText(text, worldPos, color = '#fff') {
    const label = new BABYLON.GUI.TextBlock();
    label.text = text;
    label.color = color;
    label.fontSize = 18;
    label.outlineColor = 'black';
    label.outlineWidth = 2;
    advancedTexture.addControl(label);
    let t = 0;
    const start = worldPos.clone();
    scene.onBeforeRenderObservable.add(() => {
      t += scene.getEngine().getDeltaTime() / 1000;
      const pos = start.add(new BABYLON.Vector3(0, t * 1.2, 0));
      label.linkWithMesh({ position: pos });
      label.alpha = Math.max(0, 1 - t);
      if (t > 1.2) {
        label.dispose();
      }
    });
  }

  // Simple enemy AI update
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;

    // Movement vector from inputs relative to camera
    const forward = camera.getDirection(BABYLON.Axis.Z);
    const right = camera.getDirection(BABYLON.Axis.X);
    forward.y = 0; right.y = 0;
    forward.normalize(); right.normalize();

    let desired = new BABYLON.Vector3(0, player.velocity.y, 0);
    if (input.forward) desired.addInPlace(forward);
    if (input.back) desired.addInPlace(forward.scale(-1));
    if (input.right) desired.addInPlace(right);
    if (input.left) desired.addInPlace(right.scale(-1));
    let speed = moveSpeed * (input.sprint ? sprintMultiplier : 1);
    if (desired.length() > 0.001) {
      desired = desired.normalize().scale(speed);
    }

    // Y velocity and jump
    player.velocity.y += gravity * dt;
    if (input.jump && player.onGround) {
      player.velocity.y = jumpSpeed;
      player.onGround = false;
    }

    // Horizontal smoothing
    const horizontalVel = new BABYLON.Vector3(player.velocity.x, 0, player.velocity.z);
    const targetHorizontal = new BABYLON.Vector3(desired.x, 0, desired.z);
    const accel = 20;
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

    // Apply movement
    camera.cameraDirection.addInPlace(player.velocity.scale(dt));

    // Simple ground check
    if (camera.position.y <= 1.8) {
      camera.position.y = 1.8;
      if (player.velocity.y < 0) player.velocity.y = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    // Enemies chase and attack
    enemies.forEach((e) => {
      if (e.mesh.isDisposed()) return;
      const toPlayer = camera.position.subtract(e.mesh.position);
      const distance = toPlayer.length();
      if (distance < 18) {
        const dirN = toPlayer.normalize();
        e.mesh.moveWithCollisions(dirN.scale(e.speed * dt));
        e.mesh.lookAt(camera.position.add(new BABYLON.Vector3(0, 1.4, 0)));
      }
      // Enemy attack if very close
      if (distance < 1.8 && Math.random() < 0.01) {
        player.stats.health -= e.damage;
        floatingText(`-${e.damage}`, camera.position.add(new BABYLON.Vector3(0, 1.6, 0)), '#ff5252');
        if (player.stats.health <= 0) {
          player.stats.health = 0;
          updateUI();
          setMessage('You were defeated. Press R to retry.', 0);
        } else {
          updateUI();
        }
      }
    });

    // Interactions (chests, portal)
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
    enemies.slice().forEach((e) => e.mesh.dispose());
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