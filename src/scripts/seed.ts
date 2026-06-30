import fs from 'fs';
import path from 'path';
import { db } from '../lib/db';

interface Match {
  id: string;
  description: string;
  teamA: string;
  teamB: string;
  date: string;
  stadium: string;
  status: string;
  scoreA: number | null;
  scoreB: number | null;
}

function seed() {
  console.log('Starting database seeding...');
  
  const schedulePath = path.resolve(process.cwd(), 'FIFA2026_schedule.json');
  if (!fs.existsSync(schedulePath)) {
    console.error(`Error: Schedule file not found at ${schedulePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(schedulePath, 'utf8');
  const matches: Match[] = JSON.parse(rawData);

  console.log(`Loaded ${matches.length} matches from schedule file.`);

  const insertMatch = db.prepare(`
    INSERT INTO matches (id, description, teamA, teamB, date, stadium, status, scoreA, scoreB)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      description=excluded.description,
      teamA=CASE WHEN excluded.teamA != 'TBD' THEN excluded.teamA ELSE matches.teamA END,
      teamB=CASE WHEN excluded.teamB != 'TBD' THEN excluded.teamB ELSE matches.teamB END,
      date=excluded.date,
      stadium=excluded.stadium
  `);

  // Run in a transaction for maximum speed
  const runTransaction = db.transaction((matchesList: Match[]) => {
    for (const match of matchesList) {
      insertMatch.run(
        match.id,
        match.description,
        match.teamA,
        match.teamB,
        match.date,
        match.stadium,
        match.status || 'scheduled',
        match.scoreA,
        match.scoreB
      );
    }
  });

  try {
    runTransaction(matches);
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
