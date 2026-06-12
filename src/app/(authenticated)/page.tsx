'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Search, Save, CheckCircle, Clock, AlertCircle, HelpCircle, X, Trophy } from 'lucide-react';
import CountryFlag from '@/components/CountryFlag';
import UserAvatar from '@/components/UserAvatar';

interface Prediction {
  predictedScoreA: number;
  predictedScoreB: number;
  predictedWinner?: string | null;
  points: number | null;
}

interface Match {
  id: string;
  description: string;
  teamA: string;
  teamB: string;
  date: string; // ISO String: '2026-06-11T21:00:00.000Z'
  stadium: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
  penaltyScoreA?: number | null;
  penaltyScoreB?: number | null;
  isLocked: boolean;
  prediction: Prediction | null;
  predictors?: {
    userId: number;
    userName: string;
    userEmail: string;
    predictedScoreA?: number;
    predictedScoreB?: number;
    points?: number | null;
  }[];
  consensus?: {
    winA: number;
    draw: number;
    winB: number;
    total: number;
  };
}

// Countdown component
function Countdown({ matches }: { matches: Match[] }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [nextMatch, setNextMatch] = useState<Match | null>(null);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      // Find the next upcoming match (kick-off in the future)
      const upcoming = matches
        .filter((m) => new Date(m.date) > now)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

      if (!upcoming) {
        setTimeLeft('Ingen kommende kamper');
        setNextMatch(null);
        return;
      }

      setNextMatch(upcoming);

      const diff = new Date(upcoming.date).getTime() - now.getTime();
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      const dStr = days > 0 ? `${days}d ` : '';
      const hStr = hours > 0 || days > 0 ? `${hours}t ` : '';
      const mStr = `${minutes}m `;
      const sStr = `${seconds}s`;

      setTimeLeft(`${dStr}${hStr}${mStr}${sStr}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [matches]);

  if (!nextMatch) return null;

  return (
    <div className="glass-panel-light rounded-xl p-3.5 flex flex-col gap-1 border border-amber-500/20 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-2.5 h-full bg-gradient-to-b from-amber-400 to-amber-600" />
      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center justify-center gap-1">
        <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
        Neste tipsfrist ({nextMatch.teamA} - {nextMatch.teamB})
      </span>
      <span className="text-xl font-black tracking-widest text-white">{timeLeft}</span>
    </div>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; email: string } | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'standings' | 'podium'>('matches');
  
  // Podium states
  const [podiumTeams, setPodiumTeams] = useState<string[]>([]);
  const [podiumGold, setPodiumGold] = useState('');
  const [podiumSilver, setPodiumSilver] = useState('');
  const [podiumBronze, setPodiumBronze] = useState('');
  const [podiumLocked, setPodiumLocked] = useState(false);
  const [podiumSaving, setPodiumSaving] = useState(false);
  const [podiumSuccess, setPodiumSuccess] = useState(false);
  const [otherPodiums, setOtherPodiums] = useState<{ userId: number; userName: string; goldTeam: string; silverTeam: string; bronzeTeam: string }[]>([]);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all'); // 'all', 'group', 'knockout'
  const [predictionFilter, setPredictionFilter] = useState('all'); // 'all', 'predicted', 'missing'
  
  // Pending changes for scores in cards
  const [draftScores, setDraftScores] = useState<Record<string, { a: string; b: string; winner?: 'teamA' | 'teamB' | null }>>({});
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [saveSuccessMatchId, setSaveSuccessMatchId] = useState<string | null>(null);

  // Rules Modal state
  const [showRules, setShowRules] = useState(false);

  // Fetch matches & predictions
  const fetchMatches = async () => {
    try {
      const res = await fetch('/api/predictions');
      if (!res.ok) throw new Error('Klarte ikke å hente kamper');
      const data = await res.json();
      setMatches(data.matches);

      // Pre-populate draft scores
      const initialDrafts: Record<string, { a: string; b: string; winner?: 'teamA' | 'teamB' | null }> = {};
      data.matches.forEach((m: Match) => {
        if (m.prediction) {
          initialDrafts[m.id] = {
            a: m.prediction.predictedScoreA.toString(),
            b: m.prediction.predictedScoreB.toString(),
            winner: m.prediction.predictedWinner as 'teamA' | 'teamB' | null,
          };
        } else {
          initialDrafts[m.id] = { a: '', b: '', winner: null };
        }
      });
      setDraftScores(initialDrafts);
    } catch (err: any) {
      setError(err.message || 'Noe gikk galt');
    } finally {
      setLoading(false);
    }
  };

  const fetchPodium = async () => {
    try {
      const res = await fetch('/api/predictions/podium');
      if (res.ok) {
        const data = await res.json();
        setPodiumTeams(data.teams);
        setPodiumLocked(data.isLocked);
        if (data.prediction) {
          setPodiumGold(data.prediction.goldTeam || '');
          setPodiumSilver(data.prediction.silverTeam || '');
          setPodiumBronze(data.prediction.bronzeTeam || '');
        }
        if (data.otherUsersPicks) {
          setOtherPodiums(data.otherUsersPicks);
        }
      }
    } catch (err) {
      console.error('Klarte ikke å hente vinnertips:', err);
    }
  };

  const handleSavePodium = async () => {
    if (!podiumGold || !podiumSilver || !podiumBronze) {
      setError('Du må velge både gull, sølv og bronse');
      return;
    }

    if (podiumGold === podiumSilver || podiumGold === podiumBronze || podiumSilver === podiumBronze) {
      setError('Du kan ikke velge samme land til flere plasseringer');
      return;
    }

    setPodiumSaving(true);
    setError('');

    try {
      const res = await fetch('/api/predictions/podium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goldTeam: podiumGold,
          silverTeam: podiumSilver,
          bronzeTeam: podiumBronze,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kunne ikke lagre vinnertips');
      }

      setPodiumSuccess(true);
      setTimeout(() => setPodiumSuccess(false), 2500);
      await fetchPodium();
    } catch (err: any) {
      setError(err.message || 'Noe gikk galt under lagring av vinnertips');
    } finally {
      setPodiumSaving(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    fetchPodium();

    // Fetch user details
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch((err) => console.error('Error fetching auth user:', err));
  }, []);

  const handleScoreChange = (matchId: string, team: 'a' | 'b', val: string) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setDraftScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: val,
        // Reset winner if scores are no longer draw
        winner: team === 'a' && val !== prev[matchId]?.b ? null : team === 'b' && val !== prev[matchId]?.a ? null : prev[matchId]?.winner
      },
    }));
  };

  const handlePredictedWinnerChange = (matchId: string, winner: 'teamA' | 'teamB') => {
    setDraftScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        winner,
      },
    }));
  };

  const handleSavePrediction = async (matchId: string) => {
    const draft = draftScores[matchId];
    if (!draft || draft.a === '' || draft.b === '') return;

    const isKnockout = matchId >= 'M073';
    const isDraw = draft.a === draft.b;

    if (isKnockout && isDraw && draft.winner !== 'teamA' && draft.winner !== 'teamB') {
      setError('Du må velge et lag som går videre ved uavgjort tips');
      return;
    }

    setSavingMatchId(matchId);
    setError('');

    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          predictedScoreA: draft.a,
          predictedScoreB: draft.b,
          predictedWinner: isKnockout && isDraw ? draft.winner : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kunne ikke lagre tips');
      }

      setSaveSuccessMatchId(matchId);
      setTimeout(() => setSaveSuccessMatchId(null), 2500);

      // Refresh matches data
      const matchesRes = await fetch('/api/predictions');
      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setMatches(matchesData.matches);
      }
    } catch (err: any) {
      setError(err.message || 'Kunne ikke lagre tips');
    } finally {
      setSavingMatchId(null);
    }
  };

  // Filter logic
  const filteredMatches = matches.filter((match) => {
    const matchesSearch = 
      match.teamA.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.teamB.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.stadium.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const isGroup = match.description.toLowerCase().startsWith('group');
    if (stageFilter === 'group' && !isGroup) return false;
    if (stageFilter === 'knockout' && isGroup) return false;

    const hasPrediction = !!match.prediction;
    if (predictionFilter === 'predicted' && !hasPrediction) return false;
    if (predictionFilter === 'missing' && hasPrediction) return false;

    return true;
  });

  const totalPoints = matches.reduce((sum, m) => sum + (m.prediction?.points || 0), 0);
  const predictedCount = matches.filter((m) => !!m.prediction).length;

  // Split matches into active and finished
  const activeMatches = filteredMatches.filter((m) => m.status !== 'finished');
  const finishedMatches = filteredMatches.filter((m) => m.status === 'finished');

  // Find the next upcoming active match to highlight
  const now = new Date();
  const nextUpcomingMatch = [...activeMatches]
    .filter((m) => new Date(m.date) > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const nextUpcomingMatchId = nextUpcomingMatch?.id || null;

  // Group filtered active matches by Date in Oslo local timezone!
  const getOsloDateKey = (dateIsoStr: string) => {
    const d = new Date(dateIsoStr);
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Oslo',
    });
    return formatter.format(d);
  };

  const groupedActiveMatches: Record<string, Match[]> = {};
  activeMatches.forEach((m) => {
    const dateKey = getOsloDateKey(m.date);
    if (!groupedActiveMatches[dateKey]) {
      groupedActiveMatches[dateKey] = [];
    }
    groupedActiveMatches[dateKey].push(m);
  });

  // Sort dates chronologically
  const sortedActiveDates = Object.keys(groupedActiveMatches).sort();

  // Sort finished matches reverse-chronologically
  const sortedFinishedMatches = [...finishedMatches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Format date header (e.g. "torsdag 11. juni")
  const formatOsloDateHeader = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d)); // Parse as UTC to avoid local timezone drift during print
    return new Intl.DateTimeFormat('no-NO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(dateObj);
  };

  const formatOsloKickoffTime = (dateIsoStr: string) => {
    const d = new Date(dateIsoStr);
    return new Intl.DateTimeFormat('no-NO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Oslo',
    }).format(d) + ' (Oslo-tid)';
  };

  // Helper function to render each match card
  const renderMatchCard = (match: Match, isNextUpcoming: boolean) => {
    const draft = draftScores[match.id] || { a: '', b: '' };
    const isDraftComplete = draft.a !== '' && draft.b !== '';
    const hasSaved = !!match.prediction;
    const isLocked = match.isLocked;
    const isFinished = match.status === 'finished';

    // Find who got exact predictions (points === 3)
    const exactTippere = match.predictors?.filter(
      (p) => p.points === 3 || (isFinished && p.predictedScoreA === match.scoreA && p.predictedScoreB === match.scoreB)
    ) || [];

    return (
      <div
        key={match.id}
        className={`glass-card rounded-2xl p-4 flex flex-col gap-3 border transition-all duration-300 relative overflow-hidden ${
          isFinished
            ? 'border-white/5 bg-gray-950/20'
            : isNextUpcoming
            ? 'border-amber-500/40 shadow-lg shadow-amber-500/5 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent'
            : hasSaved
            ? 'border-emerald-500/20 shadow-emerald-500/5'
            : 'border-white/10'
        }`}
      >
        {isNextUpcoming && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
        )}

        {/* Match Header */}
        <div className="flex justify-between items-center text-xs font-semibold text-gray-400">
          <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
            {match.description}
          </span>
          <span className="flex items-center gap-1">
            {isFinished ? (
              <span className="bg-gray-500/10 text-gray-400 px-2 py-0.5 rounded border border-white/5 font-bold text-[9px] uppercase tracking-wider">
                Fullført
              </span>
            ) : isNextUpcoming ? (
              <span className="bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-black text-[9px] uppercase tracking-wider animate-pulse-slow">
                ⭐ Neste Kamp
              </span>
            ) : isLocked ? (
              <>
                <Clock className="h-3 w-3 text-red-400" />
                <span className="text-red-400 font-bold uppercase tracking-wider text-[10px]">Stengt</span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 text-emerald-400 animate-pulse" />
                <span className="text-emerald-400">Åpen for tips</span>
              </>
            )}
          </span>
        </div>

        {/* Main Match Deck Layout */}
        <div className="flex items-center justify-between gap-2 py-2">
          {/* Team A */}
          <div className="flex-1 flex flex-col items-center gap-1.5 text-center">
            <CountryFlag countryName={match.teamA} />
            <span className="text-sm font-bold text-white leading-tight truncate w-full max-w-[100px]" title={match.teamA}>
              {match.teamA}
            </span>
          </div>

          {/* Input Score Area */}
          <div className="flex items-center gap-2">
            <input
              id={`input-${match.id}-teamA`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={isLocked}
              value={draft.a}
              onChange={(e) => handleScoreChange(match.id, 'a', e.target.value)}
              placeholder="- "
              className={`w-12 h-12 rounded-xl text-center font-extrabold text-xl glass-input ${
                isLocked ? 'text-gray-400 cursor-not-allowed border-dashed' : 'text-white'
              }`}
            />
            <span className="text-gray-500 font-bold text-lg">:</span>
            <input
              id={`input-${match.id}-teamB`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={isLocked}
              value={draft.b}
              onChange={(e) => handleScoreChange(match.id, 'b', e.target.value)}
              placeholder="- "
              className={`w-12 h-12 rounded-xl text-center font-extrabold text-xl glass-input ${
                isLocked ? 'text-gray-400 cursor-not-allowed border-dashed' : 'text-white'
              }`}
            />
          </div>

          {/* Team B */}
          <div className="flex-1 flex flex-col items-center gap-1.5 text-center">
            <CountryFlag countryName={match.teamB} />
            <span className="text-sm font-bold text-white leading-tight truncate w-full max-w-[100px]" title={match.teamB}>
              {match.teamB}
            </span>
          </div>
        </div>

        {/* Knockout draw predicted winner selector */}
        {match.id >= 'M073' && draft.a !== '' && draft.b !== '' && draft.a === draft.b && (
          <div className="flex flex-col items-center gap-1.5 py-1.5 bg-black/30 border border-white/5 rounded-xl px-3 animate-fade-in text-center">
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
              Hvem går videre? (Uavgjort tips krever vinner)
            </span>
            <div className="flex gap-2 w-full max-w-[200px]">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => handlePredictedWinnerChange(match.id, 'teamA')}
                className={`flex-1 py-1 rounded text-[10px] font-black uppercase border transition-all cursor-pointer ${
                  draft.winner === 'teamA'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                {match.teamA}
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => handlePredictedWinnerChange(match.id, 'teamB')}
                className={`flex-1 py-1 rounded text-[10px] font-black uppercase border transition-all cursor-pointer ${
                  draft.winner === 'teamB'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:bg-white/10'
                }`}
              >
                {match.teamB}
              </button>
            </div>
          </div>
        )}

        {/* Predictors Avatars List */}
        {match.predictors && match.predictors.length > 0 && (
          <div className="flex items-center gap-2 py-1 border-t border-white/5 pt-2">
            <div className="flex -space-x-1.5 overflow-hidden">
              {match.predictors.slice(0, 5).map((p) => (
                <UserAvatar
                  key={p.userId}
                  name={p.userName}
                  className="w-5 h-5 text-[8px] ring-1.5 ring-gray-900 border-none"
                />
              ))}
              {match.predictors.length > 5 && (
                <div className="inline-block h-5 w-5 rounded-full ring-1.5 ring-gray-900 bg-gray-800 border border-white/10 text-[8px] font-black text-gray-300 flex items-center justify-center select-none">
                  +{match.predictors.length - 5}
                </div>
              )}
            </div>
            <span className="text-[9px] text-gray-400 font-semibold">
              {match.predictors.length} {match.predictors.length === 1 ? 'person har tippet' : 'personer har tippet'}
            </span>
          </div>
        )}

        {/* Consensus Statistics (Folkets tips) */}
        {match.consensus && match.consensus.total > 0 && (
          <div className="py-2 border-t border-white/5 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px] text-gray-400 font-semibold">
              <span className="flex items-center gap-1">📊 Folkets tips ({match.consensus.total} stemmer)</span>
              <div className="flex gap-2 text-[9px] font-bold">
                <span className="text-blue-400">H: {Math.round((match.consensus.winA / match.consensus.total) * 100)}%</span>
                {match.id < 'M073' && (
                  <span className="text-gray-400">U: {Math.round((match.consensus.draw / match.consensus.total) * 100)}%</span>
                )}
                <span className="text-red-400">B: {Math.round((match.consensus.winB / match.consensus.total) * 100)}%</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5 flex">
              <div
                style={{ width: `${(match.consensus.winA / match.consensus.total) * 100}%` }}
                className="h-full bg-blue-500 transition-all duration-500"
                title={`Hjemme: ${Math.round((match.consensus.winA / match.consensus.total) * 100)}%`}
              />
              {match.id < 'M073' && (
                <div
                  style={{ width: `${(match.consensus.draw / match.consensus.total) * 100}%` }}
                  className="h-full bg-gray-500 transition-all duration-500"
                  title={`Uavgjort: ${Math.round((match.consensus.draw / match.consensus.total) * 100)}%`}
                />
              )}
              <div
                style={{ width: `${(match.consensus.winB / match.consensus.total) * 100}%` }}
                className="h-full bg-red-500 transition-all duration-500"
                title={`Borte: ${Math.round((match.consensus.winB / match.consensus.total) * 100)}%`}
              />
            </div>
          </div>
        )}

        {/* Footer & Submit Actions */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1 text-xs">
          <span className="text-[10px] text-gray-500 truncate max-w-[180px]" title={formatOsloKickoffTime(match.date)}>
            {formatOsloKickoffTime(match.date)}
          </span>

          {/* If match is finished, show points and actual results */}
          {isFinished ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-medium">
                FT:{' '}
                <strong className="text-white">
                  {match.scoreA}-{match.scoreB}
                  {match.penaltyScoreA !== null && match.penaltyScoreB !== null && match.penaltyScoreA !== undefined && match.penaltyScoreB !== undefined && (
                    <span className="text-[9px] text-gray-400 font-bold ml-1">
                      ({match.penaltyScoreA}-{match.penaltyScoreB} str)
                    </span>
                  )}
                </strong>
              </span>
              {match.prediction && (
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                    match.prediction.points === 3
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : match.prediction.points === 1
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}
                >
                  {match.prediction.points === 3
                    ? 'Eksakt (+3)'
                    : match.prediction.points === 1
                    ? 'Utfall (+1)'
                    : 'Feil (+0)'}
                </span>
              )}
            </div>
          ) : !isLocked ? (
            <button
              id={`btn-${match.id}-save`}
              onClick={() => handleSavePrediction(match.id)}
              disabled={!isDraftComplete || savingMatchId === match.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                saveSuccessMatchId === match.id
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:pointer-events-none'
              }`}
            >
              {savingMatchId === match.id ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : saveSuccessMatchId === match.id ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 animate-bounce" />
                  <span>Lagret</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>{hasSaved ? 'Oppdater' : 'Tipp'}</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-[10px] uppercase font-bold text-gray-500">
              Tips stengt
            </span>
          )}
        </div>

        {/* Celebration / correct bets notification banner when finished */}
        {isFinished && (
          <div className="mt-1.5 border-t border-white/5 pt-2">
            {match.prediction?.points === 3 ? (
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-emerald-500/15 border border-amber-500/20 text-[11px] text-amber-200 flex flex-col gap-0.5 leading-snug">
                <div className="flex items-center gap-1 font-black uppercase text-[9px] text-amber-400">
                  🎉 Gratulerer!
                </div>
                <div>
                  {match.id >= 'M073' && match.scoreA === match.scoreB ? (
                    <>
                      Du tippet uavgjort <strong>{match.scoreA}-{match.scoreB}</strong> og at{' '}
                      <strong>{match.prediction.predictedWinner === 'teamA' ? match.teamA : match.teamB}</strong> gikk videre! (+3 poeng)
                    </>
                  ) : (
                    <>
                      Du tippet helt eksakt! <strong>{match.scoreA}-{match.scoreB}</strong> (+3 poeng)
                    </>
                  )}
                </div>
                {exactTippere.filter(p => p.userId !== currentUser?.id).length > 0 && (
                  <div className="text-[9px] text-gray-400 mt-1">
                    Andre med eksakt treff: {exactTippere.filter(p => p.userId !== currentUser?.id).map(p => p.userName).join(', ')}
                  </div>
                )}
              </div>
            ) : match.prediction?.points === 1 ? (
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200 flex flex-col gap-0.5 leading-snug">
                <div className="flex items-center gap-1 font-black uppercase text-[9px] text-blue-400">
                  👍 Riktig utfall!
                </div>
                <div>
                  {match.id >= 'M073' && match.scoreA === match.scoreB ? (
                    <>
                      Du tippet riktig lag videre ({match.prediction?.predictedWinner === 'teamA' ? match.teamA : match.teamB}) etter straffer! (+1 poeng)
                    </>
                  ) : (
                    <>
                      Du tippet riktig vinner! (+1 poeng)
                    </>
                  )}
                </div>
                {exactTippere.length > 0 && (
                  <div className="text-[9px] text-gray-400 mt-1">
                    Eksakt treff av: {exactTippere.map(p => p.userName).join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {exactTippere.length > 0 ? (
                  <div className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-[10px] text-emerald-300/80 flex items-center gap-1.5 leading-snug">
                    <span>🎯</span>
                    <div className="truncate w-full">
                      <strong>Eksakt resultat tippet av:</strong>{' '}
                      {exactTippere.map(p => p.userName).join(', ')}
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-[9px] text-gray-500 flex items-center gap-1.5 leading-snug">
                    <span>😅</span>
                    <div>Ingen tippet eksakt resultat denne gangen.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const calculateGroupStandings = () => {
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const standings: Record<string, Record<string, { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number }>> = {};
    
    groups.forEach(g => {
      standings[g] = {};
    });

    const groupStageMatches = matches.filter(m => m.id < 'M073');

    groupStageMatches.forEach(m => {
      const groupName = m.description.replace('Group ', '').trim();
      if (groups.includes(groupName)) {
        if (m.teamA && m.teamA !== 'TBD') {
          if (!standings[groupName][m.teamA]) {
            standings[groupName][m.teamA] = { team: m.teamA, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
          }
        }
        if (m.teamB && m.teamB !== 'TBD') {
          if (!standings[groupName][m.teamB]) {
            standings[groupName][m.teamB] = { team: m.teamB, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
          }
        }
      }
    });

    groupStageMatches.forEach(m => {
      const groupName = m.description.replace('Group ', '').trim();
      if (!groups.includes(groupName)) return;

      if (m.status === 'finished') {
        const scoreA = m.scoreA;
        const scoreB = m.scoreB;

        if (scoreA !== null && scoreB !== null && !isNaN(scoreA) && !isNaN(scoreB)) {
        const teamA = m.teamA;
        const teamB = m.teamB;

        if (standings[groupName][teamA] && standings[groupName][teamB]) {
          standings[groupName][teamA].played++;
          standings[groupName][teamB].played++;

          standings[groupName][teamA].gf += scoreA;
          standings[groupName][teamA].ga += scoreB;
          standings[groupName][teamB].gf += scoreB;
          standings[groupName][teamB].ga += scoreA;

          if (scoreA > scoreB) {
            standings[groupName][teamA].won++;
            standings[groupName][teamA].points += 3;
            standings[groupName][teamB].lost++;
          } else if (scoreA < scoreB) {
            standings[groupName][teamB].won++;
            standings[groupName][teamB].points += 3;
            standings[groupName][teamA].lost++;
          } else {
            standings[groupName][teamA].drawn++;
            standings[groupName][teamA].points += 1;
            standings[groupName][teamB].drawn++;
            standings[groupName][teamB].points += 1;
          }

          standings[groupName][teamA].gd = standings[groupName][teamA].gf - standings[groupName][teamA].ga;
          standings[groupName][teamB].gd = standings[groupName][teamB].gf - standings[groupName][teamB].ga;
        }
      }
      }
    });

    const sortedStandings: Record<string, typeof standings[string][string][]> = {};
    groups.forEach(g => {
      sortedStandings[g] = Object.values(standings[g]).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.team.localeCompare(b.team);
      });
    });

    return sortedStandings;
  };

  const renderStandingsSimulator = () => {
    const standings = calculateGroupStandings();
    
    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-12 max-w-2xl mx-auto w-full">
        {Object.keys(standings).map((groupName) => (
          <div key={groupName} className="glass-panel-light rounded-2xl border border-white/5 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
              <span className="font-black text-white text-xs uppercase tracking-wider">Gruppe {groupName}</span>
              <span className="text-[10px] text-gray-400 font-semibold">Offisiell tabell</span>
            </div>
            
            <div className="p-3 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-gray-500 font-black text-[9px] uppercase border-b border-white/5 pb-1 select-none">
                    <th className="py-1 px-1.5 w-6 text-center">Pos</th>
                    <th className="py-1 px-1.5">Lag</th>
                    <th className="py-1 px-1.5 w-8 text-center">K</th>
                    <th className="py-1 px-1.5 w-10 text-center">MF</th>
                    <th className="py-1 px-1.5 w-8 text-center">P</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {standings[groupName].length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-gray-500">Laster lag...</td>
                    </tr>
                  ) : (
                    standings[groupName].map((row, index) => {
                      const isPromoted = index < 2;
                      return (
                        <tr key={row.team} className="hover:bg-white/5 text-gray-300">
                          <td className="py-2 px-1.5 text-center font-bold">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${
                              isPromoted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800 text-gray-400'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-2 px-1.5 flex items-center gap-1.5 min-w-[100px] truncate">
                            <CountryFlag countryName={row.team} className="w-4 h-4 shrink-0" />
                            <span className="font-bold text-white truncate text-[11px]" title={row.team}>{row.team}</span>
                          </td>
                          <td className="py-2 px-1.5 text-center text-gray-400">{row.played}</td>
                          <td className="py-2 px-1.5 text-center text-gray-400 font-semibold">
                            {row.gd > 0 ? `+${row.gd}` : row.gd}
                          </td>
                          <td className="py-2 px-1.5 text-center font-black text-white">{row.points}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-white/2 px-3 py-1.5 border-t border-white/5 text-[9px] text-gray-500 flex justify-between select-none">
              <span>* Grønne går videre (Topp 2)</span>
              <span>K: Kamper • P: Poeng</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPodiumTab = () => {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto w-full pb-12">
        <div className="glass-panel-light rounded-2xl p-5 border border-white/5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                🏆 Topp 3 (Sluttplassering)
              </h3>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest block mt-0.5">
                Tipp 1., 2. og 3. plass i VM 2026. Låses ved første kampstart.
              </span>
            </div>
            {podiumLocked ? (
              <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-2.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider">
                Låst
              </span>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider animate-pulse-slow">
                Åpen
              </span>
            )}
          </div>

          <div className="space-y-4 pt-1">
            {/* Gold */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl select-none">🥇</span>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-yellow-400 uppercase tracking-wider">1. Plass (Gull)</span>
                  <span className="text-[10px] text-gray-500">Verdensmester</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {podiumGold && <CountryFlag countryName={podiumGold} className="w-6 h-6 shrink-0" />}
                <select
                  value={podiumGold}
                  disabled={podiumLocked}
                  onChange={(e) => setPodiumGold(e.target.value)}
                  className="glass-input text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-900 border-white/10 w-44 text-white"
                >
                  <option value="">Velg lag...</option>
                  {podiumTeams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Silver */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-300/5 border border-slate-300/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl select-none">🥈</span>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-300 uppercase tracking-wider">2. Plass (Sølv)</span>
                  <span className="text-[10px] text-gray-500">Tapende finalist</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {podiumSilver && <CountryFlag countryName={podiumSilver} className="w-6 h-6 shrink-0" />}
                <select
                  value={podiumSilver}
                  disabled={podiumLocked}
                  onChange={(e) => setPodiumSilver(e.target.value)}
                  className="glass-input text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-900 border-white/10 w-44 text-white"
                >
                  <option value="">Velg lag...</option>
                  {podiumTeams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bronze */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-600/5 border border-amber-600/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl select-none">🥉</span>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-amber-500 uppercase tracking-wider">3. Plass (Bronse)</span>
                  <span className="text-[10px] text-gray-500">Vinner av bronsefinalen</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {podiumBronze && <CountryFlag countryName={podiumBronze} className="w-6 h-6 shrink-0" />}
                <select
                  value={podiumBronze}
                  disabled={podiumLocked}
                  onChange={(e) => setPodiumBronze(e.target.value)}
                  className="glass-input text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-900 border-white/10 w-44 text-white"
                >
                  <option value="">Velg lag...</option>
                  {podiumTeams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!podiumLocked && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSavePodium}
                disabled={podiumSaving || !podiumGold || !podiumSilver || !podiumBronze}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-md"
              >
                {podiumSaving ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : podiumSuccess ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 animate-bounce" />
                    <span>Lagret</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Lagre tips (Topp 3)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Other Users Picks List */}
        {podiumLocked && (
          <div className="glass-panel-light rounded-2xl p-5 border border-white/5 space-y-4">
            <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">
              Hva har kollegaene dine tippet?
            </h3>
            
            <div className="space-y-3">
              {otherPodiums.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Ingen andre har registrert vinnertips.</p>
              ) : (
                otherPodiums.map(p => (
                  <div key={p.userId} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar name={p.userName} className="w-7 h-7 text-[10px] font-bold" />
                      <span className="text-xs font-bold text-white truncate max-w-[120px]" title={p.userName}>{p.userName}</span>
                    </div>

                    <div className="flex gap-1.5 shrink-0 text-[10px] font-bold">
                      <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded text-yellow-400 animate-pulse-slow">
                        <span>🥇</span>
                        <span>{p.goldTeam}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-300/10 border border-slate-300/20 px-2 py-0.5 rounded text-slate-300">
                        <span>🥈</span>
                        <span>{p.silverTeam}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-600/10 border border-amber-600/20 px-2 py-0.5 rounded text-amber-500">
                        <span>🥉</span>
                        <span>{p.bronzeTeam}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-400 font-medium">Laster kamper...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Panel */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Kampoversikt</h2>
        <button
          onClick={() => setShowRules(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-gray-300 transition-all cursor-pointer"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Regler & poeng</span>
        </button>
      </div>

      {/* Countdown Panel */}
      <Countdown matches={matches} />

      {/* User Stats Card */}
      <div className="glass-card rounded-2xl p-4 flex flex-col gap-3.5 border-l-4 border-l-blue-500 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Ditt Dashboard</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{totalPoints}</span>
              <span className="text-xs font-bold text-gray-400 uppercase">poeng</span>
            </div>
          </div>
          <div className="text-right space-y-1 relative z-10">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Dine tips</span>
            <div className="text-lg font-bold text-gray-200">
              {predictedCount} <span className="text-xs text-gray-500">/ 104</span>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-1">
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
            <span>Tippeframgang</span>
            <span>{Math.round((predictedCount / 104) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5 border border-white/5">
            <div
              style={{ width: `${(predictedCount / 104) * 100}%` }}
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
            />
          </div>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Tab Navigation */}
      <div className="flex rounded-xl bg-black/30 p-1 border border-white/5 relative z-10 select-none">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'matches'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          ⚽ Kamper
        </button>
        <button
          onClick={() => setActiveTab('standings')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'standings'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          📊 Gruppetabeller
        </button>
        <button
          onClick={() => setActiveTab('podium')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'podium'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🏆 Topp 3
        </button>
      </div>

      {activeTab === 'matches' && (
        <>
          {/* Search & Filter Controls */}
      <div className="space-y-3 glass-panel-light p-3.5 rounded-xl border border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            id="match-search"
            type="text"
            placeholder="Søk på lag, gruppe, stadion..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-input pl-9 pr-3 py-2 text-sm rounded-lg"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <select
              id="filter-stage"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full glass-input px-3 py-2 rounded-lg bg-gray-900 border-white/10"
            >
              <option value="all">Alle runder</option>
              <option value="group">Gruppespill</option>
              <option value="knockout">Sluttspill</option>
            </select>
          </div>
          <div>
            <select
              id="filter-prediction"
              value={predictionFilter}
              onChange={(e) => setPredictionFilter(e.target.value)}
              className="w-full glass-input px-3 py-2 rounded-lg bg-gray-900 border-white/10"
            >
              <option value="all">Alle tips</option>
              <option value="predicted">Tippet</option>
              <option value="missing">Ikke tippet</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950/50 border border-red-500/30 p-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Match Cards Grouped by Date */}
      {sortedActiveDates.length === 0 && sortedFinishedMatches.length === 0 ? (
        <div className="text-center py-12 glass-panel-light rounded-xl border border-white/5">
          <Calendar className="mx-auto h-8 w-8 text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">Ingen kamper funnet med gjeldende filter.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active / Upcoming Matches */}
          {sortedActiveDates.length > 0 && (
            <div className="space-y-6">
              {sortedActiveDates.map((dateKey) => (
                <div key={dateKey} className="space-y-3">
                  {/* Date Header */}
                  <div className="flex items-center gap-2 px-1">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-gray-300 capitalize">
                      {formatOsloDateHeader(dateKey)}
                    </h3>
                  </div>

                  {/* Match Cards */}
                  <div className="space-y-4">
                    {groupedActiveMatches[dateKey].map((match) =>
                      renderMatchCard(match, match.id === nextUpcomingMatchId)
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Finished Matches Section */}
          {sortedFinishedMatches.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between px-1">
                <button
                  onClick={() => setShowFinished(!showFinished)}
                  className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-all cursor-pointer bg-transparent border-0 outline-none"
                >
                  <span>Fullførte kamper ({sortedFinishedMatches.length})</span>
                  <span className="text-xs font-bold text-blue-400">
                    {showFinished ? '[Skjul]' : '[Vis]'}
                  </span>
                </button>
              </div>

              {showFinished && (
                <div className="space-y-4 opacity-80">
                  {sortedFinishedMatches.map((match) =>
                    renderMatchCard(match, false)
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {activeTab === 'standings' && renderStandingsSimulator()}

      {activeTab === 'podium' && renderPodiumTab()}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md glass-card rounded-2xl p-6 border border-white/10 shadow-2xl relative">
            <button
              id="rules-close-btn"
              onClick={() => setShowRules(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              <span>Regler & Poengberegning</span>
            </h3>

            <div className="space-y-4 text-sm text-gray-300 leading-relaxed font-sans">
              <p>
                Bli med i VM-Mania 2026 og tipp kampresultatene! Du kan lagre og endre tipsene dine helt frem til kampstart for hver enkelt kamp.
              </p>

              {/* Group Stage Rules */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">⚽ Gruppespill</h4>
                <div className="space-y-3 bg-white/5 border border-white/5 p-4 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/20 font-bold text-xs shrink-0">
                      3 poeng
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Eksakt resultat</h4>
                      <p className="text-xs text-gray-400">Du tippet nøyaktig riktig målscore (f.eks. tips 2-1, resultat 2-1). Uavgjort er mulig.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/20 font-bold text-xs shrink-0">
                      1 poeng
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Riktig utfall</h4>
                      <p className="text-xs text-gray-400">Du tippet riktig vinner eller uavgjort, men bommet på antall mål.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/20 font-bold text-xs shrink-0">
                      0 poeng
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Feil utfall</h4>
                      <p className="text-xs text-gray-400">Du tippet feil vinner eller feil uavgjort.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Knockout Stage Rules */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 mb-2">🏆 Sluttspill (fra 8-delsfinale)</h4>
                <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl space-y-2 text-xs text-gray-300">
                  <p>
                    I sluttspillet er det <strong className="text-white">ingen uavgjort</strong> – om det er likt etter 90 minutter, spilles det ekstraomganger og eventuelt straffesparkkonkurranse.
                  </p>
                  <p>
                    Du tipper resultatet <strong className="text-white">etter 90 minutter</strong> (ordinær tid). Hvis du tipper uavgjort, må du i tillegg velge <strong className="text-amber-300">«Hvem går videre?»</strong> – altså hvem du tror vinner på straffespark.
                  </p>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/20 font-bold text-[10px] shrink-0">3p</span>
                      <span>Eksakt riktig score (etter 90 min) + riktig lag videre</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/20 font-bold text-[10px] shrink-0">1p</span>
                      <span>Riktig lag videre, men feil score (f.eks. tippet 1-1 + Frankrike, resultat 2-1 til Frankrike etter ekstraomganger)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/20 font-bold text-[10px] shrink-0">0p</span>
                      <span>Feil lag videre</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Podium Rules */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-yellow-400 mb-2">🏆 Vinnertips (Verdensmester)</h4>
                <div className="bg-yellow-500/5 border border-yellow-500/20 p-3 rounded-xl space-y-2 text-xs text-gray-300">
                  <p>
                    Tipp hvilke land som tar 1., 2. og 3. plass i mesterskapet. Tipsene må sendes inn før den aller første kampen i turneringen starter.
                  </p>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/20 font-bold text-[10px] shrink-0">100p</span>
                      <span>Alle 3 riktige (gull, sølv og bronse på nøyaktig riktig plass)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/20 font-bold text-[10px] shrink-0">50p</span>
                      <span>2 av 3 riktige plasseringer</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/20 font-bold text-[10px] shrink-0">25p</span>
                      <span>1 av 3 riktige plasseringer</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 bg-black/20 p-3 rounded-lg border border-white/5">
                <strong>Viktig:</strong> Alle tider er oppgitt i norsk tid (Oslo-tid). Tips stenges automatisk i det kampen starter.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
