// MCF TICKETS: altas de personal desde servidor. No exponer service_role.
import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const allowedOrigins = new Set(['https://allggames.github.io', 'http://localhost:4173']);
const json = (body: unknown, status: number, origin: string) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://allggames.github.io',
    'Vary': 'Origin' },
});

Deno.serve(async req => {
  const origin = req.headers.get('origin') ?? '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://allggames.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
  const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publicKey || !secretKey) return json({ error: 'Server configuration missing' }, 503, origin);

  const authClient = createClient(url, publicKey, { auth: { persistSession: false } });
  const adminClient = createClient(url, secretKey, { auth: { persistSession: false } });
  const token = authHeader.slice(7);
  const { data: { user }, error: userError } = await authClient.auth.getUser(token);
  if (userError || !user) return json({ error: 'Invalid session' }, 401, origin);
  const { data: actor, error: actorError } = await adminClient.from('profiles')
    .select('id,role,active').eq('id', user.id).maybeSingle();
  if (actorError || !actor || !actor.active || actor.role !== 'admin')
    return json({ error: 'Administrator permission required' }, 403, origin);

  let body: { action?: unknown; name?: unknown; email?: unknown; role?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400, origin); }

  if (body.action === 'list') {
    const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return json({ error: 'Could not list users' }, 500, origin);
    return json({ users: data.users.map(person => ({ id: person.id, email: person.email })) }, 200, origin);
  }
  if (body.action !== 'invite') return json({ error: 'Unknown action' }, 400, origin);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = body.role === 'admin' ? 'admin' : body.role === 'promoter' ? 'promoter' : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || name.length < 2 || name.length > 120 || !role)
    return json({ error: 'Invalid user information' }, 400, origin);

  const { data, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: 'https://allggames.github.io/MCFTICKETS/?setup=1#/permisos',
  });
  if (inviteError || !data.user) return json({ error: 'Could not invite user' }, 400, origin);

  // La invitación no habilita privilegios. Solo un admin activo puede hacerlo.
  const { error: profileError } = await adminClient.from('profiles').insert({
    id: data.user.id, display_name: name, role, active: false,
  });
  if (profileError) return json({ error: 'Invitation sent, but profile registration needs attention' }, 500, origin);
  return json({ ok: true, user_id: data.user.id }, 201, origin);
});
