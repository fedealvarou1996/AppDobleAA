import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getEffectivePaymentStatus } from '../utils/paymentPeriod';
import { buildGoodFaithXlsxBlob } from '../utils/goodFaithExport';
import { getPlayerCompleteness } from '../utils/playerCompleteness';

async function getFunctionErrorMessage(error, fallbackMessage) {
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const payload = await error.context.json();

      if (payload?.error) {
        return payload.error;
      }

      if (payload?.message) {
        return payload.message;
      }
    } catch {
      // Ignore parse failures and fallback to generic message.
    }
  }

  return error?.message || fallbackMessage;
}

function PlayersList() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [playerTeams, setPlayerTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [processingId, setProcessingId] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function loadPlayersAndTeams() {
      const [
        { data: playersData, error: playersError },
        { data: teamsData, error: teamsError },
        { data: playerTeamsData, error: playerTeamsError },
      ] = await Promise.all([
          supabase.from('players').select('*').order('created_at', { ascending: false }),
          supabase.from('teams').select('id, name, slug, is_active').order('name', {
            ascending: true,
          }),
          supabase.from('player_teams').select('id, player_id, team_id'),
        ]);

      if (!isMounted) return;

      if (teamsError) {
        console.error('Error cargando equipos:', teamsError);
        setErrorMessage('No se pudieron cargar los equipos.');
      } else {
        setTeams(teamsData || []);
      }

      if (playerTeamsError) {
        console.error('Error cargando asignaciones de equipos:', playerTeamsError);
        setErrorMessage('No se pudieron cargar las asignaciones de equipos.');
      } else {
        setPlayerTeams(playerTeamsData || []);
      }

      const { data: expiredData, error: expiredError } = { data: playersData, error: playersError };

      if (expiredError) {
        console.error('Error cargando jugadores:', expiredError);
        setErrorMessage('No se pudieron cargar los jugadores.');
        setLoading(false);
        return;
      }

      const loadedPlayers = expiredData || [];
      const expiredPlayers = loadedPlayers.filter(
        (player) => player.payment_status && !getEffectivePaymentStatus(player)
      );

      if (expiredPlayers.length > 0) {
        const expiredIds = expiredPlayers.map((player) => player.id);
        const { error: expireUpdateError } = await supabase
          .from('players')
          .update({
            payment_status: false,
            updated_at: new Date().toISOString(),
          })
          .in('id', expiredIds);

        if (expireUpdateError) {
          console.error('Error actualizando vencimientos de cuota:', expireUpdateError);
        } else {
          expiredPlayers.forEach((player) => {
            player.payment_status = false;
          });
        }
      }

      setPlayers(loadedPlayers);
      setLoading(false);
    }

    loadPlayersAndTeams();

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const uniqueCategories = new Set();

    players.forEach((player) => {
      const category = player.category?.trim();

      if (category) {
        uniqueCategories.add(category);
      }
    });

    return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b));
  }, [players]);

  const teamNameById = useMemo(
    () =>
      teams.reduce((acc, team) => {
        acc[team.id] = team.name;
        return acc;
      }, {}),
    [teams]
  );

  const playerTeamIdsByPlayerId = useMemo(
    () =>
      playerTeams.reduce((acc, playerTeam) => {
        if (!acc[playerTeam.player_id]) {
          acc[playerTeam.player_id] = [];
        }

        acc[playerTeam.player_id].push(playerTeam.team_id);
        return acc;
      }, {}),
    [playerTeams]
  );

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return players.filter((player) => {
      const firstName = player.first_name || '';
      const lastName = player.last_name || '';
      const dni = player.dni || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const reverseFullName = `${lastName} ${firstName}`.trim();
      const category = player.category?.trim() || '';

      const matchesSearch =
        !normalizedSearch ||
        firstName.toLowerCase().includes(normalizedSearch) ||
        lastName.toLowerCase().includes(normalizedSearch) ||
        dni.toLowerCase().includes(normalizedSearch) ||
        fullName.toLowerCase().includes(normalizedSearch) ||
        reverseFullName.toLowerCase().includes(normalizedSearch);

      const matchesCategory = !selectedCategory || category === selectedCategory;

      const matchesTeam =
        !selectedTeamFilter ||
        playerTeamIdsByPlayerId[player.id]?.includes(selectedTeamFilter);

      const matchesPayment =
        !paymentFilter ||
        (paymentFilter === 'paid' && getEffectivePaymentStatus(player) === true) ||
        (paymentFilter === 'pending' && getEffectivePaymentStatus(player) === false);

      return matchesSearch && matchesCategory && matchesTeam && matchesPayment;
    });
  }, [
    players,
    searchTerm,
    selectedCategory,
    selectedTeamFilter,
    paymentFilter,
    playerTeamIdsByPlayerId,
  ]);

  const teamsBySlug = useMemo(
    () =>
      teams.reduce((acc, team) => {
        acc[team.slug] = team;
        return acc;
      }, {}),
    [teams]
  );

  const playerTeamsByPlayerId = useMemo(() => {
    return playerTeams.reduce((acc, playerTeam) => {
      const teamName = teamNameById[playerTeam.team_id];

      if (!teamName) return acc;

      if (!acc[playerTeam.player_id]) {
        acc[playerTeam.player_id] = [];
      }

      acc[playerTeam.player_id].push(teamName);
      return acc;
    }, {});
  }, [playerTeams, teamNameById]);

  function getPlayerTeamLabel(playerId) {
    return playerTeamsByPlayerId[playerId]?.join(', ') || '-';
  }

  function getPlayerTeamNames(playerId) {
    return playerTeamsByPlayerId[playerId] || [];
  }

  function getPlayerFullName(player) {
    return `${player.first_name || ''} ${player.last_name || ''}`.trim() || '-';
  }

  function formatPlayerDate(value) {
    return value ? new Date(value).toLocaleDateString('es-AR') : '-';
  }

  const visibleSelectedCount = filteredPlayers.filter((player) =>
    selectedPlayerIds.includes(player.id)
  ).length;
  const allVisibleSelected =
    filteredPlayers.length > 0 && visibleSelectedCount === filteredPlayers.length;

  function setVisibleSelection(selected) {
    const visibleIds = filteredPlayers.map((player) => player.id);

    setSelectedPlayerIds((current) => {
      const currentSet = new Set(current);

      if (selected) {
        visibleIds.forEach((id) => currentSet.add(id));
      } else {
        visibleIds.forEach((id) => currentSet.delete(id));
      }

      return Array.from(currentSet);
    });
  }

  function togglePlayerSelection(playerId) {
    setSelectedPlayerIds((current) =>
      current.includes(playerId)
        ? current.filter((currentId) => currentId !== playerId)
        : [...current, playerId]
    );
  }

  function clearSelection() {
    setSelectedPlayerIds([]);
  }

  async function handleAddTeam(teamSlug) {
    if (!selectedPlayerIds.length) {
      setErrorMessage('Selecciona al menos un jugador.');
      return;
    }

    const team = teamsBySlug[teamSlug];

    if (!team) {
      setErrorMessage('No se encontro el equipo seleccionado.');
      return;
    }

    setBulkProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    const rows = selectedPlayerIds.map((playerId) => ({
      player_id: playerId,
      team_id: team.id,
    }));

    const { error } = await supabase.from('player_teams').upsert(rows, {
      onConflict: 'player_id,team_id',
      ignoreDuplicates: true,
    });

    if (error) {
      console.error('Error asignando equipo:', error);
      setErrorMessage('No se pudo agregar el equipo a los jugadores seleccionados.');
      setBulkProcessing(false);
      return;
    }

    setPlayerTeams((current) => {
      const existingKeys = new Set(
        current.map((playerTeam) => `${playerTeam.player_id}:${playerTeam.team_id}`)
      );
      const nextRows = rows
        .filter((row) => !existingKeys.has(`${row.player_id}:${row.team_id}`))
        .map((row) => ({
          ...row,
          id: `${row.player_id}:${row.team_id}`,
        }));

      return [...current, ...nextRows];
    });
    setSuccessMessage(`${selectedPlayerIds.length} jugador(es) agregados a ${team.name}.`);
    clearSelection();
    setBulkProcessing(false);
  }

  async function handleRemoveTeam(teamSlug) {
    if (!selectedPlayerIds.length) {
      setErrorMessage('Selecciona al menos un jugador.');
      return;
    }

    const team = teamsBySlug[teamSlug];

    if (!team) {
      setErrorMessage('No se encontro el equipo seleccionado.');
      return;
    }

    setBulkProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    const { error } = await supabase
      .from('player_teams')
      .delete()
      .eq('team_id', team.id)
      .in('player_id', selectedPlayerIds);

    if (error) {
      console.error('Error quitando equipo:', error);
      setErrorMessage('No se pudo quitar el equipo a los jugadores seleccionados.');
      setBulkProcessing(false);
      return;
    }

    setPlayerTeams((current) =>
      current.filter(
        (playerTeam) =>
          playerTeam.team_id !== team.id || !selectedPlayerIds.includes(playerTeam.player_id)
      )
    );
    setSuccessMessage(`${selectedPlayerIds.length} jugador(es) quitados de ${team.name}.`);
    clearSelection();
    setBulkProcessing(false);
  }

  function clearFilters() {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedTeamFilter('');
    setPaymentFilter('');
  }

  function handleExportCsvPlayers() {
    if (!filteredPlayers.length) {
      setErrorMessage('No hay jugadores filtrados para exportar.');
      return;
    }

    const headers = [
      'Nombre',
      'Apellido',
      'DNI',
      'Categoria',
      'Telefono',
      'Email',
      'Direccion',
      'Equipos',
      'Estado cuota',
      'Estado jugador',
      'Ultimo pago',
      'Fecha de alta',
    ];

    const escapeCsvValue = (value) => {
      const normalizedValue = value === null || value === undefined ? '' : String(value);
      const escapedValue = normalizedValue.replace(/"/g, '""');
      return `"${escapedValue}"`;
    };

    const rows = filteredPlayers.map((player) => [
      player.first_name || '',
      player.last_name || '',
      player.dni || '',
      player.category || '',
      player.phone || '',
      player.email || '',
      player.address || '',
      getPlayerTeamLabel(player.id),
      getEffectivePaymentStatus(player) ? 'Al dia' : 'Pendiente',
      player.is_active === false ? 'Inactivo' : 'Activo',
      player.last_payment_date
        ? new Date(player.last_payment_date).toLocaleDateString('es-AR')
        : '',
      player.created_at ? new Date(player.created_at).toLocaleDateString('es-AR') : '',
    ]);

    const delimiter = ';';
    const csvContent = [
      headers.map(escapeCsvValue).join(delimiter),
      ...rows.map((row) => row.map(escapeCsvValue).join(delimiter)),
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `jugadores-filtrados-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessMessage(`Exportacion completada: ${filteredPlayers.length} jugador(es).`);
  }

  function handleExportGoodFaithPlayers() {
    if (!filteredPlayers.length) {
      setErrorMessage('No hay jugadores filtrados para exportar.');
      return;
    }

    const uniqueCategories = Array.from(
      new Set(filteredPlayers.map((player) => player.category?.trim()).filter(Boolean))
    );
    const category = selectedCategory || (uniqueCategories.length === 1 ? uniqueCategories[0] : '');
    const teamName = selectedTeamFilter ? teamNameById[selectedTeamFilter] : '';
    const blob = buildGoodFaithXlsxBlob(filteredPlayers, category, teamName);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `lista-de-buena-fe-${timestamp}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSuccessMessage(`Exportacion completada: ${filteredPlayers.length} jugador(es).`);
  }

  async function handleToggleActive(player) {
    const isActive = player.is_active !== false;
    const actionLabel = isActive ? 'inactivar' : 'reactivar';

    if (!window.confirm(`Seguro que queres ${actionLabel} este jugador?`)) {
      return;
    }

    setProcessingId(player.id);
    setErrorMessage('');
    setSuccessMessage('');

    const { error } = await supabase
      .from('players')
      .update({
        is_active: !isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', player.id);

    if (error) {
      console.error(`Error al ${actionLabel} jugador:`, error);
      setErrorMessage(
        'No se pudo actualizar el estado del jugador. Verifica que exista la columna is_active en players.'
      );
      setProcessingId('');
      return;
    }

    setPlayers((prev) =>
      prev.map((currentPlayer) =>
        currentPlayer.id === player.id
          ? {
              ...currentPlayer,
              is_active: !isActive,
              updated_at: new Date().toISOString(),
            }
          : currentPlayer
      )
    );
    setProcessingId('');
  }

  async function handleDelete(player) {
    const fullName =
      `${player.first_name || ''} ${player.last_name || ''}`.trim() ||
      'este jugador';

    if (
      !window.confirm(
        `Seguro que queres eliminar a ${fullName}? Esta accion no se puede deshacer.`
      )
    ) {
      return;
    }

    setProcessingId(player.id);
    setErrorMessage('');

    const { data, error } = await supabase.functions.invoke('delete-player', {
      body: { playerId: player.id },
    });

    if (error) {
      console.error('Error eliminando jugador:', error);
      const message = await getFunctionErrorMessage(
        error,
        'No se pudo eliminar el jugador.'
      );
      setErrorMessage(message);
      setProcessingId('');
      return;
    }

    const responseMessage = data?.message;

    if (responseMessage) {
      setSuccessMessage(responseMessage);
    }

    setPlayers((prev) =>
      prev.filter((currentPlayer) => currentPlayer.id !== player.id)
    );
    setProcessingId('');
  }

  if (loading) {
    return (
      <div className="page-center">
        <div className="loading-card">
          <strong>Cargando jugadores...</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Jugadores</h1>
          <p>Listado de atletas registrados en el club.</p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/dashboard')}
          >
            Volver al dashboard
          </button>
          <button
            className="primary-button"
            onClick={() => navigate('/players/new')}
          >
            Nuevo jugador
          </button>
        </div>
      </div>

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {players.length > 0 && (
        <div className="filters-card">
          <div className="filters-grid">
            <div className="filter-field">
              <label htmlFor="player-search">Buscar</label>
              <input
                id="player-search"
                type="search"
                placeholder="Buscar por nombre, apellido o DNI"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="category-filter">Categoria</label>
              <select
                id="category-filter"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                <option value="">Todas las categorias</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="payment-filter">Estado de pago</label>
              <select
                id="payment-filter"
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="paid">Cuota al dia</option>
                <option value="pending">Cuota pendiente</option>
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="team-filter">Equipo</label>
              <select
                id="team-filter"
                value={selectedTeamFilter}
                onChange={(event) => setSelectedTeamFilter(event.target.value)}
              >
                <option value="">Todos los equipos</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filters-actions">
              <div className="players-actions-layout">
                <div className="players-selection-summary">
                  <strong>{selectedPlayerIds.length} seleccionados</strong>
                  <span>
                    {visibleSelectedCount} de {filteredPlayers.length} visibles
                  </span>
                </div>

                <div className="button-row filters-button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={clearFilters}
                  >
                    Limpiar filtros
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setVisibleSelection(true)}
                    disabled={filteredPlayers.length === 0}
                  >
                    Seleccionar visibles
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={clearSelection}
                    disabled={selectedPlayerIds.length === 0}
                  >
                    Limpiar selección
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleAddTeam('overtime')}
                    disabled={bulkProcessing || selectedPlayerIds.length === 0}
                  >
                    Agregar a Overtime
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleAddTeam('bea')}
                    disabled={bulkProcessing || selectedPlayerIds.length === 0}
                  >
                    Agregar a BEA
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleRemoveTeam('overtime')}
                    disabled={bulkProcessing || selectedPlayerIds.length === 0}
                  >
                    Quitar Overtime
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleRemoveTeam('bea')}
                    disabled={bulkProcessing || selectedPlayerIds.length === 0}
                  >
                    Quitar BEA
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleExportCsvPlayers}
                    disabled={filteredPlayers.length === 0}
                  >
                    Exportar filtrados (CSV)
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleExportGoodFaithPlayers}
                    disabled={filteredPlayers.length === 0}
                  >
                    Lista de Buena Fe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {players.length === 0 ? (
        <div className="empty-card">
          <h2>No hay jugadores cargados.</h2>
          <p>Cuando cargues jugadores, van a aparecer en este listado.</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="empty-card">
          <h2>No se encontraron jugadores con esos filtros.</h2>
          <p>Proba cambiando la busqueda o limpiando los filtros.</p>
        </div>
      ) : (
        <>
        <div className="players-mobile-cards">
          {filteredPlayers.map((player) => {
            const isSelected = selectedPlayerIds.includes(player.id);
            const isPaid = getEffectivePaymentStatus(player);
            const isActive = player.is_active !== false;
            const completeness = getPlayerCompleteness(player, getPlayerTeamNames(player.id));

            return (
              <article
                key={player.id}
                className={`player-mobile-card ${isSelected ? 'player-mobile-card-selected' : ''}`}
              >
                <div className="player-mobile-card-header">
                  <label className="player-mobile-select">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlayerSelection(player.id)}
                      aria-label={`Seleccionar a ${getPlayerFullName(player)}`}
                    />
                  </label>

                  {(player.photo_thumb_url || player.photo_url) ? (
                    <img
                      className="player-mobile-photo"
                      src={player.photo_thumb_url || player.photo_url}
                      alt={`Foto de ${getPlayerFullName(player)}`}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="player-mobile-photo-placeholder">
                      {getPlayerFullName(player).slice(0, 1)}
                    </div>
                  )}

                  <div className="player-mobile-title">
                    <h2>{getPlayerFullName(player)}</h2>
                    <span>DNI {player.dni || '-'}</span>
                  </div>
                </div>

                <div className="player-mobile-meta">
                  <div>
                    <span>Categoria</span>
                    <strong>{player.category || '-'}</strong>
                  </div>
                  <div>
                    <span>Equipos</span>
                    <strong>{getPlayerTeamLabel(player.id)}</strong>
                  </div>
                  <div>
                    <span>Cuota</span>
                    <strong className={isPaid ? 'mobile-status-success' : 'mobile-status-warning'}>
                      {isPaid ? 'Al dia' : 'Pendiente'}
                    </strong>
                  </div>
                  <div>
                    <span>Estado</span>
                    <strong>{isActive ? 'Activo' : 'Inactivo'}</strong>
                  </div>
                  <div>
                    <span>Perfil</span>
                    <strong
                      className={
                        completeness.isComplete ? 'mobile-status-success' : 'mobile-status-warning'
                      }
                    >
                      {completeness.label}
                    </strong>
                  </div>
                  <div>
                    <span>Ultimo pago</span>
                    <strong>{formatPlayerDate(player.last_payment_date)}</strong>
                  </div>
                  <div>
                    <span>Alta</span>
                    <strong>{formatPlayerDate(player.created_at)}</strong>
                  </div>
                </div>

                <div className="player-mobile-actions">
                  <button
                    className="secondary-button small-button"
                    onClick={() => navigate(`/players/${player.id}`)}
                    disabled={processingId === player.id}
                  >
                    Ver
                  </button>
                  <button
                    className="secondary-button small-button"
                    onClick={() => navigate(`/players/${player.id}/edit`)}
                    disabled={processingId === player.id}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="secondary-button small-button"
                    onClick={() => handleToggleActive(player)}
                    disabled={processingId === player.id}
                  >
                    {isActive ? 'Inactivar' : 'Reactivar'}
                  </button>
                  <button
                    type="button"
                    className="danger-button small-button"
                    onClick={() => handleDelete(player)}
                    disabled={processingId === player.id}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="table-card players-table-card">
          <table>
            <thead>
              <tr>
                <th className="selection-column">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => setVisibleSelection(event.target.checked)}
                    aria-label="Seleccionar jugadores visibles"
                  />
                </th>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Categoria</th>
                <th>Equipo</th>
                <th>Cuota</th>
                <th>Estado</th>
                <th>Perfil</th>
                <th>Ultimo pago</th>
                <th>Fecha de alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr key={player.id}>
                  <td className="selection-column">
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() => togglePlayerSelection(player.id)}
                      aria-label={`Seleccionar a ${player.first_name || ''} ${player.last_name || ''}`}
                    />
                  </td>
                  <td>
                    <div className="player-name-cell">
                      {(player.photo_thumb_url || player.photo_url) && (
                        <img
                          className="player-thumb"
                          src={player.photo_thumb_url || player.photo_url}
                          alt={`Foto de ${(player.first_name || '').trim()} ${(player.last_name || '').trim()}`}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <span>
                        {getPlayerFullName(player)}
                      </span>
                    </div>
                  </td>
                  <td>{player.dni || '-'}</td>
                  <td>{player.category || '-'}</td>
                  <td>{getPlayerTeamLabel(player.id)}</td>
                  <td>{getEffectivePaymentStatus(player) ? 'Al dia' : 'Pendiente'}</td>
                  <td>{player.is_active === false ? 'Inactivo' : 'Activo'}</td>
                  <td>
                    {(() => {
                      const completeness = getPlayerCompleteness(
                        player,
                        getPlayerTeamNames(player.id)
                      );
                      return (
                        <span
                          className={`badge ${
                            completeness.isComplete ? 'badge-success' : 'badge-warning'
                          }`}
                          title={
                            completeness.isComplete
                              ? 'Perfil completo'
                              : `Falta: ${completeness.missingFields.join(', ')}`
                          }
                        >
                          {completeness.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {player.last_payment_date
                      ? formatPlayerDate(player.last_payment_date)
                      : '-'}
                  </td>
                  <td>
                    {player.created_at
                      ? formatPlayerDate(player.created_at)
                      : '-'}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="secondary-button small-button"
                        onClick={() => navigate(`/players/${player.id}`)}
                        disabled={processingId === player.id}
                      >
                        Ver
                      </button>
                      <button
                        className="secondary-button small-button"
                        onClick={() => navigate(`/players/${player.id}/edit`)}
                        disabled={processingId === player.id}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => handleToggleActive(player)}
                        disabled={processingId === player.id}
                      >
                        {player.is_active === false ? 'Reactivar' : 'Inactivar'}
                      </button>
                      <button
                        type="button"
                        className="danger-button small-button"
                        onClick={() => handleDelete(player)}
                        disabled={processingId === player.id}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

export default PlayersList;
