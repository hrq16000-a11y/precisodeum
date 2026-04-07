import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No auth header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) throw new Error('Not authenticated')

    const { data: isAdmin } = await callerClient.rpc('has_role', { _user_id: caller.id, _role: 'admin' })
    if (!isAdmin) throw new Error('Not authorized')

    const { email, password, full_name, profile_type } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) throw new Error('Email inválido')
    if (!password || typeof password !== 'string' || password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres')
    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) throw new Error('Nome deve ter no mínimo 2 caracteres')

    const validTypes = ['client', 'provider', 'rh']
    const type = validTypes.includes(profile_type) ? profile_type : 'client'

    // Create user with service role (auto-confirms email)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    })
    if (createError) throw createError

    // Update profile with correct type
    if (newUser.user) {
      await adminClient.from('profiles').update({
        profile_type: type,
        role: type,
        full_name: full_name.trim(),
      }).eq('id', newUser.user.id)
    }

    return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
