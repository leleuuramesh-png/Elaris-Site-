// netlify/functions/org-create.js
//
// Cria uma nova organização no Elaris e registra o usuário autenticado
// como 'owner'. Usa a SUPABASE_SECRET_KEY (backend-only) para ignorar RLS
// nesta operação controlada -- o mesmo padrão usado no Trem Forge.
//
// Espera um header Authorization: Bearer <supabase_access_token>
// e body JSON: { "name": "Minha Empresa", "slug": "minha-empresa" }

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Supabase env vars ausentes no Netlify.' }),
    };
  }

  // Cliente admin: usa a secret key, ignora RLS. Só existe no backend.
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  try {
    // 1. Valida o token do usuário que está fazendo a requisição
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token de autenticação ausente.' }) };
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token inválido ou expirado.' }) };
    }
    const userId = userData.user.id;

    // 2. Valida o body
    const body = JSON.parse(event.body || '{}');
    const { name, slug } = body;
    if (!name || !slug) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Campos "name" e "slug" são obrigatórios.' }) };
    }

    // 3. Busca o plano 'free' para vincular por padrão
    const { data: freePlan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('id')
      .eq('slug', 'free')
      .single();

    if (planError || !freePlan) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Plano padrão "free" não encontrado.' }) };
    }

    // 4. Cria a organização
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        slug,
        owner_id: userId,
        plan_id: freePlan.id,
        credits_balance: 0,
      })
      .select()
      .single();

    if (orgError) {
      // slug duplicado é o erro mais comum aqui
      return { statusCode: 409, body: JSON.stringify({ error: orgError.message }) };
    }

    // 5. Adiciona o criador como membro 'owner'
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: userId,
        role: 'owner',
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      // Rollback manual simples: remove a org criada se falhar em adicionar o membro
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      return { statusCode: 500, body: JSON.stringify({ error: 'Falha ao registrar owner: ' + memberError.message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ organization: org }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
