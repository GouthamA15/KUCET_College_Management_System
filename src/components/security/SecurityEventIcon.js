import React from 'react';
import { Globe, Mail, Lock, History } from 'lucide-react';

export function SecurityEventIcon({ type }) {
  switch (type) {
    case 'LOGIN_SUCCESS': return <Globe size={14} />;
    case 'EMAIL_VERIFIED': return <Mail size={14} />;
    case 'PASSWORD_CHANGED':
    case 'PASSWORD_CREATED': return <Lock size={14} />;
    default: return <History size={14} />;
  }
}
