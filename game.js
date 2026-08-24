
/* StickSmash — a Smash-Bros-style local stick-figure fighter
 * Built from hand-drawn stick-figure sprite sheets (walk / run / jump / punch / kick /
 * fireball / spinning uppercut). Single source of game logic; works both as a plain
 * repo page (loads assets/frames/*.png) and inside a self-contained single-file build
 * (window.SPRITE_BASE64 provides data URIs).
 */
(() => {
  "use strict";
 
  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------
  const CW = 960, CH = 540;
 
  const GRAVITY = 2000;
  const MAX_FALL = 980;
  const FASTFALL_BONUS = 620;
  const WALK_SPEED = 230;
  const RUN_SPEED = 400;
  const RUN_HOLD_TIME = 0.32;
  const GROUND_ACCEL = 2600;
  const GROUND_FRICTION = 2400;
  const AIR_ACCEL = 1400;
  const AIR_DRAG = 900;
  const JUMP_V = -800;
  const DOUBLE_JUMP_V = -720;
  const MAX_JUMPS = 2;
 
  const STOCK_COUNT = 3;
  const RESPAWN_INVUL = 1.6;
  const LASER_MAX_CHARGE = 2.0;
 
  const ACTIONS = ["run", "jump", "kick", "walk", "punch", "fireball", "spin", "swordwalk", "slice", "airslice", "tornado"];
  const FRAME_COUNT = 5;
 
  const MOVES = {
    punch: {
      frames: ["punch_2", "punch_3", "punch_4"],
      durs: [0.09, 0.10, 0.14],
      activeFrame: 1,
      damage: 7,
      baseKB: 260,
      scaleKB: 4.2,
      angleDeg: 62,
      hitboxW: 60, hitboxH: 56, hitboxYOff: -132,
      cooldown: 0.1,
      sfx: "punch",
    },
    kick: {
      frames: ["kick_0", "kick_1", "kick_2", "kick_3"],
      durs: [0.10, 0.08, 0.11, 0.11],
      activeFrame: 2,
      damage: 12,
      baseKB: 340,
      scaleKB: 5.8,
      angleDeg: 24,
      hitboxW: 78, hitboxH: 44, hitboxYOff: -70,
      cooldown: 0.15,
      sfx: "kick",
    },
    fireball: {
      frames: ["fireball_1", "fireball_2", "fireball_3", "fireball_4"],
      durs: [0.10, 0.09, 0.11, 0.14],
      activeFrame: 2,
      damage: 9,
      baseKB: 240,
      scaleKB: 3.6,
      angleDeg: 16,
      cooldown: 0.85,
      isProjectile: true,
      projSpeed: 560,
      projLife: 1.1,
      sfx: "fireball",
    },
    uppercut: {
      frames: ["spin_0", "spin_1", "spin_2", "spin_3", "spin_4"],
      durs: [0.07, 0.08, 0.13, 0.10, 0.10],
      activeFrame: 2,
      damage: 11,
      baseKB: 420,
      scaleKB: 5.5,
      angleDeg: 78,
      hitboxW: 100, hitboxH: 190, hitboxYOff: -190,
      cooldown: 1.1,
      launchVel: -900,
      sfx: "uppercut",
    },
    slice: {
      frames: ["slice_0", "slice_1", "slice_2", "slice_3", "slice_4"],
      durs: [0.06, 0.07, 0.09, 0.08, 0.07],
      activeFrame: 2,
      damage: 10,
      baseKB: 300,
      scaleKB: 4.6,
      angleDeg: 38,
      hitboxW: 100, hitboxH: 64, hitboxYOff: -138,
      cooldown: 0.22,
      sfx: "slice",
    },
    airslice: {
      frames: ["airslice_0", "airslice_1", "airslice_2", "airslice_3", "airslice_4"],
      durs: [0.06, 0.07, 0.08, 0.08, 0.07],
      activeFrame: 2,
      damage: 12,
      baseKB: 320,
      scaleKB: 4.8,
      angleDeg: 20,
      hitboxW: 100, hitboxH: 90, hitboxYOff: -150,
      cooldown: 0.45,
      sfx: "slice",
    },
    tornado: {
      // Big, sweeping multi-hit move: swirling sword tornado around Lance's
      // whole body (aoe: not offset by facing) that ticks damage repeatedly
      // for as long as a foe stays inside it — "a lot of damage" per the
      // request. Plays straight through the 5 real tornado frames once, no
      // frame-repeating trick; the multi-hit comes from tickInterval landing
      // several ticks within that single natural pass.
      frames: ["tornado_0", "tornado_1", "tornado_2", "tornado_3", "tornado_4"],
      durs: [0.09, 0.09, 0.10, 0.10, 0.11],
      multiHit: true,
      aoe: true,
      tickInterval: 0.1,
      tickDamage: 8,
      tickBaseKB: 115,
      tickScaleKB: 2.2,
      angleDeg: 55,
      hitboxW: 170, hitboxH: 210, hitboxYOff: -200,
      cooldown: 1.3,
      sfx: "tornado",
    },
  };
 
  const KEYMAPS = {
    p1: { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", punch: "KeyF", kick: "KeyG", fireball: "KeyR", uppercut: "KeyT", laser: "KeyY" },
    p2: { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", punch: "KeyK", kick: "KeyL", fireball: "KeyI", uppercut: "KeyO", laser: "KeyP" },
  };
 
  // ---------------------------------------------------------------------
  // Characters — same hand-drawn stick-figure art, different accent color
  // and a handful of stat multipliers.
  // ---------------------------------------------------------------------
  const CHARACTERS = [
    {
      id: "twilight", name: "Twilight", color: "#5b4fe0",
      blurb: "Balanced all-rounder: punch, kick, fireball, spin uppercut, and a chargeable laser.",
      speedMul: 1, jumpMul: 1, scaleMul: 1, kbTakenMul: 1, powerMul: 1,
      idleAction: "punch", walkAction: "walk", runAction: "run", jumpAction: "jump",
      // Reference canvas height (px) of this character's idle-pose sprite —
      // drawPlayer scales every frame off this, not that frame's own natural
      // height, so a taller-canvas action (a big swing with extra headroom
      // for the sword) doesn't make the character balloon in size on screen.
      refHeight: 250,
      moveMap: { punch: "punch", kick: "kick", fireball: "fireball", uppercut: "uppercut", laser: "laser" },
    },
    {
      id: "lance", name: "Lance", color: "#2ea8a8",
      blurb: "Sword fighter: slice on the ground, air slice while airborne, and a heavy multi-hit sword tornado.",
      speedMul: 1, jumpMul: 1, scaleMul: 1, kbTakenMul: 1, powerMul: 1,
      idleAction: "swordwalk", walkAction: "swordwalk", runAction: "swordwalk", jumpAction: "jump",
      refHeight: 176,
      moveMap: {
        punch: (p) => (p.grounded ? "slice" : "airslice"),
        kick: (p) => (p.grounded ? "slice" : "airslice"),
        fireball: "tornado",
        uppercut: null,
        laser: null,
      },
    },
  ];
 
  // ---------------------------------------------------------------------
  // Stages — grounds[] are solid (never drop-through); platforms[] are
  // one-way. Multiple ground segments let a stage have a gap/pit.
  // ---------------------------------------------------------------------
  const STAGES = [
    {
      id: "battlefield", name: "Battlefield",
      grounds: [{ x1: 90, x2: 870, y: 460 }],
      platforms: [{ x1: 180, x2: 360, y: 224 }, { x1: 600, x2: 780, y: 224 }],
      groundY: 460, stageL: 90, stageR: 870,
      blast: { l: -140, r: 1100, t: -320, b: 660 },
      sky: ["#cfe8ff", "#eaf6ff", "#fef9ec"], ground: "#efe6cf", grass: "#8fd18a", plat: "#ffe27a", cloud: "rgba(255,255,255,0.75)",
    },
    {
      id: "skyisle", name: "Sky Isle",
      grounds: [{ x1: 330, x2: 630, y: 460 }],
      platforms: [{ x1: 150, x2: 290, y: 280 }, { x1: 670, x2: 810, y: 280 }, { x1: 410, x2: 550, y: 150 }],
      groundY: 460, stageL: 330, stageR: 630,
      blast: { l: -140, r: 1100, t: -320, b: 660 },
      sky: ["#8ec9ff", "#bfe3ff", "#e8f7ff"], ground: "#cdb98e", grass: "#e8d27a", plat: "#a7e0ff", cloud: "rgba(255,255,255,0.85)",
    },
    {
      id: "dusk", name: "Dusk Field",
      grounds: [{ x1: 40, x2: 920, y: 460 }],
      platforms: [],
      groundY: 460, stageL: 40, stageR: 920,
      blast: { l: -160, r: 1120, t: -320, b: 660 },
      sky: ["#ffb37a", "#ffd9a0", "#fff3d6"], ground: "#7a5a4a", grass: "#d97b4a", plat: "#ffcf8a", cloud: "rgba(255,240,220,0.65)",
    },
    {
      id: "twinpeaks", name: "Twin Peaks",
      grounds: [{ x1: 60, x2: 330, y: 460 }, { x1: 630, x2: 900, y: 460 }],
      platforms: [{ x1: 420, x2: 540, y: 300 }],
      groundY: 460, stageL: 60, stageR: 900,
      spawn: [195, 765],
      blast: { l: -140, r: 1120, t: -320, b: 660 },
      sky: ["#c9b8d9", "#e3cfe0", "#f6e6d8"], ground: "#8a6b5a", grass: "#b98a63", plat: "#d9b3e0", cloud: "rgba(255,235,245,0.55)",
    },
    {
      id: "tower", name: "The Tower",
      grounds: [{ x1: 400, x2: 560, y: 460 }],
      platforms: [{ x1: 260, x2: 420, y: 350 }, { x1: 540, x2: 700, y: 250 }, { x1: 340, x2: 500, y: 140 }],
      groundY: 460, stageL: 260, stageR: 700,
      spawn: [430, 530],
      blast: { l: -160, r: 1120, t: -380, b: 660 },
      sky: ["#141a33", "#232a52", "#3a3465"], ground: "#232030", grass: "#4fd1ff", plat: "#4fd1ff", cloud: "rgba(255,255,255,0.9)",
      stars: true,
    },
  ];
 
  // ---------------------------------------------------------------------
  // Asset loading
  // ---------------------------------------------------------------------
  function spriteSrcCandidates(action, i) {
    if (window.SPRITE_BASE64 && window.SPRITE_BASE64[action] && window.SPRITE_BASE64[action][i]) {
      return [window.SPRITE_BASE64[action][i]];
    }
    // Try the organized assets/frames/ layout first, then fall back to the
    // sprites sitting flat next to index.html — e.g. GitHub's web upload UI
    // drops individually-added files flat unless a whole folder is dragged
    // in, so a repo can easily end up without the assets/frames/ subfolder.
    return [`assets/frames/${action}_${i}.png`, `${action}_${i}.png`];
  }
 
  const IMAGES = {}; // key "action_i" -> HTMLImageElement
  function loadAllSprites(onProgress) {
    return new Promise((resolve) => {
      const keys = [];
      ACTIONS.forEach((a) => { for (let i = 0; i < FRAME_COUNT; i++) keys.push(`${a}_${i}`); });
      let loaded = 0;
      const markLoaded = () => {
        loaded++;
        onProgress(loaded / keys.length);
        if (loaded === keys.length) resolve();
      };
      keys.forEach((key) => {
        const [action, iStr] = key.split("_");
        const srcs = spriteSrcCandidates(action, iStr);
        const img = new Image();
        let attempt = 0;
        img.onload = markLoaded;
        img.onerror = () => {
          if (attempt < srcs.length) {
            img.src = srcs[attempt++];
          } else {
            markLoaded(); // every candidate failed — don't hang the loading bar
          }
        };
        img.src = srcs[attempt++];
        IMAGES[key] = img;
      });
    });
  }
 
  // ---------------------------------------------------------------------
  // Tiny procedural audio (no external files)
  // ---------------------------------------------------------------------
  let actx = null;
  function ensureAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
    } else if (actx.state === "suspended") {
      actx.resume();
    }
  }
  function beep(freq, dur, type = "square", vol = 0.18, sweepTo = null) {
    if (!actx) return;
    const t0 = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 1), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(actx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  function noiseBurst(dur, vol = 0.22) {
    if (!actx) return;
    const bufferSize = Math.floor(actx.sampleRate * dur);
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = actx.createBufferSource();
    src.buffer = buffer;
    const gain = actx.createGain();
    gain.gain.setValueAtTime(vol, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    src.connect(gain).connect(actx.destination);
    src.start();
  }
  const SFX = {
    jump: () => beep(520, 0.12, "square", 0.14, 720),
    doubleJump: () => beep(620, 0.14, "square", 0.16, 900),
    punch: () => { beep(180, 0.08, "square", 0.2, 90); noiseBurst(0.06, 0.15); },
    kick: () => { beep(120, 0.12, "sawtooth", 0.22, 60); noiseBurst(0.09, 0.2); },
    fireball: () => { beep(220, 0.12, "sawtooth", 0.2, 480); noiseBurst(0.07, 0.15); },
    uppercut: () => { beep(300, 0.18, "square", 0.2, 760); },
    slice: () => { beep(260, 0.09, "sawtooth", 0.2, 140); noiseBurst(0.05, 0.16); },
    tornado: () => { beep(200, 0.22, "sawtooth", 0.22, 90); noiseBurst(0.14, 0.22); },
    laser: (frac) => { beep(300 + frac * 500, 0.16 + frac * 0.14, "sawtooth", 0.24, 950 + frac * 650); noiseBurst(0.06, 0.14); },
    land: () => beep(90, 0.07, "square", 0.1, 60),
    ko: () => { beep(700, 0.4, "sawtooth", 0.2, 40); },
    hit: () => noiseBurst(0.05, 0.18),
    start: () => { beep(440, 0.1, "square", 0.15, 660); },
    select: () => beep(500, 0.06, "square", 0.12, 640),
  };
 
  // ---------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (cur, target, delta) => {
    if (cur < target) return Math.min(cur + delta, target);
    if (cur > target) return Math.max(cur - delta, target);
    return cur;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
 
  // ---------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------
  class Player {
    constructor(id, charDef, spawnX, keymap, isCPU, label, slotColor) {
      this.id = id;
      this.charDef = charDef;
      // Player-slot color (P1/P2/CPU) is independent of the character's own
      // signature color, so two players sharing a character are still
      // readable at a glance in-match.
      this.color = slotColor || charDef.color;
      this.label = label;
      this.spawnX = spawnX;
      this.keymap = keymap;
      this.isCPU = isCPU;
      this.reset(true);
    }
 
    reset(fullReset, groundY) {
      this.x = this.spawnX;
      this.y = groundY != null ? groundY : this.y;
      this.vx = 0;
      this.vy = 0;
      this.facing = this.spawnX < CW / 2 ? 1 : -1;
      this.grounded = false;
      this.onPlatformIndex = -1;
      this.jumpsUsed = 0;
      this.state = "fall";
      this.action = "punch"; // idle uses punch_0/punch_1
      this.frameIndex = 0;
      this.animTimer = 0;
      this.walkDist = 0;
      this.runHoldTimer = 0;
      this.attack = null; // {move, key, stepIndex, stepTimer, hasHit}
      this.charging = null; // {t} while charging the laser
      // Keyed dynamically by resolved move name (varies per character's moveMap),
      // not just the fixed input slots — see Game.resolveMoveKey / tryMove.
      this.cooldowns = {};
      this.dropThroughTimer = 0;
      if (fullReset) {
        this.damage = 0;
        this.stocks = STOCK_COUNT;
        this.dead = false;
        this.invul = 0;
      } else {
        this.damage = 0;
        this.invul = RESPAWN_INVUL;
      }
      this.squash = 1;
      this.aiTimer = 0;
      this.aiInput = { left: false, right: false, up: false, down: false, punch: false, kick: false, fireball: false, uppercut: false, laser: false };
    }
 
    get isBusy() {
      return !!this.attack || !!this.charging;
    }
 
    hurtbox() {
      const s = this.charDef.scaleMul;
      return { x: this.x - 34 * s, y: this.y - 196 * s, w: 68 * s, h: 196 * s };
    }
  }
 
  // ---------------------------------------------------------------------
  // Game
  // ---------------------------------------------------------------------
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.keys = new Set();
      this.mode = "2p"; // '2p' | 'cpu'
      this.state = "menu"; // menu | charselect | stageselect | countdown | playing | gameover
      this.countdownT = 0;
      this.shake = 0;
      this.particles = [];
      this.projectiles = [];
      this.laserFlash = null;
      this.lastTime = null;
      this.winner = null;
      this.stage = STAGES[0];
 
      this.pick = { p1: 0, p2: 0, stage: 0 };
 
      this.players = [];
 
      window.addEventListener("keydown", (e) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
        this.keys.add(e.code);
        if (e.code === "Enter" || e.code === "Space") this.onConfirm();
        if (e.code === "KeyR" && this.state === "gameover") this.startMatch();
        if (e.code === "Escape" && (this.state === "playing" || this.state === "gameover")) this.toMenu();
      });
      window.addEventListener("keyup", (e) => this.keys.delete(e.code));
 
      requestAnimationFrame((t) => this.loop(t));
    }
 
    onConfirm() {
      if (this.state === "menu") this.goCharSelect();
      else if (this.state === "charselect") this.goStageSelect();
      else if (this.state === "stageselect") this.startMatch();
      else if (this.state === "gameover") this.startMatch();
    }
 
    showScreen(id) {
      ["menu-screen", "charselect-screen", "stageselect-screen", "gameover-screen"].forEach((sid) => {
        document.getElementById(sid).classList.toggle("hidden", sid !== id);
      });
    }
 
    toMenu() {
      this.state = "menu";
      this.showScreen("menu-screen");
    }
 
    setMode(mode) {
      this.mode = mode;
      document.querySelectorAll(".mode-btn[data-mode]").forEach((b) => b.classList.toggle("selected", b.dataset.mode === mode));
    }
 
    goCharSelect() {
      ensureAudio();
      SFX.select();
      this.state = "charselect";
      document.getElementById("p2-pick-label").textContent = this.mode === "cpu" ? "CPU" : "Player 2";
      document.getElementById("p2-pick-label").style.color = this.mode === "cpu" ? "#9b3fe6" : "#e6522c";
      this.refreshCharSelection();
      this.showScreen("charselect-screen");
    }
 
    refreshCharSelection() {
      document.querySelectorAll("#p1-char-grid .char-card").forEach((el, i) => el.classList.toggle("selected", i === this.pick.p1));
      document.querySelectorAll("#p2-char-grid .char-card").forEach((el, i) => el.classList.toggle("selected", i === this.pick.p2));
    }
 
    goStageSelect() {
      ensureAudio();
      SFX.select();
      this.state = "stageselect";
      this.refreshStageSelection();
      this.showScreen("stageselect-screen");
    }
 
    refreshStageSelection() {
      document.querySelectorAll("#stage-grid .stage-card").forEach((el, i) => el.classList.toggle("selected", i === this.pick.stage));
    }
 
    startMatch() {
      ensureAudio();
      SFX.start();
      this.showScreen(null);
 
      this.stage = STAGES[this.pick.stage];
      let spawn1, spawn2;
      if (this.stage.spawn) {
        [spawn1, spawn2] = this.stage.spawn;
      } else {
        const w = this.stage.stageR - this.stage.stageL;
        spawn1 = this.stage.stageL + w * 0.28;
        spawn2 = this.stage.stageL + w * 0.72;
      }
 
      const char1 = CHARACTERS[this.pick.p1] || CHARACTERS[0];
      const char2 = CHARACTERS[this.pick.p2] || CHARACTERS[0];
 
      const p1 = new Player("p1", char1, spawn1, KEYMAPS.p1, false, "P1", "#2f6fed");
      const p2Label = this.mode === "cpu" ? "CPU" : "P2";
      const p2Color = this.mode === "cpu" ? "#9b3fe6" : "#e6522c";
      const p2 = new Player("p2", char2, spawn2, KEYMAPS.p2, this.mode === "cpu", p2Label, p2Color);
      p1.y = this.stage.groundY;
      p2.y = this.stage.groundY;
      this.players = [p1, p2];
      this.particles = [];
      this.projectiles = [];
      this.laserFlash = null;
      this.shake = 0;
      this.state = "countdown";
      this.countdownT = 2.2;
    }
 
    endMatch(winner) {
      this.state = "gameover";
      this.winner = winner;
      this.showScreen("gameover-screen");
      document.getElementById("winner-line").textContent =
        winner ? `${winner.label} wins the match!` : "Draw!";
      document.getElementById("winner-title").style.textShadow =
        `4px 4px 0 ${winner ? winner.color : "#888"}`;
    }
 
    // -------------------------------------------------------------
    // Input helpers
    // -------------------------------------------------------------
    inputFor(player) {
      if (player.isCPU) return player.aiInput;
      const km = player.keymap;
      return {
        left: this.keys.has(km.left),
        right: this.keys.has(km.right),
        up: this.keys.has(km.up),
        down: this.keys.has(km.down),
        punch: this.keys.has(km.punch),
        kick: this.keys.has(km.kick),
        fireball: this.keys.has(km.fireball),
        uppercut: this.keys.has(km.uppercut),
        laser: this.keys.has(km.laser),
      };
    }
 
    // -------------------------------------------------------------
    // Simple CPU brain
    // -------------------------------------------------------------
    updateCPU(cpu, foe, dt) {
      cpu.aiTimer -= dt;
      const input = cpu.aiInput;
      if (cpu.aiTimer <= 0) {
        cpu.aiTimer = rand(0.08, 0.16);
        const dx = foe.x - cpu.x;
        const dist = Math.abs(dx);
        input.left = input.right = input.up = input.down = input.punch = input.kick = input.fireball = input.uppercut = false;
 
        const stageL = this.stage.stageL, stageR = this.stage.stageR;
        const nearLeftEdge = cpu.x < stageL + 50 && cpu.grounded;
        const nearRightEdge = cpu.x > stageR - 50 && cpu.grounded;
 
        // What this character's slots actually do — varies by moveMap, so the
        // AI shouldn't assume everyone has a ranged fireball or a recovery uppercut.
        const mm = cpu.charDef.moveMap || {};
        const isRangedFireball = mm.fireball === "fireball";
        const heavyCloseMove = mm.fireball && mm.fireball !== "fireball" ? mm.fireball : null; // e.g. Lance's tornado
        const hasUppercut = mm.uppercut === "uppercut";
        const cd = (key) => cpu.cooldowns[key] || 0;
 
        if (!cpu.isBusy) {
          if (isRangedFireball && dist > 220 && cd("fireball") <= 0 && Math.random() < 0.22) {
            input.fireball = true;
            if (dx < 0) cpu.facing = -1; else cpu.facing = 1;
          } else if (dist > 68) {
            if (dx < 0 && !nearLeftEdge) input.left = true;
            else if (dx > 0 && !nearRightEdge) input.right = true;
            else if (nearLeftEdge) input.right = true;
            else if (nearRightEdge) input.left = true;
          } else {
            const roll = Math.random();
            if (heavyCloseMove && roll < 0.18 && cd(heavyCloseMove) <= 0) input.fireball = true;
            else if (roll < 0.55) input.kick = true;
            else if (roll < 0.9) input.punch = true;
            else if (hasUppercut && cd("uppercut") <= 0) input.uppercut = true;
          }
          if ((foe.y < cpu.y - 70 && dist < 260 && Math.random() < 0.5) || Math.random() < 0.01) {
            input.up = true;
          }
          // recovery: if fallen off, move back & jump/uppercut toward stage center
          if (!cpu.grounded && (cpu.x < stageL || cpu.x > stageR) && cpu.y > 250) {
            input.left = cpu.x > CW / 2;
            input.right = cpu.x <= CW / 2;
            if (hasUppercut && cd("uppercut") <= 0) input.uppercut = true;
            else input.up = cpu.jumpsUsed < MAX_JUMPS;
          }
        }
      }
    }
 
    // -------------------------------------------------------------
    // Physics + state update for one player
    // -------------------------------------------------------------
    updatePlayer(p, foe, dt) {
      if (p.dead) return;
      if (p.isCPU) this.updateCPU(p, foe, dt);
      const input = this.inputFor(p);
      const stage = this.stage;
      const cd = p.charDef;
 
      if (p.invul > 0) p.invul = Math.max(0, p.invul - dt);
      if (p.dropThroughTimer > 0) p.dropThroughTimer -= dt;
      for (const k in p.cooldowns) {
        if (p.cooldowns[k] > 0) p.cooldowns[k] -= dt;
      }
 
      if (p.attack) {
        // locked into attack animation; allow tiny drift only
        p.vx = approach(p.vx, 0, GROUND_FRICTION * dt);
      } else if (p.charging) {
        p.vx = approach(p.vx, 0, GROUND_FRICTION * dt);
        if (!p.grounded) {
          // knocked airborne mid-charge — the charge fizzles
          p.charging = null;
        } else if (!input.laser || p.charging.t >= LASER_MAX_CHARGE) {
          this.fireLaser(p, foe);
        } else {
          p.charging.t += dt;
        }
      } else {
        // ---- Horizontal movement (no hitstun lockout — always controllable) ----
        const wantLeft = input.left, wantRight = input.right;
        let targetSpeed = 0;
        if (wantLeft && !wantRight) { targetSpeed = -WALK_SPEED * cd.speedMul; p.facing = -1; }
        else if (wantRight && !wantLeft) { targetSpeed = WALK_SPEED * cd.speedMul; p.facing = 1; }
 
        if (targetSpeed !== 0) {
          p.runHoldTimer += dt;
          if (p.runHoldTimer > RUN_HOLD_TIME && p.grounded) {
            targetSpeed = targetSpeed < 0 ? -RUN_SPEED * cd.speedMul : RUN_SPEED * cd.speedMul;
          }
        } else {
          p.runHoldTimer = 0;
        }
 
        const accel = p.grounded ? GROUND_ACCEL : AIR_ACCEL;
        const maxRun = RUN_SPEED * cd.speedMul;
        if (targetSpeed !== 0) {
          p.vx = approach(p.vx, p.grounded ? targetSpeed : clamp(p.vx + Math.sign(targetSpeed) * accel * dt, -maxRun, maxRun), accel * dt);
        } else {
          const fr = p.grounded ? GROUND_FRICTION : AIR_DRAG;
          p.vx = approach(p.vx, 0, fr * dt);
        }
 
        // ---- Jump ----
        if (input.up && !p._upHeldLast) {
          if (p.grounded || p.jumpsUsed < MAX_JUMPS) {
            p.vy = (p.jumpsUsed === 0 ? JUMP_V : DOUBLE_JUMP_V) * cd.jumpMul;
            p.jumpsUsed++;
            p.grounded = false;
            p.onPlatformIndex = -1;
            p.action = "jump"; p.frameIndex = 0; p.animTimer = 0; p.state = "jump";
            (p.jumpsUsed > 1 ? SFX.doubleJump : SFX.jump)();
            p.squash = 1.25;
          }
        }
        p._upHeldLast = input.up;
 
        // ---- Drop through platform ----
        if (input.down && p.grounded && p.onPlatformIndex >= 0) {
          p.dropThroughTimer = 0.28;
          p.grounded = false;
        }
 
        // ---- Attacks & specials ----
        // Each input slot (punch/kick/fireball/uppercut/laser) is resolved through
        // the character's moveMap to an actual move key — a static string, a
        // context-sensitive function (e.g. Lance's slice vs airslice), or
        // null/absent to disable that slot entirely for this character.
        this.tryMove(p, "punch", input.punch) ||
        this.tryMove(p, "kick", input.kick) ||
        this.tryMove(p, "fireball", input.fireball) ||
        this.tryMove(p, "uppercut", input.uppercut) ||
        this.tryMove(p, "laser", input.laser);
      }
 
      // ---- Gravity ----
      if (!p.grounded) {
        let g = GRAVITY;
        p.vy += g * dt;
        if (input.down && p.vy > 0) p.vy += FASTFALL_BONUS * dt;
        p.vy = Math.min(p.vy, MAX_FALL);
      } else {
        p.vy = 0;
      }
 
      // ---- Integrate ----
      const wasGrounded = p.grounded;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.walkDist += Math.abs(p.vx * dt);
 
      // ---- Ground / platform collision ----
      p.grounded = false;
      p.onPlatformIndex = -1;
      if (p.vy >= 0) {
        for (const g of stage.grounds) {
          if (p.x > g.x1 - 8 && p.x < g.x2 + 8 && p.y >= g.y) {
            p.y = g.y; p.grounded = true; p.vy = 0;
            break;
          }
        }
        if (!p.grounded) {
          stage.platforms.forEach((pl, idx) => {
            if (p.dropThroughTimer > 0) return;
            if (p.x > pl.x1 + 6 && p.x < pl.x2 - 6) {
              const prevY = p.y - p.vy * dt;
              if (prevY <= pl.y + 2 && p.y >= pl.y) {
                p.y = pl.y; p.grounded = true; p.vy = 0; p.onPlatformIndex = idx;
              }
            }
          });
        }
      }
      if (p.grounded) {
        p.jumpsUsed = 0;
        if (!wasGrounded) { SFX.land(); p.squash = 1.35; this.spawnDust(p.x, p.y); }
      }
 
      // ---- Squash/stretch relax ----
      p.squash = approach(p.squash, 1, dt * 4);
 
      // ---- Attack progression ----
      if (p.attack) this.updateAttack(p, foe, dt);
 
      // ---- Animation state selection ----
      this.updateAnimation(p, dt);
 
      // ---- Blast zone check ----
      const b = stage.blast;
      if (p.x < b.l || p.x > b.r || p.y < b.t || p.y > b.b) {
        this.koPlayer(p);
      }
    }
 
    // Resolve an abstract input slot (punch/kick/fireball/uppercut/laser) to an
    // actual move key for this character, via their moveMap. Returns null if the
    // slot is disabled for this character.
    resolveMoveKey(p, slot) {
      const mm = p.charDef.moveMap;
      const mapped = mm ? mm[slot] : slot;
      if (mapped == null) return null;
      return typeof mapped === "function" ? mapped(p) : mapped;
    }
 
    tryMove(p, slot, pressed) {
      if (!pressed) return false;
      const moveKey = this.resolveMoveKey(p, slot);
      if (!moveKey) return false;
      if (moveKey === "laser") {
        if ((p.cooldowns.laser || 0) <= 0) { p.charging = { t: 0 }; return true; }
        return false;
      }
      if ((p.cooldowns[moveKey] || 0) <= 0) {
        this.beginAttack(p, moveKey);
        return true;
      }
      return false;
    }
 
    beginAttack(p, key) {
      const move = MOVES[key];
      p.attack = { key, move, stepIndex: 0, stepTimer: move.durs[0], hasHit: false };
      p.action = move.frames[0].split("_")[0];
      p.frameIndex = parseInt(move.frames[0].split("_")[1], 10);
      p.animTimer = 0;
      p.state = key;
      if (move.launchVel) {
        p.vy = move.launchVel * p.charDef.jumpMul;
        p.grounded = false;
        p.onPlatformIndex = -1;
      }
      SFX[move.sfx]();
    }
 
    updateAttack(p, foe, dt) {
      const a = p.attack;
      const move = a.move;
      a.stepTimer -= dt;
 
      if (move.multiHit) {
        // Ticks damage repeatedly for as long as the attack animation runs and
        // a foe stays inside the (typically surrounding/"aoe") hitbox — e.g.
        // Lance's sword tornado — rather than a single activeFrame hit-check.
        a.tickTimer = (a.tickTimer || 0) - dt;
        if (a.tickTimer <= 0) {
          a.tickTimer = move.tickInterval;
          const s = p.charDef.scaleMul;
          const w = move.hitboxW * s, h = move.hitboxH * s;
          const hb = { x: 0, y: p.y + move.hitboxYOff * s, w, h };
          if (move.aoe) hb.x = p.x - w / 2;
          else hb.x = p.facing > 0 ? p.x + 6 : p.x - 6 - w;
          if (rectsOverlap(hb, foe.hurtbox()) && foe.invul <= 0 && !foe.dead) {
            this.dealHit(p, foe, move.tickDamage * p.charDef.powerMul, move.tickBaseKB, move.tickScaleKB, move.angleDeg);
          }
        }
      } else if (a.stepIndex === move.activeFrame && !a.hasHit) {
        // active hit frame check
        a.hasHit = true;
        if (move.isProjectile) {
          this.spawnProjectile(p, move);
        } else {
          const hb = { x: 0, y: p.y + move.hitboxYOff * p.charDef.scaleMul, w: move.hitboxW * p.charDef.scaleMul, h: move.hitboxH * p.charDef.scaleMul };
          if (p.facing > 0) hb.x = p.x + 6;
          else hb.x = p.x - 6 - hb.w;
          if (rectsOverlap(hb, foe.hurtbox()) && foe.invul <= 0 && !foe.dead) {
            this.applyHit(p, foe, move);
          }
        }
      }
 
      if (a.stepTimer <= 0) {
        a.stepIndex++;
        if (a.stepIndex >= move.frames.length) {
          p.attack = null;
          p.cooldowns[a.key] = move.cooldown != null ? move.cooldown : 0.06;
        } else {
          a.stepTimer = move.durs[a.stepIndex];
          const f = move.frames[a.stepIndex];
          p.action = f.split("_")[0];
          p.frameIndex = parseInt(f.split("_")[1], 10);
          p.animTimer = 0;
        }
      }
    }
 
    // Shared knockback/damage application used by melee, projectiles, and the laser.
    dealHit(attacker, target, damageAmount, baseKB, scaleKB, angleDeg) {
      target.damage += damageAmount;
      const speed = (baseKB + target.damage * scaleKB) * attacker.charDef.powerMul * target.charDef.kbTakenMul;
      const angle = (angleDeg * Math.PI) / 180;
      const dirX = Math.sign(target.x - attacker.x) || attacker.facing;
      target.vx = Math.cos(angle) * speed * dirX;
      target.vy = -Math.sin(angle) * speed;
      target.grounded = false;
      target.onPlatformIndex = -1;
      target.charging = null; // getting hit fizzles a charging laser
      this.shake = clamp(speed * 0.0025, 0.12, 0.9);
      SFX.hit();
      this.spawnHitSpark(target.x - dirX * 20, target.y - 120, attacker.color);
    }
 
    applyHit(attacker, target, move) {
      this.dealHit(attacker, target, move.damage * attacker.charDef.powerMul, move.baseKB, move.scaleKB, move.angleDeg);
    }
 
    spawnProjectile(p, move) {
      this.projectiles.push({
        x: p.x + p.facing * 26,
        y: p.y - 140 * p.charDef.scaleMul,
        vx: p.facing * move.projSpeed,
        dir: p.facing,
        owner: p,
        move,
        life: move.projLife,
        t: 0,
        r: 15,
        trailTimer: 0,
      });
    }
 
    updateProjectiles(dt) {
      this.projectiles.forEach((pr) => {
        pr.t += dt;
        pr.x += pr.vx * dt;
        pr.trailTimer -= dt;
        if (pr.trailTimer <= 0) {
          pr.trailTimer = 0.025;
          this.particles.push({ x: pr.x - pr.dir * 8, y: pr.y + rand(-4, 4), vx: rand(-20, 20) - pr.dir * 30, vy: rand(-20, 20), life: 0.22, t: 0, color: "rgba(255,140,40,0.8)", r: rand(2, 4) });
        }
        const target = this.players.find((pl) => pl !== pr.owner);
        if (target && !target.dead && target.invul <= 0) {
          const box = { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 };
          if (rectsOverlap(box, target.hurtbox())) {
            this.dealHit(pr.owner, target, pr.move.damage * pr.owner.charDef.powerMul, pr.move.baseKB, pr.move.scaleKB, pr.move.angleDeg);
            pr.dead = true;
          }
        }
        const b = this.stage.blast;
        if (pr.t >= pr.life || pr.x < b.l - 60 || pr.x > b.r + 60) pr.dead = true;
      });
      this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    }
 
    fireLaser(p, foe) {
      const frac = clamp(p.charging.t / LASER_MAX_CHARGE, 0, 1);
      const damage = 4 + frac * 20;
      const baseKB = 220 + frac * 520;
      const beamHalfH = (26 + frac * 30) * p.charDef.scaleMul;
      const headY = p.y - 196 * p.charDef.scaleMul * 0.9;
      const reach = 900;
      const bx1 = p.facing > 0 ? p.x + 10 : p.x - 10 - reach;
      const bx2 = p.facing > 0 ? p.x + 10 + reach : p.x - 10;
 
      if (!foe.dead && foe.invul <= 0) {
        const beamRect = { x: bx1, y: headY - beamHalfH, w: bx2 - bx1, h: beamHalfH * 2 };
        if (rectsOverlap(beamRect, foe.hurtbox())) {
          this.dealHit(p, foe, damage * p.charDef.powerMul, baseKB, 4.0, 18);
        }
      }
 
      this.laserFlash = { x1: bx1, x2: bx2, y: headY, color: p.color, t: 0, life: 0.18, thick: 6 + frac * 16 };
      SFX.laser(frac);
      p.charging = null;
      p.cooldowns.laser = 0.55;
    }
 
    koPlayer(p) {
      if (p.dead) return;
      SFX.ko();
      this.shake = 1.4;
      this.spawnHitSpark(clamp(p.x, 0, CW), clamp(p.y - 100, 0, CH), p.color, true);
      p.stocks -= 1;
      if (p.stocks <= 0) {
        p.dead = true;
        p.stocks = 0;
        const other = this.players.find((pl) => pl !== p);
        this.endMatch(other && !other.dead ? other : null);
      } else {
        p.reset(false, this.stage.groundY);
      }
    }
 
    spawnDust(x, y) {
      for (let i = 0; i < 5; i++) {
        this.particles.push({ x: x + rand(-10, 10), y: y - rand(0, 6), vx: rand(-40, 40), vy: rand(-60, -10), life: 0.35, t: 0, color: "rgba(120,120,120,0.6)", r: rand(3, 6) });
      }
    }
    spawnHitSpark(x, y, color, big) {
      const n = big ? 14 : 8;
      for (let i = 0; i < n; i++) {
        const ang = rand(0, Math.PI * 2);
        const spd = rand(80, big ? 420 : 220);
        this.particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: big ? 0.6 : 0.3, t: 0, color, r: rand(2, big ? 6 : 4), spark: true });
      }
    }
    updateParticles(dt) {
      this.particles.forEach((pt) => {
        pt.t += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 500 * dt;
      });
      this.particles = this.particles.filter((pt) => pt.t < pt.life);
    }
 
    // -------------------------------------------------------------
    // Animation frame selection
    // -------------------------------------------------------------
    updateAnimation(p, dt) {
      if (p.attack) return; // handled in updateAttack
 
      const cd = p.charDef;
      if (!p.grounded) {
        // jump/fall pose driven by vy
        p.action = cd.jumpAction || "jump";
        if (p.vy < -320) p.frameIndex = p.jumpsUsed > 1 ? 1 : 0;
        else if (p.vy < -80) p.frameIndex = 1;
        else if (p.vy < 90) p.frameIndex = 2;
        else p.frameIndex = 3;
        p.state = "air";
        return;
      }
 
      const speed = Math.abs(p.vx);
      if (speed < 18) {
        // idle breathing: alternate frame 0 / 1 of the character's idle action
        // (also used while charging the laser)
        p.action = cd.idleAction || "punch";
        p.animTimer += dt;
        const cyc = 0.55;
        p.frameIndex = Math.floor(p.animTimer / cyc) % 2 === 0 ? 0 : 1;
        p.state = "idle";
      } else {
        const isRun = speed > (WALK_SPEED + RUN_SPEED) / 2 * cd.speedMul - 40;
        p.action = isRun ? (cd.runAction || "run") : (cd.walkAction || "walk");
        p.state = isRun ? "run" : "walk";
        const stride = isRun ? 46 : 34;
        p.frameIndex = Math.floor(p.walkDist / stride) % FRAME_COUNT;
      }
    }
 
    // -------------------------------------------------------------
    // Main loop
    // -------------------------------------------------------------
    loop(t) {
      if (this.lastTime == null) this.lastTime = t;
      let dt = (t - this.lastTime) / 1000;
      dt = Math.min(dt, 1 / 30);
      this.lastTime = t;
 
      if (this.state === "countdown") {
        this.countdownT -= dt;
        if (this.countdownT <= 0) this.state = "playing";
      } else if (this.state === "playing") {
        const [p1, p2] = this.players;
        this.updatePlayer(p1, p2, dt);
        this.updatePlayer(p2, p1, dt);
        this.updateProjectiles(dt);
      }
      this.updateParticles(dt);
      if (this.laserFlash) {
        this.laserFlash.t += dt;
        if (this.laserFlash.t >= this.laserFlash.life) this.laserFlash = null;
      }
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
 
      this.render();
      requestAnimationFrame((tt) => this.loop(tt));
    }
 
    // -------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------
    render() {
      const ctx = this.ctx;
      ctx.save();
      ctx.clearRect(0, 0, CW, CH);
 
      let shakeX = 0, shakeY = 0;
      if (this.shake > 0) {
        shakeX = rand(-1, 1) * this.shake * 8;
        shakeY = rand(-1, 1) * this.shake * 8;
      }
      ctx.translate(shakeX, shakeY);
 
      this.drawBackground(ctx, this.stage);
      this.drawStage(ctx, this.stage);
 
      if (this.players.length && (this.state === "countdown" || this.state === "playing" || this.state === "gameover")) {
        this.players.forEach((p) => this.drawShadow(ctx, p));
        [...this.players].sort((a, b) => a.y - b.y).forEach((p) => this.drawPlayer(ctx, p));
        this.players.forEach((p) => this.drawChargeGlow(ctx, p));
        this.drawProjectiles(ctx);
        this.drawParticles(ctx);
        this.drawLaserFlash(ctx);
        this.drawHUD(ctx);
      }
 
      if (this.state === "countdown") this.drawCountdown(ctx);
 
      ctx.restore();
    }
 
    drawBackground(ctx, stage) {
      const g = ctx.createLinearGradient(0, 0, 0, CH);
      g.addColorStop(0, stage.sky[0]);
      g.addColorStop(0.55, stage.sky[1]);
      g.addColorStop(1, stage.sky[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
 
      if (stage.stars) {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        const starPts = [[80,60],[160,140],[260,50],[340,180],[430,90],[520,40],[610,160],[700,70],[780,130],[860,50],[920,190],[60,220],[900,260],[200,260],[500,230]];
        starPts.forEach(([x, y]) => {
          ctx.globalAlpha = 0.4 + ((x * y) % 100) / 200;
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      } else {
        ctx.fillStyle = stage.cloud;
        const clouds = [[120, 90, 60], [200, 70, 40], [720, 60, 55], [800, 100, 35], [430, 50, 45]];
        clouds.forEach(([x, y, r]) => {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.arc(x + r * 0.8, y + 8, r * 0.7, 0, Math.PI * 2);
          ctx.arc(x - r * 0.8, y + 10, r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        });
      }
 
      ctx.strokeStyle = "rgba(28,28,28,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, stage.groundY + 60);
      ctx.lineTo(CW, stage.groundY + 60);
      ctx.stroke();
    }
 
    drawStage(ctx, stage) {
      stage.grounds.forEach((g) => {
        this.roundRectSketch(ctx, g.x1, g.y, g.x2 - g.x1, 46, 16, stage.ground, "#1c1c1c");
        ctx.fillStyle = stage.grass;
        ctx.fillRect(g.x1 + 4, g.y, g.x2 - g.x1 - 8, 10);
        ctx.strokeStyle = "#1c1c1c";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(g.x1 + 4, g.y + 1); ctx.lineTo(g.x2 - 4, g.y + 1); ctx.stroke();
      });
 
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = "rgba(230,60,60,0.25)";
      ctx.lineWidth = 3;
      const b = stage.blast;
      ctx.strokeRect(b.l + 8, b.t + 8, b.r - b.l - 16, b.b - b.t - 16);
      ctx.restore();
 
      stage.platforms.forEach((pl) => {
        this.roundRectSketch(ctx, pl.x1, pl.y, pl.x2 - pl.x1, 16, 8, stage.plat, "#1c1c1c");
      });
    }
 
    roundRectSketch(ctx, x, y, w, h, r, fill, stroke) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
 
    drawShadow(ctx, p) {
      const groundY = this.stage.groundY;
      const s = p.charDef.scaleMul;
      const t = clamp(1 - (groundY - Math.min(p.y, groundY)) / 260, 0.15, 1);
      ctx.save();
      ctx.globalAlpha = 0.28 * t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, groundY + 20, (34 * t + 8) * s, (9 * t + 3) * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
 
    drawPlayer(ctx, p) {
      const key = `${p.action}_${p.frameIndex}`;
      const img = IMAGES[key];
      if (!img || !img.complete || !img.naturalWidth) return;
 
      ctx.save();
      if (p.invul > 0 && Math.floor(p.invul * 14) % 2 === 0) {
        ctx.globalAlpha = 0.35;
      }
 
      ctx.translate(p.x, p.y);
      ctx.scale(p.facing * p.squash, 1 / Math.max(p.squash, 0.7) * 1);
 
      ctx.filter = `drop-shadow(0 0 3px ${p.color}) drop-shadow(0 0 7px ${p.color}55)`;
 
      // Scale off the character's own idle-pose reference height, not this
      // frame's own naturalHeight — so an action with a taller canvas (extra
      // headroom for a big swing/spin) doesn't visually resize the character.
      const scale = (196 / (p.charDef.refHeight || 250)) * p.charDef.scaleMul;
      const dW = img.naturalWidth * scale;
      const dHgt = img.naturalHeight * scale;
      ctx.drawImage(img, -dW / 2, -dHgt, dW, dHgt);
      ctx.restore();
    }
 
    drawChargeGlow(ctx, p) {
      if (!p.charging) return;
      const frac = clamp(p.charging.t / LASER_MAX_CHARGE, 0, 1);
      const headY = p.y - 196 * p.charDef.scaleMul * 0.9;
      const rad = 8 + frac * 24;
      const hue = frac < 0.5 ? "#fff3b0" : frac < 0.85 ? "#ffb020" : "#ff4d2e";
      ctx.save();
      ctx.globalAlpha = 0.5 + frac * 0.4;
      const grad = ctx.createRadialGradient(p.x, headY, 0, p.x, headY, rad);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.4, hue);
      grad.addColorStop(1, "rgba(255,80,20,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, headY, rad, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
 
    drawProjectiles(ctx) {
      this.projectiles.forEach((pr) => {
        const pulse = 1 + Math.sin(pr.t * 30) * 0.08;
        const rr = pr.r * 1.8 * pulse;
        ctx.save();
        ctx.globalAlpha = 0.92;
        const grad = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, rr);
        grad.addColorStop(0, "#fff6c9");
        grad.addColorStop(0.35, "#ffb02e");
        grad.addColorStop(1, "rgba(255,60,20,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, rr, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    }
 
    drawLaserFlash(ctx) {
      const f = this.laserFlash;
      if (!f) return;
      const a = 1 - f.t / f.life;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = f.thick;
      ctx.lineCap = "round";
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y);
      ctx.lineTo(f.x2, f.y);
      ctx.stroke();
      ctx.restore();
    }
 
    drawParticles(ctx) {
      this.particles.forEach((pt) => {
        const a = 1 - pt.t / pt.life;
        ctx.save();
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }
 
    drawHUD(ctx) {
      this.players.forEach((p, i) => {
        const x = i === 0 ? 30 : CW - 176;
        const y = CH - 92;
        ctx.save();
        ctx.textAlign = "left";
        ctx.font = "bold 15px Kalam, sans-serif";
        ctx.fillStyle = p.color;
        ctx.fillText(`${p.label} · ${p.charDef.name}`, x, y);
 
        for (let s = 0; s < STOCK_COUNT; s++) {
          ctx.beginPath();
          ctx.arc(x + 4 + s * 16, y + 16, 5, 0, Math.PI * 2);
          ctx.fillStyle = s < p.stocks ? p.color : "rgba(0,0,0,0.15)";
          ctx.fill();
        }
 
        const pct = Math.round(p.damage);
        let dmgColor = "#2ecc71";
        if (pct > 100) dmgColor = "#e74c3c";
        else if (pct > 50) dmgColor = "#f1c40f";
        ctx.font = "bold 34px Bangers, Kalam, sans-serif";
        ctx.fillStyle = dmgColor;
        ctx.strokeStyle = "#1c1c1c";
        ctx.lineWidth = 3;
        ctx.strokeText(pct + "%", x, y + 52);
        ctx.fillText(pct + "%", x, y + 52);
        ctx.restore();
      });
    }
 
    drawCountdown(ctx) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, CW, CH);
      const n = this.countdownT;
      let label = "FIGHT!";
      if (n > 1.55) label = "3";
      else if (n > 0.9) label = "2";
      else if (n > 0.25) label = "1";
      ctx.font = "bold 90px Bangers, Kalam, sans-serif";
      ctx.fillStyle = "#1c1c1c";
      ctx.strokeStyle = "#ffe27a";
      ctx.lineWidth = 6;
      ctx.strokeText(label, CW / 2, CH / 2 + 30);
      ctx.fillText(label, CW / 2, CH / 2 + 30);
      ctx.restore();
    }
  }
 
  // ---------------------------------------------------------------------
  // Select-screen thumbnails
  // ---------------------------------------------------------------------
  function renderCharThumb(canvas, charDef) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const img = IMAGES[`${charDef.idleAction || "punch"}_0`];
    if (!img || !img.naturalWidth) return;
    ctx.save();
    ctx.translate(W / 2, H - 6);
    ctx.filter = `drop-shadow(0 0 2px ${charDef.color}) drop-shadow(0 0 5px ${charDef.color}66)`;
    const targetH = (H - 14) * charDef.scaleMul;
    const scale = targetH / img.naturalHeight;
    const dW = img.naturalWidth * scale;
    ctx.drawImage(img, -dW / 2, -targetH, dW, targetH);
    ctx.restore();
  }
 
  function renderStageThumb(canvas, stage) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const k = W / CW;
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, stage.sky[0]);
    g.addColorStop(0.6, stage.sky[1]);
    g.addColorStop(1, stage.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
 
    if (stage.stars) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 18; i++) {
        const sx = (i * 53) % W, sy = (i * 29) % (H * 0.7);
        ctx.globalAlpha = 0.3 + ((i * 37) % 100) / 150;
        ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
 
    const gY = stage.groundY * k;
    stage.grounds.forEach((gseg) => {
      ctx.fillStyle = stage.ground;
      const gh = Math.max(4, 46 * k);
      ctx.fillRect(gseg.x1 * k, gseg.y * k, (gseg.x2 - gseg.x1) * k, gh);
      ctx.fillStyle = stage.grass;
      ctx.fillRect(gseg.x1 * k, gseg.y * k, (gseg.x2 - gseg.x1) * k, Math.max(2, 6 * k));
      ctx.strokeStyle = "#1c1c1c";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gseg.x1 * k, gseg.y * k, (gseg.x2 - gseg.x1) * k, gh);
    });
 
    stage.platforms.forEach((pl) => {
      ctx.fillStyle = stage.plat;
      const pw = (pl.x2 - pl.x1) * k, ph = Math.max(2, 8 * k);
      ctx.fillRect(pl.x1 * k, pl.y * k, pw, ph);
      ctx.strokeStyle = "#1c1c1c";
      ctx.lineWidth = 1;
      ctx.strokeRect(pl.x1 * k, pl.y * k, pw, ph);
    });
  }
 
  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("game");
    canvas.width = CW; canvas.height = CH;
    const loadingFill = document.getElementById("loading-fill");
    const loadingWrap = document.getElementById("loading-wrap");
    const modeRow = document.getElementById("mode-row");
 
    let game = null;
 
    function buildCharGrid(containerId, onPick) {
      const el = document.getElementById(containerId);
      el.innerHTML = "";
      CHARACTERS.forEach((c, i) => {
        const card = document.createElement("button");
        card.className = "char-card";
        card.type = "button";
        card.style.setProperty("--accent", c.color);
        const canvas = document.createElement("canvas");
        canvas.width = 96; canvas.height = 118;
        canvas.className = "char-thumb";
        const name = document.createElement("div");
        name.className = "char-name";
        name.textContent = c.name;
        name.style.color = c.color;
        const blurb = document.createElement("div");
        blurb.className = "char-blurb";
        blurb.textContent = c.blurb;
        card.append(canvas, name, blurb);
        card.addEventListener("click", () => { ensureAudio(); SFX.select(); onPick(i); });
        el.appendChild(card);
        renderCharThumb(canvas, c);
      });
    }
 
    function buildStageGrid() {
      const el = document.getElementById("stage-grid");
      el.innerHTML = "";
      STAGES.forEach((s, i) => {
        const card = document.createElement("button");
        card.className = "stage-card";
        card.type = "button";
        const canvas = document.createElement("canvas");
        canvas.width = 220; canvas.height = 124;
        canvas.className = "stage-thumb";
        const name = document.createElement("div");
        name.className = "stage-name";
        name.textContent = s.name;
        card.append(canvas, name);
        card.addEventListener("click", () => {
          ensureAudio(); SFX.select();
          game.pick.stage = i;
          game.refreshStageSelection();
        });
        el.appendChild(card);
        renderStageThumb(canvas, s);
      });
    }
 
    loadAllSprites((frac) => {
      if (loadingFill) loadingFill.style.width = `${Math.round(frac * 100)}%`;
    }).then(() => {
      if (loadingWrap) loadingWrap.classList.add("hidden");
      if (modeRow) modeRow.classList.remove("hidden");
      game = new Game(canvas);
      window.__stickSmashGame = game;
 
      buildCharGrid("p1-char-grid", (i) => { game.pick.p1 = i; game.refreshCharSelection(); });
      buildCharGrid("p2-char-grid", (i) => { game.pick.p2 = i; game.refreshCharSelection(); });
      buildStageGrid();
      game.refreshCharSelection();
      game.refreshStageSelection();
 
      document.querySelectorAll(".mode-btn[data-mode]").forEach((btn) => {
        btn.addEventListener("click", () => {
          ensureAudio();
          game.setMode(btn.dataset.mode);
        });
      });
      document.getElementById("start-btn").addEventListener("click", () => game.goCharSelect());
      document.getElementById("charselect-back-btn").addEventListener("click", () => game.toMenu());
      document.getElementById("charselect-next-btn").addEventListener("click", () => game.goStageSelect());
      document.getElementById("stageselect-back-btn").addEventListener("click", () => game.goCharSelect());
      document.getElementById("stageselect-fight-btn").addEventListener("click", () => game.startMatch());
      document.getElementById("rematch-btn").addEventListener("click", () => game.startMatch());
      document.getElementById("menu-btn").addEventListener("click", () => game.toMenu());
      game.setMode("2p");
    });
  });
})();
