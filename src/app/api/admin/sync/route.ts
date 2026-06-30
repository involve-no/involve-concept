import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

const openFootballToDbTeams: Record<string, string> = {
  'south korea': 'Rep. of Korea',
  'rep. of korea': 'Rep. of Korea',
  'czech republic': 'Czech Rep.',
  'czech rep.': 'Czech Rep.',
  'bosnia & herzegovina': 'Bosnia/Herzeg.',
  'bosnia/herzeg.': 'Bosnia/Herzeg.',
  'bosnia and herzegovina': 'Bosnia/Herzeg.',
  'iran': 'IR Iran',
  'ir iran': 'IR Iran',
  'cote d\'ivoire': 'Ivory Coast',
  'ivory coast': 'Ivory Coast',
  'united states': 'USA',
  'usa': 'USA',
  'dr congo': 'DR Congo',
  'congo dr': 'DR Congo',
  'cape verde': 'Cape Verde',
  'cabo verde': 'Cape Verde',
};

function normalizeTeam(name: string): string {
  if (!name) return '';
  const norm = name.trim().toLowerCase();
  return openFootballToDbTeams[norm] || name.trim();
}

const isPlaceholder = (name: string): boolean => {
  if (!name) return true;
  const clean = name.trim().toUpperCase();
  if (clean === 'TBD') return true;
  if (/^\d+[A-L]/i.test(clean)) return true;
  if (/^[WL]\d+/i.test(clean)) return true;
  if (clean.includes('/') || clean.includes('WINNER') || clean.includes('LOSER') || clean.includes('RUNNER')) return true;
  return false;
};

