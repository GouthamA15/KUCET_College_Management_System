import React from 'react';
import EventGuard from '@/modules/events/components/EventGuard';
import TournamentLobby from '@/modules/events/components/TournamentLobby';
import { getAuthUser } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export default async function ChessEventLobbyPage() {
  let currentUser = null;
  try {
    currentUser = await getAuthUser();
  } catch (_e) {
    currentUser = null;
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <EventGuard eventKey="chess" isAdmin={isAdmin}>
          <TournamentLobby eventKey="chess" currentUser={currentUser} />
        </EventGuard>
      </div>
    </div>
  );
}
