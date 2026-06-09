import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = db.prepare(`
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(p.matchId) as predictionCount,
        COALESCE(SUM(p.points), 0) as totalPoints
      FROM users u
      LEFT JOIN predictions p ON u.id = p.userId
      GROUP BY u.id
      ORDER BY u.name ASC
    `).all() as any[];

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin Users GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await request.json();

    if (!userId || isNaN(parseInt(userId, 10))) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const targetId = parseInt(userId, 10);

    // Prevent admin from deleting themselves
    if (targetId === session.id) {
      return NextResponse.json({ error: 'Du kan ikke slette din egen konto' }, { status: 400 });
    }

    // Delete predictions first, then user
    const deleteUser = db.transaction(() => {
      db.prepare('DELETE FROM predictions WHERE userId = ?').run(targetId);
      db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    });

    deleteUser();

    return NextResponse.json({ success: true, message: 'Bruker slettet' });
  } catch (error) {
    console.error('Admin Users DELETE Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
