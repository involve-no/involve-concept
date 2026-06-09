import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setSession, getSession, deleteSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user: session });
}

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      return NextResponse.json({ error: 'Name and email cannot be empty' }, { status: 400 });
    }

    // Check if user exists or register them
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(trimmedEmail) as { id: number; name: string; email: string } | undefined;

    if (!user) {
      const result = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run(trimmedName, trimmedEmail);
      user = {
        id: result.lastInsertRowid as number,
        name: trimmedName,
        email: trimmedEmail,
      };
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
    const isAdmin = trimmedEmail === adminEmail.toLowerCase();

    const sessionData = {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin,
    };

    await setSession(sessionData);

    return NextResponse.json({ success: true, user: sessionData });
  } catch (error: any) {
    console.error('Auth API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  await deleteSession();
  return NextResponse.json({ success: true });
}
