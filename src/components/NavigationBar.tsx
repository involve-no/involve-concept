'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Trophy, CalendarDays, Shield, LogOut } from 'lucide-react';

export default function NavigationBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-md glass-panel border-t border-white/5 py-2.5 px-6 flex items-center justify-between rounded-t-2xl shadow-xl shadow-black/50">
      <Link 
        id="nav-matches"
        href="/" 
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
          pathname === '/' ? 'text-blue-400 scale-105 font-semibold' : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        <CalendarDays className="h-5 w-5" />
        <span className="text-[10px] tracking-wider">Kamper</span>
      </Link>

      <Link 
        id="nav-leaderboard"
        href="/leaderboard" 
        className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
          pathname === '/leaderboard' ? 'text-blue-400 scale-105 font-semibold' : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        <Trophy className="h-5 w-5" />
        <span className="text-[10px] tracking-wider">Tabell</span>
      </Link>

      {isAdmin && (
        <Link 
          id="nav-admin"
          href="/admin" 
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            pathname === '/admin' ? 'text-blue-400 scale-105 font-semibold' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Shield className="h-5 w-5" />
          <span className="text-[10px] tracking-wider">Admin</span>
        </Link>
      )}

      <button 
        id="nav-logout-btn"
        onClick={handleLogout}
        className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-400 active:scale-95 cursor-pointer transition-all"
      >
        <LogOut className="h-5 w-5" />
        <span className="text-[10px] tracking-wider">Logg ut</span>
      </button>
    </nav>
  );
}
