// netlify/functions/auth-me.js
const { getUserFromEvent, publicUser } = require('./_lib/auth');

exports.handler = async (event) => {
  const user = await getUserFromEvent(event);
  if (!user) {
    return { statusCode: 200, body: JSON.stringify({ user: null }) };
  }
  return { statusCode: 200, body: JSON.stringify({ user: publicUser(user) }) };
};
