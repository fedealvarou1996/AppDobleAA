import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

function PlayersList() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
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

      setPlayers(data || []);
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

      const matchesCategory =
        !selectedCategory || category === selectedCategory;

      const matchesPayment =
        !paymentFilter ||
        (paymentFilter === 'paid' && player.payment_status === true) ||
        (paymentFilter === 'pending' && player.payment_status === false);

      return matchesSearch && matchesCategory && matchesPayment;
    });
  }, [players, searchTerm, selectedCategory, paymentFilter]);

  function clearFilters() {
    setSearchTerm('');
    setSelectedCategory('');
    setPaymentFilter('');
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

        <button className="primary-button" onClick={() => navigate('/players/new')}>
        Nuevo jugador
        </button>
      </div>

      {errorMessage && (
        <div className="alert alert-error">
          {errorMessage}
        </div>
      )}

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
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Limpiar filtros
              </button>
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
          <p>Probá cambiando la búsqueda o limpiando los filtros.</p>
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Categoría</th>
                <th>Cuota</th>
                <th>Último pago</th>
                <th>Fecha de alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
              <tbody>
                {filteredPlayers.map((player) => (
                  <tr key={player.id}>
                    <td>{`${player.first_name || ''} ${player.last_name || ''}`.trim() || '-'}</td>
                    <td>{player.dni || '-'}</td>
                    <td>{player.category || '-'}</td>
                    <td>{player.payment_status ? 'Al día' : 'Pendiente'}</td>
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
                        >
                          Ver
                        </button>
                        <button
                          className="secondary-button small-button"
                          onClick={() => navigate(`/players/${player.id}/edit`)}
                        >
                          Editar
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
