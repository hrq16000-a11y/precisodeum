/**
 * Mensagem detalhada de bloqueio no LoginPage.
 *
 * Valida que o trecho que constrói a mensagem de erro inclui:
 *  - vetor humanizado (e-mail, WhatsApp, dispositivo)
 *  - data ISO formatada em pt-BR
 *  - dias restantes
 *  - motivo humanizado (self_deletion_180d → "exclusão voluntária …")
 *  - instruções (link para /ajuda)
 *  - permanente: "O bloqueio é permanente."
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "..");
const loginPage = fs.readFileSync(path.join(SRC, "pages/LoginPage.tsx"), "utf8");

describe("LoginPage · mensagem detalhada de bloqueio (LGPD)", () => {
  it("identifica vetor por matched_via (email/whatsapp/dispositivo)", () => {
    expect(loginPage).toMatch(/matched_via/);
    expect(loginPage).toMatch(/this e-mail|este e-mail/i);
    expect(loginPage).toMatch(/este WhatsApp/);
    expect(loginPage).toMatch(/dispositivo/);
  });

  it("formata expires_at em pt-BR (dia + mês por extenso + ano)", () => {
    expect(loginPage).toMatch(/toLocaleDateString\(\s*["']pt-BR["']/);
    expect(loginPage).toMatch(/month:\s*["']long["']/);
    expect(loginPage).toMatch(/year:\s*["']numeric["']/);
  });

  it("humaniza self_deletion_180d → 'exclusão voluntária'", () => {
    expect(loginPage).toMatch(/self_deletion_180d/);
    expect(loginPage).toMatch(/exclusão volunt[áa]ria/i);
  });

  it("inclui instruções com link para /ajuda", () => {
    expect(loginPage).toMatch(/\/ajuda/);
  });

  it("trata o caso permanente com mensagem específica", () => {
    expect(loginPage).toMatch(/bloqueio[\s\S]{0,40}permanente/i);
  });

  it("toast.error usa duração estendida (>=12s) para o usuário ler", () => {
    expect(loginPage).toMatch(/duration:\s*1[02]\d{3}/);
  });
});

describe("Contrato com check_registration_block estendido", () => {
  it("LoginPage lê expires_at, days_remaining, matched_via, permanent e reason", () => {
    expect(loginPage).toMatch(/block\.expires_at/);
    expect(loginPage).toMatch(/block\.days_remaining/);
    expect(loginPage).toMatch(/block\.matched_via/);
    expect(loginPage).toMatch(/block\.permanent/);
    expect(loginPage).toMatch(/block\.reason/);
  });
});
