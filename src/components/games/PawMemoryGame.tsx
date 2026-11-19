import {
  Award,
  Bone,
  Cat,
  Dog,
  Feather,
  Heart,
  PawPrint,
  Rabbit,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { playGameTone } from './soundFx';

interface PawMemoryGameProps {
  bestScore: number;
  onSessionEnd: (score: number, won: boolean, durationSec: number) => void;
}

type Difficulty = 'easy' | 'medium' | 'hard';

interface CardItem {
  id: number;
  pairId: string;
  label: string;
  matched: boolean;
  flipped: boolean;
}

const DECK_SYMBOLS = [
  { pairId: 'dog', label: 'Golden Pup', icon: Dog, color: 'text-amber-700 bg-amber-50' },
  { pairId: 'cat', label: 'Whisker Cat', icon: Cat, color: 'text-emerald-800 bg-emerald-50' },
  { pairId: 'rabbit', label: 'Fluffy Bunny', icon: Rabbit, color: 'text-stone-700 bg-stone-100' },
  { pairId: 'bird', label: 'Songbird', icon: Feather, color: 'text-sky-700 bg-sky-50' },
  { pairId: 'bone', label: 'Healthy Treat', icon: Bone, color: 'text-orange-700 bg-orange-50' },
  { pairId: 'paw', label: 'Clean Paws', icon: PawPrint, color: 'text-emerald-900 bg-emerald-100' },
  { pairId: 'care', label: 'Pet Love', icon: Heart, color: 'text-rose-700 bg-rose-50' },
  { pairId: 'badge', label: 'Good Boy', icon: Award, color: 'text-amber-800 bg-amber-100' },
];

const PAIRS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 3,
  medium: 6,
  hard: 8,
};

function buildDeck(difficulty: Difficulty): CardItem[] {
  const count = PAIRS_BY_DIFFICULTY[difficulty];
  const selected = DECK_SYMBOLS.slice(0, count);
  const raw = [...selected, ...selected].map((s, idx) => ({
    id: idx,
    pairId: s.pairId,
    label: s.label,
    matched: false,
    flipped: false,
  }));
  for (let i = raw.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  return raw;
}

export function PawMemoryGame({ bestScore, onSessionEnd }: PawMemoryGameProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [cards, setCards] = useState<CardItem[]>(() => buildDeck('medium'));
  const [pickedIndices, setPickedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [won, setWon] = useState(false);
  const [locked, setLocked] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [localBest, setLocalBest] = useState(bestScore);

  useEffect(() => {
    setLocalBest((prev) => Math.max(prev, bestScore));
  }, [bestScore]);

  const startNewGame = useCallback((nextDiff: Difficulty) => {
    setDifficulty(nextDiff);
    setCards(buildDeck(nextDiff));
    setPickedIndices([]);
    setMoves(0);
    setElapsedSec(0);
    setWon(false);
    setLocked(false);
    setLastScore(null);
  }, []);

  useEffect(() => {
    if (won) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [won]);

  const handleCardClick = (index: number) => {
    if (locked || won) return;
    const target = cards[index];
    if (!target || target.flipped || target.matched) return;

    playGameTone('flip', soundOn);
    const updated = cards.map((c, i) => (i === index ? { ...c, flipped: true } : c));
    const nextPicked = [...pickedIndices, index];
    setCards(updated);
    setPickedIndices(nextPicked);

    if (nextPicked.length === 2) {
      setLocked(true);
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [firstIdx, secondIdx] = nextPicked;
      const first = updated[firstIdx];
      const second = updated[secondIdx];

      if (first.pairId === second.pairId) {
        setTimeout(() => {
          playGameTone('collect', soundOn);
          const matchedDeck = updated.map((c, i) =>
            i === firstIdx || i === secondIdx ? { ...c, matched: true } : c
          );
          setCards(matchedDeck);
          setPickedIndices([]);
          setLocked(false);

          if (matchedDeck.every((c) => c.matched)) {
            setWon(true);
            playGameTone('win', soundOn);
            const base = difficulty === 'hard' ? 150 : difficulty === 'medium' ? 120 : 80;
            const penalty = Math.max(0, nextMoves - PAIRS_BY_DIFFICULTY[difficulty]) * 4;
            const finalScore = Math.max(30, base - penalty);
            setLastScore(finalScore);
            setLocalBest((prev) => Math.max(prev, finalScore));
            onSessionEnd(finalScore, true, Math.max(1, elapsedSec));
          }
        }, 280);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === firstIdx || i === secondIdx ? { ...c, flipped: false } : c
            )
          );
          setPickedIndices([]);
          setLocked(false);
        }, 680);
      }
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold text-emerald-950">
            Paw Memory Match
          </h3>
          <p className="text-xs text-stone-600">
            Flip cards to match adorable pets &amp; care essentials in the fewest moves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
            <button
              key={diff}
              type="button"
              onClick={() => startNewGame(diff)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-colors ${
                difficulty === diff
                  ? 'bg-emerald-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {diff} ({PAIRS_BY_DIFFICULTY[diff]} pairs)
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
          <button
            type="button"
            onClick={() => startNewGame(difficulty)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-emerald-950 text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> New Board
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="px-3 py-1.5 rounded-xl bg-stone-100 font-semibold text-stone-800 font-mono-tabular">
          Moves: {moves}
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-stone-100 font-semibold text-stone-800 font-mono-tabular">
          Time: {elapsedSec}s
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 font-bold text-emerald-900 inline-flex items-center gap-1 font-mono-tabular">
          <Trophy className="w-3.5 h-3.5 text-amber-600" /> Best: {localBest}
        </span>
      </div>

      {won && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-display font-bold text-emerald-950">
                All Pairs Matched! Score: {lastScore}
              </p>
              <p className="text-xs text-emerald-800">
                Completed {difficulty} mode in {moves} moves and {elapsedSec} seconds.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => startNewGame(difficulty)}
            className="px-4 py-2 rounded-xl bg-emerald-900 text-white text-xs font-bold cursor-pointer"
          >
            Play Again
          </button>
        </div>
      )}

      <div
        className={`grid gap-3 ${
          difficulty === 'easy'
            ? 'grid-cols-3 max-w-md mx-auto'
            : difficulty === 'medium'
            ? 'grid-cols-3 sm:grid-cols-4'
            : 'grid-cols-4'
        }`}
      >
        {cards.map((card, idx) => {
          const sym = DECK_SYMBOLS.find((s) => s.pairId === card.pairId) || DECK_SYMBOLS[0];
          const Icon = sym.icon;
          const revealed = card.flipped || card.matched;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleCardClick(idx)}
              disabled={revealed || locked}
              className="group h-24 sm:h-28 perspective-[700px] cursor-pointer focus:outline-none"
            >
              <div
                className={`relative w-full h-full transition-transform duration-300 [transform-style:preserve-3d] ${
                  revealed ? '[transform:rotateY(180deg)]' : ''
                }`}
              >
                {/* Front (hidden back) */}
                <div className="absolute inset-0 [backface-visibility:hidden] rounded-2xl border-2 border-emerald-800/20 bg-gradient-to-br from-emerald-900 to-emerald-800 flex flex-col items-center justify-center gap-1 text-emerald-50 shadow-sm group-hover:border-amber-400">
                  <PawPrint className="w-6 h-6 text-amber-300" />
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-100">
                    PawCare
                  </span>
                </div>

                {/* Back (revealed symbol) */}
                <div
                  className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 p-2 shadow-sm ${
                    card.matched
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-amber-300 bg-[#FDFBF7]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sym.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-stone-800 truncate max-w-full">
                    {card.label}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
