import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { resolvePlayerPhotoUrl } from '../utils/playerPhotoUrl';
import { getEffectivePaymentStatus } from '../utils/paymentPeriod';

function formatDate(value) {
  if (!value) return '-';
  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnlyMatch ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-AR');
}

function formatMemberId(player) {
  if (!player?.id) return 'AA-0000-0000';
  const compact = String(player.id).replace(/-/g, '').toUpperCase();
  return `AA-${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}

function VerifyPlayerProfile() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [player, setPlayer] = useState(null);
  const [renderPhotoUrl, setRenderPhotoUrl] = useState('');

  useEffect(() => {
    async function loadPublicCard() {
      setLoading(true);
      setErrorMessage('');
      setNotFound(false);

      const { data, error } = await supabase.rpc('get_public_player_card', {
        p_player_id: id,
      });

      if (error) {
        console.error('Error consultando verificacion publica:', error);
        setErrorMessage('No se pudo validar la ficha tecnica.');
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : null;

      if (!row) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setPlayer(row);
      setRenderPhotoUrl(await resolvePlayerPhotoUrl(row.photo_url || ''));
      setLoading(false);
    }

    loadPublicCard();
  }, [id]);

  if (loading) {
    return (
      <div className="page-center">
        <div className="loading-card">
          <strong>Validando carnet...</strong>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="page-container">
        <div className="alert alert-error">{errorMessage}</div>
      </div>
    );
  }

  if (notFound || !player) {
    return (
      <div className="page-center">
        <div className="empty-card">
          <h2>Carnet no encontrado</h2>
          <p>La ficha solicitada no existe o no esta disponible.</p>
        </div>
      </div>
    );
  }

  const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim() || '-';
  const memberId = formatMemberId(player);
  const effectivePaymentStatus = getEffectivePaymentStatus(player);
  const paymentLabel = effectivePaymentStatus ? 'Al dia' : 'Pendiente';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Verificacion de socio</h1>
          <p>Documento de consulta publica.</p>
        </div>
        <Link to="/login" className="secondary-button">
          Ir al sistema
        </Link>
      </div>

      <section className="member-card">
        <div className="member-card-banner">Carnet de asociado virtual</div>

        <div className="member-card-body">
          <div className="member-card-left">
            {renderPhotoUrl && (
              <div className="member-card-photo-frame">
                <img
                  className="member-card-photo"
                  src={renderPhotoUrl}
                  alt={`Foto de ${fullName}`}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            )}
          </div>

          <div className="member-card-info">
            <p>
              <span>Nombre completo:</span> {fullName}
            </p>
            <p>
              <span>ID de socio:</span> {memberId}
            </p>
            <p>
              <span>Tipo de membresia:</span> Atleta Federado
            </p>
            <p>
              <span>Fecha de emision:</span> {formatDate(player.created_at)}
            </p>
            <p>
              <span>Fecha de vencimiento:</span> {formatDate(player.last_payment_date)}
            </p>
            <p>
              <span>Estado de cuota:</span> {paymentLabel}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default VerifyPlayerProfile;
