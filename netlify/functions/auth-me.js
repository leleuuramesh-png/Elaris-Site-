// netlify/functions/auth-me.js
// GET com header "Authorization: Bearer <access_token>" -> valida o token
// no Supabase e devolve o usuário logado (ou 401, inclusive se expirou —
// nesse caso o front-end chama auth-refresh).

const { supabaseAdmin, getBearerToken, toPublicUser } = require('./_lib/supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Método não permitido.' });
  }

  const token = getBearerToken(event);
  if (!token) {
    return json(401, { error: 'Sem sessão ativa.' });
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    return json(500, { error: e.message });
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    return json(401, { error: 'Sessão inválida ou expirada.' });
  }

  return json(200, { user: toPublicUser(data.user) });
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}
