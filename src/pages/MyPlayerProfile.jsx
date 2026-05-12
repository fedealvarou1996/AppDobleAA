import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { resolvePlayerPhotoUrl } from '../utils/playerPhotoUrl';

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

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatMemberId(player) {
  if (!player?.id) return 'AA-0000-0000';
  const compact = String(player.id).replace(/-/g, '').toUpperCase();
  return `AA-${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}

function MyPlayerProfile() {
  const navigate = useNavigate();
  const { user, profile, isPlayer, signOut } = useAuth();

  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [renderPhotoUrl, setRenderPhotoUrl] = useState('');
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    async function loadPlayerProfile() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage('');
      setNotFound(false);
      setRenderPhotoUrl('');
      setPayments([]);

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error cargando ficha tecnica del jugador:', error);
        setPlayer(null);
        setErrorMessage('No se pudo cargar tu ficha tecnica.');
        setLoading(false);
        return;
      }

      if (data) {
        setPlayer(data);
        setRenderPhotoUrl(await resolvePlayerPhotoUrl(data.photo_url || ''));
        const { data: paymentsData } = await supabase
          .from('player_payments')
          .select('*')
          .eq('player_id', data.id)
          .order('payment_date', { ascending: false })
          .limit(10);
        setPayments(paymentsData || []);
        setLoading(false);
        return;
      }

      const { data: legacyData, error: legacyError } = await supabase
        .from('players')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (legacyError) {
        console.error('Error cargando ficha tecnica legacy del jugador:', legacyError);
        setPlayer(null);
        setErrorMessage('No se pudo cargar tu ficha tecnica.');
        setLoading(false);
        return;
      }

      if (!legacyData) {
        setPlayer(null);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setPlayer(legacyData);
      setRenderPhotoUrl(await resolvePlayerPhotoUrl(legacyData.photo_url || ''));
      const { data: legacyPayments } = await supabase
        .from('player_payments')
        .select('*')
        .eq('player_id', legacyData.id)
        .order('payment_date', { ascending: false })
        .limit(10);
      setPayments(legacyPayments || []);
      setLoading(false);
    }

    loadPlayerProfile();
  }, [user?.id]);

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  if (loading) {
    return (
      <div className="page-center">
        <div className="loading-card">
          <strong>Cargando ficha tecnica...</strong>
        </div>
      </div>
    );
  }

  const fullName =
    `${player?.first_name || ''} ${player?.last_name || ''}`.trim() || '-';
  const paymentLabel = player?.payment_status ? 'Al dia' : 'Pendiente';
  const memberId = formatMemberId(player);
  const issueDate = formatDate(player?.created_at);
  const dueDate = formatDate(player?.last_payment_date);
  const verificationUrl = `${window.location.origin}/verify/${player.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(verificationUrl)}`;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{player ? fullName : 'Mi ficha tecnica'}</h1>
          <p>
            {isPlayer && profile?.role === 'player'
              ? 'Consulta privada de tu informacion registrada.'
              : 'Consulta privada del jugador.'}
          </p>
        </div>

        <div className="header-actions">
          <button className="secondary-button" onClick={handleSignOut}>
            Cerrar sesion
          </button>
        </div>
      </div>

      {errorMessage && <div className="alert alert-error">{errorMessage}</div>}

      {notFound && (
        <div className="empty-card">
          <h2>Ficha tecnica no disponible</h2>
          <p>No tenes una ficha tecnica asociada. Contacta al administrador.</p>
        </div>
      )}

      {!errorMessage && !notFound && player && (
        <>
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

                <div className="member-card-qr-frame">
                  <img
                    className="member-card-qr"
                    src={qrUrl}
                    alt={`QR de verificacion de ${fullName}`}
                    loading="lazy"
                    decoding="async"
                  />
                  <small>Verificacion</small>
                </div>
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
                  <span>Fecha de emision:</span> {issueDate}
                </p>
                <p>
                  <span>Fecha de vencimiento:</span> {dueDate}
                </p>
                <p>
                  <span>Estado de cuota:</span> {paymentLabel}
                </p>
              </div>
            </div>
          </section>

          <section className="detail-card member-detail-card">
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Nombre completo</span>
                <span className="detail-value">{fullName}</span>
              </div>

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

          <section className="detail-card member-detail-card">
            <h2>Historial de pagos</h2>
            {!payments.length ? (
              <div className="empty-card">
                <p>Aun no hay pagos registrados.</p>
              </div>
            ) : (
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Metodo</th>
                      <th>Periodo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDate(payment.payment_date)}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{formatText(payment.method)}</td>
                        <td>{formatText(payment.period)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default MyPlayerProfile;
