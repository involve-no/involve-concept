'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Star, AlertCircle, RefreshCw, Eye, X, Lock } from 'lucide-react';
import CountryFlag from '@/components/CountryFlag';

interface LeaderboardUser {
  id: number;
  name: string;
  email: string;
  totalPoints: number;
  exactMatches: number;
  outcomeMatches: number;
}

interface UserPrediction {
  id: string;
  description: string;
  teamA: string;
  teamB: string;
  date: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  penaltyScoreA?: number | null;
  penaltyScoreB?: number | null;
  isLocked: boolean;
  prediction: {
    predictedScoreA?: number;
    predictedScoreB?: number;
    predictedWinner?: string | null;
    points?: number | null;
    isHidden?: boolean;
  } | null;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  // Drilldown Modal states
  const [selectedUser, setSelectedUser] = useState<{ id: number; name: string } | null>(null);
  const [userPredictions, setUserPredictions] = useState<UserPrediction[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [predictionsError, setPredictionsError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch user session first to know who to highlight
      const authRes = await fetch('/api/auth');
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.user) {
          setCurrentUserEmail(authData.user.email);
        }
      }

      // Fetch leaderboard
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('Klarte ikke å hente tabellen');
      const data = await res.json();
      setLeaderboard(data.leaderboard);
    } catch (err: any) {
      setError(err.message || 'Noe gikk galt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUserClick = async (user: { id: number; name: string }) => {
    setSelectedUser(user);
    setLoadingPredictions(true);
    setPredictionsError('');
    setUserPredictions([]);

    try {
      const res = await fetch(`/api/predictions/${user.id}`);
      if (!res.ok) throw new Error('Klarte ikke å hente tipsene for brukeren');
      const data = await res.json();
      setUserPredictions(data.matches);
    } catch (err: any) {
      setPredictionsError(err.message || 'Klarte ikke å hente tipsene');
    } finally {
      setLoadingPredictions(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Medal className="h-6 w-6 text-amber-400 animate-bounce" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-300" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return <span className="text-gray-500 font-bold text-sm w-6 text-center">{rank}</span>;
  };

  const formatOsloTime = (dateIsoStr: string) => {
    const d = new Date(dateIsoStr);
    return new Intl.DateTimeFormat('no-NO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Oslo',
    }).format(d);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-400 font-medium">Laster tabell...</span>
      </div>
    );
  }

  const topUser = leaderboard[0];

  return (
    <div className="space-y-6">
      {/* Dynamic Header Card */}
      {topUser && topUser.totalPoints > 0 && (
        <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden border border-amber-500/20 shadow-amber-500/5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                Ledende tipper
              </span>
              <h2 className="text-xl font-extrabold text-white truncate max-w-[200px]" title={topUser.name}>
                {topUser.name}
              </h2>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-center">
              <Trophy className="h-6 w-6 text-amber-400 mx-auto animate-pulse-slow" />
            </div>
          </div>
          <div className="flex justify-between items-center text-xs text-gray-400 border-t border-white/5 pt-3 mt-1">
            <span>Poengsum: <strong className="text-white text-base">{topUser.totalPoints}</strong> poeng</span>
            <span>Treff: <strong className="text-white">{topUser.exactMatches}</strong> eksakt</span>
          </div>
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        </div>
      )}

      {/* Title & Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-400">
            Tabell
          </h3>
          <span className="text-[9px] text-gray-500 uppercase tracking-widest block mt-0.5 font-medium">
            Klikk på en kollega for å se tips
          </span>
        </div>
        <button
          onClick={fetchData}
          className="p-1 text-gray-400 hover:text-white transition-all cursor-pointer rounded-lg hover:bg-white/5"
          title="Oppdater tabell"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950/50 border border-red-500/30 p-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Leaderboard Table List */}
      <div className="space-y-2.5">
        {leaderboard.length === 0 ? (
          <div className="text-center py-12 glass-panel-light rounded-xl border border-white/5">
            <Trophy className="mx-auto h-8 w-8 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">Ingen tips registrert ennå.</p>
          </div>
        ) : (
          leaderboard.map((user, index) => {
            const rank = index + 1;
            const isCurrentUser = user.email.toLowerCase() === currentUserEmail.toLowerCase();

            return (
              <button
                key={user.id}
                onClick={() => handleUserClick({ id: user.id, name: user.name })}
                className={`w-full text-left glass-panel-light rounded-xl p-3 flex items-center justify-between transition-all border hover:border-blue-500/30 hover:bg-white/5 active:scale-[0.99] cursor-pointer ${
                  isCurrentUser
                    ? 'border-blue-500/40 bg-blue-950/15'
                    : 'border-white/5'
                }`}
              >
                {/* Left Side: Rank, Avatar, Name */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8">
                    {getRankBadge(rank)}
                  </div>
                  
                  {/* Initials Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                    isCurrentUser 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}>
                    {user.name.substring(0, 2)}
                  </div>

                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white truncate max-w-[140px]" title={user.name}>
                      {user.name}
                    </span>
                    <span className="text-[10px] text-gray-500 truncate max-w-[140px]" title={user.email}>
                      {user.email}
                    </span>
                  </div>
                </div>

                {/* Right Side: Total Points & Hits stats */}
                <div className="flex items-center gap-4 text-right">
                  <div className="flex flex-col text-[10px] text-gray-500">
                    <span>{user.exactMatches} eksakt</span>
                    <span>{user.outcomeMatches} utfall</span>
                  </div>
                  <div className="w-12">
                    <span className="text-base font-black text-white">{user.totalPoints}</span>
                    <span className="text-[10px] text-gray-400 block -mt-1 font-semibold text-center">poeng</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Drilldown Modal (Tippehistorikk) */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md glass-card rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <header className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-blue-400" />
                  <span>Tippehistorikk</span>
                </h3>
                <span className="text-xs text-gray-400 font-semibold block mt-0.5">
                  Tipsene til {selectedUser.name}
                </span>
              </div>
              <button
                id="drilldown-close-btn"
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingPredictions ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                  <span className="text-xs text-gray-400">Henter tips...</span>
                </div>
              ) : predictionsError ? (
                <div className="flex items-center gap-2 rounded-lg bg-red-950/50 border border-red-500/30 p-3 text-xs text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{predictionsError}</span>
                </div>
              ) : userPredictions.filter(p => !!p.prediction).length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-500">
                  Ingen tips lagret av denne brukeren ennå.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {userPredictions
                    .filter((m) => !!m.prediction)
                    .map((m) => {
                      const pred = m.prediction!;
                      const isLocked = m.isLocked;

                      return (
                        <div
                          key={m.id}
                          className="glass-panel-light rounded-xl p-3 flex flex-col gap-2 border border-white/5 text-xs"
                        >
                          {/* Match Header */}
                          <div className="flex justify-between items-center text-[10px] text-gray-500 font-semibold">
                            <span>{m.description} • {formatOsloTime(m.date)}</span>
                            {isLocked ? (
                              <span className="text-red-400 font-semibold uppercase tracking-wider text-[9px]">Låst</span>
                            ) : (
                              <span className="text-green-400 font-semibold uppercase tracking-wider text-[9px]">
                                Åpent tips
                              </span>
                            )}
                          </div>

                          {/* Match Teams & Preds */}
                          <div className="flex items-center justify-between gap-2 py-1">
                            <div className="flex-1 flex items-center gap-1.5 min-w-0">
                              <CountryFlag countryName={m.teamA} className="w-5 h-5 shrink-0" />
                              <span className="font-bold text-white truncate text-[11px]" title={m.teamA}>{m.teamA}</span>
                            </div>
                            
                            {/* Predictions Box */}
                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                              <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-lg bg-black/30 border border-white/5 font-extrabold font-sans text-xs">
                                {pred.isHidden ? (
                                  <div className="flex items-center gap-1 text-[9px] text-gray-500 font-semibold uppercase tracking-wider py-0.5">
                                    <Lock className="h-3 w-3 text-gray-500" />
                                    <span>Skjult</span>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-blue-400">{pred.predictedScoreA}</span>
                                    <span className="text-gray-600">:</span>
                                    <span className="text-blue-400">{pred.predictedScoreB}</span>
                                  </>
                                )}
                              </div>
                              {/* Show predicted progression winner for knockout draws */}
                              {!pred.isHidden && pred.predictedScoreA === pred.predictedScoreB && pred.predictedWinner && m.id >= 'M073' && (
                                <div className="text-[8px] font-bold uppercase tracking-wider text-amber-400 px-1">
                                  → {pred.predictedWinner === 'teamA' ? m.teamA : m.teamB}
                                </div>
                              )}
                            </div>

                            <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                              <span className="font-bold text-white truncate text-[11px] text-right" title={m.teamB}>{m.teamB}</span>
                              <CountryFlag countryName={m.teamB} className="w-5 h-5 shrink-0" />
                            </div>
                          </div>

                          {/* Result Footer */}
                          {m.status === 'finished' && !pred.isHidden && (
                            <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-1 text-[10px]">
                              <span className="text-gray-400">
                                Resultat:{' '}
                                <strong className="text-white">
                                  {m.scoreA}-{m.scoreB}
                                </strong>
                                {m.penaltyScoreA !== null && m.penaltyScoreA !== undefined &&
                                 m.penaltyScoreB !== null && m.penaltyScoreB !== undefined && (
                                  <span className="text-[9px] text-gray-500 font-semibold ml-1">
                                    ({m.penaltyScoreA}-{m.penaltyScoreB} str.)
                                  </span>
                                )}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                                  pred.points === 3
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : pred.points === 1
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}
                              >
                                {pred.points === 3
                                  ? 'Eksakt (+3)'
                                  : pred.points === 1
                                  ? m.id >= 'M073' && m.scoreA === m.scoreB
                                    ? 'Riktig videre (+1)'
                                    : 'Utfall (+1)'
                                  : 'Feil (+0)'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
