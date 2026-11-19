import {
  Award,
  Bone,
  CheckCircle2,
  Compass,
  Gamepad2,
  Grid,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  PLAY_ACHIEVEMENTS,
  recordGameSessionAndRewards,
  subscribeMyGameSessions,
  subscribeMyRewards,
} from '../services/firestoreService';
import type { GameId, GameSessionRecord, UserRewardProfile } from '../types/pawcare';
import { FeedPuppyGame } from './games/FeedPuppyGame';
import { PawMemoryGame } from './games/PawMemoryGame';
import { PawRunnerGame } from './games/PawRunnerGame';
import { PetRescueGame } from './games/PetRescueGame';

interface PlayZoneSectionProps {
  defaultView?: 'play' | 'rewards';
}

const GAMES_META: {
  id: GameId;
  title: string;
  tagline: string;
  icon: typeof Gamepad2;
}[] = [
  {
    id: 'paw_runner',
    title: 'Paw Runner',
    tagline: 'Jump Dehradun park obstacles & collect golden paw treats',
    icon: Zap,
  },
  {
    id: 'paw_memory',
    title: 'Paw Memory Match',
    tagline: 'Flip & match pet care pairs across 3 difficulty levels',
    icon: Grid,
  },
  {
    id: 'feed_puppy',
    title: 'Feed the Puppy',
    tagline: 'Catch nutritious kibble & salmon treats while dodging hazards',
    icon: Bone,
  },
  {
    id: 'pet_rescue',
    title: 'Pet Rescue Adventure',
    tagline: 'Multi-level garden rescue mission back to the Safe Home gazebo',
    icon: Compass,
  },
];

const GAME_NAME_BY_ID: Record<GameId, string> = {
  paw_runner: 'Paw Runner',
  paw_memory: 'Paw Memory Match',
  feed_puppy: 'Feed the Puppy',
  pet_rescue: 'Pet Rescue Adventure',
};

