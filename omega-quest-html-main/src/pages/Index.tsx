import { useEffect, useRef, useState, useCallback } from "react";
import { QUESTOES, sortearQuestao, type Questao, type Dificuldade } from "@/game/questions";
import { initAudio, sfx, playMusic, stopMusic, setMuted, narrate, narratePrepare, stopNarration } from "@/game/audio";
import AuthModal from "@/components/AuthModal";
import {
  getCurrentUserAsync,
  logoutUser,
} from "@/services/authService";
import { saveScore } from "@/services/scoreService";
import {
  getRanking
} from "@/services/rankingService";
import RankingModal from "@/components/RankingModal";
import {
  saveProgress
} from "@/services/progressService";
import {
  saveMatch
} from "@/services/matchService";

// ============================================================
// CRYPT RUNNER — Princípios da Contagem (UNIFOR)
// ============================================================


const W = 960;
const H = 540;
const GRAVITY = 0.62;
const JUMP_VEL = -13.2;
const MOVE_SPEED = 4.2;
const DASH_SPEED = 11;

type Screen = "start" | "select" | "story" | "game" | "quiz" | "transition" | "gameover" | "victory";
type Character = "hero" | "heroine";
type GameMode = "story" | "arcade";
type BuffType = "speed" | "damage" | "heal";

interface Drop { x: number; y: number; vy: number; type: BuffType; life: number }



const DIFF_CFG: Record<Dificuldade, { lives: number; enemyMul: number; lifeLoss: number; quizTime: number; pool: Dificuldade[]; label: string; color: string }> = {
  facil:   { lives: 5, enemyMul: 0.80, lifeLoss: 1, quizTime: 25, pool: ["facil"],                    label: "FÁCIL",      color: "#7ee36b" },
  medio:   { lives: 3, enemyMul: 1.00, lifeLoss: 1, quizTime: 18, pool: ["facil","medio"],            label: "MÉDIO",      color: "#ffd166" },
  dificil: { lives: 2, enemyMul: 1.20, lifeLoss: 2, quizTime: 10, pool: ["facil","medio","dificil"],  label: "DIFÍCIL",    color: "#ff7777" },
};

interface Vec { x: number; y: number }
interface Platform { x: number; y: number; w: number; h: number }
type CoinKind = "normal" | "blue" | "gold";
interface Coin { x: number; y: number; taken: boolean; phase: number; kind?: CoinKind }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Projectile { x: number; y: number; vx: number; vy: number; from: "player" | "enemy"; life: number }
interface Enemy {
  type: "pombo" | "golem" | "espelho" | "sombra" | "dragao";
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  hp: number; maxHp: number;
  state: string;
  timer: number;
  phase: number;
  alpha: number;
  baseY: number;
  hitFlash: number;
  isClone?: boolean;
}

interface Room {
  name: string;
  subtitle: string;
  theme: "pombal" | "adicao" | "espelhos" | "sombras" | "dragao" | "castelo";
  sky: [string, string];
  ground: string;
  accent: string;
  fog: string;
}

const ROOMS: Room[] = [
  { name: "SALA I",   subtitle: "Pombal Encantado",    theme: "pombal",   sky: ["#1a2440", "#3a4a6e"], ground: "#2d2438", accent: "#ffd166", fog: "rgba(255,255,255,0.04)" },
  { name: "SALA II",  subtitle: "Salão da Adição",     theme: "adicao",   sky: ["#2b1a0f", "#6b4226"], ground: "#3a2614", accent: "#ff7b54", fog: "rgba(255,180,80,0.05)" },
  { name: "SALA III", subtitle: "Câmara dos Espelhos", theme: "espelhos", sky: ["#0f1a2b", "#2c4a6e"], ground: "#1a2540", accent: "#7be0ff", fog: "rgba(120,200,255,0.06)" },
  { name: "SALA IV",  subtitle: "Cripta das Sombras",  theme: "sombras",  sky: ["#1a1a26", "#2e2e3e"], ground: "#1a1a22", accent: "#b48aff", fog: "rgba(120,80,180,0.05)" },
  { name: "SALA V",   subtitle: "Trono do Dragão",     theme: "dragao",   sky: ["#3a0a0a", "#7a1a1a"], ground: "#1a0606", accent: "#ff3b3b", fog: "rgba(255,40,40,0.08)" },
  { name: "CASTELO",  subtitle: "Câmara da Princesa",  theme: "castelo",  sky: ["#0e0820", "#1e1040"], ground: "#1a1030", accent: "#ffd166", fog: "rgba(255,220,100,0.04)" },
];

interface Level {
  platforms: Platform[];
  coins: Coin[];
  enemies: Enemy[];
  portal: { x: number; y: number; w: number; h: number; active: boolean };
  startX: number; startY: number;
}

function buildLevel(roomIdx: number): Level {
  const room = ROOMS[roomIdx];
  const groundY = H - 40;
  const platforms: Platform[] = [{ x: 0, y: groundY, w: W, h: 40 }];
  const coins: Coin[] = [];
  const enemies: Enemy[] = [];
  let portalCfg = { x: W - 80, y: H - 120, w: 50, h: 80, active: false };

  // Helper to create an enemy with HP scaled by room
  const mkEnemy = (e: Partial<Enemy>): Enemy => ({
    type: "pombo", x: 0, y: 0, w: 32, h: 32,
    vx: 0, vy: 0, hp: 2, maxHp: 2,
    state: "idle", timer: 0, phase: 0, alpha: 1, baseY: 0, hitFlash: 0,
    ...e,
  } as Enemy);

  switch (room.theme) {
    case "pombal": {
      // Stepped vertical platforms reachable with jump (+ double jump)
      const steps: [number, number, number][] = [
        [180, 430, 110], [340, 360, 110], [500, 290, 110], [660, 360, 110], [820, 430, 110],
        [240, 230, 100], [560, 180, 120], [780, 220, 100],
      ];
      steps.forEach(([x, y, w]) => platforms.push({ x, y, w, h: 14 }));
      [200, 360, 500, 640, 760].forEach((x) => coins.push({ x, y: 200 + Math.random() * 150, taken: false, phase: Math.random() * 6 }));
      // pigeons flying sine waves (+15% speed)
      for (let i = 0; i < 5; i++) {
        enemies.push(mkEnemy({
          type: "pombo", x: 250 + i * 150, y: 180 + (i % 2) * 60, w: 36, h: 26,
          hp: 2, maxHp: 2, baseY: 180 + (i % 2) * 60, vx: (2.3 + Math.random() * 1.1) * 1.15,
          phase: i * 1.2,
        }));
      }
      break;
    }
    case "adicao": {
      // Stone arches
      const steps: [number, number, number][] = [
        [120, 420, 130], [300, 360, 130], [490, 420, 130], [680, 360, 130], [840, 420, 110],
        [220, 270, 110], [460, 230, 130], [700, 270, 110],
      ];
      steps.forEach(([x, y, w]) => platforms.push({ x, y, w, h: 16 }));
      [180, 360, 540, 720, 900].forEach((x, i) => coins.push({ x, y: 200 + (i % 2) * 60, taken: false, phase: i }));
      // golems patrolling (+15%)
      for (let i = 0; i < 4; i++) {
        enemies.push(mkEnemy({
          type: "golem", x: 220 + i * 180, y: groundY - 50, w: 44, h: 50,
          hp: 4, maxHp: 4, vx: (1.5 + Math.random() * 0.8) * 1.15, state: "patrol", baseY: groundY - 50,
        }));
      }
      break;
    }
    case "espelhos": {
      const steps: [number, number, number][] = [
        [100, 410, 140], [300, 340, 140], [500, 270, 140], [700, 340, 140], [860, 410, 100],
        [200, 200, 110], [600, 180, 120],
      ];
      steps.forEach(([x, y, w]) => platforms.push({ x, y, w, h: 14 }));
      [160, 340, 540, 740, 880].forEach((x, i) => coins.push({ x, y: 250 + (i % 2) * 60, taken: false, phase: i }));
      // 5 mirrors (more challenge)
      for (let i = 0; i < 5; i++) {
        enemies.push(mkEnemy({
          type: "espelho", x: 180 + i * 150, y: 200 + (i % 2) * 60, w: 36, h: 48,
          hp: 3, maxHp: 3, baseY: 200 + (i % 2) * 60, timer: 60 + i * 24,
        }));
      }
      break;
    }
    case "sombras": {
      // Pits in the ground
      platforms.length = 0;
      const segs: [number, number][] = [[0, 240], [320, 200], [580, 160], [820, 140]];
      segs.forEach(([x, w]) => platforms.push({ x, y: groundY, w, h: 40 }));
      const steps: [number, number, number][] = [
        [240, 380, 100], [430, 320, 120], [620, 380, 100], [780, 300, 110],
        [340, 230, 100], [580, 200, 120],
      ];
      steps.forEach(([x, y, w]) => platforms.push({ x, y, w, h: 14 }));
      [260, 460, 660, 820].forEach((x, i) => coins.push({ x, y: 200 + (i % 2) * 80, taken: false, phase: i }));
      for (let i = 0; i < 5; i++) {
        enemies.push(mkEnemy({
          type: "sombra", x: 320 + i * 130, y: groundY - 38, w: 32, h: 38,
          hp: 3, maxHp: 3, vx: 2.5 * 1.15, alpha: 0.85, baseY: groundY - 38, timer: 50 + i * 18,
        }));
      }
      break;
    }
    case "dragao": {
      const steps: [number, number, number][] = [
        [80, 420, 160], [280, 360, 140], [540, 360, 140], [800, 420, 120],
        [180, 240, 120], [660, 240, 120],
      ];
      steps.forEach(([x, y, w]) => platforms.push({ x, y, w, h: 16 }));
      [140, 340, 600, 820].forEach((x, i) => coins.push({ x, y: 200, taken: false, phase: i }));
      enemies.push(mkEnemy({
        type: "dragao", x: 700, y: 180, w: 110, h: 80,
        hp: 10, maxHp: 10, baseY: 180, state: "patrol", timer: 90, vx: 1.3 * 1.15,
      }));
      break;
    }
    case "castelo": {
      // Interior do castelo — corredor nobre até a princesa
      platforms.length = 0;
      // Tapete vermelho: chão contínuo
      platforms.push({ x: 0, y: groundY, w: W, h: 40 });
      // Degraus de pedra decorativos
      const steps: [number, number, number][] = [
        [160, 420, 100], [320, 380, 100], [480, 340, 100], [640, 380, 100],
        [800, 420, 100],
      ];
      steps.forEach(([x, y, w]) => platforms.push({ x, y, w, h: 14 }));
      // Sem inimigos — o herói chegou ao destino
      // Portal = abraço da princesa (à direita, bem visível)
      portalCfg = { x: W - 150, y: H - 200, w: 80, h: 130, active: true };
      break;
    }
  }

  return {
    platforms, coins, enemies,
    portal: portalCfg,
    startX: 60, startY: H - 120,
  };
}

const STORY_FULL = `ALBION, ANO 1487. Uma chuva fria castiga as torres do palácio real.

A PRINCESA ELISABETH foi capturada pelo LORDE DAS SOMBRAS, que a aprisionou na CRIPTA DOS NÚMEROS.

Você não é um cavaleiro. Não veste armadura. Você é apenas um ESTUDANTE — mas carrega algo mais afiado que uma espada: a LÓGICA.

Cinco salas amaldiçoadas o separam dela. Cada criatura cede apenas a quem domina os PRINCÍPIOS DA CONTAGEM: Adição, Multiplicação e Casas de Pombo.

A INGLATERRA inteira conta com você. Empunhe sua mente. Atravesse a cripta. Salve a princesa.`;

const ROOM_TIPS = [
  "Sala I — Pombal: derrote os pombos ou colete tudo para abrir o portal.",
  "Sala II — Adição: golems patrulham. Some os caminhos.",
  "Sala III — Espelhos: reflexos teleportam. Multiplique a atenção.",
  "Sala IV — Sombras: cuidado com os abismos. A luz é sua aliada.",
  "Sala V — Trono do Dragão: mate o dragão para abrir o castelo!",
  "Castelo — Chegue até a Princesa Elisabeth para vencer!",
];

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [storyIdx, setStoryIdx] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState({ lives: 3, mp: 100, room: 0, score: 0, bossHp: 0, bossMax: 0 });
  const [quiz, setQuiz] = useState<{ q: Questao; idx: number; chosen: number | null; revealed: boolean; order: number[]; correctShuffled: number; timeLeft: number } | null>(null);
  const [transitionText, setTransitionText] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [typedText, setTypedText] = useState("");
  const [roomTip, setRoomTip] = useState(""); // mini-narration on entering a room

  const [character, setCharacter] = useState<Character>("hero");
  const [difficulty, setDifficulty] = useState<Dificuldade>("medio");
  const [mode, setMode] = useState<GameMode>("story");
  const [hintsLeft, setHintsLeft] = useState(3);
  const [eliminatedAlt, setEliminatedAlt] = useState<number | null>(null);
  const [activeBuff, setActiveBuff] = useState<{ type: BuffType; until: number } | null>(null);
  const [hideRatio, setHideRatio] = useState(1); // 0..1
  const [arcadeBest, setArcadeBest] = useState<number>(() => Number(localStorage.getItem("cr-arcade-best") || 0));

  const [authenticated, setAuthenticated] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [username, setUsername] = useState("");
  useEffect(() => {
  if (authenticated) {
    console.log(
      "Usuário autenticado:",
      username
    );
  }
}, [authenticated, username]);

