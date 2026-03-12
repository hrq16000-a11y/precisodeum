import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const testEmail = 'teste@precisodeum.com'
  const testPassword = 'teste123456'

  // Check if user already exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const existing = existingUsers?.users?.find(u => u.email === testEmail)

  if (existing) {
    return new Response(JSON.stringify({ 
      message: 'Usuário de teste já existe',
      email: testEmail, 
      password: testPassword 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Create test user with auto-confirm
  const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Usuário Teste' },
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }

  // Update profile
  await supabaseAdmin.from('profiles').update({
    phone: '11999999999',
    role: 'provider',
  }).eq('id', user.user!.id)

  // Get a category
  const { data: cat } = await supabaseAdmin.from('categories').select('id').limit(1).single()

  // Create provider profile
  await supabaseAdmin.from('providers').insert({
    user_id: user.user!.id,
    business_name: 'Teste Serviços',
    description: 'Profissional de teste para validação da plataforma.',
    city: 'São Paulo',
    state: 'SP',
    phone: '11999999999',
    whatsapp: '11999999999',
    category_id: cat?.id || null,
    slug: 'usuario-teste-sao-paulo',
    status: 'approved',
  })

  return new Response(JSON.stringify({ 
    message: 'Usuário de teste criado com sucesso!',
    email: testEmail,
    password: testPassword,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
