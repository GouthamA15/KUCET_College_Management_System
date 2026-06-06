import { getEmailProvider } from './email/factory';
import { getStorageProvider } from './storage/factory';
import { getRealtimeProvider } from './realtime/factory';

export const email = getEmailProvider();
export const storage = getStorageProvider();
export const realtime = getRealtimeProvider();
