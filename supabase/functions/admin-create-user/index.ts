import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// FASE 1.6.2 — helpers inline (espelham src/lib/validation/*).
// Mantidos isolados aqui para não acoplar Deno ao bundle frontend.
function normalizeFullName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ')
}

function isValidFullName(value: unknown): boolean {
  const name = normalizeFullName(value)
  if (!name) return false
  if (/[@]/.test(name)) return false
  if (/(https?:\/\/|www\.)/i.test(name)) return false
  const letters = name.replace(/[^\p{L}]/gu, '')
  if (letters.length < 4) return false
  const parts = name.split(' ').filter(Boolean)
  if (parts.length < 2) return false
  const ONLY = /^[\p{L}'\-.]+$/u
  for (const p of parts) if (!ONLY.test(p)) return false
  if (!parts.some(p => p.replace(/[^\p{L}]/gu, '').length >= 2)) return false
  if (/(\p{L})\1{4,}/u.test(name.toLowerCase())) return false
  const BLOCK = new Set(['admin','administrator','administrador','teste','tester','test','user','usuario','usuário','cliente','demo','qwerty','asdf','asdfgh','xxxxx','aaaaa','null','undefined','none','fulano','beltrano','sicrano'])
  const low = parts.map(p => p.toLowerCase().replace(/[^\p{L}]/gu, ''))
  if (low.every(p => BLOCK.has(p))) return false
  return true
}

function normalizePhoneBR(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Aceita 10-13 dígitos; prefixa 55 quando faltar
  if (digits.length === 10 || digits.length === 11) return '55' + digits
  if (digits.length === 12 || digits.length === 13) return digits.startsWith('55') ? digits : '55' + digits.slice(-11)
  return ''
}

function isValidPhoneBR(raw: unknown): boolean {
  if (typeof raw !== 'string') return false
  const canonical = normalizePhoneBR(raw)
  if (!canonical) return false
  if (canonical.length < 12 || canonical.length > 13) return false
  const local = canonical.slice(2) // sem 55
  if (/^(\d)\1+$/.test(local)) return false
  const ddd = Number(local.slice(0, 2))
  // DDDs válidos no Brasil (11-99 com lacunas) — checa range simples
  if (ddd < 11 || ddd > 99) return false
  return true
}

function isValidEmail(raw: unknown): boolean {
  if (typeof raw !== 'string') return false
  const v = raw.trim().toLowerCase()
  if (v.length < 5 || v.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
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

    const { email, password, full_name, profile_type, account_type_id, level_id, staff_role, sponsor_id, whatsapp } = await req.json()

    // FASE 1.6.2 — validação centralizada
    if (!isValidEmail(email)) throw new Error('Email inválido')
    if (!password || typeof password !== 'string' || password.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres')
    if (!isValidFullName(full_name)) throw new Error('Nome completo inválido. Digite seu nome completo.')

    const normalizedName = normalizeFullName(full_name)
    let normalizedWhatsapp = ''
    if (typeof whatsapp === 'string' && whatsapp.trim()) {
      if (!isValidPhoneBR(whatsapp)) throw new Error('WhatsApp inválido. Digite um WhatsApp válido com DDD.')
      normalizedWhatsapp = normalizePhoneBR(whatsapp)
    }

    const validTypes = ['client', 'provider', 'rh', 'sponsor']
    const type = validTypes.includes(profile_type) ? profile_type : 'client'

    if (type === 'sponsor' && !sponsor_id) throw new Error('Patrocinador não selecionado')

    const validStaffRoles = ['admin', 'moderator', 'analyst']
    const sRole = staff_role && validStaffRoles.includes(staff_role) ? staff_role : null

    const profileType = type === 'sponsor' ? 'client' : type
    const profileRole = type === 'rh' || type === 'sponsor' ? 'client' : type

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const normalizedEmail = (email as string).trim().toLowerCase()
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: normalizedName, profile_type: profileType },
    })
    if (createError) throw createError

    if (newUser.user) {
      const updates: Record<string, unknown> = {
        profile_type: profileType,
        role: profileRole,
        full_name: normalizedName,
      }
      if (normalizedWhatsapp) updates.whatsapp = normalizedWhatsapp
      if (account_type_id) updates.account_type_id = account_type_id
      if (level_id) updates.level_id = level_id

      await adminClient.from('profiles').update(updates).eq('id', newUser.user.id)

      if (sRole) {
        await adminClient.from('user_roles').insert({ user_id: newUser.user.id, role: sRole })
      }

      if (type === 'sponsor' && sponsor_id) {
        await adminClient.from('sponsor_contacts').insert({
          sponsor_id,
          user_id: newUser.user.id,
          contact_name: normalizedName,
          email: normalizedEmail,
        })
      }

      // FASE 1.6.2 — audit log (sem PII)
      try {
        await adminClient.from('audit_log').insert({
          user_id: caller.id,
          action: 'create',
          resource_type: 'user',
          resource_id: newUser.user.id,
          details: {
            source: 'admin_create_user',
            target_user_id: newUser.user.id,
            profile_type: profileType,
            has_whatsapp: !!normalizedWhatsapp,
            has_staff_role: !!sRole,
          },
        })
      } catch (_) { /* audit best-effort */ }
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
