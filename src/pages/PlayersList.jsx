import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function PlayersList() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadPlayers() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando jugadores:', error);
      setErrorMessage('No se pudieron cargar los jugadores.');
      setLoading(false);
      return;
    }

    setPlayers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPlayers();
  }, []);

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

        <button className="primary-button">
          Nuevo jugador
        </button>
      </div>

      {errorMessage && (
        <div className="alert alert-error">
          {errorMessage}
        </div>
      )}

      {players.length === 0 ? (
        <div className="empty-card">
          <h2>No hay jugadores cargados</h2>
          <p>Cuando cargues jugadores, van a aparecer en este listado.</p>
        </div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Fecha de alta</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td>{player.full_name || '-'}</td>
                  <td>{player.dni || '-'}</td>
                  <td>{player.category || '-'}</td>
                  <td>{player.status || '-'}</td>
                  <td>
                    {player.created_at
                      ? new Date(player.created_at).toLocaleDateString('es-AR')
                      : '-'}
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