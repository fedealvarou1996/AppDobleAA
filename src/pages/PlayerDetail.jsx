import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { resolvePlayerPhotoUrl } from '../utils/playerPhotoUrl';
import { getEffectivePaymentStatus, isCurrentMonthlyPeriod } from '../utils/paymentPeriod';
import { getPlayerCompleteness } from '../utils/playerCompleteness';
import { PAYMENT_HISTORY_SELECT, PLAYER_DETAIL_SELECT } from '../utils/supabaseSelects';
import { openPaymentReceipt } from '../utils/paymentReceiptUpload';

function formatDate(value) {
  if (!value) return '-';

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = dateOnlyMatch
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-AR');
}

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function getPaymentStatusLabel(status) {
  if (status === 'paid') return 'Aprobado';
  if (status === 'reported') return 'Pendiente';
  if (status === 'rejected') return 'Rechazado';
  return formatText(status);
}

function getPaymentStatusBadgeClass(status) {
  if (status === 'paid') return 'badge-success';
  if (status === 'reported') return 'badge-warning';
  if (status === 'rejected') return 'badge-danger';
  return 'badge-warning';
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
  const [renderPhotoUrl, setRenderPhotoUrl] = useState('');
  const [playerTeams, setPlayerTeams] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState('');
  const [reviewingPaymentId, setReviewingPaymentId] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    method: '',
    period: '',
    notes: '',
  });

  useEffect(() => {
    async function loadPlayer() {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');
      setNotFound(false);
      setRenderPhotoUrl('');
      setPlayerTeams([]);

      const { data, error } = await supabase
        .from('players')
        .select(PLAYER_DETAIL_SELECT)
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
      const resolvedPhotoUrl = await resolvePlayerPhotoUrl(data.photo_url || '');
      setRenderPhotoUrl(resolvedPhotoUrl);

      const [
        { data: playerTeamsData, error: playerTeamsError },
        { data: paymentsData, error: paymentsError },
      ] = await Promise.all([
        supabase
          .from('player_teams')
          .select('id, teams(name, slug)')
          .eq('player_id', id),
        supabase
          .from('player_payments')
          .select(PAYMENT_HISTORY_SELECT)
          .eq('player_id', id)
          .order('payment_date', { ascending: false }),
      ]);

      if (playerTeamsError) {
        console.error('Error cargando equipos del jugador:', playerTeamsError);
        setErrorMessage('No se pudieron cargar los equipos del jugador.');
        setLoading(false);
        return;
      }

      if (paymentsError) {
        console.error('Error cargando historial de pagos:', paymentsError);
        setErrorMessage('No se pudo cargar el historial de pagos.');
        setLoading(false);
        return;
      }

      setPlayerTeams(playerTeamsData || []);
      setPayments(paymentsData || []);
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

  function handlePaymentFormChange(event) {
    const { name, value } = event.target;
    setPaymentForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreatePayment(event) {
    event.preventDefault();
    if (!player?.id) return;

    const amountValue = Number(paymentForm.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setErrorMessage('El monto del pago debe ser mayor a 0.');
      return;
    }

    setPaymentSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    const payload = {
      player_id: player.id,
      amount: amountValue,
      payment_date: paymentForm.payment_date || new Date().toISOString().slice(0, 10),
      method: paymentForm.method || null,
      period: paymentForm.period || null,
      status: 'paid',
      notes: paymentForm.notes || null,
    };

    const { data: paymentData, error: paymentError } = await supabase
      .from('player_payments')
      .insert(payload)
      .select(PAYMENT_HISTORY_SELECT)
      .single();

    if (paymentError) {
      console.error('Error registrando pago:', paymentError);
      setErrorMessage('No se pudo registrar el pago.');
      setPaymentSaving(false);
      return;
    }

    const { error: playerUpdateError } = await supabase
      .from('players')
      .update({
        payment_status: true,
        last_payment_date: payload.payment_date,
        updated_at: new Date().toISOString(),
      })
      .eq('id', player.id);

    if (playerUpdateError) {
      console.error('Error actualizando estado de cuota:', playerUpdateError);
      setErrorMessage('Pago registrado, pero no se pudo actualizar el estado del jugador.');
      setPayments((prev) => [paymentData, ...prev]);
      setPaymentSaving(false);
      return;
    }

    setPayments((prev) => [paymentData, ...prev]);
    setPlayer((prev) =>
      prev
        ? {
            ...prev,
            payment_status: true,
            last_payment_date: payload.payment_date,
            updated_at: new Date().toISOString(),
          }
        : prev
    );
    setPaymentForm({
      amount: '',
      payment_date: new Date().toISOString().slice(0, 10),
      method: '',
      period: '',
      notes: '',
    });
    setSuccessMessage('Pago registrado correctamente.');
    setPaymentSaving(false);
  }

  async function handleDeletePayment(payment) {
    if (!player?.id || !payment?.id) return;
    if (!window.confirm('¿Seguro que queres eliminar este pago?')) {
      return;
    }

    setDeletingPaymentId(payment.id);
    setErrorMessage('');
    setSuccessMessage('');

    const { error: deleteError } = await supabase
      .from('player_payments')
      .delete()
      .eq('id', payment.id)
      .eq('player_id', player.id);

    if (deleteError) {
      console.error('Error eliminando pago:', deleteError);
      setErrorMessage('No se pudo eliminar el pago.');
      setDeletingPaymentId('');
      return;
    }

    const updatedPayments = payments.filter((currentPayment) => currentPayment.id !== payment.id);
    setPayments(updatedPayments);

    const latestPayment = updatedPayments.filter((payment) => payment.status === 'paid').sort((a, b) =>
      String(b.payment_date || '').localeCompare(String(a.payment_date || ''))
    )[0];

    const newLastPaymentDate = latestPayment?.payment_date || null;
    const newPaymentStatus = latestPayment
      ? isCurrentMonthlyPeriod(latestPayment.payment_date)
      : false;

    const { error: playerUpdateError } = await supabase
      .from('players')
      .update({
        last_payment_date: newLastPaymentDate,
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', player.id);

    if (playerUpdateError) {
      console.error('Error actualizando jugador luego de eliminar pago:', playerUpdateError);
      setErrorMessage('Pago eliminado, pero no se pudo actualizar estado del jugador.');
      setDeletingPaymentId('');
      return;
    }

    setPlayer((prev) =>
      prev
        ? {
            ...prev,
            last_payment_date: newLastPaymentDate,
            payment_status: newPaymentStatus,
            updated_at: new Date().toISOString(),
          }
        : prev
    );

    setSuccessMessage('Pago eliminado correctamente.');
    setDeletingPaymentId('');
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

  async function handleApprovePayment(payment) {
    if (!player?.id || !payment?.id) return;

    setReviewingPaymentId(payment.id);
    setErrorMessage('');
    setSuccessMessage('');

    const reviewedAt = new Date().toISOString();
    const paymentDate = payment.payment_date || reviewedAt.slice(0, 10);
    const { data: updatedPayment, error: paymentUpdateError } = await supabase
      .from('player_payments')
      .update({
        status: 'paid',
        reviewed_at: reviewedAt,
        notes: `Pago aprobado por admin el ${formatDateTime(reviewedAt)}.`,
        updated_at: reviewedAt,
      })
      .eq('id', payment.id)
      .eq('player_id', player.id)
      .select(PAYMENT_HISTORY_SELECT)
      .single();

    if (paymentUpdateError) {
      console.error('Error aprobando pago:', paymentUpdateError);
      setErrorMessage('No se pudo aprobar el pago.');
      setReviewingPaymentId('');
      return;
    }

    const { error: playerUpdateError } = await supabase
      .from('players')
      .update({
        payment_status: true,
        last_payment_date: paymentDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', player.id);

    if (playerUpdateError) {
      console.error('Error actualizando jugador luego de aprobar pago:', playerUpdateError);
      setErrorMessage('Pago aprobado, pero no se pudo actualizar el estado del jugador.');
      setReviewingPaymentId('');
      return;
    }

    setPayments((currentPayments) =>
      currentPayments.map((currentPayment) =>
        currentPayment.id === payment.id ? updatedPayment : currentPayment
      )
    );
    setPlayer((currentPlayer) =>
      currentPlayer
        ? {
            ...currentPlayer,
            payment_status: true,
            last_payment_date: paymentDate,
            updated_at: new Date().toISOString(),
          }
        : currentPlayer
    );
    setSuccessMessage('Pago aprobado correctamente.');
    setReviewingPaymentId('');
  }

  async function handleRejectPayment(payment) {
    if (!player?.id || !payment?.id) return;

    setReviewingPaymentId(payment.id);
    setErrorMessage('');
    setSuccessMessage('');

    const { data: updatedPayment, error } = await supabase
      .from('player_payments')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        notes: payment.notes || 'Pago rechazado por admin.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
      .eq('player_id', player.id)
      .select(PAYMENT_HISTORY_SELECT)
      .single();

    if (error) {
      console.error('Error rechazando pago:', error);
      setErrorMessage('No se pudo rechazar el pago.');
      setReviewingPaymentId('');
      return;
    }

    setPayments((currentPayments) =>
      currentPayments.map((currentPayment) =>
        currentPayment.id === payment.id ? updatedPayment : currentPayment
      )
    );
    setSuccessMessage('Pago rechazado correctamente.');
    setReviewingPaymentId('');
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
  const effectivePaymentStatus = getEffectivePaymentStatus(player);
  const paymentLabel = effectivePaymentStatus ? 'Al dia' : 'Pendiente';
  const teamsLabel =
    playerTeams
      .map((playerTeam) => playerTeam.teams?.name)
      .filter(Boolean)
      .join(', ') || '-';
  const completeness = getPlayerCompleteness(
    player,
    playerTeams.map((playerTeam) => playerTeam.teams?.name).filter(Boolean)
  );

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

      <section
        className={`profile-completeness-card ${
          completeness.isComplete ? 'profile-completeness-complete' : 'profile-completeness-missing'
        }`}
      >
        <div>
          <span className="detail-label">Estado del perfil</span>
          <strong>{completeness.label}</strong>
          {!completeness.isComplete && (
            <p>Falta completar: {completeness.missingFields.join(', ')}.</p>
          )}
        </div>
        <button
          type="button"
          className={completeness.isComplete ? 'secondary-button' : 'primary-button'}
          onClick={() => navigate(`/players/${id}/edit`)}
        >
          Completar ficha
        </button>
      </section>

      <section className="detail-card">
        {renderPhotoUrl && (
          <div className="player-photo-wrapper">
            <img
              className="player-photo-large"
              src={renderPhotoUrl}
              alt={`Foto de ${fullName}`}
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">DNI</span>
            <span className="detail-value">{formatText(player.dni)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Camiseta</span>
            <span className="detail-value">{formatText(player.jersey_number)}</span>
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
            <span className="detail-label">Usuario vinculado</span>
            <span className="detail-value">{formatText(player.user_id)}</span>
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

      <section className="detail-card payments-section">
        <h2>Historial de pagos</h2>

        <form className="form-card payments-form" onSubmit={handleCreatePayment}>
          <div className="form-grid">
            <div className="form-field">
              <label>Monto</label>
              <input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={handlePaymentFormChange}
                required
              />
            </div>

            <div className="form-field">
              <label>Fecha de pago</label>
              <input
                type="date"
                name="payment_date"
                value={paymentForm.payment_date}
                onChange={handlePaymentFormChange}
                required
              />
            </div>

            <div className="form-field">
              <label>Metodo</label>
              <input
                type="text"
                name="method"
                placeholder="Transferencia, Efectivo, etc."
                value={paymentForm.method}
                onChange={handlePaymentFormChange}
              />
            </div>

            <div className="form-field">
              <label>Periodo</label>
              <input
                type="text"
                name="period"
                placeholder="2026-05"
                value={paymentForm.period}
                onChange={handlePaymentFormChange}
              />
            </div>
          </div>

          <div className="form-field">
            <label>Notas</label>
            <textarea
              name="notes"
              rows="2"
              value={paymentForm.notes}
              onChange={handlePaymentFormChange}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={paymentSaving}>
              {paymentSaving ? 'Guardando pago...' : 'Registrar pago'}
            </button>
          </div>
        </form>

        {!payments.length ? (
          <div className="empty-card">
            <p>Aun no hay pagos registrados para este jugador.</p>
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
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.payment_date)}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>{formatText(payment.method)}</td>
                    <td>{formatText(payment.period)}</td>
                    <td>
                      <span className={`badge ${getPaymentStatusBadgeClass(payment.status)}`}>
                        {getPaymentStatusLabel(payment.status)}
                      </span>
                    </td>
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
                    <td>{formatText(payment.notes)}</td>
                    <td>
                      {payment.status === 'reported' && (
                        <>
                          <button
                            type="button"
                            className="primary-button small-button"
                            onClick={() => handleApprovePayment(payment)}
                            disabled={reviewingPaymentId === payment.id}
                          >
                            {reviewingPaymentId === payment.id ? 'Procesando...' : 'Aprobar'}
                          </button>
                          <button
                            type="button"
                            className="secondary-button small-button"
                            onClick={() => handleRejectPayment(payment)}
                            disabled={reviewingPaymentId === payment.id}
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="danger-button small-button"
                        onClick={() => handleDeletePayment(payment)}
                        disabled={deletingPaymentId === payment.id}
                      >
                        {deletingPaymentId === payment.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default PlayerDetail;
