import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = db.prepare('SELECT goldTeam, silverTeam, bronzeTeam FROM podium_results WHERE id = 1').get() as { goldTeam: string; silverTeam: string; bronzeTeam: string } | undefined;
    
    const teamsList = Array.from(new Set([
      ...db.prepare("SELECT teamA FROM matches WHERE teamA != 'TBD' AND teamA NOT LIKE '%/%'").all().map((r: any) => r.teamA),
      ...db.prepare("SELECT teamB FROM matches WHERE teamB != 'TBD' AND teamB NOT LIKE '%/%'").all().map((r: any) => r.teamB)
    ])).filter(Boolean).sort();

    return NextResponse.json({
      results: results || { goldTeam: '', silverTeam: '', bronzeTeam: '' },
      teams: teamsList
    });
  } catch (error) {
    console.error('Admin Podium GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { goldTeam, silverTeam, bronzeTeam } = await request.json();

    if (!goldTeam && !silverTeam && !bronzeTeam) {
      db.prepare('DELETE FROM podium_results WHERE id = 1').run();
      return NextResponse.json({ success: true, message: 'Vinner-resultat nullstilt' });
    }

    if (goldTeam === silverTeam || goldTeam === bronzeTeam || silverTeam === bronzeTeam) {
      return NextResponse.json({ error: 'Du kan ikke velge samme land til flere plasseringer' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO podium_results (id, goldTeam, silverTeam, bronzeTeam)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        goldTeam = excluded.goldTeam,
        silverTeam = excluded.silverTeam,
        bronzeTeam = excluded.bronzeTeam
    `).run(goldTeam || null, silverTeam || null, bronzeTeam || null);

    return NextResponse.json({ success: true, message: 'Vinner-resultat lagret' });
  } catch (error) {
    console.error('Admin Podium POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
