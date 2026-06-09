import React from 'react';

interface UserAvatarProps {
  name: string;
  className?: string;
}

const colorSchemes = [
  'from-blue-500 to-indigo-600 text-white',
  'from-emerald-500 to-teal-600 text-white',
  'from-violet-500 to-purple-600 text-white',
  'from-rose-500 to-pink-600 text-white',
  'from-amber-500 to-orange-600 text-white',
  'from-cyan-500 to-blue-600 text-white',
  'from-fuchsia-500 to-pink-600 text-white',
];

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColorClass(name: string): string {
  if (!name) return colorSchemes[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorSchemes.length;
  return colorSchemes[index];
}

export default function UserAvatar({ name, className = 'w-8 h-8 text-xs' }: UserAvatarProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColorClass(name);

  return (
    <div
      className={`rounded-full bg-gradient-to-tr ${colorClass} flex items-center justify-center font-black tracking-wider shadow-sm select-none shrink-0 border border-white/10 ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}
