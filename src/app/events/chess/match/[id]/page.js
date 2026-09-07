import React from 'react';
import EventGuard from '@/modules/events/components/EventGuard';
import ChessGameView from '@/modules/events/games/chess/ChessGameView';
import { getAuthUser } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export default async function ChessMatchArenaPage({ params }) {
  const resolvedParams = await params;
  const matchId = resolvedParams.id;

  let currentUser = null;
  try {
    currentUser = await getAuthUser();
  } catch (_e) {
    currentUser = null;
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <EventGuard eventKey="chess" isAdmin={isAdmin}>
      <ChessGameView matchId={matchId} currentUser={currentUser} />
    </EventGuard>
  );
}
