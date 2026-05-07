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

async function getFunctionErrorMessage(error) {
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
      // Ignore parse failures and fallback to the generic error message.
    }
  }

  return error?.message || 'No se pudo enviar la invitacion del jugador.';
}

function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    async function loadPlayer() {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
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

  async function handleInvitePlayer() {
    if (!player?.id) return;

    if (!player.email) {
      setErrorMessage('El jugador necesita un email para poder enviar la invitacion.');
      return;
    }

    setInviting(true);
    setErrorMessage('');
    setSuccessMessage('');

    const { data, error } = await supabase.functions.invoke('invite-player', {
      body: { playerId: player.id },
    });

    if (error) {
      console.error('Error invitando jugador:', error);
      const message = await getFunctionErrorMessage(error);
      setErrorMessage(message);
      setInviting(false);
      return;
    }

    const invitedUserId = data?.userId || null;

    if (invitedUserId) {
      setPlayer((currentPlayer) =>
        currentPlayer
          ? {
              ...currentPlayer,
              user_id: invitedUserId,
            }
          : currentPlayer
      );
    }

    setSuccessMessage(
      invitedUserId
        ? 'Invitacion enviada y usuario vinculado correctamente.'
        : 'Invitacion enviada correctamente.'
    );
    setInviting(false);
  }

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
          {!player.user_id && (
            <button
              className="secondary-button"
              onClick={handleInvitePlayer}
              disabled={inviting}
            >
              {inviting ? 'Enviando invitacion...' : 'Invitar jugador'}
            </button>
          )}
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

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

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
            <span className="detail-label">Usuario vinculado</span>
            <span className="detail-value">{formatText(player.user_id)}</span>
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
