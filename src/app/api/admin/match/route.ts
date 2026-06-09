import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { matchId, scoreA, scoreB, penaltyScoreA, penaltyScoreB, status } = await request.json();

    if (!matchId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (status !== 'scheduled' && status !== 'finished') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Check if match exists
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any;
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (status === 'scheduled') {
      // Reset match score, penalties and prediction points
      const updateMatch = db.prepare('UPDATE matches SET scoreA = NULL, scoreB = NULL, penaltyScoreA = NULL, penaltyScoreB = NULL, status = ? WHERE id = ?');
      const updatePredictions = db.prepare('UPDATE predictions SET points = NULL WHERE matchId = ?');

      const runReset = db.transaction(() => {
        updateMatch.run('scheduled', matchId);
        updatePredictions.run(matchId);
      });

      runReset();
      return NextResponse.json({ success: true, message: 'Match score reset successfully' });
    }

    // status is 'finished'
    const actualA = parseInt(scoreA, 10);
    const actualB = parseInt(scoreB, 10);

    if (isNaN(actualA) || isNaN(actualB) || actualA < 0 || actualB < 0) {
      return NextResponse.json({ error: 'Scores must be non-negative integers' }, { status: 400 });
    }

    // If knockout stage and score is a draw, a penalty result is required
    const isKnockout = matchId >= 'M073';
    let pA: number | null = null;
    let pB: number | null = null;

    if (isKnockout && actualA === actualB) {
      if (penaltyScoreA === undefined || penaltyScoreB === undefined || penaltyScoreA === null || penaltyScoreB === null) {
        return NextResponse.json({ error: 'Uavgjorte sluttspillkamper må ha strafferesultat' }, { status: 400 });
      }
      pA = parseInt(penaltyScoreA, 10);
      pB = parseInt(penaltyScoreB, 10);
      if (isNaN(pA) || isNaN(pB) || pA < 0 || pB < 0 || pA === pB) {
        return NextResponse.json({ error: 'Ugyldig strafferesultat (må være forskjellige heltall)' }, { status: 400 });
      }
    }

    // Update match score, penalties and status
    const updateMatch = db.prepare('UPDATE matches SET scoreA = ?, scoreB = ?, penaltyScoreA = ?, penaltyScoreB = ?, status = ? WHERE id = ?');
    
    // Get all predictions for this match
    const predictions = db.prepare('SELECT * FROM predictions WHERE matchId = ?').all(matchId) as any[];

    // Prepare prediction points update
    const updatePredictionPoints = db.prepare('UPDATE predictions SET points = ? WHERE userId = ? AND matchId = ?');

    // Scoring logic helper:
    // - 3 points: Guess exact score (after regular/extra time) AND correct qualifier/winner
    // - 1 point: Guess correct qualifier/winner but wrong score
    // - 0 points: Guess wrong qualifier/winner
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

    // Run update in a transaction
    const runScoring = db.transaction(() => {
      updateMatch.run(actualA, actualB, pA, pB, 'finished', matchId);

      for (const pred of predictions) {
        const points = calculatePoints(
          pred.predictedScoreA,
          pred.predictedScoreB,
          pred.predictedWinner,
          actualA,
          actualB,
          pA,
          pB
        );
        updatePredictionPoints.run(points, pred.userId, matchId);
      }
    });

    runScoring();

    return NextResponse.json({ success: true, message: 'Match score saved and points calculated' });
  } catch (error: any) {
    console.error('Admin Match Scoring Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
