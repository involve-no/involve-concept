import { db } from '../lib/db';

const calculatePoints = (
  predA: number,
  predB: number,
  predWinner: string | null,
  actA: number,
  actB: number,
  actPA: number | null,
  actPB: number | null
): number => {
  let actualWinner = 0;
  if (actA > actB) {
    actualWinner = 1;
  } else if (actA < actB) {
    actualWinner = -1;
  } else if (actPA !== null && actPB !== null) {
    actualWinner = actPA > actPB ? 1 : -1;
  }

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

  if (predictedWinner !== actualWinner) {
    return 0;
  }

  if (predA === actA && predB === actB) {
    return 3;
  }

  if (predA === predB && actA === actB) {
    return 2;
  }

  return 1;
};

function runRecalculation() {
  console.log('Running points recalculation for all finished matches...');
  const predictions = db.prepare(`
    SELECT p.userId, p.matchId, p.predictedScoreA, p.predictedScoreB, p.predictedWinner, p.points,
           m.scoreA, m.scoreB, m.penaltyScoreA, m.penaltyScoreB
    FROM predictions p
    JOIN matches m ON p.matchId = m.id
    WHERE m.status = 'finished'
  `).all() as any[];

  console.log(`Found ${predictions.length} predictions to check.`);

  const updateStmt = db.prepare('UPDATE predictions SET points = ? WHERE userId = ? AND matchId = ?');

  let updatedCount = 0;

  db.transaction(() => {
    for (const p of predictions) {
      const newPoints = calculatePoints(
        p.predictedScoreA,
        p.predictedScoreB,
        p.predictedWinner,
        p.scoreA,
        p.scoreB,
        p.penaltyScoreA,
        p.penaltyScoreB
      );

      if (p.points !== newPoints) {
        console.log(`Updating Match ${p.matchId} User ${p.userId}: points updated from ${p.points} to ${newPoints}`);
        updateStmt.run(newPoints, p.userId, p.matchId);
        updatedCount++;
      }
    }
  })();

  console.log(`Points recalculation complete. Updated ${updatedCount} predictions.`);
}

try {
  runRecalculation();
} catch (error) {
  console.error('Points recalculation failed:', error);
}
