// netlify/functions/_lib/supabase.js
// Cliente admin do Supabase (usa a SUPABASE_SECRET_KEY, ignora RLS) +
// helpers pequenos reusados pelos endpoints de auth. Mesmo padrão do
// org-create.js já existente.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

function supabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY ausentes nas variáveis de ambiente do Netlify.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getBearerToken(event) {
  const header = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// user_metadata é onde guardamos name/orgName no signup (auth.users nativo
// do Supabase). Plano real vem da organização (org-create.js / tabela
// organizations), não do usuário — aqui só devolvemos um placeholder.
function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || '',
    orgName: user.user_metadata?.orgName || '',
  };
}

function toSession(session) {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
}

module.exports = { supabaseAdmin, getBearerToken, toPublicUser, toSession };
