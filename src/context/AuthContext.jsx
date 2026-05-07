import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  async function loadProfile(userId) {
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

    setProfile(data);
    setProfileLoaded(true);
    return data;
  }

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        setLoading(true);

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error obteniendo sesión:', error);
        }

        const currentSession = data?.session ?? null;
        const currentUser = currentSession?.user ?? null;

        if (!isMounted) return;

        setSession(currentSession);
        setUser(currentUser);

        if (currentUser) {
          await loadProfile(currentUser.id);
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
        loadProfile(currentUser.id);
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
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error cerrando sesión:', error);
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
      refreshProfile: () => loadProfile(user?.id),
      signOut,
    }),
    [session, user, profile, loading, profileLoaded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}
