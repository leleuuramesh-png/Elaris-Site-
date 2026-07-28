// netlify/functions/auth-logout.js
const { parseCookies, destroySession, sessionCookie } = require('./_lib/auth');

exports.handler = async (event) => {
  const cookies = parseCookies(event.headers && event.headers.cookie);
  const sessionId = cookies['elaris_session'];
  await destroySession(sessionId);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookie(null, { clear: true }),
    },
    body: JSON.stringify({ ok: true }),
  };
};
