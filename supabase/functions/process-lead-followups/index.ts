// Cron-triggered: processa lembretes de follow-up de leads em aberto.
// Chama a função SQL `process_lead_followup_reminders` que insere notificações
// para cada lead vencido (status new/contacted) e reagenda a próxima janela.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data, error } = await supabase.rpc('process_lead_followup_reminders');
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[process-lead-followups]', err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
