// netlify/functions/auth-refresh.js
// POST { refresh_token } -> troca por um novo par access_token/refresh_token.
// O front-end chama isso quando auth-me devolve 401 (access_token expirado),
// evitando deslogar o usuário a cada ~1h.

const { supabaseAdmin, toPublicUser, toSession } = require('./_lib/supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método não permitido.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Corpo da requisição inválido.' });
  }

  const refresh_token = body.refresh_token;
  if (!refresh_token) {
    return json(400, { error: 'refresh_token ausente.' });
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    return json(500, { error: e.message });
  }

  const { data, error } = await admin.auth.refreshSession({ refresh_token });
  if (error || !data?.session) {
    return json(401, { error: 'Não foi possível renovar a sessão. Faça login novamente.' });
  }

  return json(200, {
    user: toPublicUser(data.user),
    session: toSession(data.session),
  });
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}
