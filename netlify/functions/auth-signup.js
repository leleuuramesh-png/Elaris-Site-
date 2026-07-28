// netlify/functions/auth-signup.js
const { createUser, createSession, sessionCookie, publicUser } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido.' }) };
  }

  const { name, email, password, orgName } = body;

  if (!email || !password) {
    return { statusCode: 400, body: JSON.stringify({ error: 'E-mail e senha são obrigatórios.' }) };
  }
  if (password.length < 8) {
    return { statusCode: 400, body: JSON.stringify({ error: 'A senha precisa ter pelo menos 8 caracteres.' }) };
  }

  try {
    const user = await createUser({ name, email, password, orgName });
    const sessionId = await createSession(user.id);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': sessionCookie(sessionId),
      },
      body: JSON.stringify({ user: publicUser(user) }),
    };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return { statusCode, body: JSON.stringify({ error: err.message || 'Erro ao criar conta.' }) };
  }
};
