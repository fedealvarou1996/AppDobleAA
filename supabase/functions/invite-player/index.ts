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

async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string
) {
  let page = 1;

  while (page <= 10) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const matchedUser = data.users.find(
      (currentUser) => currentUser.email?.toLowerCase() === email.toLowerCase()
    );

    if (matchedUser) {
      return matchedUser;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }

  return null;
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
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Faltan variables de entorno de Supabase.' }, 500);
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
    return jsonResponse({ error: 'No se pudo validar el perfil del administrador.' }, 500);
  }

  if (callerProfile?.role !== 'admin') {
    return jsonResponse({ error: 'Solo los administradores pueden invitar jugadores.' }, 403);
  }

  const { playerId } = await req.json();

  if (!playerId || typeof playerId !== 'string') {
    return jsonResponse({ error: 'Falta playerId en la solicitud.' }, 400);
  }

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id, first_name, last_name, email, user_id')
    .eq('id', playerId)
    .maybeSingle();

  if (playerError) {
    return jsonResponse({ error: 'No se pudo cargar el jugador.' }, 500);
  }

  if (!player) {
    return jsonResponse({ error: 'Jugador no encontrado.' }, 404);
  }

  if (!player.email) {
    return jsonResponse(
      { error: 'El jugador no tiene email configurado para enviar la invitacion.' },
      400
    );
  }

  let invitedUserId = player.user_id || null;
  let invitationCreated = false;

  if (!invitedUserId) {
    const redirectTo = Deno.env.get('PLAYER_INVITE_REDIRECT_TO') || undefined;
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(player.email, {
        data: {
          role: 'player',
        },
        redirectTo,
      });

    if (inviteError) {
      const existingUser = await findAuthUserByEmail(adminClient, player.email);

      if (!existingUser) {
        return jsonResponse(
          {
            error:
              inviteError.message || 'No se pudo enviar la invitacion del jugador.',
          },
          400
        );
      }

      invitedUserId = existingUser.id;
    } else {
      invitedUserId = inviteData.user?.id || null;
      invitationCreated = true;
    }
  }

  if (!invitedUserId) {
    return jsonResponse(
      { error: 'No se pudo resolver el usuario autenticado del jugador.' },
      500
    );
  }

  const { data: linkedPlayer, error: linkedPlayerError } = await adminClient
    .from('players')
    .select('id, first_name, last_name')
    .eq('user_id', invitedUserId)
    .neq('id', player.id)
    .maybeSingle();

  if (linkedPlayerError) {
    return jsonResponse({ error: 'No se pudo validar la vinculacion existente.' }, 500);
  }

  if (linkedPlayer) {
    return jsonResponse(
      {
        error: `Ese usuario ya esta vinculado a ${
          `${linkedPlayer.first_name || ''} ${linkedPlayer.last_name || ''}`.trim() ||
          'otro jugador'
        }.`,
      },
      409
    );
  }

  const { error: profileUpsertError } = await adminClient.from('profiles').upsert(
    {
      id: invitedUserId,
      role: 'player',
    },
    {
      onConflict: 'id',
    }
  );

  if (profileUpsertError) {
    return jsonResponse(
      { error: 'No se pudo preparar el perfil del jugador invitado.' },
      500
    );
  }

  const { error: playerUpdateError } = await adminClient
    .from('players')
    .update({
      user_id: invitedUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', player.id);

  if (playerUpdateError) {
    return jsonResponse(
      { error: 'No se pudo vincular el jugador con el usuario invitado.' },
      500
    );
  }

  return jsonResponse({
    message: invitationCreated
      ? 'Invitacion enviada correctamente.'
      : 'El usuario ya existia y fue vinculado correctamente.',
    userId: invitedUserId,
  });
});
