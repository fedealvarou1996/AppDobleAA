import { useEffect, useMemo, useState } from 'react';
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
