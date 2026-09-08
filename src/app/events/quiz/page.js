import React from 'react';
import QuizLobbyClient from './QuizLobbyClient';
import { getAuthUser } from '@/lib/api-utils';
import { EventConfigService } from '@/modules/events/services/EventConfigService';

export const dynamic = 'force-dynamic';

export default async function QuizLobbyPage() {
  let currentUser = null;
  try {
    currentUser = await getAuthUser();
  } catch (_e) {
    currentUser = null;
  }

  let config = null;
  try {
    config = await EventConfigService.getEventConfig('quiz');
  } catch (_e) {
    config = null;
  }

  return (
    <QuizLobbyClient
      currentUser={currentUser}
      initialConfig={config}
    />
  );
}
