import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'npm:mercadopago';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function toDateOnly(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: true }, 200);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const mercadoPagoAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');

  if (!supabaseUrl || !supabaseServiceRoleKey || !mercadoPagoAccessToken || !webhookSecret) {
    return jsonResponse({ error: 'Faltan variables de entorno.' }, 500);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const url = new URL(req.url);
  const queryType = url.searchParams.get('type') || url.searchParams.get('topic');
  const queryDataId =
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    url.searchParams.get('resource.id');

  const body = await req.json().catch(() => ({}));
  const bodyType = typeof body?.type === 'string' ? body.type : null;
  const bodyAction = typeof body?.action === 'string' ? body.action : null;
  const bodyDataId = body?.data?.id ? String(body.data.id) : null;

  const eventType = queryType || bodyType;
  const paymentId = queryDataId || bodyDataId;

  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers.get('x-signature') || '',
      xRequestId: req.headers.get('x-request-id') || '',
      dataId: paymentId || '',
      secret: webhookSecret,
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return jsonResponse({ error: 'Firma de webhook invalida.' }, 401);
    }

    return jsonResponse({ error: 'No se pudo validar la firma del webhook.' }, 401);
  }

  if (!eventType || !String(eventType).includes('payment')) {
    await adminClient.from('mercadopago_events').insert({
      event_type: String(eventType || 'unknown'),
      action: String(bodyAction || 'ignored_event'),
      status: 'ignored',
      raw_payload: body,
    });

    return jsonResponse({ ok: true }, 200);
  }

  if (!paymentId) {
    await adminClient.from('mercadopago_events').insert({
      event_type: String(eventType),
      action: String(bodyAction || 'missing_payment_id'),
      status: 'ignored',
      raw_payload: body,
    });

    return jsonResponse({ ok: true }, 200);
  }

  const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken}`,
    },
  });

  const payment = await paymentResponse.json().catch(() => null);

  if (!paymentResponse.ok || !payment) {
    await adminClient.from('mercadopago_events').insert({
      event_type: String(eventType),
      action: String(bodyAction || 'payment_lookup_failed'),
      mp_payment_id: String(paymentId),
      status: 'lookup_failed',
      status_detail: `Mercado Pago respondio ${paymentResponse.status}`,
      raw_payload: {
        notification: body,
        payment_lookup_response: payment,
      },
    });

    return jsonResponse({ ok: true, ignored: true }, 200);
  }

  const externalReference = payment.external_reference
    ? String(payment.external_reference)
    : null;
  const metadataPlayerId = payment.metadata?.player_id
    ? String(payment.metadata.player_id)
    : null;
  const playerId = metadataPlayerId || (externalReference ? externalReference.split(':')[0] : null);
  const period = payment.metadata?.period ? String(payment.metadata.period) : null;
  const amount = Number(payment.transaction_amount || 0);
  const status = String(payment.status || 'unknown');
  const statusDetail = String(payment.status_detail || '');
  const preferenceId = payment.order?.id ? String(payment.order.id) : null;

  await adminClient.from('mercadopago_events').insert({
    event_type: String(eventType),
    action: String(bodyAction || 'payment_notification'),
    external_reference: externalReference,
    mp_payment_id: String(payment.id),
    mp_preference_id: preferenceId,
    status,
    status_detail: statusDetail,
    amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : null,
    player_id: playerId,
    raw_payload: payment,
  });

  if (status !== 'approved' || !playerId) {
    return jsonResponse({ ok: true }, 200);
  }

  const paymentDate = toDateOnly(payment.date_approved || payment.date_created);

  const { error: paymentInsertError } = await adminClient.from('player_payments').insert({
    player_id: playerId,
    amount: Number(amount.toFixed(2)),
    payment_date: paymentDate,
    method: 'Mercado Pago',
    period,
    status: 'paid',
    notes: `Pago online aprobado (${payment.id})`,
    mp_payment_id: String(payment.id),
    mp_preference_id: preferenceId,
  });

  if (paymentInsertError) {
    const duplicate = paymentInsertError.code === '23505';

    if (!duplicate) {
      return jsonResponse({ error: 'No se pudo registrar el pago aprobado.' }, 500);
    }
  }

  await adminClient
    .from('players')
    .update({
      payment_status: true,
      last_payment_date: paymentDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playerId);

  return jsonResponse({ ok: true }, 200);
});
