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

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) throw new Error('Not authenticated')

    const { data: isAdmin } = await callerClient.rpc('has_role', { _user_id: caller.id, _role: 'admin' })
    if (!isAdmin) throw new Error('Not authorized')

    const { email, password, full_name, profile_type, account_type_id, level_id, staff_role } = await req.json()

    if (!email || typeof email !== 'string' || !email.includes('@')) throw new Error('Email inválido')
    if (!password || typeof password !== 'string' || password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres')
    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) throw new Error('Nome deve ter no mínimo 2 caracteres')

    const validTypes = ['client', 'provider', 'rh', 'company']
    const type = validTypes.includes(profile_type) ? profile_type : 'client'

    const validStaffRoles = ['admin', 'moderator', 'analyst']
    const sRole = staff_role && validStaffRoles.includes(staff_role) ? staff_role : null

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim(), profile_type: type },
    })
    if (createError) throw createError

    if (newUser.user) {
      const updates: Record<string, unknown> = {
        profile_type: type,
        role: type === 'rh' ? 'client' : type,
        full_name: full_name.trim(),
      }
      if (account_type_id) updates.account_type_id = account_type_id
      if (level_id) updates.level_id = level_id

      await adminClient.from('profiles').update(updates).eq('id', newUser.user.id)

      if (sRole) {
        await adminClient.from('user_roles').insert({ user_id: newUser.user.id, role: sRole })
      }
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
