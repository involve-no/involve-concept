import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import NavigationBar from '@/components/NavigationBar';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-start text-white">
      {/* Container simulating a mobile phone on desktop, taking full height */}
      <div className="w-full max-w-md min-h-screen bg-gray-950/80 border-x border-white/5 shadow-2xl flex flex-col relative pb-20">
        
        {/* Sticky Header */}
        <header className="sticky top-0 z-40 glass-panel px-4 py-3.5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black bg-gradient-to-r from-blue-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent">
              VM-Mania 2026
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
            <span className="font-semibold text-gray-300 truncate max-w-[80px]" title={session.name}>
              {session.name}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 overflow-y-auto">
          {children}
        </main>

        {/* Persistent Bottom Navbar */}
        <NavigationBar isAdmin={session.isAdmin} />
      </div>
    </div>
  );
}
