import { ArrowLeft, ArrowRight, Heart, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { playGameTone } from './soundFx';

interface FeedPuppyGameProps {
  bestScore: number;
  onSessionEnd: (score: number, won: boolean, durationSec: number) => void;
}

interface FallingItem {
  x: number;
  y: number;
  vy: number;
  kind: 'kibble' | 'salmon' | 'unsafe';
}

const CANVAS_W = 680;
const CANVAS_H = 340;
const PLAYER_W = 74;

export function FeedPuppyGame({ bestScore, onSessionEnd }: FeedPuppyGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<'ready' | 'playing' | 'paused' | 'gameover'>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [soundOn, setSoundOn] = useState(true);
  const [localBest, setLocalBest] = useState(bestScore);

  const keysRef = useRef({ left: false, right: false });
  const stateRef = useRef({
    status: 'ready' as 'ready' | 'playing' | 'paused' | 'gameover',
    soundOn: true,
    playerX: CANVAS_W / 2 - PLAYER_W / 2,
    score: 0,
    lives: 3,
    combo: 0,
    items: [] as FallingItem[],
    spawnTimer: 0.7,
    startedAt: 0,
    speedBoost: 1,
  });

  useEffect(() => {
    setLocalBest((prev) => Math.max(prev, bestScore));
  }, [bestScore]);

  useEffect(() => {
    stateRef.current.soundOn = soundOn;
  }, [soundOn]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.status = 'playing';
    s.playerX = CANVAS_W / 2 - PLAYER_W / 2;
    s.score = 0;
    s.lives = 3;
    s.combo = 0;
    s.items = [];
    s.spawnTimer = 0.55;
    s.startedAt = Date.now();
    s.speedBoost = 1;
    setScore(0);
    setLives(3);
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
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keysRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keysRef.current.right = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keysRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keysRef.current.right = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  const drawScene = useCallback((ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current;

    const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bg.addColorStop(0, '#FDFBF7');
    bg.addColorStop(1, '#ECFDF5');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Floor strip
    ctx.fillStyle = '#14532D';
    ctx.fillRect(0, CANVAS_H - 28, CANVAS_W, 28);
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, CANVAS_H - 32, CANVAS_W, 5);

    // Falling items
    for (const item of s.items) {
      if (item.kind === 'kibble') {
        ctx.fillStyle = '#B45309';
        ctx.beginPath();
        ctx.roundRect(item.x - 13, item.y - 6, 26, 12, 5);
        ctx.fill();
        ctx.fillStyle = '#FEF3C7';
        ctx.beginPath();
        ctx.arc(item.x - 12, item.y - 4, 4, 0, Math.PI * 2);
        ctx.arc(item.x - 12, item.y + 4, 4, 0, Math.PI * 2);
        ctx.arc(item.x + 12, item.y - 4, 4, 0, Math.PI * 2);
        ctx.arc(item.x + 12, item.y + 4, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'salmon') {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(item.x, item.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFBEB';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        // Unsafe chocolate / mud ball
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(item.x, item.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(item.x - 5, item.y - 5);
        ctx.lineTo(item.x + 5, item.y + 5);
        ctx.moveTo(item.x + 5, item.y - 5);
        ctx.lineTo(item.x - 5, item.y + 5);
        ctx.stroke();
      }
    }

    // Happy Puppy & Bowl Basket
    const px = s.playerX;
    const py = CANVAS_H - 76;

    // Bowl
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.roundRect(px, py + 24, PLAYER_W, 20, 8);
    ctx.fill();
    ctx.fillStyle = '#D97706';
    ctx.fillRect(px + 8, py + 28, PLAYER_W - 16, 5);

    // Puppy head peeking behind bowl
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(px + PLAYER_W / 2, py + 12, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.ellipse(px + PLAYER_W / 2 - 14, py + 14, 5, 9, 0.2, 0, Math.PI * 2);
    ctx.ellipse(px + PLAYER_W / 2 + 14, py + 14, 5, 9, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.arc(px + PLAYER_W / 2 - 6, py + 9, 2.3, 0, Math.PI * 2);
    ctx.arc(px + PLAYER_W / 2 + 6, py + 9, 2.3, 0, Math.PI * 2);
    ctx.arc(px + PLAYER_W / 2, py + 15, 3, 0, Math.PI * 2);
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

      if (s.status === 'playing') {
        const moveSpeed = 380;
        if (keysRef.current.left) s.playerX -= moveSpeed * dt;
        if (keysRef.current.right) s.playerX += moveSpeed * dt;
        s.playerX = Math.max(8, Math.min(CANVAS_W - PLAYER_W - 8, s.playerX));

        s.speedBoost = Math.min(2.2, s.speedBoost + dt * 0.025);
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          const r = Math.random();
          const kind: FallingItem['kind'] = r < 0.56 ? 'kibble' : r < 0.8 ? 'salmon' : 'unsafe';
          s.items.push({
            x: 24 + Math.random() * (CANVAS_W - 48),
            y: -16,
            vy: (155 + Math.random() * 80) * s.speedBoost,
            kind,
          });
          s.spawnTimer = Math.max(0.32, 0.78 - (s.speedBoost - 1) * 0.3);
        }

        const bowlY = CANVAS_H - 58;
        const remaining: FallingItem[] = [];
        for (const item of s.items) {
          item.y += item.vy * dt;
          const caught =
            item.y >= bowlY - 14 &&
            item.y <= bowlY + 24 &&
            item.x >= s.playerX - 8 &&
            item.x <= s.playerX + PLAYER_W + 8;

          if (caught) {
            if (item.kind === 'unsafe') {
              s.lives -= 1;
              s.combo = 0;
              setLives(s.lives);
              playGameTone('hit', s.soundOn);
            } else {
              s.combo += 1;
              const pts = item.kind === 'salmon' ? 20 : 10;
              s.score += pts + (s.combo >= 5 ? 5 : 0);
              setScore(s.score);
              playGameTone('collect', s.soundOn);
            }
          } else if (item.y < CANVAS_H + 20) {
            remaining.push(item);
          }
        }
        s.items = remaining;

        if (s.lives <= 0) {
          s.status = 'gameover';
          setStatus('gameover');
          setLocalBest((prev) => Math.max(prev, s.score));
          const durationSec = Math.max(1, Math.round((Date.now() - s.startedAt) / 1000));
          onSessionEnd(s.score, s.score >= 80, durationSec);
        }
      }

      if (ctx) drawScene(ctx);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drawScene, onSessionEnd]);

  const handlePointerMove = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || stateRef.current.status !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * CANVAS_W;
    stateRef.current.playerX = Math.max(8, Math.min(CANVAS_W - PLAYER_W - 8, relX - PLAYER_W / 2));
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-emerald-950">
            Feed the Puppy: Treat Catcher
          </h3>
          <p className="text-xs text-stone-600">
            Catch healthy kibble &amp; golden salmon treats; dodge red X unsafe snacks!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200">
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                className={`w-3.5 h-3.5 ${i < lives ? 'text-rose-600 fill-rose-600' : 'text-stone-300'}`}
              />
            ))}
          </div>
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
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-semibold cursor-pointer"
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
          onMouseMove={(e) => handlePointerMove(e.clientX)}
          onTouchMove={(e) => {
            if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
          }}
          className="w-full h-auto block touch-none select-none cursor-ew-resize"
        />

        {status !== 'playing' && (
          <div className="absolute inset-0 bg-emerald-950/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center text-white space-y-3">
            <p className="font-display text-2xl font-extrabold">
              {status === 'ready'
                ? 'Treat Time!'
                : status === 'paused'
                ? 'Game Paused'
                : `Feeding Finished! Score: ${score}`}
            </p>
            <p className="text-xs text-emerald-100 max-w-sm">
              Move with ← / → Arrow keys, A/D, mouse pointer, or touch drag to catch safe treats.
            </p>
            <button
              type="button"
              onClick={status === 'paused' ? togglePause : startGame}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 text-sm font-bold cursor-pointer shadow-md"
            >
              {status === 'paused' ? 'Resume' : status === 'gameover' ? 'Play Again' : 'Start Catching'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
        <span>Controls: ← → / A D / Drag Bowl</span>
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onTouchStart={() => { keysRef.current.left = true; }}
            onTouchEnd={() => { keysRef.current.left = false; }}
            onMouseDown={() => { keysRef.current.left = true; }}
            onMouseUp={() => { keysRef.current.left = false; }}
            className="px-4 py-2 rounded-xl bg-emerald-800 text-white font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onTouchStart={() => { keysRef.current.right = true; }}
            onTouchEnd={() => { keysRef.current.right = false; }}
            onMouseDown={() => { keysRef.current.right = true; }}
            onMouseUp={() => { keysRef.current.right = false; }}
            className="px-4 py-2 rounded-xl bg-emerald-800 text-white font-bold cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
