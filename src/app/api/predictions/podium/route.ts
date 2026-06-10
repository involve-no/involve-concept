import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const firstMatch = db.prepare('SELECT date FROM matches ORDER BY date ASC LIMIT 1').get() as { date: string } | undefined;
    const isLocked = firstMatch ? new Date() >= new Date(firstMatch.date) : false;

    const teamsList = Array.from(new Set([
      ...db.prepare("SELECT teamA FROM matches WHERE teamA != 'TBD' AND teamA NOT LIKE '%/%'").all().map((r: any) => r.teamA),
      ...db.prepare("SELECT teamB FROM matches WHERE teamB != 'TBD' AND teamB NOT LIKE '%/%'").all().map((r: any) => r.teamB)
    ])).filter(Boolean).sort();

    const prediction = db.prepare('SELECT goldTeam, silverTeam, bronzeTeam FROM podium_predictions WHERE userId = ?').get(session.id) as { goldTeam: string; silverTeam: string; bronzeTeam: string } | undefined;

    let otherUsersPicks: any[] = [];
    if (isLocked) {
      otherUsersPicks = db.prepare(`
        SELECT u.id as userId, u.name as userName, p.goldTeam, p.silverTeam, p.bronzeTeam
        FROM podium_predictions p
        JOIN users u ON p.userId = u.id
        WHERE p.userId != ?
      `).all(session.id) as any[];
    }

    return NextResponse.json({
      isLocked,
      teams: teamsList,
      prediction: prediction || { goldTeam: '', silverTeam: '', bronzeTeam: '' },
      otherUsersPicks
    });
  } catch (error) {
    console.error('Podium GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const firstMatch = db.prepare('SELECT date FROM matches ORDER BY date ASC LIMIT 1').get() as { date: string } | undefined;
    const isLocked = firstMatch ? new Date() >= new Date(firstMatch.date) : false;

    if (isLocked) {
      return NextResponse.json({ error: 'Vinnertips er låst. Turneringen har startet.' }, { status: 400 });
    }

    const { goldTeam, silverTeam, bronzeTeam } = await request.json();

    if (!goldTeam || !silverTeam || !bronzeTeam) {
      return NextResponse.json({ error: 'Du må velge både gull, sølv og bronse' }, { status: 400 });
    }

    if (goldTeam === silverTeam || goldTeam === bronzeTeam || silverTeam === bronzeTeam) {
      return NextResponse.json({ error: 'Du kan ikke velge samme land til flere plasseringer' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO podium_predictions (userId, goldTeam, silverTeam, bronzeTeam)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET
        goldTeam = excluded.goldTeam,
        silverTeam = excluded.silverTeam,
        bronzeTeam = excluded.bronzeTeam
    `).run(session.id, goldTeam, silverTeam, bronzeTeam);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Podium POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
