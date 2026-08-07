import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { supabase } from '../lib/supabaseClient';
import { resolvePlayerPhotoUrl } from '../utils/playerPhotoUrl';
import { getEffectivePaymentStatus } from '../utils/paymentPeriod';
import { getPlayerCompleteness } from '../utils/playerCompleteness';
import { PAYMENT_HISTORY_SELECT, PLAYER_DETAIL_SELECT } from '../utils/supabaseSelects';
import {
  openPaymentReceipt,
  removePaymentReceipt,
  uploadPaymentReceipt,
  validatePaymentReceipt,
} from '../utils/paymentReceiptUpload';
import {
  removePlayerPhotoSet,
  uploadPlayerPhoto,
  validatePlayerPhoto,
} from '../utils/playerPhotoUpload';

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

function getInitialPaymentNotice() {
  const paymentResult = new URLSearchParams(window.location.search).get('payment');

  if (paymentResult === 'success') {
    return {
      type: 'success',
      message:
        'Pago iniciado correctamente. Mercado Pago puede demorar unos segundos en confirmar la cuota.',
    };
  }

  if (paymentResult === 'pending') {
    return {
      type: 'success',
      message: 'El pago quedo pendiente. Te avisaremos cuando Mercado Pago lo confirme.',
    };
  }

  if (paymentResult === 'failure') {
    return {
      type: 'error',
      message: 'El pago no se completo. Podes intentarlo nuevamente.',
    };
  }

  return { type: '', message: '' };
}

function getCurrentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthlyFee(category) {
  if (category === 'Primera') return 65000;
  if (category === 'Desarrollo') return 85000;
  return 0;
}

function getPaymentStatusLabel(status) {
  if (status === 'paid') return 'Aprobado';
  if (status === 'reported') return 'Pendiente de validacion';
  if (status === 'rejected') return 'Rechazado';
  return formatText(status);
}

const NARANJA_PAYMENT_ALIAS =
  import.meta.env.VITE_NARANJA_PAYMENT_ALIAS || 'Alias pendiente de configurar';
const NARANJA_PAYMENT_CBU = import.meta.env.VITE_NARANJA_PAYMENT_CBU || '';
const NARANJA_PAYMENT_HOLDER = import.meta.env.VITE_NARANJA_PAYMENT_HOLDER || '';

