'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertCircle, Save, CheckCircle, RotateCcw, Calendar, Search, RefreshCw } from 'lucide-react';
import CountryFlag from '@/components/CountryFlag';

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
}

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'scheduled', 'finished'
  
  // Scores states
  const [scores, setScores] = useState<Record<string, { a: string; b: string; pa: string; pb: string }>>({});
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [successMatchId, setSuccessMatchId] = useState<string | null>(null);
  const [resetConfirmId, setResetConfirmId] = useState<string | null>(null);
  
  // Sync states
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const router = useRouter();

  const handleAutoSync = async () => {
    setSyncing(true);
    setError('');
    setSyncMessage('');
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kunne ikke synkronisere data');
      }
      setSyncMessage(data.message);
      // Re-fetch matches to update admin dashboard list view
      await verifyAdminAndFetchMatches();
    } catch (err: any) {
      setError(err.message || 'Noe gikk galt under synkronisering');
    } finally {
      setSyncing(false);
    }
  };

  const verifyAdminAndFetchMatches = async () => {
    try {
      // 1. Verify user is admin
      const authRes = await fetch('/api/auth');
      if (!authRes.ok) {
        router.push('/login');
        return;
      }
      const authData = await authRes.json();
      if (!authData.user || !authData.user.isAdmin) {
        router.push('/');
        return;
      }
      setIsAdmin(true);

      // 2. Fetch matches
      const res = await fetch('/api/predictions');
      if (!res.ok) throw new Error('Klarte ikke å hente kamper');
      const data = await res.json();
      setMatches(data.matches);

      // Initialize scores drafts
      const initialScores: Record<string, { a: string; b: string; pa: string; pb: string }> = {};
      data.matches.forEach((m: Match) => {
        initialScores[m.id] = {
          a: m.scoreA !== null ? m.scoreA.toString() : '',
          b: m.scoreB !== null ? m.scoreB.toString() : '',
          pa: m.penaltyScoreA !== null && m.penaltyScoreA !== undefined ? m.penaltyScoreA.toString() : '',
          pb: m.penaltyScoreB !== null && m.penaltyScoreB !== undefined ? m.penaltyScoreB.toString() : '',
        };
      });
      setScores(initialScores);
    } catch (err: any) {
      setError(err.message || 'Noe gikk galt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyAdminAndFetchMatches();
  }, []);

  const handleScoreChange = (matchId: string, team: 'a' | 'b' | 'pa' | 'pb', val: string) => {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: val,
      },
    }));
  };

  const handleSaveScore = async (matchId: string) => {
    const scoreDraft = scores[matchId];
    if (!scoreDraft || scoreDraft.a === '' || scoreDraft.b === '') return;

    // Check if penalty scores are needed
    const isKnockout = matchId >= 'M073';
    const isDraw = scoreDraft.a === scoreDraft.b;
    if (isKnockout && isDraw && (scoreDraft.pa === '' || scoreDraft.pb === '')) {
      setError('Uavgjorte sluttspillkamper må ha strafferesultat');
      return;
    }

    setSavingMatchId(matchId);
    setError('');

    try {
      const res = await fetch('/api/admin/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          scoreA: scoreDraft.a,
          scoreB: scoreDraft.b,
          penaltyScoreA: isKnockout && isDraw ? scoreDraft.pa : null,
          penaltyScoreB: isKnockout && isDraw ? scoreDraft.pb : null,
          status: 'finished',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kunne ikke lagre resultat');
      }

      setSuccessMatchId(matchId);
      setTimeout(() => setSuccessMatchId(null), 2500);

      // Update local match state
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? { 
                ...m, 
                scoreA: parseInt(scoreDraft.a, 10), 
                scoreB: parseInt(scoreDraft.b, 10), 
                penaltyScoreA: isKnockout && isDraw ? parseInt(scoreDraft.pa, 10) : null,
                penaltyScoreB: isKnockout && isDraw ? parseInt(scoreDraft.pb, 10) : null,
                status: 'finished' 
              }
            : m
        )
      );
    } catch (err: any) {
      setError(err.message || 'Kunne ikke lagre resultat');
    } finally {
      setSavingMatchId(null);
    }
  };

  const handleResetMatch = async (matchId: string) => {
    setSavingMatchId(matchId);
    setError('');

    try {
      const res = await fetch('/api/admin/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          status: 'scheduled',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kunne ikke nullstille kamp');
      }

      setScores((prev) => ({
        ...prev,
        [matchId]: { a: '', b: '', pa: '', pb: '' },
      }));

      // Update local match state
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? { ...m, scoreA: null, scoreB: null, penaltyScoreA: null, penaltyScoreB: null, status: 'scheduled' }
            : m
        )
      );
    } catch (err: any) {
      setError(err.message || 'Kunne ikke nullstille kamp');
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

    if (statusFilter === 'scheduled' && match.status !== 'scheduled') return false;
    if (statusFilter === 'finished' && match.status !== 'finished') return false;

    return true;
  });

  // Group filtered matches by Date in Oslo local timezone!
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

  const groupedMatches: Record<string, Match[]> = {};
  filteredMatches.forEach((m) => {
    const dateKey = getOsloDateKey(m.date);
    if (!groupedMatches[dateKey]) {
      groupedMatches[dateKey] = [];
    }
    groupedMatches[dateKey].push(m);
  });

  // Sort dates chronologically
  const sortedDates = Object.keys(groupedMatches).sort();

  const formatOsloDateHeader = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
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

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <span className="text-sm text-gray-400 font-medium">Sjekker administrator-tilgang...</span>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600/20 border border-blue-500/30 p-1.5 rounded-lg">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Adminpanel</h2>
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
              Legg inn kampresultater og beregn poeng
            </p>
          </div>
        </div>

        <button
          id="admin-auto-sync-btn"
          onClick={handleAutoSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-lg shadow-blue-950/20 transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Synkroniserer...' : 'Synk fra openfootball'}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3 glass-panel-light p-3.5 rounded-xl border border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            id="admin-match-search"
            type="text"
            placeholder="Søk på lag, gruppe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-input pl-9 pr-3 py-2 text-sm rounded-lg"
          />
        </div>

        <div>
          <select
            id="admin-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full glass-input px-3 py-2 text-xs rounded-lg bg-gray-900 border-white/10"
          >
            <option value="all">Alle kamper</option>
            <option value="scheduled">Planlagt (Åpen)</option>
            <option value="finished">Avsluttet (Resultat)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950/50 border border-red-500/30 p-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {syncMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-950/50 border border-emerald-500/30 p-3 text-xs text-emerald-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Grouped Match List */}
      {sortedDates.length === 0 ? (
        <div className="text-center py-12 glass-panel-light rounded-xl border border-white/5">
          <p className="text-sm text-gray-500">Ingen kamper funnet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Calendar className="h-4 w-4 text-blue-400" />
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {formatOsloDateHeader(dateKey)}
                </h3>
              </div>

              <div className="space-y-4">
                {groupedMatches[dateKey].map((match) => {
                  const draft = scores[match.id] || { a: '', b: '' };
                  const isDraftComplete = draft.a !== '' && draft.b !== '';
                  const isFinished = match.status === 'finished';

                  return (
                    <div
                      key={match.id}
                      className={`glass-card rounded-2xl p-4 flex flex-col gap-3 border ${
                        isFinished ? 'border-blue-500/10' : 'border-white/10'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex justify-between items-center text-xs font-semibold text-gray-400">
                        <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                          {match.description}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                          isFinished 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {isFinished ? (
                            match.penaltyScoreA !== null && match.penaltyScoreB !== null && match.penaltyScoreA !== undefined && match.penaltyScoreB !== undefined ? (
                              `Avsluttet (e.str. ${match.penaltyScoreA}-${match.penaltyScoreB})`
                            ) : (
                              'Avsluttet'
                            )
                          ) : (
                            'Planlagt'
                          )}
                        </span>
                      </div>

                      {/* Score Inputs */}
                      <div className="flex items-center justify-between gap-2 py-1">
                        <div className="flex-1 flex flex-col items-center gap-1.5 text-center">
                          <CountryFlag countryName={match.teamA} className="w-10 h-10" />
                          <span className="text-xs font-bold text-gray-300 leading-tight truncate w-full max-w-[100px]" title={match.teamA}>
                            {match.teamA}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            id={`admin-input-${match.id}-teamA`}
                            type="text"
                            inputMode="numeric"
                            value={draft.a}
                            onChange={(e) => handleScoreChange(match.id, 'a', e.target.value)}
                            placeholder="-"
                            className="w-10 h-10 rounded-lg text-center font-bold text-base glass-input"
                          />
                          <span className="text-gray-500 font-bold">:</span>
                          <input
                            id={`admin-input-${match.id}-teamB`}
                            type="text"
                            inputMode="numeric"
                            value={draft.b}
                            onChange={(e) => handleScoreChange(match.id, 'b', e.target.value)}
                            placeholder="-"
                            className="w-10 h-10 rounded-lg text-center font-bold text-base glass-input"
                          />
                        </div>

                        <div className="flex-1 flex flex-col items-center gap-1.5 text-center">
                          <CountryFlag countryName={match.teamB} className="w-10 h-10" />
                          <span className="text-xs font-bold text-gray-300 leading-tight truncate w-full max-w-[100px]" title={match.teamB}>
                            {match.teamB}
                          </span>
                        </div>
                      </div>

                      {/* Penalty Shootout Inputs for Knockout Draws */}
                      {match.id >= 'M073' && draft.a !== '' && draft.b !== '' && draft.a === draft.b && (
                        <div className="flex flex-col items-center gap-1.5 py-1.5 bg-black/30 border border-white/5 rounded-xl px-3 animate-fade-in text-center">
                          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
                            Straffesparkkonkurranse (Mål)
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              id={`admin-input-${match.id}-penaltyScoreA`}
                              type="text"
                              inputMode="numeric"
                              value={draft.pa || ''}
                              onChange={(e) => handleScoreChange(match.id, 'pa', e.target.value)}
                              placeholder="str"
                              className="w-12 h-8 rounded-lg text-center font-bold text-xs bg-gray-900 border border-white/10 text-white"
                            />
                            <span className="text-gray-500 font-bold text-xs">:</span>
                            <input
                              id={`admin-input-${match.id}-penaltyScoreB`}
                              type="text"
                              inputMode="numeric"
                              value={draft.pb || ''}
                              onChange={(e) => handleScoreChange(match.id, 'pb', e.target.value)}
                              placeholder="str"
                              className="w-12 h-8 rounded-lg text-center font-bold text-xs bg-gray-900 border border-white/10 text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* Card Footer actions */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1 text-xs">
                        <span className="text-[10px] text-gray-500 truncate max-w-[150px]" title={formatOsloKickoffTime(match.date)}>
                          {formatOsloKickoffTime(match.date)}
                        </span>

                        <div className="flex items-center gap-2">
                          {isFinished && (
                            <div className="flex items-center gap-2">
                              {resetConfirmId === match.id ? (
                                <>
                                  <button
                                    id={`admin-btn-${match.id}-reset-cancel`}
                                    onClick={() => setResetConfirmId(null)}
                                    className="px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                                  >
                                    Avbryt
                                  </button>
                                  <button
                                    id={`admin-btn-${match.id}-reset-confirm`}
                                    onClick={() => {
                                      handleResetMatch(match.id);
                                      setResetConfirmId(null);
                                    }}
                                    disabled={savingMatchId === match.id}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600/90 hover:bg-red-700 text-white shadow-lg shadow-red-950/20 active:scale-95 transition-all cursor-pointer"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span>Bekreft nullstilling</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  id={`admin-btn-${match.id}-reset`}
                                  onClick={() => setResetConfirmId(match.id)}
                                  disabled={savingMatchId === match.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Nullstill</span>
                                </button>
                              )}
                            </div>
                          )}
                          <button
                            id={`admin-btn-${match.id}-save`}
                            onClick={() => handleSaveScore(match.id)}
                            disabled={!isDraftComplete || savingMatchId === match.id || resetConfirmId === match.id}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                              successMatchId === match.id
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:pointer-events-none'
                            }`}
                          >
                            {savingMatchId === match.id ? (
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : successMatchId === match.id ? (
                              <>
                                <CheckCircle className="h-3.5 w-3.5" />
                                <span>Lagret</span>
                              </>
                            ) : (
                              <>
                                <Save className="h-3.5 w-3.5" />
                                <span>{isFinished ? 'Oppdater resultat' : 'Lagre resultat'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
