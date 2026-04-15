import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { service_name, category_name, prompt, mode } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // MODE: "magic" — generate a professional description from a simple prompt
    if (mode === 'magic' && prompt) {
      const magicPrompt = prompt.trim();
      if (magicPrompt.length < 3) {
        return new Response(JSON.stringify({ error: "Prompt muito curto" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `Você é um copywriter profissional brasileiro especializado em marketing de serviços.
Dado uma frase curta do profissional, gere uma descrição profissional e atraente do serviço em português brasileiro.
A descrição deve ter entre 80-120 palavras, ser persuasiva, destacar diferenciais e incluir um call-to-action sutil.
NÃO use markdown, apenas texto corrido com parágrafos.
${service_name ? `Serviço: ${service_name}` : ''}
${category_name ? `Categoria: ${category_name}` : ''}`
            },
            { role: "user", content: magicPrompt }
          ],
          max_tokens: 400,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "Falha ao gerar" }), {
          status: response.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const description = data.choices?.[0]?.message?.content?.trim() || '';

      return new Response(JSON.stringify({ description }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MODE: default — generate structured SEO content
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em serviços residenciais e comerciais no Brasil. Gere conteúdo SEO para uma página de serviço popular. Responda APENAS em JSON válido com esta estrutura:
{
  "problem": "Frase curta descrevendo um problema real que o cliente enfrenta (ex: 'Chuveiro queimou e não sabe o que fazer?')",
  "solution": "Explicação simples em 1-2 frases sobre como o profissional resolve",
  "price_note": "Nota sobre o que influencia o preço (ex: 'O valor varia conforme a complexidade do serviço e região')",
  "tips": ["Dica 1 para o cliente", "Dica 2", "Dica 3"],
  "faq": [{"q": "Pergunta frequente?", "a": "Resposta curta"}]
}`
          },
          {
            role: "user",
            content: `Gere conteúdo para o serviço "${service_name}" na categoria "${category_name}".`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_service_content",
              description: "Generate SEO content for a service page",
              parameters: {
                type: "object",
                properties: {
                  problem: { type: "string" },
                  solution: { type: "string" },
                  price_note: { type: "string" },
                  tips: { type: "array", items: { type: "string" } },
                  faq: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        q: { type: "string" },
                        a: { type: "string" }
                      },
                      required: ["q", "a"]
                    }
                  }
                },
                required: ["problem", "solution", "price_note", "tips", "faq"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_service_content" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let content = {};
    
    if (toolCall?.function?.arguments) {
      try {
        content = JSON.parse(toolCall.function.arguments);
      } catch {
        content = { error: "Failed to parse AI response" };
      }
    }

    return new Response(JSON.stringify(content), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-service-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
