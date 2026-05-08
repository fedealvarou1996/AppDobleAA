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
    return jsonResponse({ error: 'Solo los administradores pueden eliminar jugadores.' }, 403);
  }

  const { playerId } = await req.json();

  if (!playerId || typeof playerId !== 'string') {
    return jsonResponse({ error: 'Falta playerId en la solicitud.' }, 400);
  }

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id, user_id')
    .eq('id', playerId)
    .maybeSingle();

  if (playerError) {
    return jsonResponse({ error: 'No se pudo cargar el jugador.' }, 500);
  }

  if (!player) {
    return jsonResponse({ error: 'Jugador no encontrado.' }, 404);
  }

  const linkedUserId = player.user_id;

  const { error: deletePlayerError } = await adminClient
    .from('players')
    .delete()
    .eq('id', playerId);

  if (deletePlayerError) {
    return jsonResponse({ error: 'No se pudo eliminar el jugador.' }, 500);
  }

  if (!linkedUserId) {
    return jsonResponse({
      message: 'Jugador eliminado correctamente.',
      deletedAuthUser: false,
      deletedProfile: false,
    });
  }

  const { data: linkedPlayers, error: linkedPlayersError } = await adminClient
    .from('players')
    .select('id')
    .eq('user_id', linkedUserId)
    .limit(1);

  if (linkedPlayersError) {
    return jsonResponse(
      {
        message:
          'Jugador eliminado, pero no se pudo verificar la vinculacion para limpiar usuario/perfil.',
        deletedAuthUser: false,
        deletedProfile: false,
      },
      200
    );
  }

  if (linkedPlayers && linkedPlayers.length > 0) {
    return jsonResponse({
      message: 'Jugador eliminado. El usuario sigue vinculado a otra ficha.',
      deletedAuthUser: false,
      deletedProfile: false,
    });
  }

  const { error: deleteProfileError } = await adminClient
    .from('profiles')
    .delete()
    .eq('id', linkedUserId)
    .eq('role', 'player');

  if (deleteProfileError) {
    return jsonResponse(
      {
        message:
          'Jugador eliminado, pero no se pudo eliminar el perfil del usuario vinculado.',
        deletedAuthUser: false,
        deletedProfile: false,
      },
      200
    );
  }

  const { error: deleteAuthUserError } = await adminClient.auth.admin.deleteUser(
    linkedUserId
  );

  if (deleteAuthUserError) {
    return jsonResponse(
      {
        message: 'Jugador eliminado y perfil eliminado, pero no se pudo eliminar auth.users.',
        deletedAuthUser: false,
        deletedProfile: true,
      },
      200
    );
  }

  return jsonResponse({
    message: 'Jugador, perfil y usuario eliminados correctamente.',
    deletedAuthUser: true,
    deletedProfile: true,
  });
});
