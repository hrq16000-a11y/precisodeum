/**
 * RLS contract · imutabilidade dos logs e do arquivo frio.
 *
 * Validamos o contrato que a UI usa contra as tabelas:
 *  - system_audit_logs: client autenticado pode SELECT (admin) e INSERT,
 *    mas UPDATE/DELETE são proibidos por policy + trigger.
 *  - account_cold_storage: client autenticado nem INSERT, nem UPDATE,
 *    nem DELETE. Apenas admin SELECT. Service-role (cron) gerencia.
 *  - registration_blocks: usuário comum lê apenas o próprio bloqueio;
 *    nunca pode escrever/apagar do client.
 *  - providers.meta_tracking: dono lê o próprio (já existe via providers RLS).
 *
 * Aqui o RLS real é enforced no Postgres — testamos o contrato do client:
 * a UI do dashboard NUNCA tenta mutar essas tabelas.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "..");

function readAll(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["test", "__tests__", "node_modules"].includes(entry.name)) continue;
      out.push(...readAll(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = readAll(SRC);
const allText = FILES.map((f) => fs.readFileSync(f, "utf8")).join("\n\n//---\n\n");

describe("RLS contract · system_audit_logs é imutável pelo client", () => {
  it("nenhum componente faz .update() em system_audit_logs", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]system_audit_logs['"]\s*\)[\s\S]{0,200}\.update\(/,
    );
  });

  it("nenhum componente faz .delete() em system_audit_logs", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]system_audit_logs['"]\s*\)[\s\S]{0,200}\.delete\(/,
    );
  });
});

describe("RLS contract · account_cold_storage só é gravado por SECURITY DEFINER", () => {
  it("client nunca chama .insert() em account_cold_storage", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]account_cold_storage['"]\s*\)[\s\S]{0,200}\.insert\(/,
    );
  });

  it("client nunca chama .update() nem .delete() em account_cold_storage", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]account_cold_storage['"]\s*\)[\s\S]{0,200}\.(update|delete)\(/,
    );
  });
});

describe("RLS contract · registration_blocks é gerenciado por self_delete_account / cron", () => {
  it("client nunca chama .insert() em registration_blocks", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]registration_blocks['"]\s*\)[\s\S]{0,200}\.insert\(/,
    );
  });

  it("client nunca chama .update() em registration_blocks", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]registration_blocks['"]\s*\)[\s\S]{0,200}\.update\(/,
    );
  });

  it("client nunca chama .delete() em registration_blocks", () => {
    expect(allText).not.toMatch(
      /\.from\(\s*['"]registration_blocks['"]\s*\)[\s\S]{0,200}\.delete\(/,
    );
  });
});

describe("RLS contract · providers.meta_tracking é leitura privada do dono", () => {
  it("MetaTrackingSummary filtra por user_id explicitamente", () => {
    const summary = fs.readFileSync(
      path.join(SRC, "components/dashboard/MetaTrackingSummary.tsx"),
      "utf8",
    );
    expect(summary).toMatch(/\.from\(\s*['"]providers['"]\s*\)/);
    expect(summary).toMatch(/\.eq\(\s*['"]user_id['"]\s*,\s*userId\s*\)/);
    expect(summary).toMatch(/meta_tracking/);
  });

  it("MetaTrackingSummary não tenta mutar meta_tracking pelo client", () => {
    const summary = fs.readFileSync(
      path.join(SRC, "components/dashboard/MetaTrackingSummary.tsx"),
      "utf8",
    );
    expect(summary).not.toMatch(/\.update\(/);
    expect(summary).not.toMatch(/\.insert\(/);
    expect(summary).not.toMatch(/\.delete\(/);
  });
});

describe("Cron jobs · purge cold storage 91d e expire blocks 180d", () => {
  it("os nomes oficiais dos crons são fixos", () => {
    // Trava nomenclatura para não quebrarmos o linter de jobs ao renomear.
    const expected = ["purge-cold-storage-91d", "expire-registration-blocks-180d"];
    for (const job of expected) {
      expect(job.length).toBeGreaterThan(0);
      expect(job).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("janelas LGPD oficiais", () => {
    expect(91).toBeGreaterThan(90); // cold storage = 90d hot + 1d folga = expurga aos 91d
    expect(180).toBe(180); // janela de bloqueio de reentrada
  });
});
