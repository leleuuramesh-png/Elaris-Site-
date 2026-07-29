// netlify/functions/auth-logout.js
// POST com header "Authorization: Bearer <access_token>" -> revoga a sessão
// no Supabase (best-effort). O front-end limpa os tokens localmente de
// qualquer forma, então uma falha aqui não trava o logout.

const { supabaseAdmin, getBearerToken } = require('./_lib/supabase');

exports.handler = async (event) => {
  const token = getBearerToken(event);
  if (token) {
    try {
      const admin = supabaseAdmin();
      await admin.auth.admin.signOut(token);
    } catch (e) {
      // best-effort — não bloqueia o logout no front-end
    }
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
