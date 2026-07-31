import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { supabase } from '../lib/supabaseClient';
import { getEffectivePaymentStatus } from '../utils/paymentPeriod';
import { getPlayerCompleteness } from '../utils/playerCompleteness';
import appLogo from '../assets/logo.svg';

function formatDate(value) {
  if (!value) return '-';

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const date = dateOnlyMatch ? new Date(`${value}T00:00:00`) : new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-AR');
}

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value) {
  const amount = Number(value);

  if (Number.isNaN(amount)) return '$ 0';

  return amount.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}

function addOneMonth(dateValue) {
  if (!dateValue) return null;

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue));
  const date = dateOnlyMatch ? new Date(`${dateValue}T00:00:00`) : new Date(dateValue);

  if (Number.isNaN(date.getTime())) return null;

  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + 1);
  return nextDate;
}

function Dashboard() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [playerTeams, setPlayerTeams] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [paymentNotifications, setPaymentNotifications] = useState([]);
  const [paymentNotificationsLoading, setPaymentNotificationsLoading] = useState(true);
  const [paymentNotificationsError, setPaymentNotificationsError] = useState('');
  const [livePaymentNotice, setLivePaymentNotice] = useState('');

  const loadPaymentNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setPaymentNotificationsLoading(true);
    }
    setPaymentNotificationsError('');

    const { data: paymentsData, error: paymentsError } = await supabase
      .from('player_payments')
      .select('id, player_id, amount, payment_date, method, period, status, created_at')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(8);

    if (paymentsError) {
      console.error('Error cargando notificaciones de pagos:', paymentsError);
      setPaymentNotificationsError('No se pudieron cargar las notificaciones de pagos.');
      setPaymentNotificationsLoading(false);
      return;
    }

    const playerIds = [...new Set((paymentsData || []).map((payment) => payment.player_id).filter(Boolean))];
    let playersById = {};

    if (playerIds.length > 0) {
      const { data: paymentPlayersData, error: paymentPlayersError } = await supabase
        .from('players')
        .select('id, first_name, last_name, category')
        .in('id', playerIds);

      if (paymentPlayersError) {
        console.error('Error cargando jugadores de pagos:', paymentPlayersError);
      } else {
        playersById = (paymentPlayersData || []).reduce((acc, player) => {
          acc[player.id] = player;
          return acc;
        }, {});
      }
    }

    setPaymentNotifications(
      (paymentsData || []).map((payment) => ({
        ...payment,
        player: playersById[payment.player_id] || null,
      }))
    );
    setPaymentNotificationsLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      setSummaryLoading(true);
      setSummaryError('');

      const [
        { data: playersData, error: playersError },
        { data: teamsData, error: teamsError },
        { data: playerTeamsData, error: playerTeamsError },
      ] = await Promise.all([
        supabase
          .from('players')
          .select(
            'id, first_name, last_name, payment_status, last_payment_date, is_active, photo_url, photo_thumb_url, dni, birth_date, category, phone, email, address'
          ),
        supabase.from('teams').select('id, name, slug, is_active').order('name', {
          ascending: true,
        }),
        supabase.from('player_teams').select('player_id, team_id'),
      ]);

      if (!isMounted) return;

      if (playersError || teamsError || playerTeamsError) {
        console.error('Error cargando resumen:', playersError || teamsError || playerTeamsError);
        setSummaryError('No se pudo cargar el resumen administrativo.');
        setSummaryLoading(false);
        return;
      }

      setPlayers(playersData || []);
      setTeams((teamsData || []).filter((team) => team.is_active !== false));
      setPlayerTeams(playerTeamsData || []);
      setSummaryLoading(false);
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialPaymentNotifications() {
      await loadPaymentNotifications();
    }

    loadInitialPaymentNotifications();

    const channel = supabase
      .channel('admin-payment-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'player_payments' },
        async () => {
          if (!isMounted) return;

          await loadPaymentNotifications({ silent: true });
          setLivePaymentNotice('Nuevo pago registrado. El listado ya fue actualizado.');
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [loadPaymentNotifications]);

  const summary = useMemo(() => {
    const activePlayers = players.filter((player) => player.is_active !== false);
    const inactivePlayers = players.filter((player) => player.is_active === false);
    const paidPlayers = activePlayers.filter((player) => getEffectivePaymentStatus(player));
    const pendingPlayers = activePlayers.filter((player) => !getEffectivePaymentStatus(player));
    const teamNameById = teams.reduce((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {});
    const teamNamesByPlayerId = playerTeams.reduce((acc, playerTeam) => {
      const teamName = teamNameById[playerTeam.team_id];
      if (!teamName) return acc;
      if (!acc[playerTeam.player_id]) {
        acc[playerTeam.player_id] = [];
      }
      acc[playerTeam.player_id].push(teamName);
      return acc;
    }, {});
    const incompleteProfiles = activePlayers.filter(
      (player) => !getPlayerCompleteness(player, teamNamesByPlayerId[player.id] || []).isComplete
    );

    const teamCounts = teams.map((team) => ({
      id: team.id,
      name: team.name,
      count: playerTeams.filter((playerTeam) => playerTeam.team_id === team.id).length,
    }));

    const upcomingDuePlayers = activePlayers
      .map((player) => ({
        ...player,
        dueDate: addOneMonth(player.last_payment_date),
      }))
      .filter((player) => player.dueDate)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5);

    return {
      totalPlayers: players.length,
      activePlayers: activePlayers.length,
      inactivePlayers: inactivePlayers.length,
      paidPlayers: paidPlayers.length,
      pendingPlayers: pendingPlayers.length,
      teamCounts,
      upcomingDuePlayers,
      incompleteProfiles: incompleteProfiles.length,
    };
  }, [players, playerTeams, teams]);

  async function handleLogout() {
    try {
      await signOut();
    } catch {
      alert('No se pudo cerrar sesion. Proba nuevamente.');
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <img className="dashboard-logo" src={appLogo} alt="Logo Asociacion de Atletas" />
          <p className="eyebrow">Panel administrativo</p>
          <h1>Asociacion de Atletas</h1>
          <p className="muted">Sesion iniciada correctamente.</p>
        </div>

        <button className="secondary-button" onClick={handleLogout}>
          Cerrar sesion
        </button>
      </header>

      <section className="dashboard-summary-section">
        <div className="dashboard-section-heading">
          <div>
            <p className="eyebrow">Resumen</p>
            <h2>Estado general</h2>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/players')}
          >
            Ver jugadores
          </button>
        </div>

        {summaryError && <div className="alert alert-error">{summaryError}</div>}

        {summaryLoading ? (
          <div className="loading-card">
            <strong>Cargando resumen...</strong>
          </div>
        ) : (
          <>
            <div className="summary-grid">
              <article className="summary-card summary-card-featured">
                <span>Total jugadores</span>
                <strong>{summary.totalPlayers}</strong>
                <small>{summary.activePlayers} activos</small>
              </article>
              <article className="summary-card">
                <span>Cuota al dia</span>
                <strong>{summary.paidPlayers}</strong>
                <small>Periodo vigente</small>
              </article>
              <article className="summary-card">
                <span>Cuota pendiente</span>
                <strong>{summary.pendingPlayers}</strong>
                <small>Jugadores activos</small>
              </article>
              <article className="summary-card">
                <span>Inactivos</span>
                <strong>{summary.inactivePlayers}</strong>
                <small>No cuentan como pendientes</small>
              </article>
              <article className="summary-card">
                <span>Perfiles incompletos</span>
                <strong>{summary.incompleteProfiles}</strong>
                <small>Jugadores activos</small>
              </article>
            </div>

            <div className="dashboard-insights-grid">
              <article className="info-card">
                <h2>Jugadores por equipo</h2>
                <div className="team-summary-list">
                  {summary.teamCounts.length === 0 ? (
                    <p className="muted">No hay equipos cargados.</p>
                  ) : (
                    summary.teamCounts.map((team) => (
                      <div key={team.id} className="team-summary-row">
                        <span>{team.name}</span>
                        <strong>{team.count}</strong>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="info-card">
                <h2>Proximos vencimientos</h2>
                <div className="due-summary-list">
                  {summary.upcomingDuePlayers.length === 0 ? (
                    <p className="muted">No hay pagos recientes para calcular vencimientos.</p>
                  ) : (
                    summary.upcomingDuePlayers.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        className="due-summary-row"
                        onClick={() => navigate(`/players/${player.id}`)}
                      >
                        <span>
                          {`${player.first_name || ''} ${player.last_name || ''}`.trim() || '-'}
                        </span>
                        <strong>{formatDate(player.dueDate)}</strong>
                      </button>
                    ))
                  )}
                </div>
              </article>

              <article className="info-card payment-notifications-card">
                <div className="payment-notifications-heading">
                  <div>
                    <p className="eyebrow">Notificaciones</p>
                    <h2>Pagos recientes</h2>
                  </div>
                  <span className="payment-notifications-count">
                    {paymentNotifications.length}
                  </span>
                </div>

                {livePaymentNotice && (
                  <div className="alert alert-success payment-live-notice">
                    {livePaymentNotice}
                  </div>
                )}

                {paymentNotificationsError && (
                  <div className="alert alert-error">{paymentNotificationsError}</div>
                )}

                {paymentNotificationsLoading ? (
                  <p className="muted">Cargando pagos recientes...</p>
                ) : paymentNotifications.length === 0 ? (
                  <p className="muted">Todavia no hay pagos registrados.</p>
                ) : (
                  <div className="payment-notifications-list">
                    {paymentNotifications.map((payment) => {
                      const playerName = payment.player
                        ? `${payment.player.first_name || ''} ${payment.player.last_name || ''}`.trim()
                        : 'Jugador no encontrado';

                      return (
                        <button
                          key={payment.id}
                          type="button"
                          className="payment-notification-row"
                          onClick={() => navigate(`/players/${payment.player_id}`)}
                        >
                          <span className="payment-notification-dot" aria-hidden="true" />
                          <span className="payment-notification-main">
                            <strong>{playerName || 'Jugador sin nombre'}</strong>
                            <small>
                              {payment.period || formatDate(payment.payment_date)}
                              {payment.player?.category ? ` · ${payment.player.category}` : ''}
                            </small>
                          </span>
                          <span className="payment-notification-side">
                            <strong>{formatCurrency(payment.amount)}</strong>
                            <small>{formatDateTime(payment.created_at)}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            </div>
          </>
        )}
      </section>

      <section className="dashboard-grid">
        <article className="info-card">
          <h2>Usuario</h2>
          <p>
            <strong>Email:</strong> {user?.email}
          </p>
          <p>
            <strong>Rol:</strong> {profile?.role ?? 'Sin rol cargado'}
          </p>
          <p>
            <strong>Permisos admin:</strong> {isAdmin ? 'Si' : 'No'}
          </p>
        </article>

        <article className="info-card module-card">
          <h2>Modulo Jugadores</h2>
          <p>Administra el listado de atletas, altas, edicion, busqueda y filtros.</p>
          <div className="dashboard-actions button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate('/players')}
            >
              Gestionar jugadores
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate('/players/new')}
            >
              Nuevo jugador
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

export default Dashboard;
