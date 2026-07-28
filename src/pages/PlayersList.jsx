import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { getEffectivePaymentStatus } from '../utils/paymentPeriod';
import { buildGoodFaithXlsxBlob } from '../utils/goodFaithExport';

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
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [processingId, setProcessingId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function loadPlayers() {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error('Error cargando jugadores:', error);
        setErrorMessage('No se pudieron cargar los jugadores.');
        setLoading(false);
        return;
      }

      const loadedPlayers = data || [];
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

    loadPlayers();

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

      const matchesPayment =
        !paymentFilter ||
        (paymentFilter === 'paid' && getEffectivePaymentStatus(player) === true) ||
        (paymentFilter === 'pending' && getEffectivePaymentStatus(player) === false);

      return matchesSearch && matchesCategory && matchesPayment;
    });
  }, [players, searchTerm, selectedCategory, paymentFilter]);

  function clearFilters() {
    setSearchTerm('');
    setSelectedCategory('');
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
    const blob = buildGoodFaithXlsxBlob(filteredPlayers, category);
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

            <div className="filters-actions">
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
                  className="primary-button"
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
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Categoria</th>
                <th>Cuota</th>
                <th>Estado</th>
                <th>Ultimo pago</th>
                <th>Fecha de alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr key={player.id}>
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
                        {`${player.first_name || ''} ${player.last_name || ''}`.trim() ||
                          '-'}
                      </span>
                    </div>
                  </td>
                  <td>{player.dni || '-'}</td>
                  <td>{player.category || '-'}</td>
                  <td>{getEffectivePaymentStatus(player) ? 'Al dia' : 'Pendiente'}</td>
                  <td>{player.is_active === false ? 'Inactivo' : 'Activo'}</td>
                  <td>
                    {player.last_payment_date
                      ? new Date(player.last_payment_date).toLocaleDateString('es-AR')
                      : '-'}
                  </td>
                  <td>
                    {player.created_at
                      ? new Date(player.created_at).toLocaleDateString('es-AR')
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
      )}
    </div>
  );
}

export default PlayersList;
