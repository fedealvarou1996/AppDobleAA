import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getCurrentPeriod() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
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
  const mercadoPagoAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Faltan variables de entorno de Supabase.' }, 500);
  }

  if (!mercadoPagoAccessToken) {
    return jsonResponse({ error: 'Falta MERCADOPAGO_ACCESS_TOKEN.' }, 500);
  }

  if (!authHeader) {
    return jsonResponse({ error: 'No autorizado.' }, 401);
  }

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const {
    data: { user: callerUser },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !callerUser) {
    return jsonResponse({ error: 'No se pudo validar el usuario autenticado.' }, 401);
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', callerUser.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse({ error: 'No se pudo validar el perfil del usuario.' }, 500);
  }

  if (callerProfile?.role !== 'player') {
    return jsonResponse({ error: 'Solo los jugadores pueden iniciar este pago.' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const amount = Number(body?.amount);
  const period = typeof body?.period === 'string' && body.period ? body.period : getCurrentPeriod();

  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ error: 'El monto debe ser mayor a 0.' }, 400);
  }

  const title = typeof body?.title === 'string' && body.title.trim()
    ? body.title.trim()
    : `Cuota mensual ${period}`;

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id, first_name, last_name, email')
    .eq('user_id', callerUser.id)
    .maybeSingle();

  if (playerError) {
    return jsonResponse({ error: 'No se pudo cargar el jugador.' }, 500);
  }

  if (!player?.id) {
    return jsonResponse({ error: 'No tenes una ficha de jugador vinculada.' }, 404);
  }

  const requestOrigin = req.headers.get('origin') || Deno.env.get('APP_BASE_URL') || '';
  if (!requestOrigin) {
    return jsonResponse({ error: 'No se pudo resolver el dominio de retorno.' }, 500);
  }

  const webhookUrl = Deno.env.get('MERCADOPAGO_WEBHOOK_URL');
  const now = new Date();
  const externalReference = `${player.id}:${period}:${now.getTime()}`;

  const preferencePayload: Record<string, unknown> = {
    items: [
      {
        title,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: Number(amount.toFixed(2)),
      },
    ],
    payer: {
      email: player.email || callerUser.email || undefined,
      name: player.first_name || undefined,
      surname: player.last_name || undefined,
    },
    external_reference: externalReference,
    metadata: {
      player_id: player.id,
      period,
      created_by_user_id: callerUser.id,
    },
    back_urls: {
      success: `${requestOrigin}/my-profile?payment=success`,
      failure: `${requestOrigin}/my-profile?payment=failure`,
      pending: `${requestOrigin}/my-profile?payment=pending`,
    },
    auto_return: 'approved',
  };

  if (webhookUrl) {
    preferencePayload.notification_url = webhookUrl;
  }

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preferencePayload),
  });

  const responsePayload = await response.json().catch(() => null);

  if (!response.ok) {
    return jsonResponse(
      {
        error: 'No se pudo crear el checkout en Mercado Pago.',
        details: responsePayload,
      },
      502
    );
  }

  const preferenceId = responsePayload?.id;
  const checkoutUrl = responsePayload?.init_point || responsePayload?.sandbox_init_point;

  if (!preferenceId || !checkoutUrl) {
    return jsonResponse({ error: 'Mercado Pago no devolvio los datos esperados.' }, 502);
  }

  await adminClient.from('mercadopago_events').insert({
    event_type: 'preference_created',
    action: 'create_checkout',
    external_reference: externalReference,
    mp_preference_id: String(preferenceId),
    status: 'pending',
    amount: Number(amount.toFixed(2)),
    player_id: player.id,
    raw_payload: responsePayload,
  });

  return jsonResponse({
    checkoutUrl,
    preferenceId,
    externalReference,
  });
});