const calculatePoints = (
  predA: number,
  predB: number,
  predWinner: string | null,
  actA: number,
  actB: number,
  actPA: number | null,
  actPB: number | null
): number => {
  // 1. Determine actual winner (1 for Team A, -1 for Team B, 0 for Group Draw)
  let actualWinner = 0;
  if (actA > actB) {
    actualWinner = 1;
  } else if (actA < actB) {
    actualWinner = -1;
  } else if (actPA !== null && actPB !== null) {
    actualWinner = actPA > actPB ? 1 : -1;
  }

  // 2. Determine predicted winner (1 for Team A, -1 for Team B, 0 for Group Draw)
  let predictedWinner = 0;
  if (predA > predB) {
    predictedWinner = 1;
  } else if (predA < predB) {
    predictedWinner = -1;
  } else if (predWinner === 'teamA') {
    predictedWinner = 1;
  } else if (predWinner === 'teamB') {
    predictedWinner = -1;
  }

  // If predicted winner is wrong, 0 points
  if (predictedWinner !== actualWinner) {
    return 0;
  }

  // Guessing exact score + correct winner
  if (predA === actA && predB === actB) {
    return 3;
  }

  return 1;
};

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  let isAuthorized = !!(session && session.isAdmin);

  if (!isAuthorized) {
    const authHeader = request.headers.get('Authorization');
    const syncToken = process.env.SYNC_TOKEN;
    if (syncToken && authHeader === `Bearer ${syncToken}`) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ofUrl = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
    const response = await fetch(ofUrl, { cache: 'no-store' });
    
    if (!response.ok) {
      return NextResponse.json({ error: `Klarte ikke å hente data fra openfootball (Status: ${response.status})` }, { status: 502 });
    }

    const data = await response.json();
    if (!data.matches || !Array.isArray(data.matches)) {
      return NextResponse.json({ error: 'Ugyldig dataformat fra openfootball' }, { status: 502 });
    }

    const dbGroupMatches = db.prepare("SELECT * FROM matches WHERE id < 'M073'").all() as any[];
    const dbKnockoutMatches = db.prepare("SELECT * FROM matches WHERE id >= 'M073' ORDER BY id ASC").all() as any[];

    let scoresSynced = 0;
    let teamsSynced = 0;

    const updateMatchScoreStmt = db.prepare('UPDATE matches SET scoreA = ?, scoreB = ?, penaltyScoreA = ?, penaltyScoreB = ?, status = ? WHERE id = ?');
    const updateMatchTeamsStmt = db.prepare('UPDATE matches SET teamA = ?, teamB = ? WHERE id = ?');
    const updateMatchTeamsAndScoreStmt = db.prepare('UPDATE matches SET teamA = ?, teamB = ?, scoreA = ?, scoreB = ?, penaltyScoreA = ?, penaltyScoreB = ?, status = ? WHERE id = ?');
    const getPredictionsStmt = db.prepare('SELECT * FROM predictions WHERE matchId = ?');
    const updatePredictionPointsStmt = db.prepare('UPDATE predictions SET points = ? WHERE userId = ? AND matchId = ?');

    const runSync = db.transaction(() => {
      for (let i = 0; i < data.matches.length; i++) {
        const ofM = data.matches[i];
        let dbMatch = null;

        if (i < 72) {
          // Group stage match
          dbMatch = dbGroupMatches.find(dbM => {
            const dbA = normalizeTeam(dbM.teamA).toLowerCase();
            const dbB = normalizeTeam(dbM.teamB).toLowerCase();
            const of1 = normalizeTeam(ofM.team1).toLowerCase();
            const of2 = normalizeTeam(ofM.team2).toLowerCase();
            return (dbA === of1 && dbB === of2) || (dbA === of2 && dbB === of1);
          });
        } else {
          // Knockout stage match (maps directly by index relative to 72)
          dbMatch = dbKnockoutMatches[i - 72];
        }

        if (!dbMatch) continue;

        let teamAUpdated = dbMatch.teamA;
        let teamBUpdated = dbMatch.teamB;
        let teamChanged = false;

        // Knockout matches: populate qualified team names if openfootball has them
        if (dbMatch.id >= 'M073') {
          const ofTeam1 = ofM.team1;
          const ofTeam2 = ofM.team2;
          
          if (!isPlaceholder(ofTeam1) && !isPlaceholder(ofTeam2)) {
            const normOf1 = normalizeTeam(ofTeam1);
            const normOf2 = normalizeTeam(ofTeam2);
            if (dbMatch.teamA !== normOf1 || dbMatch.teamB !== normOf2) {
              teamAUpdated = normOf1;
              teamBUpdated = normOf2;
              teamChanged = true;
            }
          }
        }

        const hasScore = ofM.score && (ofM.score.et || ofM.score.ft) && (ofM.score.et?.length === 2 || ofM.score.ft?.length === 2);
        if (hasScore) {
          const finalScoreArray = (ofM.score.et && ofM.score.et.length === 2) ? ofM.score.et : ofM.score.ft;
          const actA = finalScoreArray[0];
          const actB = finalScoreArray[1];
          const penaltyScoreArray = ofM.score.p || ofM.score.ps;
          const actPA = (penaltyScoreArray && penaltyScoreArray.length === 2) ? penaltyScoreArray[0] : null;
          const actPB = (penaltyScoreArray && penaltyScoreArray.length === 2) ? penaltyScoreArray[1] : null;

          if (actA !== null && actA !== undefined && actB !== null && actB !== undefined && !isNaN(actA) && !isNaN(actB)) {
            // Update score if match is not finished, or score/penalties/teams changed
            if (
              dbMatch.status !== 'finished' || 
              dbMatch.scoreA !== actA || 
              dbMatch.scoreB !== actB ||
              dbMatch.penaltyScoreA !== actPA ||
              dbMatch.penaltyScoreB !== actPB ||
              teamChanged
            ) {
              if (teamChanged) {
                updateMatchTeamsAndScoreStmt.run(teamAUpdated, teamBUpdated, actA, actB, actPA, actPB, 'finished', dbMatch.id);
                teamsSynced++;
              } else {
                updateMatchScoreStmt.run(actA, actB, actPA, actPB, 'finished', dbMatch.id);
              }

              // Recalculate points for all predictions of this match
              const predictions = getPredictionsStmt.all(dbMatch.id) as any[];
              for (const pred of predictions) {
                const points = calculatePoints(
                  pred.predictedScoreA,
                  pred.predictedScoreB,
                  pred.predictedWinner,
                  actA,
                  actB,
                  actPA,
                  actPB
                );
                updatePredictionPointsStmt.run(points, pred.userId, dbMatch.id);
              }
              scoresSynced++;
            }
          }
        } else if (teamChanged) {
          updateMatchTeamsStmt.run(teamAUpdated, teamBUpdated, dbMatch.id);
          teamsSynced++;
        }
      }
    });

    runSync();

    return NextResponse.json({
      success: true,
      scoresSynced,
      teamsSynced,
      message: `Synkronisering fullført. Synkroniserte ${scoresSynced} resultater og ${teamsSynced} knockout-lag.`,
    });

  } catch (error: any) {
    console.error('Match Sync Error:', error);
    return NextResponse.json({ error: 'Kunne ikke synkronisere data' }, { status: 500 });
  }
}
