import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Self-healing check: calculate points for any predictions that are missing points but the match is finished
    const uncalculated = db.prepare(`
      SELECT p.userId, p.matchId, p.predictedScoreA, p.predictedScoreB, p.predictedWinner,
             m.scoreA, m.scoreB, m.penaltyScoreA, m.penaltyScoreB
      FROM predictions p
      JOIN matches m ON p.matchId = m.id
      WHERE p.points IS NULL AND m.status = 'finished'
    `).all() as any[];

    if (uncalculated.length > 0) {
      const updatePoints = db.prepare('UPDATE predictions SET points = ? WHERE userId = ? AND matchId = ?');
      db.transaction(() => {
        for (const p of uncalculated) {
          let actualWinner = 0;
          if (p.scoreA > p.scoreB) actualWinner = 1;
          else if (p.scoreA < p.scoreB) actualWinner = -1;
          else if (p.penaltyScoreA !== null && p.penaltyScoreB !== null) {
            actualWinner = p.penaltyScoreA > p.penaltyScoreB ? 1 : -1;
          }

          let predictedWinner = 0;
          if (p.predictedScoreA > p.predictedScoreB) predictedWinner = 1;
          else if (p.predictedScoreA < p.predictedScoreB) predictedWinner = -1;
          else if (p.predictedWinner === 'teamA') predictedWinner = 1;
          else if (p.predictedWinner === 'teamB') predictedWinner = -1;

          let points = 0;
          if (predictedWinner === actualWinner) {
            if (p.predictedScoreA === p.scoreA && p.predictedScoreB === p.scoreB) {
              points = 3;
            } else if (p.predictedScoreA === p.predictedScoreB && p.scoreA === p.scoreB) {
              points = 2;
            } else {
              points = 1;
            }
          }
          updatePoints.run(points, p.userId, p.matchId);
        }
      })();
    }

    const leaderboard = db.prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.email,
        COALESCE(SUM(p.points), 0) as totalPoints,
        SUM(CASE WHEN p.points = 3 THEN 1 ELSE 0 END) as exactMatches,
        SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END) as outcomeMatches
      FROM users u
      LEFT JOIN predictions p ON u.id = p.userId
      GROUP BY u.id
    `).all() as any[];

    // Fetch podium results and predictions to add winner points dynamically
    const results = db.prepare('SELECT goldTeam, silverTeam, bronzeTeam FROM podium_results WHERE id = 1').get() as { goldTeam: string; silverTeam: string; bronzeTeam: string } | undefined;
    const hasResults = results && results.goldTeam && results.silverTeam && results.bronzeTeam;

    const podiumPredictions = db.prepare('SELECT userId, goldTeam, silverTeam, bronzeTeam FROM podium_predictions').all() as { userId: number; goldTeam: string; silverTeam: string; bronzeTeam: string }[];
    const podiumMap = new Map(podiumPredictions.map(p => [p.userId, p]));

    const computedLeaderboard = leaderboard.map(user => {
      let podiumPoints = 0;
      const pred = podiumMap.get(user.id);
      
      if (hasResults && pred) {
        let correctCount = 0;
        if (pred.goldTeam === results.goldTeam) correctCount++;
        if (pred.silverTeam === results.silverTeam) correctCount++;
        if (pred.bronzeTeam === results.bronzeTeam) correctCount++;

        if (correctCount === 3) podiumPoints = 100;
        else if (correctCount === 2) podiumPoints = 50;
        else if (correctCount === 1) podiumPoints = 25;
      }

      return {
        ...user,
        totalPoints: user.totalPoints + podiumPoints,
        podiumPoints // Expose it separately in case we want to show it in user details
      };
    });

    // Re-sort leaderboard by totalPoints DESC, exactMatches DESC, name ASC
    computedLeaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactMatches !== a.exactMatches) return b.exactMatches - a.exactMatches;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ leaderboard: computedLeaderboard });
  } catch (error) {
    console.error('Leaderboard GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
