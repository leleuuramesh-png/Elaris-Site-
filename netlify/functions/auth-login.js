// netlify/functions/auth-login.js
// POST { email, password } -> valida credenciais no Supabase Auth,
// devolve o usuário + access_token/refresh_token.

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

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) {
    return json(400, { error: 'Informe e-mail e senha.' });
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    return json(500, { error: e.message });
  }

  const { data, error } = await admin.auth.signInWithPassword({ email, password });
  if (error) {
    return json(401, { error: 'E-mail ou senha incorretos.' });
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
