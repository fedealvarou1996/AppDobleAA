import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function formatCurrency(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return '$ 0';

  return amount.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
}

function formatDate(value: unknown) {
  if (!value) return '-';

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const date = dateOnlyMatch ? new Date(`${value}T00:00:00`) : new Date(String(value));

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-AR');
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const notificationEmail = Deno.env.get('PAYMENT_NOTIFICATION_EMAIL');
  const fromEmail =
    Deno.env.get('PAYMENT_NOTIFICATION_FROM') ||
    'Asociacion de Atletas <onboarding@resend.dev>';
  const appBaseUrl = (Deno.env.get('APP_BASE_URL') || '').replace(/\/$/, '');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Falta configuracion de Supabase.' }, 500);
  }

  if (!resendApiKey || !notificationEmail) {
    return jsonResponse({ error: 'Falta configuracion de email.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: 'No autorizado.' }, 401);
  }

  let body: { paymentId?: string } = {};

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Body invalido.' }, 400);
  }

  if (!body.paymentId) {
    return jsonResponse({ error: 'Falta paymentId.' }, 400);
  }

  const { data: payment, error: paymentError } = await adminClient
    .from('player_payments')
    .select('id, player_id, amount, payment_date, method, period, status, created_at')
    .eq('id', body.paymentId)
    .maybeSingle();

  if (paymentError || !payment) {
    return jsonResponse({ error: 'Pago no encontrado.' }, 404);
  }

  if (payment.status !== 'reported') {
    return jsonResponse({ ok: true, skipped: true, reason: 'El pago no esta pendiente.' });
  }

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id, first_name, last_name, dni, category, user_id, profile_id')
    .eq('id', payment.player_id)
    .maybeSingle();

  if (playerError || !player) {
    return jsonResponse({ error: 'Jugador no encontrado.' }, 404);
  }

  if (player.user_id !== user.id && player.profile_id !== user.id) {
    return jsonResponse({ error: 'No autorizado para este pago.' }, 403);
  }

  const playerName =
    `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Jugador sin nombre';
  const playerUrl = appBaseUrl ? `${appBaseUrl}/players/${player.id}` : '';
  const subject = `Nuevo pago informado - ${playerName}`;
  const text = [
    'Nuevo pago informado',
    '',
    `Jugador: ${playerName}`,
    `DNI: ${player.dni || '-'}`,
    `Categoria: ${player.category || '-'}`,
    `Monto: ${formatCurrency(payment.amount)}`,
    `Periodo: ${payment.period || '-'}`,
    `Fecha informada: ${formatDate(payment.payment_date)}`,
    `Metodo: ${payment.method || '-'}`,
    '',
    playerUrl ? `Revisar en: ${playerUrl}` : 'Revisalo desde el dashboard admin.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h1 style="margin: 0 0 16px;">Nuevo pago informado</h1>
      <p>Un jugador subio un comprobante y el pago quedo pendiente de validacion.</p>
      <table style="border-collapse: collapse; margin: 18px 0; width: 100%; max-width: 560px;">
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Jugador</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(playerName)}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>DNI</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(player.dni || '-')}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Categoria</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(player.category || '-')}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Monto</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(formatCurrency(payment.amount))}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Periodo</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(payment.period || '-')}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Fecha informada</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(formatDate(payment.payment_date))}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Metodo</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(payment.method || '-')}</td></tr>
      </table>
      ${
        playerUrl
          ? `<p><a href="${escapeHtml(playerUrl)}" style="display: inline-block; padding: 10px 14px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;">Revisar pago</a></p>`
          : '<p>Revisalo desde el dashboard admin.</p>'
      }
    </div>
  `;

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `payment-report-${payment.id}`,
      'User-Agent': 'asociacion-atletas-supabase-function',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [notificationEmail],
      subject,
      html,
      text,
    }),
  });

  if (!emailResponse.ok) {
    const errorPayload = await emailResponse.text();
    console.error('Error enviando email de pago:', errorPayload);
    return jsonResponse({ error: 'No se pudo enviar el email.' }, 502);
  }

  const emailPayload = await emailResponse.json();
  return jsonResponse({ ok: true, emailId: emailPayload.id });
});
