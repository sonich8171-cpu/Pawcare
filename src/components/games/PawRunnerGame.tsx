import { Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { playGameTone } from './soundFx';

interface PawRunnerGameProps {
  bestScore: number;
  onSessionEnd: (score: number, won: boolean, durationSec: number) => void;
}

interface Obstacle {
  x: number;
  w: number;
  h: number;
  kind: 'hedge' | 'puddle' | 'cone';
}

interface Coin {
  x: number;
  y: number;
  collected: boolean;
}

const CANVAS_W = 720;
const CANVAS_H = 300;
const GROUND_Y = 236;

export function PawRunnerGame({ bestScore, onSessionEnd }: PawRunnerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'ready' | 'playing' | 'paused' | 'gameover'>('ready');
  const [score, setScore] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [localBest, setLocalBest] = useState(bestScore);

  const stateRef = useRef({
    status: 'ready' as 'ready' | 'playing' | 'paused' | 'gameover',
    soundOn: true,
    playerY: GROUND_Y - 40,
    vy: 0,
    jumpsUsed: 0,
    speed: 255,
    distance: 0,
    bonus: 0,
    obstacles: [] as Obstacle[],
    coins: [] as Coin[],
    spawnTimer: 0.9,
    coinTimer: 1.1,
    startedAt: 0,
    cloudOffset: 0,
    pawFrame: 0,
  });

  useEffect(() => {
    setLocalBest((prev) => Math.max(prev, bestScore));
  }, [bestScore]);

  useEffect(() => {
    stateRef.current.soundOn = soundOn;
  }, [soundOn]);

  const drawScene = useCallback((ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;

    // Sky gradient (Warm Cream -> Soft Sage)
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#FDFBF7');
    sky.addColorStop(1, '#DCFCE7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Sun
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath();
    ctx.arc(620, 56, 26, 0, Math.PI * 2);
    ctx.fill();

    // Distant Dehradun hills
    ctx.fillStyle = '#BBF7D0';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.quadraticCurveTo(140, 145, 290, GROUND_Y);
    ctx.quadraticCurveTo(450, 130, 620, GROUND_Y);
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 3; i += 1) {
      const cx = ((i * 260 - s.cloudOffset) % (CANVAS_W + 120)) + (i * 260 - s.cloudOffset < -80 ? CANVAS_W + 120 : 0);
      ctx.beginPath();
      ctx.arc(cx, 54 + i * 16, 18, 0, Math.PI * 2);
      ctx.arc(cx + 18, 48 + i * 16, 22, 0, Math.PI * 2);
      ctx.arc(cx + 38, 54 + i * 16, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Forest Green lawn & path
    ctx.fillStyle = '#14532D';
    ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, GROUND_Y, CANVAS_W, 8);

    // Path dashes
    ctx.fillStyle = '#D97706';
    for (let x = -(Math.floor(s.distance) % 48); x < CANVAS_W; x += 48) {
      ctx.fillRect(x, GROUND_Y + 26, 22, 4);
    }

    // Coins (Golden Paw Treats)
    for (const c of s.coins) {
      if (c.collected) continue;
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(c.x, c.y + 1, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Obstacles
    for (const ob of s.obstacles) {
      if (ob.kind === 'hedge') {
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.roundRect(ob.x, GROUND_Y - ob.h, ob.w, ob.h, 8);
        ctx.fill();
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(ob.x + ob.w * 0.35, GROUND_Y - ob.h + 10, 7, 0, Math.PI * 2);
        ctx.arc(ob.x + ob.w * 0.68, GROUND_Y - ob.h + 12, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (ob.kind === 'cone') {
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.moveTo(ob.x, GROUND_Y);
        ctx.lineTo(ob.x + ob.w / 2, GROUND_Y - ob.h);
        ctx.lineTo(ob.x + ob.w, GROUND_Y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFBEB';
        ctx.fillRect(ob.x + 7, GROUND_Y - ob.h * 0.45, ob.w - 14, 5);
      } else {
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.ellipse(ob.x + ob.w / 2, GROUND_Y - 4, ob.w / 2, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player Puppy (Cute animated character)
    const px = 92;
    const py = s.playerY;
    const legSwing = Math.sin(s.pawFrame * 14) * 5;

    // Shadow
    const groundDist = Math.max(0, GROUND_Y - 40 - py);
    const shadowScale = Math.max(0.45, 1 - groundDist / 160);
    ctx.fillStyle = 'rgba(20, 83, 45, 0.22)';
    ctx.beginPath();
    ctx.ellipse(px + 22, GROUND_Y + 3, 20 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 18);
    ctx.quadraticCurveTo(px - 10, py + 6 + legSwing * 0.5, px - 6, py + 2);
    ctx.stroke();

    // Legs
    ctx.fillStyle = '#D97706';
    ctx.fillRect(px + 6, py + 30 + (py < GROUND_Y - 42 ? 0 : legSwing), 7, 10);
    ctx.fillRect(px + 27, py + 30 - (py < GROUND_Y - 42 ? 0 : legSwing), 7, 10);

    // Body
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(px + 2, py + 12, 36, 22, 10);
    ctx.fill();

    // Emerald PawCare Collar
    ctx.fillStyle = '#059669';
    ctx.fillRect(px + 29, py + 14, 6, 12);

    // Head
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(px + 36, py + 12, 13, 0, Math.PI * 2);
    ctx.fill();

    // Floppy Ear
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.ellipse(px + 29, py + 13, 5, 8, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Eye & Nose
    ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.arc(px + 41, py + 9, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 48, py + 12, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.status = 'playing';
    s.playerY = GROUND_Y - 40;
    s.vy = 0;
    s.jumpsUsed = 0;
    s.speed = 260;
    s.distance = 0;
    s.bonus = 0;
    s.obstacles = [];
    s.coins = [];
    s.spawnTimer = 0.85;
    s.coinTimer = 0.95;
    s.startedAt = Date.now();
    setScore(0);
    setStatus('playing');
  }, []);

  const triggerJump = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'ready' || s.status === 'gameover') {
      startGame();
      return;
    }
    if (s.status !== 'playing') return;
    if (s.jumpsUsed < 2) {
      s.vy = -495;
      s.jumpsUsed += 1;
      playGameTone('jump', s.soundOn);
    }
  }, [startGame]);

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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        if (stateRef.current.status === 'playing') {
          e.preventDefault();
        }
        triggerJump();
      } else if (e.key.toLowerCase() === 'p') {
        togglePause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerJump, togglePause]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const s = stateRef.current;

      if (s.status === 'playing') {
        s.pawFrame += dt;
        s.cloudOffset += dt * 32;
        s.speed = Math.min(480, s.speed + dt * 6.5);
        s.distance += s.speed * dt * 0.08;

        // Gravity & Jump
        s.vy += 1260 * dt;
        s.playerY += s.vy * dt;
        if (s.playerY >= GROUND_Y - 40) {
          s.playerY = GROUND_Y - 40;
          s.vy = 0;
          s.jumpsUsed = 0;
        }

        // Spawn obstacles
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          const kinds: Obstacle['kind'][] = ['hedge', 'cone', 'puddle'];
          const kind = kinds[Math.floor(Math.random() * kinds.length)];
          const w = kind === 'puddle' ? 42 : kind === 'hedge' ? 32 : 26;
          const h = kind === 'puddle' ? 12 : kind === 'hedge' ? 36 : 34;
          s.obstacles.push({ x: CANVAS_W + 20, w, h, kind });
          s.spawnTimer = Math.max(0.95, 1.85 - (s.speed - 260) / 360) + Math.random() * 0.5;
        }

        // Spawn coins
        s.coinTimer -= dt;
        if (s.coinTimer <= 0) {
          s.coins.push({
            x: CANVAS_W + 30,
            y: GROUND_Y - (56 + Math.random() * 74),
            collected: false,
          });
          s.coinTimer = 1.05 + Math.random() * 0.9;
        }

        // Update coins & check pickup
        const playerBox = { x: 98, y: s.playerY + 6, w: 36, h: 32 };
        for (const c of s.coins) {
          c.x -= s.speed * dt;
          if (!c.collected) {
            const dx = c.x - (playerBox.x + playerBox.w / 2);
            const dy = c.y - (playerBox.y + playerBox.h / 2);
            if (dx * dx + dy * dy < 28 * 28) {
              c.collected = true;
              s.bonus += 15;
              playGameTone('collect', s.soundOn);
            }
          }
        }
        s.coins = s.coins.filter((c) => c.x > -30 && !c.collected);

        // Update obstacles & collision
        let hit = false;
        for (const ob of s.obstacles) {
          ob.x -= s.speed * dt;
          const obTop = GROUND_Y - ob.h;
          if (
            playerBox.x < ob.x + ob.w - 4 &&
            playerBox.x + playerBox.w > ob.x + 4 &&
            playerBox.y + playerBox.h > obTop + 4
          ) {
            hit = true;
          }
        }
        s.obstacles = s.obstacles.filter((ob) => ob.x + ob.w > -20);

        const totalScore = Math.floor(s.distance) + s.bonus;
        setScore(totalScore);

        if (hit) {
          s.status = 'gameover';
          setStatus('gameover');
          playGameTone('hit', s.soundOn);
          setLocalBest((prev) => Math.max(prev, totalScore));
          const durationSec = Math.max(1, Math.round((Date.now() - s.startedAt) / 1000));
          onSessionEnd(totalScore, totalScore >= 100, durationSec);
        }
      }

      if (ctx) drawScene(ctx);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drawScene, onSessionEnd]);

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-emerald-950">
            Paw Runner: The Happy Pet Adventure
          </h3>
          <p className="text-xs text-stone-600">
            Jump over Dehradun park obstacles &amp; collect golden paw treats. Supports double-jump!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 font-mono-tabular">
            Score: {score}
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 inline-flex items-center gap-1 font-mono-tabular">
            <Trophy className="w-3.5 h-3.5 text-amber-600" /> Best: {localBest}
          </div>
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
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-xs font-semibold cursor-pointer"
            >
              {status === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {status === 'paused' ? 'Resume' : 'Pause'}
            </button>
          )}
          <button
            type="button"
            onClick={startGame}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restart
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-emerald-200 bg-[#FDFBF7]">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={triggerJump}
          className="w-full h-auto block cursor-pointer touch-manipulation select-none"
        />

        {status !== 'playing' && (
          <div className="absolute inset-0 bg-emerald-950/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center text-white space-y-3">
            <p className="font-display text-2xl font-extrabold">
              {status === 'ready'
                ? 'Ready for a Walk in Dehradun?'
                : status === 'paused'
                ? 'Game Paused'
                : `Run Complete! Score: ${score}`}
            </p>
            <p className="text-xs text-emerald-100 max-w-sm">
              Press Space / Up Arrow or tap anywhere on the trail to jump. Double-tap to clear tall hedges.
            </p>
            <button
              type="button"
              onClick={status === 'paused' ? togglePause : startGame}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 text-sm font-bold cursor-pointer shadow-md"
            >
              {status === 'paused' ? 'Resume Run' : status === 'gameover' ? 'Run Again' : 'Start Running'}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
        <span>Controls: Space / ↑ / Tap Trail</span>
        <button
          type="button"
          onClick={triggerJump}
          className="sm:hidden px-5 py-2.5 rounded-xl bg-emerald-800 text-white font-bold cursor-pointer"
        >
          Tap to Jump
        </button>
      </div>
    </div>
  );
}
