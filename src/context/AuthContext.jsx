import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthContext } from './authContextInstance';

async function ensurePlayerRecord(userObj) {
  if (!userObj?.id) return false;

  const metadata = userObj.user_metadata || {};

  const { data: existingPlayer, error: existingPlayerError } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', userObj.id)
    .maybeSingle();

  if (existingPlayerError) {
    console.error('Error buscando ficha existente del player:', existingPlayerError);
    return false;
  }

  if (existingPlayer) {
    return true;
  }

  const { error: playerInsertError } = await supabase.from('players').insert({
    profile_id: userObj.id,
    user_id: userObj.id,
    first_name: metadata.first_name || '',
    last_name: metadata.last_name || '',
    dni: metadata.dni || '',
    birth_date: metadata.birth_date || null,
    category: metadata.category || '',
    phone: metadata.phone || null,
    email: userObj.email || null,
    address: metadata.address || null,
    payment_status: false,
    last_payment_date: null,
    notes: null,
  });

  if (playerInsertError) {
    console.error('Error creando ficha de player desde metadata:', playerInsertError);
    return false;
  }

  return true;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const bootstrapPlayerProfile = useCallback(async (userObj) => {
    if (!userObj?.id) return null;

    const metadata = userObj.user_metadata || {};

    if (metadata.role !== 'player') {
      return null;
    }

    const { error: profileUpsertError } = await supabase.from('profiles').upsert(
      { id: userObj.id, role: 'player' },
      { onConflict: 'id' }
    );

    if (profileUpsertError) {
      console.error('Error creando profile de player desde metadata:', profileUpsertError);
      return null;
    }

    await ensurePlayerRecord(userObj);

    return { id: userObj.id, role: 'player' };
  }, []);

  const loadProfile = useCallback(async (userObj) => {
    const userId = userObj?.id;

    if (!userId) {
      setProfile(null);
      setProfileLoaded(true);
      return null;
    }

    setProfileLoaded(false);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error cargando profile:', error);
      setProfile(null);
      setProfileLoaded(true);
      return null;
    }

    if (!data) {
      const bootstrappedProfile = await bootstrapPlayerProfile(userObj);

      if (bootstrappedProfile) {
        setProfile(bootstrappedProfile);
        setProfileLoaded(true);
        return bootstrappedProfile;
      }
    }

    if (data?.role === 'player') {
      await ensurePlayerRecord(userObj);
    }

    setProfile(data);
    setProfileLoaded(true);
    return data;
  }, [bootstrapPlayerProfile]);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        setLoading(true);

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error obteniendo sesiÃ³n:', error);
        }

        const currentSession = data?.session ?? null;
        const currentUser = currentSession?.user ?? null;

        if (!isMounted) return;

        setSession(currentSession);
        setUser(currentUser);

        if (currentUser) {
          await loadProfile(currentUser);
        } else {
          setProfile(null);
          setProfileLoaded(true);
        }
      } catch (error) {
        console.error('Error inesperado cargando auth:', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileLoaded(true);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const currentUser = newSession?.user ?? null;

      setSession(newSession);
      setUser(currentUser);

      if (currentUser) {
        loadProfile(currentUser);
      } else {
        setProfile(null);
        setProfileLoaded(true);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error cerrando sesiÃ³n:', error);
      throw error;
    }

    setSession(null);
    setUser(null);
    setProfile(null);
  }

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      profileLoaded,
      isAuthenticated: Boolean(user),
      role: profile?.role || null,
      isAdmin: profile?.role === 'admin',
      isPlayer: profile?.role === 'player',
      refreshProfile: () => loadProfile(user),
      signOut,
    }),
    [session, user, profile, loading, profileLoaded, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

