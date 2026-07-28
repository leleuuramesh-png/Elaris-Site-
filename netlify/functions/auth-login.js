// netlify/functions/auth-login.js
const { getUserByEmail, verifyPassword, createSession, sessionCookie, publicUser } = require('./_lib/auth');

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

  const { email, password } = body;
  if (!email || !password) {
    return { statusCode: 400, body: JSON.stringify({ error: 'E-mail e senha são obrigatórios.' }) };
  }

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'E-mail ou senha incorretos.' }) };
  }

  const sessionId = await createSession(user.id);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookie(sessionId),
    },
    body: JSON.stringify({ user: publicUser(user) }),
  };
};
