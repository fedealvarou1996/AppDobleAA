import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function formatDate(value) {
  if (!value) return '-';

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnlyMatch
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-AR');
}

function formatText(value) {
  return value ? value : '-';
}

function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadPlayer() {
      setLoading(true);
      setErrorMessage('');
      setNotFound(false);

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error cargando jugador:', error);
        setErrorMessage('No se pudo cargar la ficha del jugador.');
        setLoading(false);
        return;
      }

      if (!data) {
        setPlayer(null);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setPlayer(data);
      setLoading(false);
    }

    loadPlayer();
  }, [id]);

  if (loading) {
    return (
      <div className="page-center">
        <div className="loading-card">
          <strong>Cargando jugador...</strong>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>Ficha del jugador</h1>
            <p>No se pudo obtener la informacion solicitada.</p>
          </div>

          <button className="secondary-button" onClick={() => navigate('/players')}>
            Volver
          </button>
        </div>

        <div className="alert alert-error">{errorMessage}</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>Ficha del jugador</h1>
            <p>Jugador no encontrado</p>
          </div>

          <button className="secondary-button" onClick={() => navigate('/players')}>
            Volver
          </button>
        </div>

        <div className="empty-card">
          <h2>Jugador no encontrado</h2>
          <p>El jugador solicitado no existe o ya no esta disponible.</p>
        </div>
      </div>
    );
  }

  const fullName =
    `${player.first_name || ''} ${player.last_name || ''}`.trim() || '-';
  const paymentLabel = player.payment_status ? 'Al dia' : 'Pendiente';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{fullName}</h1>
          <p>Ficha individual del jugador.</p>
        </div>

        <div className="header-actions">
          <button className="secondary-button" onClick={() => navigate('/players')}>
            Volver
          </button>
          <button
            className="primary-button"
            onClick={() => navigate(`/players/${id}/edit`)}
          >
            Editar jugador
          </button>
        </div>
      </div>

      <section className="detail-card">
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">DNI</span>
            <span className="detail-value">{formatText(player.dni)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Fecha de nacimiento</span>
            <span className="detail-value">{formatDate(player.birth_date)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Categoria</span>
            <span className="detail-value">{formatText(player.category)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Telefono</span>
            <span className="detail-value">{formatText(player.phone)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Email</span>
            <span className="detail-value">{formatText(player.email)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Direccion</span>
            <span className="detail-value">{formatText(player.address)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Estado de cuota</span>
            <span
              className={`badge ${
                player.payment_status ? 'badge-success' : 'badge-warning'
              }`}
            >
              {paymentLabel}
            </span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Ultimo pago</span>
            <span className="detail-value">
              {formatDate(player.last_payment_date)}
            </span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Fecha de alta</span>
            <span className="detail-value">{formatDate(player.created_at)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Ultima actualizacion</span>
            <span className="detail-value">{formatDate(player.updated_at)}</span>
          </div>
        </div>

        <div className="detail-item detail-notes">
          <span className="detail-label">Notas</span>
          <span className="detail-value">{formatText(player.notes)}</span>
        </div>
      </section>
    </div>
  );
}

export default PlayerDetail;
