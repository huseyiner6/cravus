// src/app/screens/Profile/ProfileEntry.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import ProfileScreen from './Profile/ProfileScreen';
import LoginScreen from '../Auth/LoginScreen';

export default function ProfileEntry() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => sub.subscription?.unsubscribe();
  }, []);

  if (hasSession === null) return null;
  return hasSession ? <ProfileScreen /> : <LoginScreen />;
}