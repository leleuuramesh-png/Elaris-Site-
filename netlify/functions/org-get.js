// netlify/functions/org-get.js
// GET com "Authorization: Bearer <access_token>" -> devolve a organização
// principal do usuário logado (a primeira em que ele é membro), já com o
// nome do plano. Complementa o org-create.js existente: create escreve,
// get lê -- usado no login e na restauração de sessão pra repor
// currentUser.org/plan com dados reais em vez do placeholder 'Free'.

const { supabaseAdmin, getBearerToken } = require('./_lib/supabase');

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

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return json(401, { error: 'Sessão inválida ou expirada.' });
  }

  const { data: membership, error: memberError } = await admin
    .from('organization_members')
    .select('role, joined_at, organizations(id, name, slug, credits_balance, plans(slug, name))')
    .eq('user_id', userData.user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError) {
    return json(500, { error: memberError.message });
  }
  if (!membership || !membership.organizations) {
    return json(404, { error: 'Nenhuma organização encontrada para este usuário.' });
  }

  const org = membership.organizations;
  return json(200, {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: membership.role,
      plan: org.plans?.name || org.plans?.slug || 'Free',
      creditsBalance: org.credits_balance,
    },
  });
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}