//fazendo a alteração 3 do login

  useEffect(() => {
  async function restore() {
    const user =
      await getCurrentUserAsync();

    if (!user) return;

    setAuthenticated(true);

    setUsername(
      user.get("username")
    );

    setPlayerName(
      user.get("username")
    );
  }

  restore();
}, []);

  // Mutable game state in ref to avoid re-renders
  const stateRef = useRef({
    player: {
      x: 60, y: H - 120, w: 28, h: 40, vx: 0, vy: 0,
      onGround: false, jumps: 0, dir: 1,
      dashCd: 0, dashing: 0, invuln: 0, fireCd: 0,
      anim: 0,
    },
    keys: { left: false, right: false, jump: false, fire: false, dash: false, hide: false },
    level: buildLevel(0),
    projectiles: [] as Projectile[],
    particles: [] as Particle[],
    drops: [] as Drop[],
    cameraShake: 0,
    askedQuestions: new Set<number>(),
    lives: 3, mp: 100, score: 0, room: 0,
    paused: false,
    lastDamageEnemy: 0,
    starField: Array.from({ length: 80 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.3, p: Math.random() })),
    pendingDamage: false,
    // dificuldade / modo
    difficulty: "medio" as Dificuldade,
    mode: "story" as GameMode,
    character: "hero" as Character,
    enemyMul: 1.0,
    // buffs
    buff: null as { type: BuffType; until: number } | null,
    // hide stamina
    hideStamina: 1.0,
    hiding: false,
    // arcade
    arcadeKills: 0,
    arcadeWave: 0,
    arcadeSpawnTimer: 0,
    arcadeCameraX: 0,
    arcadeChunksUntilX: 0,
    arcadeStars: 0,
    arcadeMeters: 0,
    arcadeMaxX: 0,
    arcadeKillsToQuiz: 8,
    arcadeLastQuizMeters: 0,
    arcadeScoreAccum: 0,
  });

  // Limpa o canvas quando não está no jogo (evita o fundo do jogo aparecer nas telas de menu)
  useEffect(() => {
    if (screen === "game") return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
  }, [screen]);

  // ============== Init audio + mute persistence ==============
  useEffect(() => {
    const m = localStorage.getItem("cr-muted") === "1";
    setMutedState(m); setMuted(m);
  }, []);

  const toggleMute = () => {
    const v = !muted;
    setMutedState(v); setMuted(v);
    localStorage.setItem("cr-muted", v ? "1" : "0");
  };

  const togglePause = () => {
    const s = stateRef.current;
    s.paused = !s.paused;
    setPaused(s.paused);
  };

  const exitToMenu = () => {
    const s = stateRef.current;
    s.paused = false;
    setPaused(false);
    stopMusic();
    stopNarration();
    setScreen("start");
  };

  // Safety net: se vidas chegarem a 0 em qualquer fluxo, força GAME OVER
  useEffect(() => {
    if (hud.lives <= 0 && screen !== "gameover" && screen !== "start" && screen !== "story" && screen !== "select") {
      const s = stateRef.current;
      s.paused = true;
      s.pendingDamage = false;
      setQuiz(null);
      stopMusic();
      // Salva recorde do arcade
      if (s.mode === "arcade" && s.score > arcadeBest) {
        localStorage.setItem("cr-arcade-best", String(s.score));
        setArcadeBest(s.score);
      }
      safeNarrate(`A escuridão consumiu ${playerName || "nosso herói"}. A Princesa Elisabeth ainda aguarda... tente novamente, bravo guerreiro.`);
      setScreen("gameover");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.lives, screen]);

  // ============== Input handlers ==============
  useEffect(() => {
    const k = stateRef.current.keys;
    const down = (e: KeyboardEvent) => {
      if (screen === "quiz" || screen === "story") return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") k.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") k.right = true;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        if (!k.jump) tryJump();
        k.jump = true;
      }
      if (e.code === "KeyJ" || e.code === "KeyX") { if (!k.fire) tryFire(); k.fire = true; }
      if (e.code === "ShiftLeft" || e.code === "KeyK") { if (!k.dash) tryDash(); k.dash = true; }
      if (e.code === "KeyC") k.hide = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") k.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") k.right = false;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") k.jump = false;
      if (e.code === "KeyJ" || e.code === "KeyX") k.fire = false;
      if (e.code === "ShiftLeft" || e.code === "KeyK") k.dash = false;
      if (e.code === "KeyC") k.hide = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [screen]);

  // Touch swipe / mobile: swipe up = jump, taps handled by buttons
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    let sy = 0, sx = 0, st = 0;
    const ts = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    };
    const te = (e: TouchEvent) => {
      const t = e.changedTouches[0]; if (!t) return;
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 400 && dy < -40 && Math.abs(dy) > Math.abs(dx)) tryJump();
    };
    c.addEventListener("touchstart", ts, { passive: true });
    c.addEventListener("touchend", te, { passive: true });
    return () => { c.removeEventListener("touchstart", ts); c.removeEventListener("touchend", te); };
  }, []);

  function tryJump() {
    const s = stateRef.current;
    const p = s.player;
    if (p.jumps < 2) {
      p.vy = JUMP_VEL * (p.jumps === 0 ? 1 : 0.85);
      // gold sparks at feet
      for (let i = 0; i < (p.jumps === 0 ? 8 : 14); i++) {
        s.particles.push({
          x: p.x + p.w / 2 + (Math.random() - 0.5) * p.w,
          y: p.y + p.h - 2,
          vx: (Math.random() - 0.5) * (p.jumps === 0 ? 3 : 5),
          vy: -Math.random() * 3 - (p.jumps === 0 ? 0 : 1.5),
          life: 24, max: 24,
          color: p.jumps === 0 ? "#c8a960" : "#7be0ff",
          size: 1 + Math.random() * 2,
        });
      }
      p.jumps++;
      p.onGround = false;
      sfx("jump");
    }
  }
  function tryFire() {
    const s = stateRef.current; const p = s.player;
    if (s.mp < 12 || p.fireCd > 0) return;
    s.mp -= 12; p.fireCd = 14;
    s.projectiles.push({ x: p.x + p.w / 2, y: p.y + p.h / 2 - 4, vx: 9 * p.dir, vy: 0, from: "player", life: 60 });
    sfx("shoot");
    setHud((h) => ({ ...h, mp: Math.round(s.mp) }));
  }
  function tryDash() {
    const s = stateRef.current;
    const p = s.player;
    if (p.dashCd > 0) return;
    p.dashing = 12; p.dashCd = 50; p.invuln = Math.max(p.invuln, 14);
    for (let i = 0; i < 18; i++) {
      s.particles.push({
        x: p.x + p.w / 2, y: p.y + p.h / 2 + (Math.random() - 0.5) * p.h,
        vx: -p.dir * (2 + Math.random() * 4), vy: (Math.random() - 0.5) * 1.5,
        life: 22, max: 22, color: i % 2 ? "#7be0ff" : "#c8a960", size: 2 + Math.random() * 2,
      });
    }
    sfx("dash");
  }

  // ============== Game loop ==============
  useEffect(() => {
    if (screen !== "game") return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    let raf = 0; let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - last); last = now;
      if (!stateRef.current.paused) update(dt);
      render(ctx);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  function update(_dt: number) {
    const s = stateRef.current;
    const p = s.player;
    const lvl = s.level;
    const room = ROOMS[s.room];
    const now = performance.now();

    // Hide stamina (KeyC) — invuln a tiros, sem atacar
    let canHide = s.keys.hide && s.hideStamina > 0.02;
    if (canHide) {
      s.hideStamina = Math.max(0, s.hideStamina - 1 / 120); // ~2s para esvaziar
      s.hiding = true;
    } else {
      s.hideStamina = Math.min(1, s.hideStamina + 1 / 240); // ~4s para recarregar
      s.hiding = false;
    }

    // Buff timeout
    if (s.buff && now > s.buff.until) s.buff = null;
    const speedBuff = s.buff?.type === "speed" ? 1.4 : 1.0;
    const damageBuff = s.buff?.type === "damage" ? 2 : 1;

    // Horizontal
    let move = 0;
    if (s.keys.left) move -= 1;
    if (s.keys.right) move += 1;
    if (move !== 0) p.dir = move;
    let speed = MOVE_SPEED * speedBuff;
    if (s.hiding) speed *= 0.55;
    if (p.dashing > 0) { speed = DASH_SPEED; p.dashing--; }
    p.vx = move * speed;

    // Cooldowns / regen
    if (p.dashCd > 0) p.dashCd--;
    if (p.fireCd > 0) p.fireCd--;
    if (p.invuln > 0) p.invuln--;
    if (s.mp < 100) s.mp = Math.min(100, s.mp + 0.2);
    if (s.cameraShake > 0) s.cameraShake *= 0.88;

    // Gravity
    p.vy += GRAVITY;
    if (p.vy > 16) p.vy = 16;
    p.x += p.vx; p.y += p.vy;

    // Platform collisions
    p.onGround = false;
    for (const pl of lvl.platforms) {
      if (p.x + p.w > pl.x && p.x < pl.x + pl.w) {
        if (p.y + p.h > pl.y && p.y + p.h - p.vy <= pl.y + 0.5 && p.vy >= 0) {
          p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.jumps = 0;
        }
      }
    }
    // Bounds (sem limite à direita em arcade — mundo infinito)
    if (s.mode !== "arcade" && p.x < 0) p.x = 0;
    if (s.mode !== "arcade" && p.x + p.w > W) p.x = W - p.w;
    // Pit fall
    if (p.y > H + 60) {
      if (s.mode === "arcade") {
        // Reposiciona acima do chão próximo da câmera
        p.x = s.arcadeCameraX + W * 0.35;
        p.y = 0;
      } else {
        p.x = lvl.startX; p.y = lvl.startY;
      }
      p.vy = 0;
      damagePlayer();
    }

    p.anim += Math.abs(p.vx) > 0.5 ? 0.25 : 0.08;

    // Coins
    for (const c of lvl.coins) {
      if (c.taken) continue;
      c.phase += 0.1;
      if (Math.abs(c.x - (p.x + p.w / 2)) < 22 && Math.abs(c.y - (p.y + p.h / 2)) < 28) {
        c.taken = true;
        const kind = c.kind || "normal";
        const pts = kind === "gold" ? 100 : kind === "blue" ? 25 : 10;
        s.score += pts;
        if (s.mode === "arcade") s.arcadeStars++;
        sfx("coin");
        const col = kind === "gold" ? "#ffe066" : kind === "blue" ? "#7be0ff" : room.accent;
        for (let i = 0; i < (kind === "gold" ? 16 : 8); i++) s.particles.push({
          x: c.x, y: c.y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4,
          life: 36, max: 36, color: col, size: 2 + Math.random() * 2,
        });
      }
    }
    // Portal activation when all coins / boss dead (desabilitado em arcade)
    if (s.mode === "arcade") {
      lvl.portal.active = false;
    } else {
      const allCoins = lvl.coins.every((c) => c.taken);
      const bossAlive = lvl.enemies.some((e) => e.type === "dragao" && e.hp > 0);
      const enemiesCleared = lvl.enemies.filter((e) => !e.isClone).every((e) => e.hp <= 0);
      if (room.theme === "dragao") {
        lvl.portal.active = !bossAlive;
      } else {
        lvl.portal.active = allCoins || enemiesCleared;
      }
    }

    // Enemies AI
    for (const e of lvl.enemies) {
      if (e.hp <= 0) continue;
      if (e.hitFlash > 0) e.hitFlash--;
      updateEnemy(e, p);
    }

    // Projectiles
    for (const pr of s.projectiles) {
      pr.x += pr.vx; pr.y += pr.vy; pr.life--;
      if (pr.from === "enemy") pr.vy += 0.15;
    }
    // Player proj vs enemies
    for (const pr of s.projectiles) {
      if (pr.from !== "player" || pr.life <= 0) continue;
      for (const e of lvl.enemies) {
        if (e.hp <= 0) continue;
        if (pr.x > e.x && pr.x < e.x + e.w && pr.y > e.y && pr.y < e.y + e.h) {
          e.hp -= damageBuff; e.hitFlash = 8; pr.life = 0;
          for (let i = 0; i < 6; i++) s.particles.push({
            x: pr.x, y: pr.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
            life: 20, max: 20, color: room.accent, size: 2,
          });
          if (e.hp <= 0) {
            s.score += 50;
            for (let i = 0; i < 16; i++) s.particles.push({
              x: e.x + e.w / 2, y: e.y + e.h / 2, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
              life: 36, max: 36, color: e.type === "dragao" ? "#ff4040" : "#ffffff", size: 2 + Math.random() * 2,
            });
            if (e.type === "dragao") sfx("roar");
            // Drop de orbe (30% comum; 8% cura)
            const r = Math.random();
            if (r < 0.08) s.drops.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vy: -2, type: "heal", life: 600 });
            else if (r < 0.23) s.drops.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vy: -2, type: "speed", life: 600 });
            else if (r < 0.38) s.drops.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vy: -2, type: "damage", life: 600 });
            // Arcade: contador (quiz a cada 8 kills)
            if (s.mode === "arcade") {
              s.arcadeKills++;
              s.arcadeKillsToQuiz--;
              s.score += 5; // bônus por kill
              if (s.arcadeKillsToQuiz <= 0) {
                s.arcadeKillsToQuiz = 8;
                arcadeForceQuiz();
              }
            }
          }
          break;
        }
      }
    }
    // Enemy proj vs player (não bate se escondido)
    for (const pr of s.projectiles) {
      if (pr.from !== "enemy" || pr.life <= 0) continue;
      if (s.hiding) continue;
      if (pr.x > p.x && pr.x < p.x + p.w && pr.y > p.y && pr.y < p.y + p.h) {
        pr.life = 0; damagePlayer();
      }
    }
    if (s.mode === "arcade") {
      s.projectiles = s.projectiles.filter((pr) => pr.life > 0 && pr.x > s.arcadeCameraX - 50 && pr.x < s.arcadeCameraX + W + 50 && pr.y < H + 20);
    } else {
      s.projectiles = s.projectiles.filter((pr) => pr.life > 0 && pr.x > -20 && pr.x < W + 20 && pr.y < H + 20);
    }

    // Enemy contact damage
    if (p.invuln === 0 && !s.hiding) {
      for (const e of lvl.enemies) {
        if (e.hp <= 0) continue;
        if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
          damagePlayer(); break;
        }
      }
    }

    // Drops (orbes) física + coleta
    for (const d of s.drops) {
      d.vy += 0.18;
      if (d.vy > 5) d.vy = 5;
      d.y += d.vy; d.life--;
      // colisão com chão
      for (const pl of lvl.platforms) {
        if (d.x > pl.x && d.x < pl.x + pl.w && d.y > pl.y && d.y < pl.y + 10) {
          d.y = pl.y; d.vy = 0;
        }
      }
      if (Math.abs(d.x - (p.x + p.w / 2)) < 22 && Math.abs(d.y - (p.y + p.h / 2)) < 28) {
        d.life = 0;
        sfx("coin");
        if (d.type === "heal") {
          s.lives = Math.min(DIFF_CFG[s.difficulty].lives, s.lives + 1);
        } else {
          s.buff = { type: d.type, until: now + 8000 };
          setActiveBuff(s.buff);
        }
      }
    }
    s.drops = s.drops.filter((d) => d.life > 0);

    // Particles
    for (const pa of s.particles) { pa.x += pa.vx; pa.y += pa.vy; pa.vy += 0.08; pa.life--; }
    s.particles = s.particles.filter((pa) => pa.life > 0);

    // Ambient atmosphere particles (theme-aware)
    if (Math.random() < 0.5 && s.particles.length < 140) {
      const themeColor = room.accent;
      const ax = Math.random() * W;
      const ay = room.theme === "dragao" ? Math.random() * 80 : Math.random() * H;
      s.particles.push({
        x: ax, y: ay,
        vx: (Math.random() - 0.5) * 0.4,
        vy: room.theme === "dragao" ? -0.6 - Math.random() * 0.5 : 0.2 + Math.random() * 0.6,
        life: 90 + Math.random() * 60, max: 150,
        color: room.theme === "sombras" ? "rgba(180,150,255,0.6)" : themeColor,
        size: 1 + Math.random() * 1.5,
      });
    }

    // Portal reach (apenas história)
    if (s.mode === "story" && lvl.portal.active) {
      const po = lvl.portal;
      if (p.x + p.w > po.x && p.x < po.x + po.w && p.y + p.h > po.y && p.y < po.y + po.h) {
        nextRoom();
      }
    }

    // Arcade: endless runner — câmera segue, mundo gerado em chunks
    if (s.mode === "arcade") {
      // Câmera só avança
      const targetCam = p.x - W * 0.35;
      if (targetCam > s.arcadeCameraX) s.arcadeCameraX = targetCam;
      // Trava jogador na borda esquerda da câmera
      if (p.x < s.arcadeCameraX + 4) { p.x = s.arcadeCameraX + 4; if (p.vx < 0) p.vx = 0; }
      // Gera novos chunks conforme avança
      while (s.arcadeChunksUntilX < s.arcadeCameraX + W * 2) {
        generateArcadeChunk(s.arcadeChunksUntilX);
      }
      // Distância e pontuação por movimento
      if (p.x > s.arcadeMaxX) {
        const delta = p.x - s.arcadeMaxX;
        s.arcadeMaxX = p.x;
        s.arcadeMeters = Math.floor(s.arcadeMaxX / 60);
        s.arcadeScoreAccum += delta;
        while (s.arcadeScoreAccum >= 50) { s.score += 1; s.arcadeScoreAccum -= 50; }
      }
      // Quiz por distância (a cada 500m)
      if (s.arcadeMeters - s.arcadeLastQuizMeters >= 500) {
        s.arcadeLastQuizMeters = s.arcadeMeters;
        arcadeForceQuiz();
      }
      // GC: remove tudo bem atrás da câmera
      const cutoff = s.arcadeCameraX - 300;
      lvl.platforms = lvl.platforms.filter((pl) => pl.x + pl.w > cutoff);
      lvl.coins = lvl.coins.filter((c) => c.x > cutoff && !c.taken);
      lvl.enemies = lvl.enemies.filter((e) => (e.hp > 0 || e.hitFlash > 0) && e.x + e.w > cutoff);
      s.drops = s.drops.filter((d) => d.x > cutoff);
      s.projectiles = s.projectiles.filter((pr) => pr.x > cutoff - 50);
    }

    // Sync de estados visuais (stamina/buff) periódico
    if (Math.floor(now / 100) % 2 === 0) {
      setHideRatio(s.hideStamina);
    }

    // HUD sync (throttle? OK each frame; React batches)
    if (s.lives !== hud.lives || Math.round(s.mp) !== hud.mp || s.score !== hud.score) {
      const boss = lvl.enemies.find((x) => x.type === "dragao");
      setHud({ lives: s.lives, mp: Math.round(s.mp), room: s.room, score: s.score, bossHp: boss?.hp ?? 0, bossMax: boss?.maxHp ?? 0 });
    }
  }

  function generateArcadeChunk(fromX: number) {
    const s = stateRef.current;
    const lvl = s.level;
    const groundY = H - 40;
    const chunkW = 600;
    const endX = fromX + chunkW;
    const meters = Math.floor(fromX / 60);
    const difficulty = Math.min(1, meters / 1200); // ramp ao longo de 1200m
    const mul = s.enemyMul;

    // Chão: 1-2 segmentos com chance de gap
    let cursor = fromX;
    while (cursor < endX) {
      const segW = 120 + Math.random() * 200;
      const segEnd = Math.min(endX, cursor + segW);
      lvl.platforms.push({ x: cursor, y: groundY, w: segEnd - cursor, h: 40 });
      cursor = segEnd;
      // gap (não no início para garantir pouso)
      if (cursor < endX - 80 && fromX > 0 && Math.random() < 0.18 + difficulty * 0.12) {
        cursor += 70 + Math.random() * 70;
      }
    }

    // Plataformas aéreas (2-3)
    const numPlats = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numPlats; i++) {
      const px = fromX + 60 + (i / numPlats) * (chunkW - 120) + (Math.random() - 0.5) * 40;
      const py = 220 + Math.random() * 180;
      const pw = 80 + Math.random() * 80;
      lvl.platforms.push({ x: px, y: py, w: pw, h: 14 });
      // Estrelas em cima da plataforma
      const nCoins = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < nCoins; k++) {
        const r = Math.random();
        const kind: CoinKind = r < 0.05 ? "gold" : r < 0.30 ? "blue" : "normal";
        lvl.coins.push({ x: px + 15 + k * (pw - 30) / Math.max(1, nCoins - 1), y: py - 22, taken: false, phase: Math.random() * 6, kind });
      }
    }

    // Arco de estrelas (rio aéreo) 40% chance
    if (Math.random() < 0.4) {
      const baseX = fromX + 80 + Math.random() * 200;
      const baseY = 180 + Math.random() * 80;
      for (let k = 0; k < 7; k++) {
        const ax = baseX + k * 36;
        const ay = baseY - Math.sin(k / 6 * Math.PI) * 70;
        const r = Math.random();
        const kind: CoinKind = k === 3 && Math.random() < 0.4 ? "gold" : r < 0.3 ? "blue" : "normal";
        lvl.coins.push({ x: ax, y: ay, taken: false, phase: k, kind });
      }
    }

    // Inimigos (chance escalando)
    const enemyChance = 0.4 + difficulty * 0.4;
    if (fromX > 600 && Math.random() < enemyChance) {
      const roll = Math.random();
      const type = roll < 0.5 ? "pombo" : roll < 0.8 ? "golem" : "sombra";
      const ex = fromX + 200 + Math.random() * 250;
      if (type === "pombo") {
        lvl.enemies.push({
          type: "pombo", x: ex, y: 160 + Math.random() * 140, w: 36, h: 26,
          vx: (1.8 + Math.random() * 1.2) * 1.15 * mul, vy: 0, hp: 2, maxHp: 2,
          state: "idle", timer: 80, phase: Math.random() * 6, alpha: 1, baseY: 160 + Math.random() * 140, hitFlash: 0,
        });
      } else if (type === "golem") {
        lvl.enemies.push({
          type: "golem", x: ex, y: groundY - 50, w: 44, h: 50,
          vx: 1.5 * mul, vy: 0, hp: 4, maxHp: 4,
          state: "patrol", timer: 80, phase: 0, alpha: 1, baseY: groundY - 50, hitFlash: 0,
        });
      } else {
        lvl.enemies.push({
          type: "sombra", x: ex, y: groundY - 38, w: 32, h: 38,
          vx: 2.5 * mul, vy: 0, hp: 3, maxHp: 3,
          state: "idle", timer: 60, phase: 0, alpha: 0.85, baseY: groundY - 38, hitFlash: 0,
        });
      }
      // Em altas distâncias, chance de 2º inimigo
      if (difficulty > 0.6 && Math.random() < 0.5) {
        lvl.enemies.push({
          type: "pombo", x: ex + 120, y: 140 + Math.random() * 80, w: 36, h: 26,
          vx: (2.0 + Math.random()) * 1.15 * mul, vy: 0, hp: 2, maxHp: 2,
          state: "idle", timer: 100, phase: Math.random() * 6, alpha: 1, baseY: 140 + Math.random() * 80, hitFlash: 0,
        });
      }
    }

    s.arcadeChunksUntilX = endX;
  }


  function arcadeForceQuiz() {
    const s = stateRef.current;
    if (s.pendingDamage) return;
    s.pendingDamage = true;
    s.paused = true;
    const cfg = DIFF_CFG[s.difficulty];
    const { idx, q } = sortearQuestao(s.askedQuestions, cfg.pool);
    s.askedQuestions.add(idx);
    const order = q.alternativas.map((_, i) => i).sort(() => Math.random() - 0.5);
    const correctShuffled = order.indexOf(q.correta);
    setHintsLeft((h) => h); // sem reset
    setEliminatedAlt(null);
    setQuiz({ q, idx, chosen: null, revealed: false, order, correctShuffled, timeLeft: cfg.quizTime });
    setScreen("quiz");
  }


  function updateEnemy(e: Enemy, p: typeof stateRef.current.player) {
    const s = stateRef.current;
    const mul = s.enemyMul;
    e.timer -= mul; // ataques mais frequentes em difícil
    switch (e.type) {
      case "pombo": {
        e.phase += 0.05 * mul;
        e.x -= e.vx * mul;
        e.y = e.baseY + Math.sin(e.phase) * 44;
        if (s.mode !== "arcade" && e.x < -40) { e.x = W + 20; e.baseY = 140 + Math.random() * 140; e.vx = (2.0 + Math.random() * 1.4) * 1.15; }
        if (e.timer <= 0 && Math.abs(e.x - p.x) < 220) {
          s.projectiles.push({ x: e.x + e.w / 2, y: e.y + e.h, vx: (p.x - e.x) * 0.013 * 0.95 * mul, vy: 2 * 0.95 * mul, from: "enemy", life: 140 });
          e.timer = 130 + Math.random() * 90;
          sfx("shoot");
        }
        break;
      }
      case "golem": {
        const dx = p.x - e.x;
        const dist = Math.abs(dx);
        if (dist < 260) {
          e.vx = Math.sign(dx) * 1.5 * mul;
          if (e.timer <= 0 && Math.random() < 0.5) { e.vy = -10; e.timer = 110; }
        } else {
          if (e.timer <= 0) { e.vx = (Math.random() < 0.5 ? -1 : 1) * 1.0 * mul; e.timer = 120 + Math.random() * 90; }
        }
        e.vy += GRAVITY * 0.9;
        e.x += e.vx; e.y += e.vy;
        if (e.y > e.baseY) { e.y = e.baseY; e.vy = 0; }
        if (s.mode !== "arcade") {
          if (e.x < 20) e.x = 20;
          if (e.x + e.w > W - 20) e.x = W - 20 - e.w;
        }
        break;
      }
      case "espelho": {
        if (e.timer <= 0) {
          e.alpha = 0;
          e.x = 100 + Math.random() * (W - 200);
          e.y = 150 + Math.random() * 180;
          e.timer = 160 + Math.random() * 100;
          const ang0 = Math.atan2(p.y - e.y, p.x - e.x);
          for (let k = -1; k <= 1; k++) {
            const a = ang0 + k * 0.25;
            s.projectiles.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: Math.cos(a) * 3.04 * mul, vy: Math.sin(a) * 3.04 * mul - 0.3, from: "enemy", life: 150 });
          }
          sfx("shoot");
        } else if (e.alpha < 1) e.alpha = Math.min(1, e.alpha + 0.04);
        break;
      }
      case "sombra": {
        const dx = p.x - e.x;
        e.vx = Math.sign(dx) * (1.9 + Math.random() * 0.4) * mul;
        e.x += e.vx;
        e.alpha = 0.6 + Math.sin(s.player.anim * 0.5 + e.phase) * 0.2;
        if (e.timer <= 0) {
          s.projectiles.push({ x: e.x + e.w / 2, y: e.y, vx: Math.sign(dx) * 3.7 * mul, vy: -1, from: "enemy", life: 120 });
          e.timer = 100 + Math.random() * 70;
          sfx("shoot");
        }
        if (s.mode !== "arcade") {
          if (e.x < 0) e.x = 0;
          if (e.x + e.w > W) e.x = W - e.w;
        }
        break;
      }
      case "dragao": {
        const frac = e.hp / e.maxHp;
        const dmode = frac > 0.66 ? "patrol" : frac > 0.33 ? "barrage" : "dive";
        if (dmode === "patrol") {
          e.x += e.vx * mul;
          if (e.x < 60 || e.x + e.w > W - 60) e.vx *= -1;
          if (e.timer <= 0) {
            const dx = (p.x - e.x), dy = (p.y - e.y);
            const d = Math.hypot(dx, dy) || 1;
            s.projectiles.push({ x: e.x + e.w / 2, y: e.y + e.h, vx: dx / d * 3.04 * mul, vy: dy / d * 3.04 * mul, from: "enemy", life: 160 });
            e.timer = 120;
            sfx("shoot");
          }
        } else if (dmode === "barrage") {
          e.x += e.vx * 1.2 * mul;
          if (e.x < 60 || e.x + e.w > W - 60) e.vx *= -1;
          if (e.timer <= 0) {
            for (let k = -2; k <= 2; k++) {
              const a = Math.PI / 2 + k * 0.25;
              s.projectiles.push({ x: e.x + e.w / 2, y: e.y + e.h, vx: Math.cos(a) * 2.47 * mul, vy: Math.sin(a) * 3.04 * mul, from: "enemy", life: 160 });
            }
            e.timer = 110;
          }
        } else {
          const dx = p.x - e.x;
          e.vx = Math.sign(dx) * 2.5 * mul;
          e.x += e.vx;
          e.y += Math.sin(s.player.anim * 0.3) * 1.0;
          if (e.timer <= 0) {
            for (let k = 0; k < 3; k++) {
              s.projectiles.push({ x: e.x + e.w / 2, y: e.y + e.h, vx: (Math.random() - 0.5) * 3.8 * mul, vy: (2.5 + Math.random() * 1.5) * 0.95 * mul, from: "enemy", life: 130 });
            }
            e.timer = 80;
            sfx("roar");
          }
        }
        break;
      }
    }
  }


  function damagePlayer() {
    const s = stateRef.current;
    if (s.player.invuln > 0 || s.pendingDamage) return;
    s.player.invuln = 90;
    s.cameraShake = 12;
    sfx("hit");
    s.pendingDamage = true;
    s.paused = true;
    const cfg = DIFF_CFG[s.difficulty];
    const { idx, q } = sortearQuestao(s.askedQuestions, cfg.pool);
    s.askedQuestions.add(idx);
    const order = q.alternativas.map((_, i) => i).sort(() => Math.random() - 0.5);
    const correctShuffled = order.indexOf(q.correta);
    setEliminatedAlt(null);
    setQuiz({ q, idx, chosen: null, revealed: false, order, correctShuffled, timeLeft: cfg.quizTime });
    setScreen("quiz");
  }

  function useHint() {
    if (!quiz || quiz.revealed || hintsLeft <= 0 || eliminatedAlt !== null) return;
    // Escolhe uma alternativa errada para eliminar
    const wrongs = quiz.order.map((_, i) => i).filter((i) => i !== quiz.correctShuffled);
    const pick = wrongs[Math.floor(Math.random() * wrongs.length)];
    setEliminatedAlt(pick);
    setHintsLeft((h) => h - 1);
    const s = stateRef.current;
    s.score = Math.max(0, s.score - 5);
    setHud((h) => ({ ...h, score: s.score }));
    sfx("coin");
  }

  function answerQuiz(choice: number) {
    setQuiz((prev) => prev ? { ...prev, chosen: choice, revealed: true } : null);
    const s = stateRef.current;
    const cfg = DIFF_CFG[s.difficulty];
    if (quiz && choice === quiz.correctShuffled) {
      sfx("correct");
      s.score += 30;
    } else {
      sfx("wrong");
      s.lives = Math.max(0, s.lives - cfg.lifeLoss);
    }
    setHud((h) => ({ ...h, lives: s.lives, score: s.score }));
  }

  function closeQuiz() {
    const s = stateRef.current;
    setQuiz(null);
    setEliminatedAlt(null);
    s.pendingDamage = false;
    if (s.lives <= 0) {
      stopMusic();

      saveScore(
        s.score,
        s.mode
      ).catch(console.error);

      console.log("DEFEAT MATCH");

      saveMatch(
        s.score,
        "defeat",
        s.mode,
        s.difficulty
      ).catch(console.error);
      if (s.mode === "arcade" && s.score > arcadeBest) {
        localStorage.setItem("cr-arcade-best", String(s.score));
        setArcadeBest(s.score);
      }
      safeNarrate(`A escuridão consumiu ${playerName || "nosso herói"}. A Princesa Elisabeth ainda aguarda... tente novamente, bravo guerreiro.`);
      setScreen("gameover");
      return;
    }
    s.paused = false;
    setScreen("game");
  }

  // Quiz timer
  useEffect(() => {
    if (screen !== "quiz" || !quiz || quiz.revealed) return;
    const t = window.setInterval(() => {
      setQuiz((prev) => {
        if (!prev || prev.revealed) return prev;
        if (prev.timeLeft <= 1) {
          const s = stateRef.current;
          const cfg = DIFF_CFG[s.difficulty];
          s.lives = Math.max(0, s.lives - cfg.lifeLoss);
          sfx("wrong");
          setHud((h) => ({ ...h, lives: s.lives }));
          return { ...prev, timeLeft: 0, chosen: -1, revealed: true };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [screen, quiz?.revealed, quiz?.idx]);


  function nextRoom() {
    const s = stateRef.current;
    s.room++;
    saveProgress(
      s.room,
      s.score,
      s.mode,
      s.difficulty
    ).catch(console.error);
    sfx("portal");
    saveScore(
      s.score,
      s.mode
    ).catch(console.error);
    saveMatch(
      s.score,
      "victory",
      s.mode,
      s.difficulty
    ).catch(console.error);
    if (s.room >= ROOMS.length) {
      stopMusic(); playMusic("victory");
      safeNarrate(`${playerName ? playerName + ", você" : "Você"} libertou a Princesa Elisabeth! Albion está salva. Glória ao herói da matemática!`);
      setScreen("victory");
      // Tela WIN permanece até o jogador clicar para voltar
      return;
    }
    s.level = buildLevel(s.room);
    s.player.x = s.level.startX;
    s.player.y = s.level.startY;
    s.player.vx = 0; s.player.vy = 0;
    s.projectiles = []; s.particles = [];
    const room = ROOMS[s.room];
    setTransitionText(`${room.name} — ${room.subtitle}`);
    setScreen("transition");
    if (s.room === ROOMS.length - 2) { stopMusic(); playMusic("boss"); }
    if (room.theme === "castelo") {
      stopMusic(); playMusic("victory");
      safeNarrate(`O dragão caiu, ${playerName || "herói"}! As portas do castelo se abrem. A Princesa Elisabeth espera por você. Chegue até ela!`);
    } else {
      safeNarrate(`${room.name}. ${room.subtitle}. Prepare-se, ${playerName || "guerreiro"}.`);
    }
    setRoomTip(ROOM_TIPS[s.room] || "");
    setTimeout(() => setScreen("game"), 1800);
    setTimeout(() => setRoomTip(""), 5200);
  }

  // ============== Render ==============
  function render(ctx: CanvasRenderingContext2D) {
    const s = stateRef.current;
    const room = ROOMS[Math.min(Math.max(0, s.room), ROOMS.length - 1)];
    const shake = s.cameraShake;
    const ox = (Math.random() - 0.5) * shake;
    const oy = (Math.random() - 0.5) * shake;
    const camX = s.mode === "arcade" ? s.arcadeCameraX : 0;
    ctx.save();
    ctx.translate(ox, oy);

    // Sky gradient (fixo na tela)
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, room.sky[0]);
    grad.addColorStop(1, room.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Background com parallax em arcade
    if (s.mode === "arcade") {
      // Estrelas parallax (camada distante)
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (const st of s.starField) {
        const sx = ((st.x - camX * 0.15) % W + W) % W;
        ctx.fillRect(sx, st.y, st.s, st.s);
      }
      // Camada média — silhuetas de torres
      ctx.fillStyle = "rgba(20,15,40,0.55)";
      for (let i = 0; i < 12; i++) {
        const baseX = i * 180 - ((camX * 0.4) % 180);
        const th = 80 + ((i * 37) % 60);
        ctx.fillRect(baseX, H - 40 - th, 60, th);
        ctx.fillRect(baseX + 20, H - 40 - th - 18, 20, 18);
      }
    } else {
      drawBackground(ctx, room);
    }

    // Mundo (translada pela câmera)
    ctx.save();
    ctx.translate(-camX, 0);
    drawPlatforms(ctx, room);
    drawCoins(ctx, room);
    if (s.mode !== "arcade") {
      if (room.theme !== "castelo") drawPortal(ctx, room);
      if (room.theme === "dragao" && stateRef.current.level.portal.active) {
        drawPrincess(ctx, stateRef.current.level.portal);
      }
      if (room.theme === "castelo") {
        drawPrincess(ctx, stateRef.current.level.portal);
        drawCastlePortalBeacon(ctx);
      }
    }
    drawEnemies(ctx, room);
    drawProjectiles(ctx);
    drawDrops(ctx);
    drawPlayer(ctx);
    drawParticles(ctx);
    ctx.restore();

    drawFog(ctx, room);

    // Sombras: dynamic light around player (mais clara — 50% menos escuro)
    if (room.theme === "sombras" && s.mode !== "arcade") {
      const p = s.player;
      const lg = ctx.createRadialGradient(p.x + p.w / 2 - camX, p.y + p.h / 2, 60, p.x + p.w / 2 - camX, p.y + p.h / 2, 380);
      lg.addColorStop(0, "rgba(0,0,0,0)");
      lg.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    }

    // Vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 520);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // Damage flash
    if (s.player.invuln > 70) {
      ctx.fillStyle = `rgba(255,40,40,${(s.player.invuln - 70) / 30})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }

  function drawBackground(ctx: CanvasRenderingContext2D, room: Room) {
    const s = stateRef.current;
    if (room.theme === "pombal") {
      // Stars
      ctx.fillStyle = "#fff";
      s.starField.forEach((st) => {
        st.p += 0.02; const a = 0.5 + Math.sin(st.p) * 0.4;
        ctx.globalAlpha = a; ctx.fillRect(st.x, st.y, st.s, st.s);
      });
      ctx.globalAlpha = 1;
      // Far cages silhouettes
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      for (let i = 0; i < 6; i++) ctx.fillRect(100 + i * 150, H - 240, 4, 200);
    } else if (room.theme === "adicao") {
      // Sand dunes
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath(); ctx.moveTo(0, H - 120);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H - 120 - Math.sin(x * 0.01) * 30);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      // Embers
      for (let i = 0; i < 20; i++) {
        const x = (Date.now() * 0.05 + i * 53) % W;
        const y = (Date.now() * 0.08 + i * 31) % H;
        ctx.fillStyle = "rgba(255,160,80,0.5)";
        ctx.fillRect(x, y, 2, 2);
      }
    } else if (room.theme === "espelhos") {
      // Grid
      ctx.strokeStyle = "rgba(120,200,255,0.12)"; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    } else if (room.theme === "sombras") {
      ctx.fillStyle = "rgba(160,120,255,0.08)";
      for (let i = 0; i < 12; i++) ctx.fillRect((i * 87) % W, (i * 53) % H, 80, 4);
    } else if (room.theme === "dragao") {
      // Lava glow
      const lg = ctx.createLinearGradient(0, H - 200, 0, H);
      lg.addColorStop(0, "rgba(255,80,40,0)");
      lg.addColorStop(1, "rgba(255,80,40,0.45)");
      ctx.fillStyle = lg; ctx.fillRect(0, H - 200, W, 200);
      // Falling embers
      for (let i = 0; i < 30; i++) {
        const x = (i * 71 + Date.now() * 0.04) % W;
        const y = (i * 47 + Date.now() * 0.12) % H;
        ctx.fillStyle = "rgba(255,120,40,0.7)";
        ctx.fillRect(x, y, 2, 3);
      }
      // Castelo de fundo (aparece quando o dragão morre)
      if (stateRef.current.level.portal.active) {
        const t = Date.now() * 0.001;
        // Brilho dourado vindo do castelo
        const cg = ctx.createRadialGradient(W * 0.78, H * 0.3, 10, W * 0.78, H * 0.3, 220);
        cg.addColorStop(0, `rgba(255,220,80,${0.18 + Math.sin(t) * 0.05})`);
        cg.addColorStop(1, "rgba(255,180,40,0)");
        ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
        // Silhueta do castelo
        ctx.fillStyle = "rgba(10,4,2,0.92)";
        const cx = W * 0.72;
        const baseY = H - 40;
        // Torre central
        ctx.fillRect(cx - 18, baseY - 220, 36, 220);
        // Ameias da torre central
        for (let i = 0; i < 5; i++) ctx.fillRect(cx - 18 + i * 8, baseY - 236, 5, 16);
        // Torre esquerda
        ctx.fillRect(cx - 78, baseY - 170, 28, 170);
        for (let i = 0; i < 4; i++) ctx.fillRect(cx - 78 + i * 7, baseY - 184, 4, 14);
        // Torre direita
        ctx.fillRect(cx + 50, baseY - 170, 28, 170);
        for (let i = 0; i < 4; i++) ctx.fillRect(cx + 50 + i * 7, baseY - 184, 4, 14);
        // Corpo do castelo
        ctx.fillRect(cx - 76, baseY - 120, 154, 120);
        // Portão do castelo (janela iluminada dourada)
        ctx.fillStyle = `rgba(255,220,80,${0.7 + Math.sin(t * 1.5) * 0.15})`;
        ctx.fillRect(cx - 10, baseY - 70, 20, 30);
        // Janelas
        ctx.fillStyle = `rgba(255,200,60,${0.5 + Math.sin(t) * 0.1})`;
        ctx.fillRect(cx - 56, baseY - 95, 12, 18);
        ctx.fillRect(cx + 44, baseY - 95, 12, 18);
        ctx.fillRect(cx - 8, baseY - 190, 16, 22);
        // Texto "CASTELO REAL"
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(t) * 0.1;
        ctx.fillStyle = "#ffd166";
        ctx.font = "bold 11px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.fillText("CASTELO REAL", cx, baseY - 248);
        ctx.textAlign = "left";
        ctx.restore();
      }
    } else if (room.theme === "castelo") {
      const t = Date.now() * 0.001;
      // Paredes de pedra esculpida
      ctx.fillStyle = "#100c28";
      ctx.fillRect(0, 0, W, H - 40);
      // Arcos da abóbada
      ctx.strokeStyle = "rgba(200,160,80,0.25)"; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const ax = 90 + i * 195;
        ctx.beginPath(); ctx.arc(ax, H - 40, 90, Math.PI, 0, false); ctx.stroke();
      }
      // Colunas de pedra
      ctx.fillStyle = "#1e1840";
      for (let i = 0; i < 6; i++) {
        const cx2 = 60 + i * 175;
        ctx.fillRect(cx2 - 14, H - 320, 28, 280);
        // capitel dourado
        ctx.fillStyle = "rgba(200,160,80,0.45)";
        ctx.fillRect(cx2 - 18, H - 320, 36, 10);
        ctx.fillRect(cx2 - 18, H - 48, 36, 10);
        ctx.fillStyle = "#1e1840";
      }
      // Janelas com luz (vitral)
      for (let i = 0; i < 4; i++) {
        const wx = 120 + i * 230;
        const pulse = 0.35 + Math.sin(t * 0.8 + i) * 0.08;
        const wg = ctx.createRadialGradient(wx, 120, 4, wx, 120, 70);
        wg.addColorStop(0, `rgba(255,220,120,${pulse})`);
        wg.addColorStop(0.5, `rgba(180,120,255,${pulse * 0.4})`);
        wg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = wg; ctx.fillRect(wx - 70, 60, 140, 140);
        // arco da janela
        ctx.strokeStyle = `rgba(200,160,80,0.5)`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(wx, 140, 30, Math.PI, 0); ctx.stroke();
        ctx.strokeRect(wx - 30, 110, 60, 60);
      }
      // Tapete vermelho
      ctx.fillStyle = "rgba(120,20,20,0.55)";
      ctx.fillRect(0, H - 55, W, 15);
      ctx.fillStyle = "rgba(180,30,30,0.35)";
      ctx.fillRect(0, H - 52, W, 9);
      // Bordas douradas do tapete
      ctx.fillStyle = "rgba(200,160,80,0.5)";
      ctx.fillRect(0, H - 56, W, 3);
      ctx.fillRect(0, H - 41, W, 3);
      // Tochas nas colunas
      for (let i = 0; i < 6; i++) {
        const tx2 = 60 + i * 175;
        const flicker = 0.7 + Math.sin(t * 3 + i * 1.3) * 0.3;
        const fg = ctx.createRadialGradient(tx2, H - 290, 2, tx2, H - 290, 40);
        fg.addColorStop(0, `rgba(255,180,60,${flicker})`);
        fg.addColorStop(1, "rgba(255,120,20,0)");
        ctx.fillStyle = fg; ctx.fillRect(tx2 - 40, H - 330, 80, 80);
        ctx.fillStyle = `rgba(255,200,80,${flicker})`; ctx.fillRect(tx2 - 4, H - 300, 8, 14);
        ctx.fillStyle = `rgba(255,100,20,${flicker * 0.9})`; ctx.fillRect(tx2 - 2, H - 308, 4, 8);
      }
      // Lustre central (pendente do teto)
      const lcx = W / 2;
      const lFlicker = 0.6 + Math.sin(t * 2) * 0.15;
      const chandG = ctx.createRadialGradient(lcx, 80, 5, lcx, 80, 140);
      chandG.addColorStop(0, `rgba(255,220,120,${lFlicker})`);
      chandG.addColorStop(1, "rgba(255,180,60,0)");
      ctx.fillStyle = chandG; ctx.fillRect(lcx - 140, 0, 280, 200);
      ctx.fillStyle = "rgba(200,160,60,0.8)"; ctx.fillRect(lcx - 30, 0, 4, 50);
      ctx.fillRect(lcx - 30, 50, 60, 6);
      for (let i = 0; i < 5; i++) { ctx.fillRect(lcx - 22 + i * 11, 56, 3, 12); }
      // Efeito de brilho sagrado à direita (onde está a princesa)
      const haloG = ctx.createRadialGradient(W - 110, H - 120, 10, W - 110, H - 120, 180);
      haloG.addColorStop(0, `rgba(255,220,100,${0.22 + Math.sin(t * 1.2) * 0.06})`);
      haloG.addColorStop(1, "rgba(255,200,80,0)");
      ctx.fillStyle = haloG; ctx.fillRect(W - 300, H - 300, 310, 310);
    }
  }

  function drawPlatforms(ctx: CanvasRenderingContext2D, room: Room) {
    const lvl = stateRef.current.level;
    for (const pl of lvl.platforms) {
      if (room.theme === "castelo") {
        // Pedra nobre com tapete
        ctx.fillStyle = "#241c3c";
        ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        // Borda dourada
        ctx.fillStyle = "rgba(200,160,80,0.5)";
        ctx.fillRect(pl.x, pl.y, pl.w, 3);
        // Juntas de pedra
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        for (let x = pl.x + 32; x < pl.x + pl.w; x += 32) ctx.fillRect(x, pl.y + 3, 1, pl.h - 4);
        // Tapete vermelho no chão principal
        if (pl.h >= 40) {
          ctx.fillStyle = "rgba(120,20,20,0.55)";
          ctx.fillRect(pl.x + 30, pl.y, pl.w - 60, 8);
          ctx.fillStyle = "rgba(180,30,30,0.35)";
          ctx.fillRect(pl.x + 30, pl.y + 2, pl.w - 60, 4);
        }
      } else {
        ctx.fillStyle = room.ground;
        ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        ctx.fillStyle = room.accent + "55";
        ctx.fillRect(pl.x, pl.y, pl.w, 3);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        for (let x = pl.x + 20; x < pl.x + pl.w; x += 24) ctx.fillRect(x, pl.y + 4, 1, pl.h - 6);
      }
    }
  }

  function drawCoins(ctx: CanvasRenderingContext2D, room: Room) {
    const lvl = stateRef.current.level;
    const isArcade = stateRef.current.mode === "arcade";
    for (const c of lvl.coins) {
      if (c.taken) continue;
      const kind = c.kind || "normal";
      const color = kind === "gold" ? "#ffe066" : kind === "blue" ? "#7be0ff" : (isArcade ? "#ffd166" : room.accent);
      ctx.save();
      ctx.translate(c.x, c.y + Math.sin(c.phase) * 4);
      // Glow externo (estrelas em arcade)
      if (isArcade) {
        const glow = kind === "gold" ? 22 : kind === "blue" ? 16 : 12;
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, glow);
        g.addColorStop(0, color + "cc");
        g.addColorStop(1, color + "00");
        ctx.fillStyle = g;
        ctx.fillRect(-glow, -glow, glow * 2, glow * 2);
      }
      if (isArcade) {
        // Estrela 5 pontas
        const spikes = 5;
        const outer = kind === "gold" ? 11 : kind === "blue" ? 9 : 8;
        const inner = outer * 0.45;
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const rad = i % 2 === 0 ? outer : inner;
          const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2 + c.phase * 0.15;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        const r = 9 + Math.sin(c.phase) * 1.5;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(Math.cos(c.phase)) * r + 3, r, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawPortal(ctx: CanvasRenderingContext2D, room: Room) {
    const po = stateRef.current.level.portal;
    if (!po.active) return;
    const t = Date.now() * 0.005;
    const cx = po.x + po.w / 2, cy = po.y + po.h / 2;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = room.accent + "aa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, po.w / 2 + Math.sin(t + i) * 4, po.h / 2 + Math.cos(t + i) * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = room.accent + "33";
    ctx.fillRect(po.x, po.y, po.w, po.h);
  }

  function drawEnemies(ctx: CanvasRenderingContext2D, room: Room) {
    const lvl = stateRef.current.level;
    for (const e of lvl.enemies) {
      if (e.hp <= 0) continue;
      ctx.save();
      ctx.globalAlpha = e.alpha;
      const flash = e.hitFlash > 0;
      switch (e.type) {
        case "pombo": {
          ctx.fillStyle = flash ? "#fff" : "#4a3a55";
          ctx.fillRect(e.x, e.y, e.w, e.h);
          // Wings
          const wf = Math.sin(Date.now() * 0.02) * 6;
          ctx.fillRect(e.x - 8, e.y + wf, 12, 4);
          ctx.fillRect(e.x + e.w - 4, e.y - wf, 12, 4);
          // Beak
          ctx.fillStyle = "#ffaa44"; ctx.fillRect(e.x - 4, e.y + 10, 6, 4);
          ctx.fillStyle = "#ff3030"; ctx.fillRect(e.x + 6, e.y + 6, 3, 3);
          break;
        }
        case "golem": {
          ctx.fillStyle = flash ? "#fff" : "#5b3b22";
          ctx.fillRect(e.x, e.y, e.w, e.h);
          ctx.fillStyle = "#3a2412"; ctx.fillRect(e.x + 4, e.y + 4, e.w - 8, 6);
          ctx.fillStyle = "#ff6622"; ctx.fillRect(e.x + 8, e.y + 14, 6, 6); ctx.fillRect(e.x + e.w - 14, e.y + 14, 6, 6);
          // Cracks
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.beginPath(); ctx.moveTo(e.x + 10, e.y + 30); ctx.lineTo(e.x + 30, e.y + 45); ctx.stroke();
          break;
        }
        case "espelho": {
          ctx.fillStyle = flash ? "#fff" : "#a8d4ff";
          ctx.fillRect(e.x, e.y, e.w, e.h);
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
          // Inner reflection
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.fillRect(e.x + 6, e.y + 6, 6, e.h - 12);
          break;
        }
        case "sombra": {
          ctx.fillStyle = flash ? "#fff" : "#2a1a3a";
          // Wisp body
          ctx.beginPath(); ctx.moveTo(e.x + e.w / 2, e.y);
          ctx.bezierCurveTo(e.x - 4, e.y + 20, e.x + e.w + 4, e.y + 20, e.x + e.w / 2, e.y + e.h);
          ctx.fill();
          ctx.fillStyle = "#ff3060"; ctx.fillRect(e.x + 8, e.y + 10, 4, 4); ctx.fillRect(e.x + e.w - 12, e.y + 10, 4, 4);
          break;
        }
        case "dragao": {
          ctx.fillStyle = flash ? "#fff" : "#5a0a0a";
          ctx.fillRect(e.x, e.y, e.w, e.h);
          // Head
          ctx.fillRect(e.x - 30, e.y + 14, 36, 30);
          // Wings
          ctx.fillStyle = "#3a0606";
          ctx.beginPath(); ctx.moveTo(e.x + 20, e.y);
          ctx.lineTo(e.x + 70, e.y - 30); ctx.lineTo(e.x + 90, e.y + 10); ctx.fill();
          // Eye
          ctx.fillStyle = "#ffdf00"; ctx.fillRect(e.x - 18, e.y + 22, 6, 6);
          // Teeth
          ctx.fillStyle = "#fff";
          for (let i = 0; i < 4; i++) ctx.fillRect(e.x - 28 + i * 6, e.y + 38, 3, 5);
          break;
        }
      }
      // HP bar (small)
      if (e.type !== "pombo" || e.maxHp > 1) {
        const w = e.w; const hp = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(e.x, e.y - 8, w, 4);
        ctx.fillStyle = hp > 0.5 ? "#7ee36b" : hp > 0.25 ? "#ffd166" : "#ff5555";
        ctx.fillRect(e.x, e.y - 8, w * hp, 4);
      }
      ctx.restore();
    }
  }

  function drawProjectiles(ctx: CanvasRenderingContext2D) {
    const s = stateRef.current;
    for (const pr of s.projectiles) {
      if (pr.from === "player") {
        ctx.fillStyle = "#7be0ff";
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(123,224,255,0.4)";
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 9, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "#ff5050";
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,80,80,0.4)";
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 10, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawPlayer(ctx: CanvasRenderingContext2D) {
    const s = stateRef.current;
    const p = s.player;
    const blink = p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0;
    if (blink) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (s.hiding) ctx.globalAlpha = 0.45;
    const isHeroine = s.character === "heroine";
    // Body
    ctx.fillStyle = isHeroine ? "#a83a78" : "#264653";
    ctx.fillRect(2, 14, p.w - 4, p.h - 14);
    // Saia/cinto (heroine)
    if (isHeroine) {
      ctx.fillStyle = "#d36ba8";
      ctx.beginPath();
      ctx.moveTo(0, p.h - 10);
      ctx.lineTo(p.w, p.h - 10);
      ctx.lineTo(p.w + 4, p.h - 2);
      ctx.lineTo(-4, p.h - 2);
      ctx.closePath(); ctx.fill();
    }
    // Head
    ctx.fillStyle = "#f4d4a9";
    ctx.fillRect(4, 0, p.w - 8, 14);
    // Hair
    ctx.fillStyle = isHeroine ? "#6a3a5a" : "#3a2a1a";
    ctx.fillRect(4, 0, p.w - 8, 4);
    if (isHeroine) {
      // cabelo longo descendo
      ctx.fillRect(2, 2, 3, 16);
      ctx.fillRect(p.w - 5, 2, 3, 16);
      // tiara
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(6, -1, p.w - 12, 2);
    }
    // Backpack/cape
    ctx.fillStyle = isHeroine ? "#7a1a4a" : "#8a3b2a";
    ctx.fillRect(p.dir > 0 ? 0 : p.w - 4, 16, 4, 16);
    // Eye
    ctx.fillStyle = "#000";
    ctx.fillRect(p.dir > 0 ? p.w - 11 : 7, 6, 3, 3);
    // Legs alternating
    const leg = Math.sin(p.anim) * 4;
    ctx.fillStyle = isHeroine ? "#5a1a3a" : "#1a2a30";
    ctx.fillRect(4, p.h - 6 + Math.max(0, leg), 8, 6);
    ctx.fillRect(p.w - 12, p.h - 6 + Math.max(0, -leg), 8, 6);
    // Weapon
    const recoil = p.fireCd > 8 ? 4 : 0;
    const handX = p.dir > 0 ? p.w - 2 - recoil : -10 + recoil;
    ctx.fillStyle = "#5a3a1a";
    ctx.fillRect(handX, 18, 12, 3);
    const tipX = p.dir > 0 ? handX + 12 : handX - 2;
    ctx.fillStyle = isHeroine ? "#ff8ad0" : "#7be0ff";
    ctx.fillRect(tipX, 16, 4, 6);
    ctx.fillStyle = isHeroine ? "rgba(255,138,208,0.5)" : "rgba(123,224,255,0.5)";
    ctx.fillRect(tipX - 2, 14, 8, 10);
    if (p.dashing > 0) {
      ctx.fillStyle = "rgba(123,224,255,0.4)";
      ctx.fillRect(-p.dir * 8, 6, p.w, p.h - 6);
    }
    ctx.restore();
  }

  function drawDrops(ctx: CanvasRenderingContext2D) {
    const s = stateRef.current;
    const t = Date.now() * 0.006;
    for (const d of s.drops) {
      const color = d.type === "speed" ? "#7be0ff" : d.type === "damage" ? "#ff6060" : "#7ee36b";
      const r = 8 + Math.sin(t + d.x) * 1.5;
      ctx.save();
      ctx.fillStyle = color + "55";
      ctx.beginPath(); ctx.arc(d.x, d.y, r + 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(d.type === "speed" ? "»" : d.type === "damage" ? "×2" : "+♥", d.x, d.y + 3);
      ctx.textAlign = "left";
      ctx.restore();
    }
  }


  function drawPrincess(ctx: CanvasRenderingContext2D, po: { x: number; y: number; w: number; h: number }) {
    const t = Date.now() * 0.003;
    const cx = po.x + po.w / 2;
    const baseY = po.y + po.h - 50;
    const halo = ctx.createRadialGradient(cx, baseY + 10, 4, cx, baseY + 10, 80);
    halo.addColorStop(0, "rgba(255,220,140,0.55)");
    halo.addColorStop(1, "rgba(255,220,140,0)");
    ctx.fillStyle = halo; ctx.fillRect(po.x - 40, po.y - 30, po.w + 80, po.h + 60);
    const float = Math.sin(t) * 2;
    ctx.fillStyle = "#d36ba8";
    ctx.beginPath();
    ctx.moveTo(cx - 16, baseY + 42 + float);
    ctx.lineTo(cx + 16, baseY + 42 + float);
    ctx.lineTo(cx + 8, baseY + 14 + float);
    ctx.lineTo(cx - 8, baseY + 14 + float);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4d4a9";
    ctx.fillRect(cx - 8, baseY - 2 + float, 16, 16);
    ctx.fillRect(cx - 7, baseY - 16 + float, 14, 14);
    ctx.fillStyle = "#a87a3a";
    ctx.fillRect(cx - 9, baseY - 18 + float, 18, 6);
    ctx.fillRect(cx - 11, baseY - 14 + float, 4, 18);
    ctx.fillRect(cx + 7, baseY - 14 + float, 4, 18);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(cx - 6, baseY - 22 + float, 12, 4);
    ctx.fillRect(cx - 1, baseY - 28 + float, 2, 6);
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - 4, baseY - 10 + float, 2, 2);
    ctx.fillRect(cx + 2, baseY - 10 + float, 2, 2);
    ctx.fillStyle = "#fff4d0";
    ctx.font = "bold 12px 'Cinzel', serif";
    ctx.textAlign = "center";
    ctx.fillText("PRINCESA ELISABETH", cx, po.y - 14);
    ctx.textAlign = "left";
  }

  function drawCastlePortalBeacon(ctx: CanvasRenderingContext2D) {
    const po = stateRef.current.level.portal;
    const t = Date.now() * 0.003;
    const cx = po.x + po.w / 2;
    const cy = po.y + po.h / 2;
    // Círculos de luz pulsando ao redor da princesa
    for (let i = 0; i < 3; i++) {
      const r = 50 + i * 22 + Math.sin(t + i * 1.2) * 8;
      ctx.strokeStyle = `rgba(255,220,80,${0.35 - i * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    // Raios de luz descendentes
    ctx.save();
    const beamG = ctx.createLinearGradient(cx, 0, cx, cy - 20);
    beamG.addColorStop(0, "rgba(255,220,80,0)");
    beamG.addColorStop(1, `rgba(255,220,80,${0.18 + Math.sin(t) * 0.06})`);
    ctx.fillStyle = beamG;
    ctx.fillRect(cx - 20, 0, 40, cy - 20);
    ctx.restore();
    // Texto instrutivo pulsando
    ctx.save();
    ctx.globalAlpha = 0.75 + Math.sin(t * 2) * 0.2;
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 11px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.fillText("CHEGAR ATÉ ELA!", cx, po.y - 28);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawParticles(ctx: CanvasRenderingContext2D) {
    const s = stateRef.current;
    for (const pa of s.particles) {
      ctx.globalAlpha = pa.life / pa.max;
      ctx.fillStyle = pa.color;
      ctx.fillRect(pa.x, pa.y, pa.size, pa.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFog(ctx: CanvasRenderingContext2D, room: Room) {
    ctx.fillStyle = room.fog;
    ctx.fillRect(0, 0, W, H);
  }

  // ============== Story screen logic ==============
  const typeTimerRef = useRef<number | null>(null);
  const narrationDisabledRef = useRef(false);
  const safeNarrate = (text: string) => {
    if (narrationDisabledRef.current) return Promise.resolve();
    return narrate(text).catch(() => {});
  };
  const [storyDone, setStoryDone] = useState(false);
  const [storyLoading, setStoryLoading] = useState(false);

  function startTypewriter(durationMs: number) {
    if (typeTimerRef.current) window.clearInterval(typeTimerRef.current);
    setTypedText("");
    setStoryDone(false);
    let i = 0;
    const text = STORY_FULL;
    const totalMs = Math.max(8000, durationMs);
    const intervalMs = Math.max(18, totalMs / text.length);
    typeTimerRef.current = window.setInterval(() => {
      i++;
      setTypedText(text.slice(0, i));
      if (i >= text.length) {
        if (typeTimerRef.current) window.clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
        setStoryDone(true);
      }
    }, intervalMs) as unknown as number;
  }

  async function startJourney() {
    initAudio();
    playMusic("intro");
    narrationDisabledRef.current = false;
    setStoryLoading(true);
    setTypedText("");
    setStoryDone(false);
    setScreen("story");
    try {
      const prep = await narratePrepare(STORY_FULL);
      // Se o usuário pulou enquanto carregava, não toca nem reinicia o typewriter
      if (narrationDisabledRef.current) return;
      setStoryLoading(false);
      if (prep) {
        startTypewriter(prep.duration * 1000);
        prep.play().catch((e) => console.error("audio play failed", e));
      } else {
        startTypewriter(24000);
      }
    } catch (e) {
      console.error("narrate prepare failed", e);
      if (narrationDisabledRef.current) return;
      setStoryLoading(false);
      startTypewriter(24000);
    }
  }

  function beginGame() {
    stopNarration();
    if (typeTimerRef.current) { window.clearInterval(typeTimerRef.current); typeTimerRef.current = null; }
    const s = stateRef.current;
    const cfg = DIFF_CFG[s.difficulty];
    s.lives = cfg.lives; s.mp = 100; s.score = 0; s.room = 0;
    s.level = buildLevel(0);
    s.player.x = s.level.startX; s.player.y = s.level.startY;
    s.player.vx = 0; s.player.vy = 0; s.player.invuln = 0;
    s.projectiles = []; s.particles = []; s.drops = []; s.askedQuestions.clear(); s.paused = false; s.pendingDamage = false;
    s.hideStamina = 1; s.hiding = false; s.buff = null;
    s.arcadeKills = 0; s.arcadeWave = 0; s.arcadeSpawnTimer = 0;
    setActiveBuff(null);
    setHintsLeft(3);
    setHud({ lives: cfg.lives, mp: 100, room: 0, score: 0, bossHp: 0, bossMax: 0 });
    stopMusic(); playMusic("game");
    setTransitionText(`${ROOMS[0].name} — ${ROOMS[0].subtitle}`);
    setRoomTip(ROOM_TIPS[0]);
    setScreen("transition");
    safeNarrate(`${ROOMS[0].name}. ${ROOMS[0].subtitle}. Prepare-se, ${playerName || "guerreiro"}.`);
    setTimeout(() => setScreen("game"), 1800);
    setTimeout(() => setRoomTip(""), 5200);
  }

  function beginArcade() {
    stopNarration();
    narrationDisabledRef.current = false;
    const s = stateRef.current;
    const cfg = DIFF_CFG[s.difficulty];
    s.mode = "arcade";
    s.lives = cfg.lives; s.mp = 100; s.score = 0; s.room = 0;
    // Nível "vazio" para o endless: limpa tudo
    s.level = { platforms: [], coins: [], enemies: [], portal: { x: 0, y: 0, w: 0, h: 0, active: false }, startX: 60, startY: H - 120 };
    // Reset arcade scroll state
    s.arcadeCameraX = 0;
    s.arcadeChunksUntilX = 0;
    s.arcadeStars = 0;
    s.arcadeMeters = 0;
    s.arcadeMaxX = 60;
    s.arcadeKillsToQuiz = 8;
    s.arcadeLastQuizMeters = 0;
    s.arcadeScoreAccum = 0;
    s.arcadeKills = 0; s.arcadeWave = 0; s.arcadeSpawnTimer = 0;
    // Gera chunks iniciais (3) — primeiro sem inimigos garantido
    generateArcadeChunk(0);
    generateArcadeChunk(600);
    generateArcadeChunk(1200);
    s.player.x = 60; s.player.y = H - 120;
    s.player.vx = 0; s.player.vy = 0; s.player.invuln = 0;
    s.projectiles = []; s.particles = []; s.drops = []; s.askedQuestions.clear(); s.paused = false; s.pendingDamage = false;
    s.hideStamina = 1; s.hiding = false; s.buff = null;
    setActiveBuff(null);
    setHintsLeft(3);
    setHud({ lives: cfg.lives, mp: 100, room: 0, score: 0, bossHp: 0, bossMax: 0 });
    stopMusic(); playMusic("game");
    setTransitionText(`MODO ARCADE — Corrida Infinita`);
    setRoomTip("Corra para a direita, colete estrelas, evite inimigos. Quiz a cada 8 kills ou 500m.");
    setScreen("transition");
    setTimeout(() => setScreen("game"), 1500);
    setTimeout(() => setRoomTip(""), 5200);
  }

  function skipTyping() {
    if (typeTimerRef.current) {
      window.clearInterval(typeTimerRef.current);
      typeTimerRef.current = null;
    }
    stopNarration();
    narrationDisabledRef.current = true;
    setTypedText(STORY_FULL);
    setStoryDone(true);
  }


  function restart() {
    stopMusic();
    stopNarration();
    narrationDisabledRef.current = false;
    setScreen("start");

  }

  function restartGame() {
    const s = stateRef.current;
    if (s.mode === "arcade") { beginArcade(); return; }
    stopMusic();
    stopNarration();
    narrationDisabledRef.current = false;
    const cfg = DIFF_CFG[s.difficulty];
    s.lives = cfg.lives; s.mp = 100; s.score = 0; s.room = 0;
    s.level = buildLevel(0);
    s.player.x = s.level.startX; s.player.y = s.level.startY;
    s.player.vx = 0; s.player.vy = 0; s.player.invuln = 0;
    s.projectiles = []; s.particles = []; s.drops = []; s.askedQuestions.clear(); s.paused = false; s.pendingDamage = false;
    s.hideStamina = 1; s.hiding = false; s.buff = null;
    s.arcadeKills = 0;
    setActiveBuff(null);
    setHintsLeft(3);
    setHud({ lives: cfg.lives, mp: 100, room: 0, score: 0, bossHp: 0, bossMax: 0 });
    setQuiz(null);
    playMusic("game");
    setTransitionText(`${ROOMS[0].name} — ${ROOMS[0].subtitle}`);
    setRoomTip(ROOM_TIPS[0]);
    setScreen("transition");
    safeNarrate(`${ROOMS[0].name}. ${ROOMS[0].subtitle}. Prepare-se, ${playerName || "guerreiro"}.`);
    setTimeout(() => setScreen("game"), 1800);
    setTimeout(() => setRoomTip(""), 5200);
  }

  // Sincroniza state visual de buff
  useEffect(() => {
    const t = window.setInterval(() => {
      const s = stateRef.current;
      const b = s.buff;
      if (!b) { if (activeBuff) setActiveBuff(null); return; }
      if (performance.now() > b.until) { s.buff = null; setActiveBuff(null); return; }
      if (!activeBuff || activeBuff.type !== b.type || activeBuff.until !== b.until) setActiveBuff(b);
    }, 200);
    return () => window.clearInterval(t);
  }, [activeBuff]);

  //Detectar quando qualquer parte executar gameover

  useEffect(() => {
    if (screen !== "gameover") return;

    const s = stateRef.current;

    saveMatch(
      s.score,
      "defeat",
      s.mode,
      s.difficulty
    ).catch(console.error);

  }, [screen]);

  // ============== Render JSX ==============
  return (
    <div className="cr-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Press+Start+2P&family=Cinzel:wght@500;700&display=swap');
        :root { --ink:#e6e6e6; --ink-dim:#7a7a7a; --line:#2a2a2a; --accent:#d6d6d6; --bg:#070708; --panel:#0d0d10; --panel-2:#15151a; --gold:#c8a960; }
        * { box-sizing: border-box; margin:0; padding:0; }
        html, body { width:100%; height:100%; overflow:hidden; }
        .cr-root {
          width:100%; height:100dvh; min-height:100svh;
          background:
            radial-gradient(ellipse 140% 100% at 50% 30%, #14233f 0%, #0a1428 40%, #050a16 70%, #02040a 100%),
            radial-gradient(circle at 15% 85%, rgba(80,140,220,0.10), transparent 45%),
            radial-gradient(circle at 85% 15%, rgba(255,200,90,0.06), transparent 50%);
          color:var(--ink); font-family:'Inter','Cinzel',serif;
          display:flex; align-items:center; justify-content:center;
          overflow:hidden; position:relative;
        }
        .cr-stage {
          position:fixed; inset:0; width:100%; height:100%;
          background:transparent;
        }
        canvas {
          position:absolute; top:50%; left:50%;
          transform:translate(-50%,-50%);
          width: min(100vw, calc(100dvh * 16 / 9));
          height: min(100dvh, calc(100vw * 9 / 16));
          max-width:960px; max-height:540px;
          image-rendering:pixelated; display:block;
        }
        .scanlines { position:absolute; inset:0; pointer-events:none; background: repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,0) 2px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0) 4px); mix-blend-mode: multiply; z-index:5; }
        .overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:16px; z-index:10; overflow-y:auto; }

        /* ===== START — Protocol Omega (navy + gold) ===== */
        .start-bg { position:absolute; inset:0; background: transparent; }
        .start-orb { position:absolute; right:-80px; top:50%; transform:translateY(-50%); width:480px; height:480px; border-radius:50%;
          background: radial-gradient(circle at 35% 35%, rgba(120,180,255,0.18) 0%, rgba(60,110,200,0.12) 30%, rgba(20,40,80,0.05) 55%, transparent 70%);
          box-shadow: 0 0 200px rgba(120,180,255,0.15), inset 30px 40px 100px rgba(255,255,255,0.04);
          filter: blur(.4px); animation: orbDrift 14s ease-in-out infinite alternate; pointer-events:none;
        }
        @keyframes orbDrift { from { transform:translateY(-50%) scale(1); opacity:.85; } to { transform:translateY(-52%) scale(1.05); opacity:1; } }
        .start-card { position:relative; width:100%; max-width:560px; max-height:96dvh; overflow-y:auto; padding:32px 28px; border:1px solid rgba(200,170,90,0.35); background: linear-gradient(180deg, rgba(14,26,48,0.92), rgba(6,12,24,0.96)); backdrop-filter: blur(8px); text-align:center; box-shadow: 0 30px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(200,170,90,0.15), 0 0 60px rgba(60,110,200,0.12); border-radius:14px; scrollbar-width:thin; scrollbar-color:#c8a960 #0a1428; }
        .crest { font-family:'Press Start 2P', monospace; font-size:8px; letter-spacing:3px; color:#c8a960; margin-bottom:14px; text-transform:uppercase; opacity:.85; }
        .title { font-family:'Cinzel Decorative', serif; font-weight:900; font-size: clamp(34px, 6vw, 60px); letter-spacing:8px; line-height:1; margin:0;
          background: linear-gradient(180deg, #fff4d0 0%, #e8c879 35%, #c8a04a 70%, #8a6520 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
          text-shadow: 0 4px 24px rgba(200,170,90,0.35), 0 0 40px rgba(200,170,90,0.2);
          filter: drop-shadow(0 2px 0 rgba(0,0,0,0.5));
        }
        .subtitle { font-family:'Cinzel', serif; font-size: clamp(11px, 1.4vw, 13px); color:#9bb4d8; margin-top:10px; letter-spacing:6px; text-transform:uppercase; }
        .divider { width:80px; height:1px; background:linear-gradient(90deg, transparent, #c8a960, transparent); margin:18px auto; }
        .lede { font-family:'Cinzel',serif; font-size:14px; color:#bccae0; line-height:1.7; margin:0 0 20px; letter-spacing:.5px; }
        .lede b { color:#fff4d0; font-weight:700; }
        .meta-row { display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:20px; }
        .meta { background:rgba(255,200,90,0.05); border:1px solid rgba(200,170,90,0.25); border-radius:8px; padding:10px 4px; transition: all .2s; cursor:pointer; }
        .meta:hover { background:rgba(255,200,90,0.1); border-color:rgba(200,170,90,0.5); }
        .meta span { display:block; font-family:'Press Start 2P',monospace; font-size:7px; color:#c8a960; letter-spacing:2px; margin-bottom:4px; opacity:.85; }
        .meta b { font-family:'Cinzel',serif; font-size:11px; color:#f0e0b0; letter-spacing:1.5px; font-weight:700; }
        .name-label { display:block; font-family:'Press Start 2P',monospace; font-size:8px; letter-spacing:3px; color:#c8a960; margin-bottom:8px; text-transform:uppercase; }
        .name-input { display:block; margin: 0 auto 16px; width: 80%; max-width:340px; background:rgba(5,10,20,0.7); border:1px solid rgba(200,170,90,0.35); border-radius:8px; color:#f0e0b0; padding:11px 14px; font-family:'Cinzel',serif; font-size:14px; letter-spacing:3px; text-align:center; outline:none; transition: all .2s; }
        .name-input:focus { border-color:#c8a960; background:rgba(10,20,40,0.85); box-shadow: 0 0 20px rgba(200,170,90,0.3); }
        .name-input::placeholder { color:#5a6a8a; }
        .btn { display:inline-flex; align-items:center; justify-content:center; gap:10px; font-family:'Cinzel',serif; font-weight:700; letter-spacing:4px; padding:14px 32px; border-radius:8px; cursor:pointer; text-transform:uppercase; font-size:13px; transition: all .2s; margin: 6px; border:1px solid rgba(200,170,90,0.5); }
        .btn.solid { background:linear-gradient(180deg, #1a2a4a 0%, #0a1428 100%); color:#f0e0b0; border-color:#c8a960; box-shadow: 0 8px 24px rgba(200,170,90,0.2), inset 0 1px 0 rgba(200,170,90,0.3); position:relative; }
        .btn.solid::before, .btn.solid::after { content:'◆'; color:#c8a960; font-size:8px; opacity:.8; }
        .btn.solid:hover { background:linear-gradient(180deg, #233a64 0%, #14233f 100%); box-shadow: 0 8px 30px rgba(200,170,90,0.4), inset 0 1px 0 rgba(200,170,90,0.5); transform: translateY(-1px); }
        .btn.ghost { background:rgba(20,35,63,0.5); color:#c8a960; border-color:rgba(200,170,90,0.3); }
        .btn.ghost:hover { background:rgba(30,50,90,0.7); border-color:#c8a960; }
        .btn.danger { background:rgba(20,35,63,0.5); color:#c8a960; }
        .btn.danger:hover { background:rgba(30,50,90,0.7); border-color:#c8a960; }
        .credits { margin-top:20px; font-size:8px; color:#5a6a8a; letter-spacing:3px; font-family:'Press Start 2P', monospace; }
        .controls-hint { margin-top:14px; font-size:11px; color: #8aa0c0; letter-spacing:1px; font-family:'Cinzel',serif; }
        kbd { background:rgba(200,170,90,0.1); border:1px solid rgba(200,170,90,0.4); padding:2px 6px; border-radius:4px; font-family:monospace; color:#c8a960; font-size:11px; }

        /* ===== STORY — cinematic terminal ===== */
        .story-bg { position:absolute; inset:0; background:
          radial-gradient(ellipse at center, #0a0a10 0%, #050507 70%, #000 100%); overflow:hidden;
        }
        .story-bg::before { content:''; position:absolute; inset:0; background-image:
          radial-gradient(1.5px 1.5px at 18% 28%, rgba(255,255,255,0.5), transparent),
          radial-gradient(1px 1px at 72% 62%, rgba(255,255,255,0.4), transparent),
          radial-gradient(2px 2px at 42% 82%, rgba(200,200,210,0.4), transparent),
          radial-gradient(1px 1px at 88% 18%, rgba(255,255,255,0.5), transparent);
          animation: twinkle 4s infinite alternate; }
        .story-vignette { position:absolute; inset:0; background:
          radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 80%);
          pointer-events:none;
        }
        @keyframes twinkle { from { opacity:.4 } to { opacity:1 } }
        .story-card { position:relative; max-width:760px; width:100%; max-height:96dvh; overflow-y:auto; padding:42px 38px; border:1px solid #222; background: rgba(6,6,8,0.92); text-align:left; box-shadow: 0 0 80px rgba(0,0,0,0.9); border-radius:4px; animation: fadeUp .5s ease-out; scrollbar-width:thin; scrollbar-color:#444 #0a0a10; }
        @keyframes fadeUp { from { opacity:0; transform: translateY(14px) } to { opacity:1; transform:translateY(0) } }
        .story-text { font-family:'Cinzel', serif; font-size: clamp(16px, 2.4vw, 22px); line-height:1.8; letter-spacing:1px; min-height: 140px; color:#dcdcdc; }
        .caret { display:inline-block; margin-left:2px; color:#aaa; animation: blink 1s step-start infinite; }
        @keyframes blink { 50% { opacity:0; } }
        .story-progress { display:flex; justify-content:flex-start; gap:8px; margin-top:24px; }
        .story-dot { width:32px; height:2px; background:#2a2a2a; transition: all .3s; }
        .story-dot.on { background: #d8d8d8; box-shadow: 0 0 8px rgba(255,255,255,0.3); }

        /* HUD — Protocol Omega */
        .hud { position:absolute; top:0; left:0; right:0; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; z-index:6; pointer-events:none; font-family:'Cinzel',serif; font-size:11px;
          background: linear-gradient(180deg, rgba(6,12,24,0.85), rgba(6,12,24,0));
          border-bottom: 1px solid rgba(200,170,90,0.25);
        }
        .hud-frame { display:flex; align-items:center; gap:10px; padding:6px 12px; background:rgba(10,20,40,0.7); border:1px solid rgba(200,170,90,0.4); border-radius:8px; box-shadow: inset 0 1px 0 rgba(200,170,90,0.15), 0 4px 14px rgba(0,0,0,0.5); }
        .hud-omega { font-family:'Cinzel Decorative',serif; color:#c8a960; font-size:18px; line-height:1; text-shadow: 0 0 10px rgba(200,170,90,0.5); }
        .hud-name { font-family:'Press Start 2P',monospace; font-size:8px; color:#c8a960; letter-spacing:2px; }
        .hud-room-num { font-family:'Cinzel',serif; font-size:10px; color:#9bb4d8; letter-spacing:2px; }
        .hearts { display:flex; gap:5px; }
        .heart { font-size:18px; color: #c8a960; text-shadow: 0 0 8px rgba(200,170,90,0.6); }
        .heart.empty { color:#3a2a10; text-shadow:none; }
        .mp-bar { width:120px; height:9px; background:rgba(5,10,20,0.85); border:1px solid rgba(200,170,90,0.45); border-radius:5px; position:relative; overflow:hidden; }
        .mp-fill { height:100%; background: linear-gradient(90deg, #4a8aff, #7be0ff); transition: width .2s; box-shadow: 0 0 8px rgba(123,224,255,0.6); }
        .room-label { color: #c8a960; letter-spacing:3px; font-family:'Cinzel',serif; font-weight:700; text-transform:uppercase; font-size:11px; }
        .score { color:#f0e0b0; font-family:'Press Start 2P',monospace; font-size:10px; letter-spacing:1px; }

        /* Phase indicator (top-center) */
        .phase-bar { position:absolute; top:54px; left:50%; transform:translateX(-50%); display:flex; gap:6px; z-index:6; pointer-events:none; }
        .phase-step { width:34px; height:6px; background:rgba(10,20,40,0.7); border:1px solid rgba(200,170,90,0.3); border-radius:3px; }
        .phase-step.on { background:linear-gradient(90deg, #c8a960, #fff4d0); box-shadow: 0 0 8px rgba(200,170,90,0.7); }
        .phase-step.done { background:rgba(200,170,90,0.4); }

        /* Room tip banner */
        .room-tip { position:absolute; top:80px; left:50%; transform:translateX(-50%); z-index:6; pointer-events:none;
          padding:8px 16px; background:linear-gradient(180deg, rgba(14,26,48,0.92), rgba(6,12,24,0.95));
          border:1px solid rgba(200,170,90,0.4); border-radius:6px; color:#f0e0b0;
          font-family:'Cinzel',serif; font-size:12px; letter-spacing:1.5px; text-align:center;
          box-shadow: 0 6px 20px rgba(0,0,0,0.6); animation: tipIn .4s ease-out;
          max-width: 80%;
        }
        @keyframes tipIn { from { opacity:0; transform: translate(-50%, -10px); } to { opacity:1; transform: translate(-50%, 0); } }

        .boss-bar { position:absolute; top:96px; left:50%; transform:translateX(-50%); width:60%; max-width:480px; z-index:6; }
        .boss-bar .label { font-family:'Cinzel Decorative', serif; color:#ff5050; text-align:center; font-size:14px; letter-spacing:4px; text-shadow: 0 0 10px rgba(255,40,40,0.6); }
        .boss-bar .bar { height:14px; background:#0a0a0a; border:1px solid #6a0a0a; margin-top:4px; position:relative; border-radius:4px; overflow:hidden; }
        .boss-fill { height:100%; background: linear-gradient(90deg, #ff3b3b, #6a0a0a); }

        /* QUIZ — Protocol Omega navy/gold */
        .quiz-bg { background: radial-gradient(ellipse at center, rgba(10,20,40,0.95), rgba(2,4,10,0.98)); backdrop-filter: blur(3px); }
        .quiz-wrap { position:relative; width:100%; max-width:680px; padding-top:22px; }
        .quiz-omega { position:absolute; top:0; left:50%; transform:translateX(-50%); width:40px; height:40px; line-height:38px; text-align:center; background:#0a1428; border:2px solid #c8a960; border-radius:50%; color:#c8a960; font-family:'Cinzel Decorative',serif; font-size:18px; box-shadow:0 0 16px rgba(200,170,90,0.6), 0 0 32px rgba(200,170,90,0.2); z-index:1; }
        .quiz-card { position:relative; width:100%; max-height:88dvh; overflow-y:auto; padding:28px 30px;
          background: linear-gradient(180deg, rgba(14,26,48,0.96), rgba(6,12,24,0.98));
          border:none; border-radius:12px;
          box-shadow: 0 0 80px rgba(200,170,90,0.35), inset 0 1px 0 rgba(200,170,90,0.2);
          animation: scaleIn .35s ease-out; scrollbar-width:thin; scrollbar-color:#c8a960 #0a1428; }
        @keyframes scaleIn { from { opacity:0; transform:scale(.9) } to { opacity:1; transform:scale(1) } }
        .quiz-tags { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
        .tag { font-family:'Press Start 2P', monospace; font-size:9px; padding:5px 9px; letter-spacing:1px; border-radius:4px; }
        .tag.facil { background:rgba(126,227,107,0.12); color:#7ee36b; border:1px solid #2e7e3e; }
        .tag.medio { background:rgba(255,209,102,0.12); color:#ffd166; border:1px solid #7a5a1a; }
        .tag.dificil { background:rgba(255,119,119,0.12); color:#ff7777; border:1px solid #7a1a1a; }
        .tag.principio { background:rgba(123,168,255,0.12); color:#7ba8ff; border:1px solid #2a4a8a; }
        .quiz-q { font-family:'Cinzel', serif; font-size:17px; line-height:1.6; margin-bottom:20px; color:#f0e0b0; }
        .alts { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
        @media (max-width:560px) { .alts { grid-template-columns: 1fr; } }
        .alt { font-family:'Cinzel', serif; padding:13px 16px; background: rgba(10,20,40,0.7); border:1px solid rgba(200,170,90,0.3); color:#dde4f0; cursor:pointer; text-align:left; transition: all .15s; font-size:14px; border-radius:6px; }
        .alt:hover { border-color:#c8a960; background:rgba(20,35,63,0.85); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(200,170,90,0.2); }
        .alt.correct { background: linear-gradient(180deg, rgba(46,126,62,0.4), rgba(14,58,26,0.6)); border-color:#7ee36b; color:#fff; }
        .alt.wrong { background: linear-gradient(180deg, rgba(122,26,26,0.4), rgba(58,14,14,0.6)); border-color:#ff5555; color:#fff; }
        .alt.disabled { pointer-events:none; opacity:.85; }
        .explain { margin-top:18px; padding:14px 16px; background: rgba(200,170,90,0.08); border-left:3px solid #c8a960; border-radius:4px; font-family:'Cinzel', serif; font-size:13px; line-height:1.6; color: #e8e0c8; }
        .explain b { color: #c8a960; }
        .quiz-actions { display:flex; justify-content:flex-end; margin-top:14px; }

        /* TRANSITION */
        .trans-bg { background: radial-gradient(ellipse at center, #0a1428 0%, #02040a 80%); display:flex; align-items:center; justify-content:center; animation: wipe 1.8s ease; }
        @keyframes wipe { 0%{clip-path: inset(0 100% 0 0)} 30%{clip-path: inset(0 0 0 0)} 70%{clip-path: inset(0 0 0 0)} 100%{clip-path: inset(0 0 0 100%)} }
        .trans-text { font-family:'Cinzel Decorative', serif; font-size: clamp(24px, 4vw, 44px);
          background: linear-gradient(180deg, #fff4d0 0%, #c8a960 60%, #8a6520 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
          letter-spacing:6px; text-align:center; filter: drop-shadow(0 0 24px rgba(200,170,90,0.5)); }

        /* GAME OVER / VICTORY — Protocol Omega */
        .end-overlay-bg { position:absolute; inset:0; }
        .end-overlay-bg.lose { background: radial-gradient(ellipse at center, rgba(80,10,10,0.7) 0%, rgba(2,0,0,0.95) 70%); animation: endPulse 2.5s ease-in-out infinite alternate; }
        .end-overlay-bg.win { background: radial-gradient(ellipse at center, rgba(60,40,0,0.6) 0%, rgba(2,4,10,0.95) 70%); animation: endPulse 3s ease-in-out infinite alternate; }
        @keyframes endPulse { from { opacity:.85; } to { opacity:1; } }
        .end-card { position:relative; text-align:center; padding:48px 36px; background: linear-gradient(180deg, rgba(14,26,48,0.97), rgba(4,8,18,0.99)); border:1px solid; max-width:640px; width:90%; border-radius:14px; animation: endIn .5s cubic-bezier(.22,.8,.4,1); }
        @keyframes endIn { from { opacity:0; transform: scale(.92) translateY(20px); } to { opacity:1; transform: scale(1) translateY(0); } }
        .end-card.lose { border-color:#9a1a1a; box-shadow: 0 0 120px rgba(154,26,26,0.6), 0 0 40px rgba(255,40,40,0.2), inset 0 1px 0 rgba(255,80,80,0.2); }
        .end-card.win { border-color: #c8a960; box-shadow: 0 0 120px rgba(200,170,90,0.7), 0 0 40px rgba(255,220,90,0.25), inset 0 1px 0 rgba(200,170,90,0.35); }
        .end-badge { font-family:'Cinzel Decorative',serif; font-size:28px; margin-bottom:4px; }
        .end-card.lose .end-badge { color:#ff5050; text-shadow: 0 0 20px rgba(255,60,60,0.7); }
        .end-card.win .end-badge { color:#c8a960; text-shadow: 0 0 20px rgba(200,170,90,0.7); }
        .end-title { font-family:'Cinzel Decorative', serif; font-size: clamp(50px, 9vw, 110px); letter-spacing:8px; line-height:1; margin:4px 0 12px; font-weight:900; }
        .end-card.lose .end-title { color:#ff5050; text-shadow: 0 0 60px rgba(255,60,60,0.8), 0 4px 0 #4a0808, 0 0 120px rgba(200,0,0,0.4); }
        .end-card.win .end-title { background: linear-gradient(180deg, #fff4d0 0%, #e8c879 35%, #c8a04a 65%, #8a6520 100%); -webkit-background-clip:text; background-clip:text; color:transparent; filter: drop-shadow(0 0 40px rgba(200,170,90,0.7)); }
        .end-divider { width:80px; height:2px; background:linear-gradient(90deg,transparent,currentColor,transparent); margin:12px auto 16px; }
        .end-card.lose .end-divider { color:#7a1a1a; }
        .end-card.win .end-divider { color:#c8a960; }
        .end-text { font-family:'Cinzel', serif; font-size:14px; margin:0 0 8px; line-height:1.75; color:#c8d4e8; letter-spacing:.3px; }
        .end-score { display:inline-block; font-family:'Press Start 2P',monospace; font-size:13px; padding:10px 20px; margin:12px 0 22px; border-radius:6px; letter-spacing:2px; }
        .end-card.lose .end-score { color:#ff9090; background:rgba(80,10,10,0.5); border:1px solid #7a1a1a; }
        .end-card.win .end-score { color:#fff4d0; background:rgba(40,30,0,0.5); border:1px solid #c8a960; text-shadow: 0 0 10px rgba(200,170,90,0.5); }

        /* MOBILE TOUCH CONTROLS — navy + gold to match start screen */
        .touch { position:fixed; bottom:0; left:0; right:0; padding:10px 14px; display:none; justify-content:space-between; align-items:flex-end; z-index:7; pointer-events:none; background: linear-gradient(0deg, rgba(2,4,10,0.7) 0%, transparent 100%); }
        .touch > div { display:flex; gap:8px; pointer-events:auto; }
        .tbtn { width:54px; height:54px; border-radius:50%;
          background: linear-gradient(180deg, #1a2a4a 0%, #0a1428 100%);
          border:1px solid #c8a960; color:#f0e0b0;
          font-family:'Press Start 2P', monospace; font-size:14px; user-select:none; touch-action:none;
          box-shadow: 0 4px 14px rgba(200,170,90,0.25), inset 0 1px 0 rgba(200,170,90,0.3);
        }
        .tbtn:active { background: linear-gradient(180deg, #233a64 0%, #14233f 100%); box-shadow: 0 0 16px rgba(200,170,90,0.55); }
        @media (pointer: coarse) { .touch { display:flex; } }

        /* In-game top-right control cluster (pause/mute/exit) */
        .game-ctrls { display:flex; gap:6px; pointer-events:auto; }
        .ctrl-btn {
          background: linear-gradient(180deg, #1a2a4a 0%, #0a1428 100%);
          border:1px solid #c8a960; color:#f0e0b0;
          font-family:'Press Start 2P', monospace; font-size:11px;
          padding:6px 9px; cursor:pointer; border-radius:6px;
          box-shadow: inset 0 1px 0 rgba(200,170,90,0.25);
          transition: all .15s;
        }
        .ctrl-btn:hover { background: linear-gradient(180deg, #233a64 0%, #14233f 100%); }
        .ctrl-btn.exit { color:#ff9090; border-color:#a04040; }

        /* Pause overlay */
        .pause-overlay { position:absolute; inset:0; background:rgba(2,4,10,0.78); display:flex; align-items:center; justify-content:center; z-index:8; backdrop-filter: blur(4px); }
        .pause-card { padding:30px 40px; background:linear-gradient(180deg, rgba(14,26,48,0.95), rgba(6,12,24,0.98)); border:1px solid #c8a960; border-radius:10px; text-align:center; box-shadow: 0 0 60px rgba(200,170,90,0.3); max-width:90vw; overflow-y:auto; max-height:90dvh; }
        .pause-card h2 { font-family:'Cinzel Decorative',serif; color:#f0e0b0; letter-spacing:6px; margin:0 0 20px; font-size:28px; }

        /* ===== MOBILE RESPONSIVE ===== */
        @media (max-width: 600px) {
          .overlay { padding:10px; align-items:flex-start; padding-top:12px; }
          .start-card { padding:20px 16px; border-radius:10px; }
          .crest { font-size:6px; letter-spacing:2px; margin-bottom:8px; }
          .title { font-size:clamp(28px,9vw,42px); letter-spacing:4px; }
          .lede { font-size:12px; }
          .meta-row { gap:6px; margin-bottom:14px; }
          .meta { padding:7px 4px; }
          .meta span { font-size:6px; }
          .meta b { font-size:10px; }
          .name-label { font-size:7px; }
          .name-input { font-size:13px; padding:10px 12px; width:90%; }
          .btn { font-size:11px; padding:11px 18px; letter-spacing:2px; }
          .controls-hint { font-size:10px; }
          .controls-hint > div:last-child { grid-template-columns:1fr; }
          .story-card { padding:20px 16px; }
          .story-text { font-size:clamp(14px,3.5vw,17px); }
          .quiz-card { padding:20px 16px; margin-top:12px; }
          .quiz-q { font-size:14px; }
          .alt { font-size:12px; padding:10px 12px; }
          .alts { grid-template-columns:1fr; gap:8px; }
          .end-card { padding:28px 18px; }
          .end-title { font-size:clamp(40px,13vw,80px); letter-spacing:4px; }
          .end-score { font-size:10px; }
          .hud { padding:6px 8px; flex-wrap:wrap; gap:4px; }
          .hud-frame { padding:4px 8px; gap:5px; }
          .hud-omega { font-size:14px; }
          .hud-name { font-size:7px; }
          .hud-room-num { font-size:8px; }
          .heart { font-size:14px; }
          .mp-bar { width:70px; height:7px; }
          .score { font-size:8px; }
          .room-label { display:none; }
          .ctrl-btn { padding:4px 6px; font-size:9px; }
          .phase-bar { top:50px; gap:4px; }
          .phase-step { width:24px; height:5px; }
          .boss-bar { top:64px; width:80%; }
          .boss-bar .label { font-size:11px; }
          .tbtn { width:46px; height:46px; font-size:12px; }
          .pause-card { padding:20px 18px; }
          .pause-card h2 { font-size:20px; letter-spacing:3px; }
        }

        @media (max-width: 400px) {
          .title { font-size:clamp(24px,8vw,34px); }
          .start-card { padding:16px 12px; }
          .btn { font-size:10px; padding:10px 14px; }
        }

        @media (max-height: 600px) and (orientation: landscape) {
          .overlay { align-items:flex-start; padding:8px; overflow-y:auto; }
          .start-card { max-height:98dvh; padding:14px 18px; }
          .story-card { max-height:98dvh; padding:14px 18px; }
          .quiz-card { max-height:98dvh; padding:16px 18px; }
        }
      `}</style>

      <div className="cr-stage">
        <canvas ref={canvasRef} width={W} height={H} />
        <div className="scanlines" />

        {/* HUD */}
        {(screen === "game" || screen === "quiz" || screen === "transition") && (
          <>
            <div className="hud">
              <div className="hud-frame">
                <span className="hud-omega">Ω</span>
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                  <span className="hud-name">{playerName || "ARYO"}</span>
                  <span className="hud-room-num">
                    {stateRef.current.mode === "arcade"
                      ? `🌟 ${stateRef.current.arcadeStars} · 📏 ${stateRef.current.arcadeMeters}m · ⚔ ${stateRef.current.arcadeKillsToQuiz} · BEST ${arcadeBest}`
                      : `NÍVEL ${hud.room + 1}/${ROOMS.length}`}
                  </span>
                </div>
                <div style={{ width: 1, height: 22, background: "rgba(200,170,90,0.3)", margin: "0 4px" }} />
                <div className="hearts" aria-label="vidas">
                  {Array.from({ length: Math.max(hud.lives, DIFF_CFG[stateRef.current.difficulty].lives) }).map((_, i) => (
                    <span key={i} className={`heart ${i < hud.lives ? "" : "empty"}`}>♥</span>
                  ))}
                </div>
              </div>
              <div className="room-label">
                {stateRef.current.mode === "arcade" ? "MODO ARCADE — Corrida Infinita" : `${ROOMS[hud.room]?.name} • ${ROOMS[hud.room]?.subtitle}`}
              </div>
              <div className="hud-frame" style={{ pointerEvents: "auto" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div className="mp-bar" title="Mana"><div className="mp-fill" style={{ width: `${hud.mp}%` }} /></div>
                  <div title="Esconder (C)" style={{ width: 80, height: 5, background: "rgba(20,40,30,0.7)", border: "1px solid rgba(120,200,140,0.3)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${hideRatio * 100}%`, height: "100%", background: "linear-gradient(90deg,#3fc275,#7ee36b)", transition: "width 0.1s linear" }} />
                  </div>
                </div>
                {activeBuff && (
                  <span title="Buff ativo" style={{
                    fontFamily: "'Press Start 2P',monospace", fontSize: 9, padding: "4px 7px", borderRadius: 4,
                    background: activeBuff.type === "speed" ? "#0a2a5a" : activeBuff.type === "damage" ? "#5a0a1a" : "#0a4a1a",
                    color: activeBuff.type === "speed" ? "#7ec0ff" : activeBuff.type === "damage" ? "#ff8a8a" : "#7ee36b",
                    border: `1px solid ${activeBuff.type === "speed" ? "#3a6aaa" : activeBuff.type === "damage" ? "#aa3a4a" : "#3aaa5a"}`,
                  }}>
                    {activeBuff.type === "speed" ? "🔵" : activeBuff.type === "damage" ? "🔴" : "🟢"}{" "}
                    {Math.max(0, Math.ceil((activeBuff.until - performance.now()) / 1000))}s
                  </span>
                )}
                <span className="score" title="Score">{String(hud.score).padStart(5, "0")}</span>
                <span title="Dicas restantes" style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: "#ffd166", padding: "4px 6px", border: "1px solid rgba(255,209,102,0.4)", borderRadius: 4 }}>
                  💡 × {hintsLeft}
                </span>
                <div className="game-ctrls">
                  <button className="ctrl-btn" onClick={togglePause} title="Pausar">{paused ? "▶" : "❚❚"}</button>
                  <button className="ctrl-btn" onClick={toggleMute} title="Som">{muted ? "🔇" : "🔊"}</button>
                  <button className="ctrl-btn exit" onClick={exitToMenu} title="Sair">✕</button>
                </div>
              </div>

            </div>
            {/* Phase indicator */}
            {screen === "game" && stateRef.current.mode === "story" && (
              <div className="phase-bar">
                {ROOMS.map((_, i) => (
                  <div key={i} className={`phase-step ${i === hud.room ? "on" : i < hud.room ? "done" : ""}`} />
                ))}
              </div>
            )}
            {/* Mini room tip */}
            {roomTip && screen === "game" && <div className="room-tip">⌁ {roomTip}</div>}
            {hud.bossMax > 0 && hud.bossHp > 0 && (
              <div className="boss-bar">
                <div className="label">DRAGÃO ÔMEGA</div>
                <div className="bar"><div className="boss-fill" style={{ width: `${(hud.bossHp / hud.bossMax) * 100}%` }} /></div>
              </div>
            )}
            {paused && screen === "game" && (
              <div className="pause-overlay">
                <div className="pause-card" style={{ minWidth: 360 }}>
                  <div className="crest" style={{ marginBottom: 6 }}>⌁ PROTOCOL Ω · PAUSE ⌁</div>
                  <h2>PAUSADO</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
                    <div className="meta"><span>NÍVEL</span><b>{hud.room + 1}/5</b></div>
                    <div className="meta"><span>VIDAS</span><b>{String(hud.lives).padStart(2, "0")}</b></div>
                    <div className="meta"><span>SCORE</span><b>{String(hud.score).padStart(5, "0")}</b></div>
                  </div>
                  <p style={{ fontFamily: "'Cinzel',serif", color: "#9bb4d8", fontSize: 12, margin: "0 0 16px", letterSpacing: 1 }}>
                    {ROOM_TIPS[hud.room]}
                  </p>
                  <div>
                    <button className="btn solid" onClick={togglePause}>▶ CONTINUAR</button>
                    <button className="btn ghost" onClick={toggleMute} style={{ marginLeft: 8 }}>{muted ? "🔇 SOM" : "🔊 SOM"}</button>
                    <button className="btn ghost" onClick={exitToMenu} style={{ marginLeft: 8 }}>✕ SAIR</button>
                  </div>
                </div>
              </div>
            )}
            <div className="touch" style={{ display: "flex" }}>
              <div>
                <button className="tbtn" onMouseDown={() => stateRef.current.keys.left = true} onMouseUp={() => stateRef.current.keys.left = false} onMouseLeave={() => stateRef.current.keys.left = false} onTouchStart={() => stateRef.current.keys.left = true} onTouchEnd={() => stateRef.current.keys.left = false}>◀</button>
                <button className="tbtn" onMouseDown={() => stateRef.current.keys.right = true} onMouseUp={() => stateRef.current.keys.right = false} onMouseLeave={() => stateRef.current.keys.right = false} onTouchStart={() => stateRef.current.keys.right = true} onTouchEnd={() => stateRef.current.keys.right = false}>▶</button>
              </div>
              <div>
                <button className="tbtn" title="Atirar (X)" onMouseDown={tryFire} onTouchStart={tryFire} style={{ background: "linear-gradient(180deg, #4a1a1a, #2a0a0a)", borderColor: "#ff5050", color: "#ffd0d0" }}>🔥</button>
                <button className="tbtn" title="Dash (Shift)" onMouseDown={tryDash} onTouchStart={tryDash}>»</button>
                <button className="tbtn" title="Pular (Espaço)" onMouseDown={tryJump} onTouchStart={tryJump}>▲</button>
              </div>
            </div>
          </>
        )}

        {/* START */}
        {screen === "start" && (
          <div className="overlay">
            <div className="start-bg" />
            <div className="start-orb" />
            <div className="start-card">
              <div className="crest">⌁ UNIFOR · CCT · CIÊNCIA DA COMPUTAÇÃO / ADS ⌁</div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 6, color: "#9bb4d8", marginBottom: 6 }}>AVENTURA · LÓGICA · MATEMÁTICA</div>
              <h1 className="title" style={{display:"flex", alignItems:"center", justifyContent:"center", gap:"18px", flexWrap:"wrap"}}>
                <span>PROTOCOL <span style={{opacity:.85}}>ΩMEGA</span></span>
                <span style={{fontSize:"0.45em", letterSpacing:8, color:"#9bb4d8", fontFamily:"'Cinzel',serif"}}>— ESCAPE —</span>
              </h1>
              <div className="divider" />
              <p className="lede">
                O reino de <b>Albion</b> caiu. A Princesa Elisabeth foi aprisionada<br />
                na <b>Cripta dos Números</b>. Use lógica, cálculo e coragem<br />
                para atravessar cinco salas e restaurar o equilíbrio.
              </p>
              <div className="meta-row">
                <div className="meta"><span>MODO</span><b>HISTÓRIA</b></div>
                <div className="meta"><span>VIDAS</span><b>03</b></div>
                <div className="meta"><span>CHEFE</span><b>DRAGÃO Ω</b></div>
              </div>
              {!authenticated ? (
                <>
                  <span className="name-label">
                    Faça login para iniciar sua jornada
                  </span>

                  <AuthModal
                    onAuthenticated={(name) => {
                      setAuthenticated(true);
                      setUsername(name);
                      setPlayerName(name);
                    }}
                  />
                </>
              ) : (
                <>
                  <span className="name-label">
                    Guerreiro autenticado
                  </span>

                  <input
                    className="name-input"
                    value={playerName}
                    disabled
                  />

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 10,
                    }}
                  >
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        await logoutUser();

                        setAuthenticated(false);
                        setUsername("");
                        setPlayerName("");
                      }}
                    >
                      SAIR DA CONTA
                    </button>
                  </div>
                </>
              )}
              <div>
                <button
                  className="btn solid"
                  disabled={!authenticated}
                  onClick={() => {
                    if (!authenticated)
                      return;

                    initAudio();
                    setScreen("select");
                  }}
                  style={{
                    opacity:
                      authenticated
                        ? 1
                        : 0.4,
                  }}
                >
                  {authenticated
                    ? "COMEÇAR JORNADA"
                    : "FAÇA LOGIN"}
                </button>

                <button
                  className="btn ghost"
                  onClick={() =>
                    setShowRanking(true)
                  }
                >
                  🏆 RANKING GLOBAL
                </button>
              </div>
              <div className="controls-hint" style={{ textAlign: "left", marginTop: 18, padding: "12px 14px", background: "rgba(10,20,40,0.55)", border: "1px solid rgba(200,170,90,0.25)", borderRadius: 8 }}>
                <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: "#c8a960", letterSpacing: 2, marginBottom: 8 }}>⌁ COMANDOS ⌁</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
                  <span><kbd>A</kbd>/<kbd>D</kbd> ou <kbd>◀</kbd><kbd>▶</kbd> — mover</span>
                  <span><kbd>Espaço</kbd> ou <kbd>▲</kbd> — pular (×2)</span>
                  <span><kbd>X</kbd> ou <kbd>🔥</kbd> — atirar com a varinha</span>
                  <span><kbd>Shift</kbd> ou <kbd>»</kbd> — dash (esquiva)</span>
                  <span>❚❚ — pausar o jogo</span>
                  <span>🔊 — ligar/desligar som</span>
                </div>
              </div>
              <div className="credits">PROJETO APLICADO · AV2</div>
            </div>
          </div>
        )}

        {/* SELECT — character / difficulty / mode */}
        {screen === "select" && (
          <div className="overlay">
            <div className="start-bg" />
            <div className="start-card" style={{ maxWidth: 720 }}>
              <div className="crest">⌁ PREPARAÇÃO PARA A JORNADA ⌁</div>
              <h1 className="title" style={{ fontSize: "2.2em", marginBottom: 4 }}>ESCOLHA SUA JORNADA</h1>
              <div className="divider" />

              {/* Personagem */}
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: "#c8a960", letterSpacing: 3, marginTop: 6, marginBottom: 10 }}>⌁ PERSONAGEM ⌁</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {(["hero", "heroine"] as Character[]).map((c) => (
                  <button key={c} onClick={() => setCharacter(c)}
                    className="meta"
                    style={{
                      cursor: "pointer", padding: "12px 8px", textAlign: "center",
                      borderColor: character === c ? "var(--gold)" : "rgba(200,170,90,0.25)",
                      boxShadow: character === c ? "0 0 0 2px var(--gold), 0 0 18px rgba(200,170,90,0.4)" : "none",
                      background: character === c ? "rgba(200,170,90,0.12)" : "rgba(10,20,40,0.55)",
                    }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{c === "hero" ? "🧙‍♂️" : "🧙‍♀️"}</div>
                    <div style={{ fontFamily: "'Cinzel',serif", color: "var(--gold)", fontWeight: 700, letterSpacing: 2 }}>
                      {c === "hero" ? "HERÓI" : "HEROÍNA"}
                    </div>
                    <div style={{ fontSize: 10, color: "#9bb4d8", marginTop: 4 }}>
                      {c === "hero" ? "Manto azul · cabelo curto" : "Manto rosa · cabelo longo"}
                    </div>
                  </button>
                ))}
              </div>

              {/* Dificuldade */}
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: "#c8a960", letterSpacing: 3, marginBottom: 10 }}>⌁ DIFICULDADE ⌁</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                {(Object.keys(DIFF_CFG) as Dificuldade[]).map((d) => {
                  const cfg = DIFF_CFG[d];
                  const sel = difficulty === d;
                  return (
                    <button key={d} onClick={() => setDifficulty(d)} className="meta"
                      style={{
                        cursor: "pointer", padding: "10px 6px", textAlign: "center",
                        borderColor: sel ? cfg.color : "rgba(200,170,90,0.25)",
                        boxShadow: sel ? `0 0 0 2px ${cfg.color}, 0 0 16px ${cfg.color}55` : "none",
                        background: sel ? `${cfg.color}1f` : "rgba(10,20,40,0.55)",
                      }}>
                      <div style={{ fontFamily: "'Cinzel',serif", fontWeight: 700, color: cfg.color, letterSpacing: 2 }}>{cfg.label}</div>
                      <div style={{ fontSize: 10, color: "#9bb4d8", marginTop: 4, lineHeight: 1.4 }}>
                        ♥ {cfg.lives} · ⏱ {cfg.quizTime}s<br />
                        {d === "facil" ? "perguntas fáceis" : d === "medio" ? "fácil + médio" : "todas as perguntas"}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Modo */}
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: "#c8a960", letterSpacing: 3, marginBottom: 10 }}>⌁ MODO DE JOGO ⌁</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {(["story", "arcade"] as GameMode[]).map((m) => {
                  const sel = mode === m;
                  return (
                    <button key={m} onClick={() => setMode(m)} className="meta"
                      style={{
                        cursor: "pointer", padding: "12px 8px", textAlign: "center",
                        borderColor: sel ? "var(--gold)" : "rgba(200,170,90,0.25)",
                        boxShadow: sel ? "0 0 0 2px var(--gold), 0 0 16px rgba(200,170,90,0.4)" : "none",
                        background: sel ? "rgba(200,170,90,0.12)" : "rgba(10,20,40,0.55)",
                      }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{m === "story" ? "📖" : "♾️"}</div>
                      <div style={{ fontFamily: "'Cinzel',serif", color: "var(--gold)", fontWeight: 700, letterSpacing: 2 }}>
                        {m === "story" ? "HISTÓRIA" : "ARCADE"}
                      </div>
                      <div style={{ fontSize: 10, color: "#9bb4d8", marginTop: 4 }}>
                        {m === "story" ? "5 salas + Dragão Ω" : `Corrida infinita · ⭐ ${arcadeBest}`}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn ghost" onClick={() => setScreen("start")}>◀ Voltar</button>
                <button className="btn solid" onClick={() => {
                  const s = stateRef.current;
                  s.character = character;
                  s.difficulty = difficulty;
                  s.mode = mode;
                  s.enemyMul = DIFF_CFG[difficulty].enemyMul;
                  if (mode === "arcade") beginArcade();
                  else startJourney();
                }}>▶ INICIAR</button>
              </div>
            </div>
          </div>
        )}


        {/* STORY — single panel typewriter */}
        {screen === "story" && (

          <div className="overlay">
            <div className="story-bg" />
            <div className="story-vignette" />
            <div className="story-card">
              <div className="crest" style={{ marginBottom: 20, color: "#c8a960" }}>⌁ ALBION • TRANSMISSÃO INTERCEPTADA ⌁</div>
              {storyLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 140, gap: 18 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: "50%", background: "#c8a960",
                        animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: "#7a8aa8", letterSpacing: 3 }}>
                    Aguardando narração…
                  </span>
                  <style>{`@keyframes dotPulse { 0%,80%,100%{transform:scale(.6);opacity:.3} 40%{transform:scale(1);opacity:1} }`}</style>
                </div>
              ) : (
                <p className="story-text" style={{ whiteSpace: "pre-line", color: "#e8e0c8" }}>
                  {typedText}<span className="caret">▋</span>
                </p>
              )}
              <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 10 }}>
                {!storyLoading && !storyDone && (
                  <button className="btn ghost" onClick={skipTyping}>▸▸ Pular animação</button>
                )}
                {storyLoading && (
                  <button className="btn ghost" onClick={() => {
                    stopNarration();
                    narrationDisabledRef.current = true;
                    setStoryLoading(false);
                    startTypewriter(24000);
                  }}>▸ Pular narração</button>
                )}
                {storyDone && <span />}
                {storyDone && (
                  <button className="btn solid" onClick={beginGame}>⚔ CONTINUAR</button>
                )}
              </div>
            </div>
          </div>
        )}


        {/* TRANSITION */}
        {screen === "transition" && (
          <div className="overlay">
            <div className="trans-bg" style={{ position: "absolute", inset: 0 }} />
            <div className="trans-text" style={{ position: "relative" }}>{transitionText}</div>
          </div>
        )}

        {/* QUIZ */}
        {screen === "quiz" && quiz && (
          <div className="overlay">
            <div className="quiz-bg" style={{ position: "absolute", inset: 0 }} />
            <div className="quiz-wrap">
              <div className="quiz-omega">Ω</div>
              <div className="quiz-card">
                {/* Borda-cronômetro */}
                <div style={{
                  position: "absolute", inset: -3, borderRadius: 14, pointerEvents: "none", zIndex: 0,
                  padding: 3,
                  background: quiz.revealed
                    ? quiz.chosen === quiz.correctShuffled
                      ? "conic-gradient(from -90deg, #7ee36b 100%, transparent 100%)"
                      : "conic-gradient(from -90deg, #ff4040 100%, transparent 100%)"
                    : `conic-gradient(from -90deg, ${
                        quiz.timeLeft <= 5 ? "#ff4040" : quiz.timeLeft <= 10 ? "#ffd166" : "#c8a960"
                      } ${(quiz.timeLeft / 20) * 100}%, rgba(20,30,50,0.6) ${(quiz.timeLeft / 20) * 100}%)`,
                  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  transition: "background 0.95s linear",
                }} />

                <div className="quiz-tags">
                  <span className={`tag ${quiz.q.dificuldade}`}>
                    {quiz.q.dificuldade === "facil" ? "🟢 FÁCIL" : quiz.q.dificuldade === "medio" ? "🟡 MÉDIO" : "🔴 DIFÍCIL"}
                  </span>
                  <span className="tag principio">📐 {quiz.q.principio}</span>
                  <span className="tag" style={{ background: "#1a0a0a", color: "#ff8a8a", border: "1px solid #5a1a1a", marginLeft: "auto" }}>♥ × {hud.lives}</span>
                  {!quiz.revealed && (
                    <span className="tag" style={{
                      background: quiz.timeLeft <= 5 ? "#3a0a0a" : "rgba(10,20,40,0.7)",
                      color: quiz.timeLeft <= 5 ? "#ff4040" : quiz.timeLeft <= 10 ? "#ffd166" : "#c8a960",
                      border: `1px solid ${quiz.timeLeft <= 5 ? "#7a1a1a" : quiz.timeLeft <= 10 ? "#7a5a1a" : "#4a3a1a"}`,
                      fontVariantNumeric: "tabular-nums", minWidth: 38, textAlign: "center",
                    }}>
                      {String(quiz.timeLeft).padStart(2, "0")}s
                    </span>
                  )}
                </div>

                <p className="quiz-q">{quiz.q.enunciado}</p>
                {!quiz.revealed && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                    <button
                      onClick={useHint}
                      disabled={hintsLeft <= 0 || eliminatedAlt !== null}
                      style={{
                        fontFamily: "'Press Start 2P',monospace", fontSize: 9, letterSpacing: 1,
                        padding: "8px 12px", borderRadius: 6, cursor: hintsLeft > 0 && eliminatedAlt === null ? "pointer" : "not-allowed",
                        background: hintsLeft > 0 && eliminatedAlt === null ? "rgba(255,209,102,0.15)" : "rgba(60,60,60,0.4)",
                        color: hintsLeft > 0 && eliminatedAlt === null ? "#ffd166" : "#777",
                        border: `1px solid ${hintsLeft > 0 && eliminatedAlt === null ? "#ffd166" : "#444"}`,
                      }}
                      title="Elimina uma alternativa errada (-5 pts)"
                    >
                      💡 DICA (-5pt) · {hintsLeft}
                    </button>
                  </div>
                )}
                <div className="alts">
                  {quiz.order.map((origIdx, i) => {
                    const a = quiz.q.alternativas[origIdx];
                    const isChosen = quiz.chosen === i;
                    const isCorrect = i === quiz.correctShuffled;
                    const isEliminated = eliminatedAlt === i && !quiz.revealed;
                    let cls = "alt";
                    if (quiz.revealed) {
                      if (isCorrect) cls += " correct";
                      else if (isChosen) cls += " wrong";
                      cls += " disabled";
                    }
                    return (
                      <button
                        key={i}
                        className={cls}
                        onClick={() => !quiz.revealed && !isEliminated && answerQuiz(i)}
                        style={isEliminated ? { opacity: 0.25, textDecoration: "line-through", pointerEvents: "none" } : undefined}
                      >
                        <b style={{ color: "var(--gold)", marginRight: 8 }}>{String.fromCharCode(65 + i)}.</b>{a}
                      </button>
                    );
                    
                  })}
                </div>

                {quiz.revealed && (
                  <>
                    <div className="explain">
                      <b>{quiz.chosen === quiz.correctShuffled ? "✓ CORRETO!" : "✗ Resposta correta: " + String.fromCharCode(65 + quiz.correctShuffled)}</b><br />
                      {quiz.q.explicacao}
                      <br /><br />
                      <i style={{ color: "var(--ink-dim)" }}>
                        {quiz.chosen === quiz.correctShuffled
                          ? `Sua sabedoria salvou esta vida, ${playerName || "guerreiro"}. Siga em frente.`
                          : quiz.chosen === -1
                            ? `Tempo esgotado, ${playerName || "guerreiro"}! Você perdeu uma vida.`
                            : `Você perdeu uma vida, ${playerName || "guerreiro"}. Lembre deste princípio.`}
                      </i>
                    </div>
                    <div className="quiz-actions">
                      <button className="btn danger" onClick={closeQuiz}>Continuar ▸</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GAME OVER */}
        {screen === "gameover" && (
          
          <div className="overlay" style={{ background: "none" }}>
            <div className="end-overlay-bg lose" />
            <div className="end-card lose">
              <div className="end-badge">☠ DERROTA</div>
              <div className="end-title">GAME<br />OVER</div>
              <div className="end-divider" />
              <p className="end-text">
                A escuridão consumiu <b style={{ color: "#ff9090" }}>{playerName || "nosso herói"}</b>.<br />
                A Princesa Elisabeth ainda aguarda na cripta…
              </p>
              <div className="end-score">SCORE: {String(hud.score).padStart(5, "0")}</div>
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: "#9bb4d8", letterSpacing: 2, textAlign: "center", marginBottom: 12 }}>
                MODO: {stateRef.current.mode === "arcade" ? "ARCADE" : "HISTÓRIA"} · DIFICULDADE: {DIFF_CFG[stateRef.current.difficulty].label}
                {stateRef.current.mode === "arcade" && <> · RECORDE: {arcadeBest}</>}
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn solid" onClick={restartGame} style={{ borderColor: "#ff5050", boxShadow: "0 0 20px rgba(255,40,40,0.3)" }}>
                  ↺ TENTAR NOVAMENTE
                </button>
                <button className="btn ghost" onClick={restart}>
                  🏠 MENU PRINCIPAL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VICTORY */}
        {screen === "victory" && (
          <div className="overlay" style={{ background: "none" }}>
            <div className="end-overlay-bg win" />
            <div className="end-card win">
              <div className="end-badge">✦ VITÓRIA ✦</div>
              <div className="end-title">YOU<br />WIN!</div>
              <div className="end-divider" />
              <p className="end-text">
                <b style={{ color: "#ffd166" }}>{playerName || "O herói"}</b> derrotou o LORDE DAS SOMBRAS<br />
                e libertou a Princesa Elisabeth de Albion.<br />
                A Inglaterra canta o nome de <b style={{ color: "#ffd166" }}>{playerName || "nosso herói"}</b>,<br />
                mestre da matemática!
              </p>
              <div className="end-score">
                ✦ SCORE FINAL: {String(hud.score).padStart(5, "0")} ✦
              </div>

              <div
                style={{
                  fontFamily: "'Press Start 2P',monospace",
                  fontSize: 9,
                  color: "#9bb4d8",
                  letterSpacing: 2,
                  textAlign: "center",
                  marginBottom: 12
                }}
              >
                DIFICULDADE: {DIFF_CFG[stateRef.current.difficulty].label}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap"
                }}
              >
                <button
                  className="btn solid"
                  onClick={restartGame}
                >
                  ↺ JOGAR NOVAMENTE
                </button>

                <button
                  className="btn ghost"
                  onClick={restart}
                >
                  🏠 MENU PRINCIPAL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RANKING */}
        {showRanking && (
          <RankingModal
            onClose={() =>
              setShowRanking(false)
            }
          />
        )}

      </div>
    </div>

  );
};

export default Index;