function MyPlayerProfile() {
  const navigate = useNavigate();
  const { user, profile, isPlayer, signOut } = useAuth();
  const [initialPaymentNotice] = useState(getInitialPaymentNotice);

  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(() =>
    initialPaymentNotice.type === 'error' ? initialPaymentNotice.message : ''
  );
  const [notFound, setNotFound] = useState(false);
  const [renderPhotoUrl, setRenderPhotoUrl] = useState('');
  const [playerTeams, setPlayerTeams] = useState([]);
  const [payments, setPayments] = useState([]);
  const [successMessage, setSuccessMessage] = useState(() =>
    initialPaymentNotice.type === 'success' ? initialPaymentNotice.message : ''
  );
  const [photoUploading, setPhotoUploading] = useState(false);
  const [jerseyNumberInput, setJerseyNumberInput] = useState('');
  const [jerseySaving, setJerseySaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [paymentReportSaving, setPaymentReportSaving] = useState(false);

  useEffect(() => {
    async function loadPlayerProfile() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage((currentMessage) =>
        initialPaymentNotice.type === 'error' ? currentMessage : ''
      );
      setSuccessMessage((currentMessage) =>
        initialPaymentNotice.type === 'success' ? currentMessage : ''
      );
      setNotFound(false);
      setRenderPhotoUrl('');
      setPlayerTeams([]);
      setPayments([]);

      const { data, error } = await supabase
        .from('players')
        .select(PLAYER_DETAIL_SELECT)
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
        setJerseyNumberInput(data.jersey_number || '');
        setRenderPhotoUrl(await resolvePlayerPhotoUrl(data.photo_url || ''));
        const [{ data: playerTeamsData }, { data: paymentsData }] = await Promise.all([
          supabase
            .from('player_teams')
            .select('id, teams(name, slug)')
            .eq('player_id', data.id),
          supabase
            .from('player_payments')
            .select(PAYMENT_HISTORY_SELECT)
            .eq('player_id', data.id)
            .order('payment_date', { ascending: false })
            .limit(10),
        ]);
        setPlayerTeams(playerTeamsData || []);
        setPayments(paymentsData || []);
        setLoading(false);
        return;
      }

      const { data: legacyData, error: legacyError } = await supabase
        .from('players')
        .select(PLAYER_DETAIL_SELECT)
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
      setJerseyNumberInput(legacyData.jersey_number || '');
      setRenderPhotoUrl(await resolvePlayerPhotoUrl(legacyData.photo_url || ''));
      const [{ data: legacyPlayerTeams }, { data: legacyPayments }] = await Promise.all([
        supabase
          .from('player_teams')
          .select('id, teams(name, slug)')
          .eq('player_id', legacyData.id),
        supabase
          .from('player_payments')
          .select(PAYMENT_HISTORY_SELECT)
          .eq('player_id', legacyData.id)
          .order('payment_date', { ascending: false })
          .limit(10),
      ]);
      setPlayerTeams(legacyPlayerTeams || []);
      setPayments(legacyPayments || []);
      setLoading(false);
    }

    loadPlayerProfile();
  }, [user?.id, initialPaymentNotice.type]);

  useEffect(() => {
    if (initialPaymentNotice.message) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [initialPaymentNotice.message]);

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !player?.id) {
      return;
    }

    const photoValidationMessage = validatePlayerPhoto(file);
    if (photoValidationMessage) {
      setErrorMessage(photoValidationMessage);
      setSuccessMessage('');
      return;
    }

    setPhotoUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const previousPhotoUrl = player.photo_url || null;
    const previousPhotoThumbUrl = player.photo_thumb_url || null;
    let uploadResult = null;

    try {
      uploadResult = await uploadPlayerPhoto(file, player.id);

      const { data, error } = await supabase.rpc('update_own_player_photo', {
        p_player_id: player.id,
        p_photo_url: uploadResult.publicUrl,
        p_photo_thumb_url: uploadResult.thumbPublicUrl,
      });

      if (error) {
        throw error;
      }

      const updatedPhotoRow = Array.isArray(data) ? data[0] : data;

      setPlayer((currentPlayer) =>
        currentPlayer
          ? {
              ...currentPlayer,
              photo_url: updatedPhotoRow?.photo_url || uploadResult.publicUrl,
              photo_thumb_url: updatedPhotoRow?.photo_thumb_url || uploadResult.thumbPublicUrl,
              updated_at: updatedPhotoRow?.updated_at || new Date().toISOString(),
            }
          : currentPlayer
      );
      setRenderPhotoUrl(await resolvePlayerPhotoUrl(uploadResult.publicUrl));

      if (previousPhotoUrl && previousPhotoUrl !== uploadResult.publicUrl) {
        await removePlayerPhotoSet(previousPhotoUrl, previousPhotoThumbUrl);
      }

      setSuccessMessage('Foto actualizada correctamente.');
    } catch (photoError) {
      console.error('Error actualizando foto propia:', photoError);

      if (uploadResult?.publicUrl) {
        await removePlayerPhotoSet(uploadResult.publicUrl, uploadResult.thumbPublicUrl);
      }

      setErrorMessage(photoError.message || 'No se pudo actualizar la foto.');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleJerseySubmit(event) {
    event.preventDefault();

    if (!player?.id) {
      return;
    }

    setJerseySaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    const { data, error } = await supabase.rpc('update_own_player_jersey', {
      p_player_id: player.id,
      p_jersey_number: jerseyNumberInput,
    });

    if (error) {
      console.error('Error actualizando camiseta propia:', error);
      setErrorMessage(error.message || 'No se pudo actualizar la camiseta.');
      setJerseySaving(false);
      return;
    }

    const updatedRow = Array.isArray(data) ? data[0] : data;
    const updatedJerseyNumber = updatedRow?.jersey_number || '';

    setPlayer((currentPlayer) =>
      currentPlayer
        ? {
            ...currentPlayer,
            jersey_number: updatedJerseyNumber,
            updated_at: updatedRow?.updated_at || new Date().toISOString(),
          }
        : currentPlayer
    );
    setJerseyNumberInput(updatedJerseyNumber);
    setSuccessMessage('Camiseta actualizada correctamente.');
    setJerseySaving(false);
  }

  function handleReceiptFileChange(event) {
    setReceiptFile(event.target.files?.[0] || null);
  }

  async function handlePaymentReportSubmit(event) {
    event.preventDefault();

    if (!player?.id) return;

    const amount = getMonthlyFee(player.category);
    if (!amount) {
      setErrorMessage('Tu categoria no tiene un monto de cuota configurado.');
      setSuccessMessage('');
      return;
    }

    const receiptValidationMessage = validatePaymentReceipt(receiptFile);
    if (receiptValidationMessage) {
      setErrorMessage(receiptValidationMessage);
      setSuccessMessage('');
      return;
    }

    setPaymentReportSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    let receipt = null;

    try {
      receipt = await uploadPaymentReceipt(receiptFile, player.id);
      const period = getCurrentPeriod();

      const { data, error } = await supabase
        .from('player_payments')
        .insert({
          player_id: player.id,
          amount,
          payment_date: new Date().toISOString().slice(0, 10),
          method: 'Naranja X',
          period,
          status: 'reported',
          notes: 'Pago informado por el jugador. Pendiente de validacion admin.',
          receipt_path: receipt.path,
          receipt_file_name: receipt.fileName,
        })
        .select(PAYMENT_HISTORY_SELECT)
        .single();

      if (error) {
        throw error;
      }

      setPayments((currentPayments) => [data, ...currentPayments]);
      setReceiptFile(null);
      event.target.reset();
      setSuccessMessage('Pago informado correctamente. Queda pendiente de validacion.');
    } catch (paymentReportError) {
      console.error('Error informando pago:', paymentReportError);
      if (receipt?.path) {
        await removePaymentReceipt(receipt.path);
      }
      setErrorMessage(paymentReportError.message || 'No se pudo informar el pago.');
    } finally {
      setPaymentReportSaving(false);
    }
  }

  async function handleOpenReceipt(receiptPath) {
    try {
      await openPaymentReceipt(receiptPath);
    } catch (receiptError) {
      console.error('Error abriendo comprobante:', receiptError);
      setErrorMessage(receiptError.message || 'No se pudo abrir el comprobante.');
      setSuccessMessage('');
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
  const effectivePaymentStatus = getEffectivePaymentStatus(player);
  const paymentLabel = effectivePaymentStatus ? 'Al dia' : 'Pendiente';
  const monthlyFee = getMonthlyFee(player?.category);
  const currentPeriod = getCurrentPeriod();
  const hasReportedCurrentPayment = payments.some(
    (payment) => payment.status === 'reported' && payment.period === currentPeriod
  );
  const memberId = formatMemberId(player);
  const issueDate = formatDate(player?.created_at);
  const dueDate = formatDate(player?.last_payment_date);
  const teamsLabel =
    playerTeams
      .map((playerTeam) => playerTeam.teams?.name)
      .filter(Boolean)
      .join(', ') || '-';
  const completeness = getPlayerCompleteness(
    player,
    playerTeams.map((playerTeam) => playerTeam.teams?.name).filter(Boolean),
    { requireTeam: false }
  );
  const verificationUrl = player?.id ? `${window.location.origin}/verify/${player.id}` : '';
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
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {notFound && (
        <div className="empty-card">
          <h2>Ficha tecnica no disponible</h2>
          <p>No tenes una ficha tecnica asociada. Contacta al administrador.</p>
        </div>
      )}

      {!notFound && player && (
        <>
          <section
            className={`profile-completeness-card ${
              completeness.isComplete
                ? 'profile-completeness-complete'
                : 'profile-completeness-missing'
            }`}
          >
            <div>
              <span className="detail-label">Estado del perfil</span>
              <strong>{completeness.label}</strong>
              {!completeness.isComplete && (
                <p>
                  Falta completar: {completeness.missingFields.join(', ')}.
                </p>
              )}
            </div>
          </section>

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

                {!renderPhotoUrl && (
                  <div className="member-card-photo-placeholder">
                    Sin foto cargada
                  </div>
                )}

                <label className="primary-button photo-upload-button">
                  {photoUploading ? 'Subiendo foto...' : 'Cambiar foto'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handlePhotoUpload}
                    disabled={photoUploading}
                  />
                </label>

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
                  <span>Camiseta:</span> {formatText(player.jersey_number)}
                </p>
                <p>
                  <span>Equipos:</span> {teamsLabel}
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
                <span className="detail-label">Camiseta</span>
                <form className="jersey-inline-form" onSubmit={handleJerseySubmit}>
                  <input
                    name="jersey_number"
                    aria-label="Numero de camiseta"
                    placeholder="Ej: 10"
                    value={jerseyNumberInput}
                    onChange={(event) => setJerseyNumberInput(event.target.value)}
                  />
                  <button type="submit" className="secondary-button small-button" disabled={jerseySaving}>
                    {jerseySaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </form>
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
                <span className="detail-label">Equipos</span>
                <span className="detail-value">{teamsLabel}</span>
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
                    effectivePaymentStatus ? 'badge-success' : 'badge-warning'
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
            <h2>Informar pago</h2>
            <p className="checkout-helper-text">
              Transferi desde tu banco o billetera a Naranja X y subi el comprobante. El admin
              valida el pago y ahi tu cuota queda al dia.
            </p>

            <div className="payment-instructions-card">
              <div>
                <span className="detail-label">Monto del periodo {currentPeriod}</span>
                <strong>{monthlyFee ? formatCurrency(monthlyFee) : 'Sin monto configurado'}</strong>
              </div>
              <div>
                <span className="detail-label">Alias</span>
                <strong>{NARANJA_PAYMENT_ALIAS}</strong>
              </div>
              {NARANJA_PAYMENT_CBU && (
                <div>
                  <span className="detail-label">CBU/CVU</span>
                  <strong>{NARANJA_PAYMENT_CBU}</strong>
                </div>
              )}
              {NARANJA_PAYMENT_HOLDER && (
                <div>
                  <span className="detail-label">Titular</span>
                  <strong>{NARANJA_PAYMENT_HOLDER}</strong>
                </div>
              )}
            </div>

            <form className="payment-report-form" onSubmit={handlePaymentReportSubmit}>
              <div className="form-field">
                <label>Comprobante</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={handleReceiptFileChange}
                  disabled={paymentReportSaving || effectivePaymentStatus || hasReportedCurrentPayment}
                />
              </div>
              <button
                type="submit"
                className="primary-button"
                disabled={
                  paymentReportSaving ||
                  effectivePaymentStatus ||
                  hasReportedCurrentPayment ||
                  !monthlyFee
                }
              >
                {paymentReportSaving
                  ? 'Enviando comprobante...'
                  : effectivePaymentStatus
                    ? 'Cuota al dia'
                    : hasReportedCurrentPayment
                      ? 'Pago pendiente de validacion'
                      : 'Informar pago'}
              </button>
            </form>
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
                      <th>Estado</th>
                      <th>Comprobante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDate(payment.payment_date)}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{formatText(payment.method)}</td>
                        <td>{formatText(payment.period)}</td>
                        <td>{getPaymentStatusLabel(payment.status)}</td>
                        <td>
                          {payment.receipt_path ? (
                            <button
                              type="button"
                              className="secondary-button small-button"
                              onClick={() => handleOpenReceipt(payment.receipt_path)}
                            >
                              Ver
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
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

