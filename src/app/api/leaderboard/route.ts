import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
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
      ORDER BY totalPoints DESC, exactMatches DESC, u.name ASC
    `).all() as any[];

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
