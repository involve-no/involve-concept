import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { translateTeam } from '@/lib/translations';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await params;
    const targetUserId = parseInt(userId, 10);
    
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: 'Invalid User ID' }, { status: 400 });
    }

    // Fetch user details
    const targetUser = db.prepare('SELECT name FROM users WHERE id = ?').get(targetUserId) as { name: string } | undefined;
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all matches sorted by date, then id
    const matches = db.prepare('SELECT * FROM matches ORDER BY date ASC, id ASC').all() as any[];
    
    // Get all predictions for the target user
    const predictions = db.prepare('SELECT * FROM predictions WHERE userId = ?').all(targetUserId) as any[];

    // Map predictions by matchId
    const predictionMap = new Map(predictions.map((p) => [p.matchId, p]));

    const now = new Date();

    const matchesWithPredictions = matches.map((match) => {
      const prediction = predictionMap.get(match.id);
      const isLocked = now >= new Date(match.date);

      // Return the prediction data regardless of whether the match is locked
      let predictionData = null;
      if (prediction) {
        predictionData = {
          predictedScoreA: prediction.predictedScoreA,
          predictedScoreB: prediction.predictedScoreB,
          predictedWinner: prediction.predictedWinner,
          points: prediction.points,
        };
      }

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
        prediction: predictionData,
      };
    });

    const firstMatch = db.prepare('SELECT date FROM matches ORDER BY date ASC LIMIT 1').get() as { date: string } | undefined;
    const isLockedFirstMatch = firstMatch ? new Date() >= new Date(firstMatch.date) : false;
    const isSelf = session.id === targetUserId;

    let podiumPrediction = null;
    if (isSelf || isLockedFirstMatch) {
      podiumPrediction = db.prepare('SELECT goldTeam, silverTeam, bronzeTeam FROM podium_predictions WHERE userId = ?').get(targetUserId) as { goldTeam: string; silverTeam: string; bronzeTeam: string } | undefined;
    }

    return NextResponse.json({ 
      userName: targetUser.name, 
      matches: matchesWithPredictions,
      podiumPrediction: podiumPrediction || null
    });
  } catch (error) {
    console.error('Predictions for user GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
