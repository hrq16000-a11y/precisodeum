import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { service_name, category_name } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
