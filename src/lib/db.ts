import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

declare global {
  var dbInstance: Database.Database | undefined;
}

const dbPath = path.resolve(process.cwd(), 'data/betting.db');

// Ensure the data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: Database.Database = globalThis.dbInstance || new Database(dbPath);

if (process.env.NODE_ENV !== 'production') {
  globalThis.dbInstance = db;
}

// Enable WAL mode for concurrent read/write performance
db.pragma('journal_mode = WAL');

// Initialize the database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    teamA TEXT NOT NULL,
    teamB TEXT NOT NULL,
    date TEXT NOT NULL,
    stadium TEXT NOT NULL,
    status TEXT NOT NULL,
    scoreA INTEGER DEFAULT NULL,
    scoreB INTEGER DEFAULT NULL,
    penaltyScoreA INTEGER DEFAULT NULL,
    penaltyScoreB INTEGER DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS predictions (
    userId INTEGER NOT NULL,
    matchId TEXT NOT NULL,
    predictedScoreA INTEGER NOT NULL,
    predictedScoreB INTEGER NOT NULL,
    predictedWinner TEXT DEFAULT NULL,
    points INTEGER DEFAULT NULL,
    PRIMARY KEY (userId, matchId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (matchId) REFERENCES matches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS podium_predictions (
    userId INTEGER PRIMARY KEY,
    goldTeam TEXT DEFAULT NULL,
    silverTeam TEXT DEFAULT NULL,
    bronzeTeam TEXT DEFAULT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS podium_results (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    goldTeam TEXT DEFAULT NULL,
    silverTeam TEXT DEFAULT NULL,
    bronzeTeam TEXT DEFAULT NULL
  );
`);

// Safely alter existing database tables for backward compatibility
try {
  db.exec('ALTER TABLE matches ADD COLUMN penaltyScoreA INTEGER DEFAULT NULL');
} catch (e) {}
try {
  db.exec('ALTER TABLE matches ADD COLUMN penaltyScoreB INTEGER DEFAULT NULL');
} catch (e) {}
try {
  db.exec('ALTER TABLE predictions ADD COLUMN predictedWinner TEXT DEFAULT NULL');
} catch (e) {}
