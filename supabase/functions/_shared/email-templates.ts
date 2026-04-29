// Templates pt-BR usados pela edge function send-email.
// HTML + texto, com substituição de variáveis e proteção contra links quebrados.

const APP_NAME = "Preciso de Um";
const SITE_URL = "https://precisodeum.com.br";

export type TemplateVars = Record<string, string | number | undefined | null>;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const isSafeUrl = (u?: string | null) => {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export function renderTemplate(name: TemplateName, vars: TemplateVars): { subject: string; html: string; text: string } {
  const safeVars = Object.fromEntries(
    Object.entries(vars).map(([k, v]) => [k, v == null ? "" : String(v)]),
  ) as Record<string, string>;

  // Sanitiza links: se inválido, cai no SITE_URL
  const linkKeys = ["confirmation_url", "reset_url", "lead_url", "next_url", "action_url"];
  for (const k of linkKeys) {
    if (k in safeVars && !isSafeUrl(safeVars[k])) {
      safeVars[k] = SITE_URL;
    }
  }
  return TEMPLATES[name](safeVars);
}

const layout = (title: string, body: string) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${escape(title)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f7fb;margin:0;padding:24px;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="padding:24px 24px 8px"><strong style="font-size:18px">${APP_NAME}</strong></td></tr>
    <tr><td style="padding:8px 24px 24px;line-height:1.6;font-size:15px">${body}</td></tr>
    <tr><td style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0">
      Você recebeu este e-mail porque tem uma conta no ${APP_NAME}. Em caso de dúvidas, responda este e-mail.
    </td></tr>
  </table>
</body></html>`;

const button = (label: string, url: string) =>
  `<a href="${escape(url)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escape(label)}</a>`;

export const TEMPLATES = {
  welcome: (v: Record<string, string>) => {
    const name = v.name || "profissional";
    const url = v.confirmation_url || SITE_URL;
    return {
      subject: `Bem-vindo(a) ao ${APP_NAME}, ${name}!`,
      html: layout(
        "Bem-vindo",
        `<p>Olá, <strong>${escape(name)}</strong>!</p>
         <p>Sua conta foi criada com sucesso no <strong>${APP_NAME}</strong>. Confirme seu e-mail para liberar todos os recursos:</p>
         <p style="margin:24px 0">${button("Confirmar meu e-mail", url)}</p>
         <p style="font-size:13px;color:#64748b">Se o botão não funcionar, copie e cole este link: <br>${escape(url)}</p>`,
      ),
      text: `Olá, ${name}!\n\nSua conta foi criada no ${APP_NAME}. Confirme seu e-mail no link abaixo:\n${url}\n\nSe não foi você, ignore este e-mail.`,
    };
  },
  new_lead: (v: Record<string, string>) => {
    const provider = v.provider_name || "profissional";
    const service = v.service || "um serviço";
    const city = v.city || "sua região";
    const client = v.client_name || "Um cliente";
    const url = v.lead_url || SITE_URL;
    return {
      subject: `Novo pedido de ${service} em ${city}`,
      html: layout(
        "Novo lead recebido",
        `<p>Olá, <strong>${escape(provider)}</strong>!</p>
         <p><strong>${escape(client)}</strong> está procurando <strong>${escape(service)}</strong> em <strong>${escape(city)}</strong>.</p>
         <p style="margin:24px 0">${button("Ver detalhes do pedido", url)}</p>
         <p style="font-size:13px;color:#64748b">Responda rápido para aumentar a chance de fechar o serviço.</p>`,
      ),
      text: `Olá, ${provider}!\n\n${client} procura ${service} em ${city}.\nVeja os detalhes: ${url}\n\nResponda rápido para aumentar a chance de fechar.`,
    };
  },
  password_reset: (v: Record<string, string>) => {
    const name = v.name || "usuário";
    const url = v.reset_url || SITE_URL;
    return {
      subject: `Redefinição de senha — ${APP_NAME}`,
      html: layout(
        "Redefinir senha",
        `<p>Olá, <strong>${escape(name)}</strong>.</p>
         <p>Recebemos um pedido para redefinir a senha da sua conta no ${APP_NAME}.</p>
         <p style="margin:24px 0">${button("Redefinir minha senha", url)}</p>
         <p style="font-size:13px;color:#64748b">Este link expira em 60 minutos. Se você não solicitou, ignore este e-mail — sua senha continua a mesma.</p>`,
      ),
      text: `Olá, ${name}.\n\nUse o link abaixo para redefinir sua senha (expira em 60 minutos):\n${url}\n\nSe não foi você, ignore este e-mail.`,
    };
  },
} as const;

export type TemplateName = keyof typeof TEMPLATES;
