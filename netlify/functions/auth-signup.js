// netlify/functions/auth-signup.js
// POST { name, email, password, orgName } -> cria usuário real no Supabase Auth
// + devolve access_token/refresh_token (o front-end guarda e manda como
// "Authorization: Bearer" em chamadas protegidas, ex: org-create.js).

const { supabaseAdmin, toPublicUser, toSession } = require('./_lib/supabase');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const orgName = (body.orgName || '').trim() || 'Meu workspace';

  if (!name || !email || !password) {
    return json(400, { error: 'Preencha nome, e-mail e senha.' });
  }
  if (!EMAIL_RE.test(email)) {
    return json(400, { error: 'E-mail inválido.' });
  }
  if (password.length < 8) {
    return json(400, { error: 'A senha precisa ter pelo menos 8 caracteres.' });
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e) {
    return json(500, { error: e.message });
  }

  // Cria já confirmado: ainda não há fluxo de e-mail transacional (item
  // separado do roadmap), então exigir confirmação por e-mail deixaria
  // todo mundo travado na primeira tela.
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, orgName },
  });
  if (createError) {
    const isDuplicate = /already.*registered|already exists/i.test(createError.message);
    return json(isDuplicate ? 409 : 500, {
      error: isDuplicate ? 'Já existe uma conta com esse e-mail.' : createError.message,
    });
  }

  const { data: signInData, error: signInError } = await admin.auth.signInWithPassword({ email, password });
  if (signInError) {
    return json(500, { error: 'Conta criada, mas não foi possível abrir a sessão. Tente entrar novamente.' });
  }

  return json(200, {
    user: toPublicUser(signInData.user),
    session: toSession(signInData.session),
  });
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}