export function PlayZoneSection({ defaultView = 'play' }: PlayZoneSectionProps) {
  const { firebaseUser, userProfile } = useAuth();
  const [sectionView, setSectionView] = useState<'play' | 'rewards'>(defaultView);
  const [activeGame, setActiveGame] = useState<GameId>('paw_runner');
  const [rewards, setRewards] = useState<UserRewardProfile | null>(null);
  const [sessions, setSessions] = useState<GameSessionRecord[]>([]);
  const [savingResult, setSavingResult] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    setSectionView(defaultView);
  }, [defaultView]);

  useEffect(() => {
    if (!firebaseUser) {
      setRewards(null);
      setSessions([]);
      return;
    }
    const unsubRewards = subscribeMyRewards(firebaseUser.uid, setRewards);
    const unsubSessions = subscribeMyGameSessions(firebaseUser.uid, setSessions);
    return () => {
      unsubRewards();
      unsubSessions();
    };
  }, [firebaseUser]);

  const computePoints = (gameId: GameId, score: number, won: boolean): number => {
    const raw =
      gameId === 'paw_runner'
        ? Math.floor(score / 8)
        : gameId === 'paw_memory'
        ? Math.floor(score / 2) + (won ? 20 : 0)
        : gameId === 'feed_puppy'
        ? Math.floor(score / 4)
        : Math.floor(score / 3) + (won ? 25 : 0);
    return Math.max(5, Math.min(150, raw));
  };

  const handleSessionEnd = useCallback(
    async (gameId: GameId, score: number, won: boolean, durationSec: number) => {
      const earned = computePoints(gameId, score, won);
      if (!firebaseUser) {
        setBanner(
          `Great round (${score} pts)! Sign in with Gmail to save your ${earned} Paw Points and unlock Play Zone badges.`
        );
        return;
      }

      setSavingResult(true);
      try {
        const savedPts = await recordGameSessionAndRewards({
          userId: firebaseUser.uid,
          gameId,
          score,
          pointsEarned: earned,
          levelReached: won ? 2 : 1,
          durationSec,
          wonRound: won,
        });
        setBanner(
          `Saved ${GAME_NAME_BY_ID[gameId]} score (${score}) — +${savedPts} Paw Points added to your profile!`
        );
      } catch (err) {
        console.warn('[PlayZone] Failed to persist game session', err);
        setBanner(`Round finished (${score}) — unable to sync right now.`);
      } finally {
        setSavingResult(false);
      }
    },
    [firebaseUser]
  );

  const unlockedSet = new Set(rewards?.achievements || []);
  const bestFor = (id: GameId) => rewards?.bestScores?.[id] || 0;

  return (
    <div className="space-y-6">
      {/* Play Zone Header */}
      <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-amber-300">
            <Gamepad2 className="w-3.5 h-3.5" /> PawCare Play Zone · Zero Cost Entertainment
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Play Pet Mini-Games &amp; Unlock Badges
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
            Enjoy 4 family-friendly pet adventures directly in your browser. Collect Paw Points and
            unlock achievement badges — entertainment-only points with no fees or paid passes.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 shrink-0">
          <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-center">
            <p className="text-[11px] text-emerald-200">Paw Points</p>
            <p className="font-display text-xl font-extrabold text-amber-300 font-mono-tabular">
              {rewards?.totalPoints || 0}
            </p>
          </div>
          <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-center">
            <p className="text-[11px] text-emerald-200">Games</p>
            <p className="font-display text-xl font-extrabold text-white font-mono-tabular">
              {rewards?.gamesPlayed || 0}
            </p>
          </div>
          <div className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-center">
            <p className="text-[11px] text-emerald-200">Badges</p>
            <p className="font-display text-xl font-extrabold text-emerald-200 font-mono-tabular">
              {unlockedSet.size}/{PLAY_ACHIEVEMENTS.length}
            </p>
          </div>
        </div>
      </div>

      {/* Guest prompt if not signed in */}
      {!firebaseUser && (
        <div className="bg-[#FDFBF7] border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-stone-800">
            You can play all 4 games right now! Sign in with Gmail to save high scores and earn Paw Points.
          </p>
          <Link
            to="/login/customer"
            className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold shrink-0"
          >
            Sign In to Save Progress
          </Link>
        </div>
      )}

      {/* Save confirmation toast */}
      {banner && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            {savingResult ? 'Saving session...' : banner}
          </span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Switcher: Arcade vs Rewards */}
      <div className="inline-flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl">
        <button
          type="button"
          onClick={() => setSectionView('play')}
          className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
            sectionView === 'play'
              ? 'bg-emerald-900 text-white shadow-sm'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          Mini-Games Arcade (4 Games)
        </button>
        <button
          type="button"
          onClick={() => setSectionView('rewards')}
          className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
            sectionView === 'rewards'
              ? 'bg-emerald-900 text-white shadow-sm'
              : 'text-stone-700 hover:text-stone-900'
          }`}
        >
          Rewards &amp; Leaderboard History
        </button>
      </div>

      {sectionView === 'play' ? (
        <div className="space-y-5">
          {/* 4-Game Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GAMES_META.map((g) => {
              const Icon = g.icon;
              const active = activeGame === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveGame(g.id)}
                  className={`text-left p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    active
                      ? 'bg-emerald-900 text-white border-emerald-900 shadow-md'
                      : 'bg-white border-stone-200 hover:border-emerald-300 text-stone-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        active ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[11px] font-bold font-mono-tabular ${
                        active ? 'text-amber-300' : 'text-emerald-800'
                      }`}
                    >
                      Best: {bestFor(g.id)}
                    </span>
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm">{g.title}</p>
                    <p
                      className={`text-[11px] leading-snug mt-0.5 ${
                        active ? 'text-emerald-100' : 'text-stone-500'
                      }`}
                    >
                      {g.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Game Canvas / Board */}
          {activeGame === 'paw_runner' && (
            <PawRunnerGame
              bestScore={bestFor('paw_runner')}
              onSessionEnd={(s, w, d) => handleSessionEnd('paw_runner', s, w, d)}
            />
          )}
          {activeGame === 'paw_memory' && (
            <PawMemoryGame
              bestScore={bestFor('paw_memory')}
              onSessionEnd={(s, w, d) => handleSessionEnd('paw_memory', s, w, d)}
            />
          )}
          {activeGame === 'feed_puppy' && (
            <FeedPuppyGame
              bestScore={bestFor('feed_puppy')}
              onSessionEnd={(s, w, d) => handleSessionEnd('feed_puppy', s, w, d)}
            />
          )}
          {activeGame === 'pet_rescue' && (
            <PetRescueGame
              bestScore={bestFor('pet_rescue')}
              onSessionEnd={(s, w, d) => handleSessionEnd('pet_rescue', s, w, d)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Achievement Badges Grid */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-bold text-emerald-950">
                  Play Zone Achievement Badges
                </h3>
                <p className="text-xs text-stone-500">
                  Entertainment-only recognition badges for{' '}
                  {userProfile?.displayName || firebaseUser?.displayName || 'your PawCare account'}.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                {rewards?.totalPoints || 0} Total Paw Points
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PLAY_ACHIEVEMENTS.map((badge) => {
                const earned = unlockedSet.has(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-2xl border flex items-start gap-3 ${
                      earned
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : 'bg-stone-50 border-stone-200 opacity-75'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        earned ? 'bg-emerald-900 text-amber-300' : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {earned ? <CheckCircle2 className="w-5 h-5" /> : <Award className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-stone-900">{badge.title}</p>
                      <p className="text-xs text-stone-600 mt-0.5">{badge.description}</p>
                      <p
                        className={`text-[11px] font-semibold mt-1.5 ${
                          earned ? 'text-emerald-800' : 'text-stone-500'
                        }`}
                      >
                        {earned ? 'Unlocked' : 'Locked · Keep Playing'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Personal High Scores + Recent Sessions */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-emerald-950">
              Recent Play Sessions
            </h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-stone-500">
                No recorded game rounds yet. Switch to the Mini-Games Arcade and complete a round!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2 pr-4 font-semibold">Game</th>
                      <th className="py-2 pr-4 font-semibold">Score</th>
                      <th className="py-2 pr-4 font-semibold">Paw Points</th>
                      <th className="py-2 font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {sessions.slice(0, 12).map((sess) => (
                      <tr key={sess.sessionId}>
                        <td className="py-2.5 pr-4 font-semibold text-stone-900">
                          {GAME_NAME_BY_ID[sess.gameId] || sess.gameId}
                        </td>
                        <td className="py-2.5 pr-4 font-mono-tabular text-stone-800">
                          {sess.score}
                        </td>
                        <td className="py-2.5 pr-4 font-mono-tabular font-bold text-emerald-800">
                          +{sess.pointsEarned}
                        </td>
                        <td className="py-2.5 font-mono-tabular text-stone-500">
                          {sess.durationSec}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
