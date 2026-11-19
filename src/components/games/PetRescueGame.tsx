import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { playGameTone } from './soundFx';

interface PetRescueGameProps {
  bestScore: number;
  onSessionEnd: (score: number, won: boolean, durationSec: number) => void;
}

interface LostPet {
  id: number;
  x: number;
  y: number;
  kind: 'puppy' | 'kitten' | 'bunny';
  rescued: boolean;
}

interface GardenToken {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

interface HazardBush {
  x: number;
  y: number;
  r: number;
}

const CANVAS_W = 720;
const CANVAS_H = 380;
const SAFE_ZONE = { x: 26, y: 26, w: 110, h: 86 };

const LEVELS: {
  name: string;
  timeLimit: number;
  pets: Omit<LostPet, 'rescued'>[];
  tokens: Omit<GardenToken, 'collected'>[];
  hazards: HazardBush[];
}[] = [
  {
    name: 'Level 1 · Rajpur Garden',
    timeLimit: 45,
    pets: [
      { id: 1, x: 610, y: 80, kind: 'puppy' },
      { id: 2, x: 540, y: 310, kind: 'kitten' },
      { id: 3, x: 260, y: 295, kind: 'bunny' },
    ],
    tokens: [
      { id: 1, x: 350, y: 110 },
      { id: 2, x: 470, y: 200 },
      { id: 3, x: 180, y: 215 },
    ],
    hazards: [
      { x: 280, y: 165, r: 22 },
      { x: 465, y: 120, r: 22 },
    ],
  },
  {
    name: 'Level 2 · Jakhan Orchard',
    timeLimit: 50,
    pets: [
      { id: 1, x: 640, y: 70, kind: 'puppy' },
      { id: 2, x: 635, y: 315, kind: 'kitten' },
      { id: 3, x: 360, y: 315, kind: 'bunny' },
      { id: 4, x: 385, y: 75, kind: 'puppy' },
    ],
    tokens: [
      { id: 1, x: 240, y: 110 },
      { id: 2, x: 510, y: 170 },
      { id: 3, x: 260, y: 265 },
      { id: 4, x: 575, y: 255 },
    ],
    hazards: [
      { x: 245, y: 185, r: 22 },
      { x: 410, y: 195, r: 24 },
      { x: 535, y: 105, r: 20 },
    ],
  },
  {
    name: 'Level 3 · Sahastradhara Trail',
    timeLimit: 55,
    pets: [
      { id: 1, x: 648, y: 65, kind: 'kitten' },
      { id: 2, x: 645, y: 325, kind: 'puppy' },
      { id: 3, x: 440, y: 325, kind: 'bunny' },
      { id: 4, x: 430, y: 70, kind: 'puppy' },
      { id: 5, x: 210, y: 320, kind: 'kitten' },
    ],
    tokens: [
      { id: 1, x: 215, y: 115 },
      { id: 2, x: 345, y: 190 },
      { id: 3, x: 535, y: 120 },
      { id: 4, x: 540, y: 260 },
      { id: 5, x: 325, y: 295 },
    ],
    hazards: [
      { x: 220, y: 205, r: 23 },
      { x: 360, y: 125, r: 22 },
      { x: 475, y: 205, r: 24 },
      { x: 590, y: 185, r: 22 },
    ],
  },
];

export function PetRescueGame({ bestScore, onSessionEnd }: PetRescueGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [status, setStatus] = useState<'ready' | 'playing' | 'paused' | 'won' | 'lost'>('ready');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(LEVELS[0].timeLimit);
  const [rescuedCount, setRescuedCount] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [localBest, setLocalBest] = useState(bestScore);

  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const stateRef = useRef({
    status: 'ready' as 'ready' | 'playing' | 'paused' | 'won' | 'lost',
    levelIdx: 0,
    soundOn: true,
    px: 80,
    py: 85,
    carryingPetId: null as number | null,
    pets: LEVELS[0].pets.map((p) => ({ ...p, rescued: false })) as LostPet[],
    tokens: LEVELS[0].tokens.map((t) => ({ ...t, collected: false })) as GardenToken[],
    hazards: LEVELS[0].hazards,
    score: 0,
    timeLeft: LEVELS[0].timeLimit,
    hitCooldown: 0,
    animTime: 0,
    startedAt: 0,
  });

  useEffect(() => {
    setLocalBest((prev) => Math.max(prev, bestScore));
  }, [bestScore]);

  useEffect(() => {
    stateRef.current.soundOn = soundOn;
  }, [soundOn]);

  const startLevel = useCallback((idx: number) => {
    const lvl = LEVELS[idx] || LEVELS[0];
    const s = stateRef.current;
    s.levelIdx = idx;
    s.status = 'playing';
    s.px = 80;
    s.py = 82;
    s.carryingPetId = null;
    s.pets = lvl.pets.map((p) => ({ ...p, rescued: false }));
    s.tokens = lvl.tokens.map((t) => ({ ...t, collected: false }));
    s.hazards = lvl.hazards;
    s.score = 0;
    s.timeLeft = lvl.timeLimit;
    s.hitCooldown = 0;
    s.startedAt = Date.now();
    setLevelIdx(idx);
    setScore(0);
    setRescuedCount(0);
    setTimeLeft(lvl.timeLimit);
    setStatus('playing');
  }, []);

  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'playing') {
      s.status = 'paused';
      setStatus('paused');
    } else if (s.status === 'paused') {
      s.status = 'playing';
      setStatus('playing');
    }
  }, []);

  useEffect(() => {
    const setDir = (key: string, down: boolean) => {
      const k = key.toLowerCase();
      if (key === 'ArrowUp' || k === 'w') keysRef.current.up = down;
      if (key === 'ArrowDown' || k === 's') keysRef.current.down = down;
      if (key === 'ArrowLeft' || k === 'a') keysRef.current.left = down;
      if (key === 'ArrowRight' || k === 'd') keysRef.current.right = down;
    };
    const onDown = (e: KeyboardEvent) => {
      if (
        stateRef.current.status === 'playing' &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
      }
      setDir(e.key, true);
    };
    const onUp = (e: KeyboardEvent) => setDir(e.key, false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  const drawScene = useCallback((ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;

    // Animated garden meadow background
    const meadow = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    meadow.addColorStop(0, '#ECFDF5');
    meadow.addColorStop(1, '#DCFCE7');
    ctx.fillStyle = meadow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle sky & drifting clouds strip at top
    ctx.fillStyle = '#FDFBF7';
    ctx.fillRect(0, 0, CANVAS_W, 38);
    ctx.fillStyle = '#E0F2FE';
    for (let i = 0; i < 4; i += 1) {
      const cx = ((i * 210 + s.animTime * 18) % (CANVAS_W + 80)) - 40;
      ctx.beginPath();
      ctx.arc(cx, 20, 14, 0, Math.PI * 2);
      ctx.arc(cx + 14, 18, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Garden border trees & blooming flowers
    const treePositions = [
      [175, 48],
      [330, 44],
      [500, 46],
      [690, 145],
      [692, 265],
      [35, 210],
      [36, 338],
    ];
    for (const [tx, ty] of treePositions) {
      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.arc(tx, ty, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(tx - 4, ty - 4, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flowers
    const flowerSpots = [
      [185, 160],
      [310, 235],
      [515, 315],
      [625, 175],
    ];
    for (const [fx, fy] of flowerSpots) {
      const sway = Math.sin(s.animTime * 3 + fx) * 1.5;
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(fx + sway, fy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Safe Zone Gazebo
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(SAFE_ZONE.x, SAFE_ZONE.y, SAFE_ZONE.w, SAFE_ZONE.h, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#14532D';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('SAFE HOME', SAFE_ZONE.x + 22, SAFE_ZONE.y + 22);
    ctx.fillStyle = '#059669';
    ctx.font = '10px sans-serif';
    ctx.fillText('Drop Pets Here', SAFE_ZONE.x + 19, SAFE_ZONE.y + 38);

    // Draw thorny obstacles
    for (const hz of s.hazards) {
      ctx.fillStyle = '#991B1B';
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FCA5A5';
      ctx.beginPath();
      ctx.arc(hz.x - 5, hz.y - 5, 4, 0, Math.PI * 2);
      ctx.arc(hz.x + 6, hz.y + 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw golden paw tokens
    for (const tk of s.tokens) {
      if (tk.collected) continue;
      const pulse = 10 + Math.sin(s.animTime * 5 + tk.id) * 1.5;
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(tk.x, tk.y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw lost pets (and rescued pets inside Safe Home)
    let rescuedOffset = 0;
    for (const pet of s.pets) {
      let drawX = pet.x;
      let drawY = pet.y;
      if (pet.rescued) {
        drawX = SAFE_ZONE.x + 22 + rescuedOffset * 20;
        drawY = SAFE_ZONE.y + 64;
        rescuedOffset += 1;
      } else if (s.carryingPetId === pet.id) {
        drawX = s.px + 18;
        drawY = s.py - 12;
      }

      ctx.fillStyle =
        pet.kind === 'puppy' ? '#F59E0B' : pet.kind === 'kitten' ? '#FB923C' : '#E7E5E4';
      ctx.beginPath();
      ctx.arc(drawX, drawY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pet.rescued ? '#059669' : '#78350F';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ears
      ctx.fillStyle = pet.kind === 'bunny' ? '#D6D3D1' : '#92400E';
      ctx.beginPath();
      ctx.arc(drawX - 8, drawY - 10, 4, 0, Math.PI * 2);
      ctx.arc(drawX + 8, drawY - 10, 4, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#1C1917';
      ctx.beginPath();
      ctx.arc(drawX - 4, drawY - 2, 1.8, 0, Math.PI * 2);
      ctx.arc(drawX + 4, drawY - 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player Caregiver Guardian
    ctx.fillStyle = s.hitCooldown > 0 ? '#EF4444' : '#14532D';
    ctx.beginPath();
    ctx.arc(s.px, s.py, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(s.px - 4, s.py - 3, 2, 0, Math.PI * 2);
    ctx.arc(s.px + 4, s.py - 3, 2, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const s = stateRef.current;

      s.animTime += dt;

      if (s.status === 'playing') {
        if (s.hitCooldown > 0) s.hitCooldown = Math.max(0, s.hitCooldown - dt);

        let dx = 0;
        let dy = 0;
        if (keysRef.current.left) dx -= 1;
        if (keysRef.current.right) dx += 1;
        if (keysRef.current.up) dy -= 1;
        if (keysRef.current.down) dy += 1;

        if (dx !== 0 && dy !== 0) {
          dx *= 0.7071;
          dy *= 0.7071;
        }
        const speed = s.carryingPetId ? 185 : 220;
        s.px = Math.max(22, Math.min(CANVAS_W - 22, s.px + dx * speed * dt));
        s.py = Math.max(46, Math.min(CANVAS_H - 22, s.py + dy * speed * dt));

        // Timer
        s.timeLeft = Math.max(0, s.timeLeft - dt);
        setTimeLeft(Math.ceil(s.timeLeft));

        // Tokens pickup
        for (const tk of s.tokens) {
          if (tk.collected) continue;
          if (Math.hypot(s.px - tk.x, s.py - tk.y) < 24) {
            tk.collected = true;
            s.score += 15;
            setScore(s.score);
            playGameTone('collect', s.soundOn);
          }
        }

        // Hazards check
        if (s.hitCooldown <= 0) {
          for (const hz of s.hazards) {
            if (Math.hypot(s.px - hz.x, s.py - hz.y) < hz.r + 12) {
              s.hitCooldown = 1.0;
              s.timeLeft = Math.max(0, s.timeLeft - 4);
              playGameTone('hit', s.soundOn);
              break;
            }
          }
        }

        // Pick up lost pet if not already carrying one
        if (s.carryingPetId === null) {
          for (const pet of s.pets) {
            if (!pet.rescued && Math.hypot(s.px - pet.x, s.py - pet.y) < 26) {
              s.carryingPetId = pet.id;
              playGameTone('jump', s.soundOn);
              break;
            }
          }
        } else {
          // Drop off at Safe Home
          const inSafeZone =
            s.px >= SAFE_ZONE.x &&
            s.px <= SAFE_ZONE.x + SAFE_ZONE.w &&
            s.py >= SAFE_ZONE.y &&
            s.py <= SAFE_ZONE.y + SAFE_ZONE.h;
          if (inSafeZone) {
            const pet = s.pets.find((p) => p.id === s.carryingPetId);
            if (pet) pet.rescued = true;
            s.carryingPetId = null;
            s.score += 25;
            setScore(s.score);
            const totalRescued = s.pets.filter((p) => p.rescued).length;
            setRescuedCount(totalRescued);
            playGameTone('collect', s.soundOn);

            if (totalRescued === s.pets.length) {
              const timeBonus = Math.min(30, Math.floor(s.timeLeft));
              const finalScore = s.score + timeBonus;
              s.score = finalScore;
              setScore(finalScore);
              s.status = 'won';
              setStatus('won');
              playGameTone('win', s.soundOn);
              setLocalBest((prev) => Math.max(prev, finalScore));
              const durationSec = Math.max(1, Math.round((Date.now() - s.startedAt) / 1000));
              onSessionEnd(finalScore, true, durationSec);
            }
          }
        }

        if (s.timeLeft <= 0 && s.status === 'playing') {
          s.status = 'lost';
          setStatus('lost');
          playGameTone('hit', s.soundOn);
          const durationSec = Math.max(1, Math.round((Date.now() - s.startedAt) / 1000));
          onSessionEnd(s.score, false, durationSec);
        }
      }

      if (ctx) drawScene(ctx);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drawScene, onSessionEnd]);

  const totalPets = LEVELS[levelIdx]?.pets.length || 3;

  const holdKey = (dir: 'up' | 'down' | 'left' | 'right', active: boolean) => {
    keysRef.current[dir] = active;
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-emerald-950">
            PawCare Pet Rescue Adventure
          </h3>
          <p className="text-xs text-stone-600">
            Guide lost pets safely back to the Safe Home gazebo, avoid thorny red bushes, and gather paw tokens.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {LEVELS.map((lvl, idx) => (
            <button
              key={lvl.name}
              type="button"
              onClick={() => startLevel(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                levelIdx === idx
                  ? 'bg-emerald-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              Lvl {idx + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            aria-label={soundOn ? 'Mute game audio' : 'Enable game audio'}
            className="p-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 cursor-pointer"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-800" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
          </button>
          {(status === 'playing' || status === 'paused') && (
            <button
              type="button"
              onClick={togglePause}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold cursor-pointer"
            >
              {status === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {status === 'paused' ? 'Resume' : 'Pause'}
            </button>
          )}
          <button
            type="button"
            onClick={() => startLevel(levelIdx)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-emerald-950 text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restart
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 font-bold text-emerald-900">
          {LEVELS[levelIdx].name}
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-stone-100 font-semibold text-stone-800 font-mono-tabular">
          Rescued: {rescuedCount} / {totalPets}
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-stone-100 font-semibold text-stone-800 font-mono-tabular">
          Time: {timeLeft}s
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 font-bold text-amber-900 font-mono-tabular">
          Score: {score}
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 font-bold text-emerald-900 inline-flex items-center gap-1 font-mono-tabular">
          <Trophy className="w-3.5 h-3.5 text-amber-600" /> Best: {localBest}
        </span>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-emerald-200 bg-[#ECFDF5]">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full h-auto block select-none"
        />

        {status !== 'playing' && (
          <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center text-white space-y-3">
            <p className="font-display text-2xl font-extrabold">
              {status === 'ready'
                ? `${LEVELS[levelIdx].name}`
                : status === 'paused'
                ? 'Adventure Paused'
                : status === 'won'
                ? `All Pets Rescued! Score: ${score}`
                : `Time Up! Rescued ${rescuedCount}/${totalPets}`}
            </p>
            <p className="text-xs text-emerald-100 max-w-md">
              Use WASD or Arrow keys (or the on-screen directional pad) to pick up each wandering pet and return them to the Safe Home box.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={status === 'paused' ? togglePause : () => startLevel(levelIdx)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 text-sm font-bold cursor-pointer shadow-md"
              >
                {status === 'paused' ? 'Resume Rescue' : status === 'ready' ? 'Start Rescue' : 'Replay Level'}
              </button>
              {status === 'won' && levelIdx + 1 < LEVELS.length && (
                <button
                  type="button"
                  onClick={() => startLevel(levelIdx + 1)}
                  className="px-5 py-2.5 rounded-xl bg-white text-emerald-950 text-sm font-bold cursor-pointer shadow-md"
                >
                  Next Level →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls row + mobile D-pad */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-stone-500">
          Keyboard: WASD or Arrow keys · Avoid thorny red bushes (-4s time) · Golden orbs (+15)
        </p>
        <div className="grid grid-cols-3 gap-1.5 w-36 select-none">
          <div />
          <button
            type="button"
            aria-label="Move up"
            onTouchStart={() => holdKey('up', true)}
            onTouchEnd={() => holdKey('up', false)}
            onMouseDown={() => holdKey('up', true)}
            onMouseUp={() => holdKey('up', false)}
            onMouseLeave={() => holdKey('up', false)}
            className="h-10 rounded-xl bg-emerald-900 active:bg-emerald-700 text-white flex items-center justify-center cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div />
          <button
            type="button"
            aria-label="Move left"
            onTouchStart={() => holdKey('left', true)}
            onTouchEnd={() => holdKey('left', false)}
            onMouseDown={() => holdKey('left', true)}
            onMouseUp={() => holdKey('left', false)}
            onMouseLeave={() => holdKey('left', false)}
            className="h-10 rounded-xl bg-emerald-900 active:bg-emerald-700 text-white flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            onTouchStart={() => holdKey('down', true)}
            onTouchEnd={() => holdKey('down', false)}
            onMouseDown={() => holdKey('down', true)}
            onMouseUp={() => holdKey('down', false)}
            onMouseLeave={() => holdKey('down', false)}
            className="h-10 rounded-xl bg-emerald-900 active:bg-emerald-700 text-white flex items-center justify-center cursor-pointer"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Move right"
            onTouchStart={() => holdKey('right', true)}
            onTouchEnd={() => holdKey('right', false)}
            onMouseDown={() => holdKey('right', true)}
            onMouseUp={() => holdKey('right', false)}
            onMouseLeave={() => holdKey('right', false)}
            className="h-10 rounded-xl bg-emerald-900 active:bg-emerald-700 text-white flex items-center justify-center cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
