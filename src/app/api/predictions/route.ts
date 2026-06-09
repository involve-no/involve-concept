import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { translateTeam } from '@/lib/translations';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all matches sorted by date, then id
    const matches = db.prepare('SELECT * FROM matches ORDER BY date ASC, id ASC').all() as any[];
    
    // Get all predictions for the logged-in user
    const predictions = db.prepare('SELECT * FROM predictions WHERE userId = ?').all(session.id) as any[];

    // Get all predictors for all matches
    const allPredictions = db.prepare(`
      SELECT p.matchId, p.predictedScoreA, p.predictedScoreB, p.predictedWinner, p.points, u.id as userId, u.name as userName, u.email as userEmail
      FROM predictions p
      JOIN users u ON p.userId = u.id
    `).all() as { matchId: string; predictedScoreA: number; predictedScoreB: number; predictedWinner: string | null; points: number | null; userId: number; userName: string; userEmail: string }[];

    // Group predictors and calculate consensus by matchId
    const predictorsByMatch: Record<string, { userId: number; userName: string; userEmail: string; predictedScoreA: number; predictedScoreB: number; predictedWinner: string | null; points: number | null }[]> = {};
    const consensusByMatch: Record<string, { winA: number; draw: number; winB: number; total: number }> = {};
    
    allPredictions.forEach((p) => {
      if (!predictorsByMatch[p.matchId]) {
        predictorsByMatch[p.matchId] = [];
      }
      predictorsByMatch[p.matchId].push(p);

      if (!consensusByMatch[p.matchId]) {
        consensusByMatch[p.matchId] = { winA: 0, draw: 0, winB: 0, total: 0 };
      }
      
      consensusByMatch[p.matchId].total++;
      if (p.predictedScoreA > p.predictedScoreB) {
        consensusByMatch[p.matchId].winA++;
      } else if (p.predictedScoreA < p.predictedScoreB) {
        consensusByMatch[p.matchId].winB++;
      } else {
        const isKnockout = p.matchId >= 'M073';
        if (isKnockout) {
          if (p.predictedWinner === 'teamA') {
            consensusByMatch[p.matchId].winA++;
          } else if (p.predictedWinner === 'teamB') {
            consensusByMatch[p.matchId].winB++;
          } else {
            consensusByMatch[p.matchId].draw++;
          }
        } else {
          consensusByMatch[p.matchId].draw++;
        }
      }
    });

    // Map predictions by matchId
    const predictionMap = new Map(predictions.map((p) => [p.matchId, p]));

    const now = new Date();

    const matchesWithPredictions = matches.map((match) => {
      const prediction = predictionMap.get(match.id);
      
      // Lock predictions exactly at match kickoff time
      const isLocked = now >= new Date(match.date);

      // Map predictors list
      const predictorsList = (predictorsByMatch[match.id] || []).map(p => ({
        userId: p.userId,
        userName: p.userName,
        userEmail: p.userEmail,
        // Only share actual predictions/points when the match is locked/kick-off passed
        predictedScoreA: isLocked ? p.predictedScoreA : undefined,
        predictedScoreB: isLocked ? p.predictedScoreB : undefined,
        predictedWinner: isLocked ? p.predictedWinner : undefined,
        points: isLocked ? p.points : undefined,
      }));

      return {
        id: match.id,
        description: match.description,
        teamA: translateTeam(match.teamA),
        teamB: translateTeam(match.teamB),
        date: match.date,
        stadium: match.stadium,
        status: match.status,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        penaltyScoreA: match.penaltyScoreA,
        penaltyScoreB: match.penaltyScoreB,
        isLocked,
        prediction: prediction
          ? {
              predictedScoreA: prediction.predictedScoreA,
              predictedScoreB: prediction.predictedScoreB,
              predictedWinner: prediction.predictedWinner,
              points: prediction.points,
            }
          : null,
        predictors: predictorsList,
        consensus: consensusByMatch[match.id] || { winA: 0, draw: 0, winB: 0, total: 0 }
      };
    });

    return NextResponse.json({ matches: matchesWithPredictions });
  } catch (error) {
    console.error('Predictions GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { matchId, predictedScoreA, predictedScoreB, predictedWinner } = await request.json();

    if (!matchId || predictedScoreA === undefined || predictedScoreB === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const scoreA = parseInt(predictedScoreA, 10);
    const scoreB = parseInt(predictedScoreB, 10);

    if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
      return NextResponse.json({ error: 'Invalid scores (must be non-negative integers)' }, { status: 400 });
    }

    // Check if match exists
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any;
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Check locking mechanism (lock exactly at kickoff time)
    const now = new Date();
    const isLocked = now >= new Date(match.date);

    if (isLocked) {
      return NextResponse.json({ error: 'Predictions for this match are locked' }, { status: 400 });
    }

    // If knockout stage and score is a draw, a predicted winner must be specified
    const isKnockout = matchId >= 'M073';
    let finalWinner = null;
    if (isKnockout) {
      if (scoreA > scoreB) {
        finalWinner = 'teamA';
      } else if (scoreA < scoreB) {
        finalWinner = 'teamB';
      } else {
        // Draw: must provide teamA or teamB as progress winner
        if (predictedWinner !== 'teamA' && predictedWinner !== 'teamB') {
          return NextResponse.json({ error: 'Du må velge et lag som går videre ved uavgjort tips' }, { status: 400 });
        }
        finalWinner = predictedWinner;
      }
    }

    // Upsert prediction
    db.prepare(`
      INSERT INTO predictions (userId, matchId, predictedScoreA, predictedScoreB, predictedWinner)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(userId, matchId) DO UPDATE SET
        predictedScoreA = excluded.predictedScoreA,
        predictedScoreB = excluded.predictedScoreB,
        predictedWinner = excluded.predictedWinner
    `).run(session.id, matchId, scoreA, scoreB, finalWinner);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Predictions POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
