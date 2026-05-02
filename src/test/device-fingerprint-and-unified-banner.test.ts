/**
 * Device fingerprint (open-source) · contrato LGPD.
 *
 * Garante:
 *  1) Sem consentimento "Funcional", o helper retorna NULL e nenhum
 *     identificador é gerado.
 *  2) Com consentimento, o helper retorna o visitorId (FingerprintJS).
 *  3) O resultado é cacheado em sessionStorage para evitar re-cálculo.
 *  4) LoginPage encaminha o fingerprint ao RPC check_registration_block.
 *  5) DeleteAccountDialog NÃO bloqueia o botão por motivo (UX 1-clique).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "..");

vi.mock("@fingerprintjs/fingerprintjs", () => ({
  default: {
    load: vi.fn(async () => ({
      get: vi.fn(async () => ({ visitorId: "fp-abc-123" })),
    })),
  },
  load: vi.fn(async () => ({
    get: vi.fn(async () => ({ visitorId: "fp-abc-123" })),
  })),
}));

const consentMock = vi.fn();
vi.mock("@/lib/cookieConsent", () => ({
  getConsent: () => consentMock(),
}));

describe("getDeviceFingerprint · gate por consentimento", () => {
  beforeEach(() => {
    vi.resetModules();
    consentMock.mockReset();
    sessionStorage.clear();
  });

  it("retorna null quando não há consentimento", async () => {
    consentMock.mockReturnValue(null);
    const { getDeviceFingerprint } = await import("@/lib/deviceFingerprint");
    expect(await getDeviceFingerprint()).toBeNull();
  });

  it("retorna null quando consentimento Funcional = false", async () => {
    consentMock.mockReturnValue({
      essential: true,
      functional: false,
      analytics: true,
      marketing: true,
      version: 1,
      updated_at: new Date().toISOString(),
    });
    const { getDeviceFingerprint } = await import("@/lib/deviceFingerprint");
    expect(await getDeviceFingerprint()).toBeNull();
  });

  it("retorna visitorId quando consentimento Funcional = true", async () => {
    consentMock.mockReturnValue({
      essential: true,
      functional: true,
      analytics: false,
      marketing: false,
      version: 1,
      updated_at: new Date().toISOString(),
    });
    const { getDeviceFingerprint } = await import("@/lib/deviceFingerprint");
    const fp = await getDeviceFingerprint();
    expect(fp).toBe("fp-abc-123");
    // Cache de sessão preenchido
    expect(sessionStorage.getItem("device_fp_v1")).toBe("fp-abc-123");
  });
});

describe("LoginPage · encaminha device_fingerprint para check_registration_block", () => {
  const loginPage = fs.readFileSync(path.join(SRC, "pages/LoginPage.tsx"), "utf8");

  it("importa getDeviceFingerprint", () => {
    expect(loginPage).toMatch(/getDeviceFingerprint/);
  });

  it("chama check_registration_block com _device_fingerprint", () => {
    expect(loginPage).toMatch(/_device_fingerprint:\s*deviceFp/);
  });

  it("humaniza o vetor 'device' como 'este dispositivo'", () => {
    expect(loginPage).toMatch(/matched_via\s*===\s*["']device["']/);
    expect(loginPage).toMatch(/este dispositivo/);
  });
});

describe("DeleteAccountDialog · UX 1-clique", () => {
  const dialog = fs.readFileSync(
    path.join(SRC, "components/dashboard/DeleteAccountDialog.tsx"),
    "utf8",
  );

  it("motivo é opcional (canSubmit não depende de reason)", () => {
    // Não pode haver lógica que exija reason !== '' para liberar o submit.
    expect(dialog).toMatch(/canSubmit\s*=\s*!submitting/);
  });

  it("CTA usa o copy 'Sim, excluir agora'", () => {
    expect(dialog).toMatch(/Sim,\s*excluir agora/);
  });

  it("envia _reason: null quando usuário não preenche", () => {
    expect(dialog).toMatch(/let reasonPayload:\s*string\s*\|\s*null\s*=\s*null/);
  });
});

describe("CookieConsent · banner unificado com glass + ícones Lucide", () => {
  const banner = fs.readFileSync(path.join(SRC, "components/CookieConsent.tsx"), "utf8");

  it("usa ícones Lucide ShieldCheck e Cookie", () => {
    expect(banner).toMatch(/from\s+["']lucide-react["']/);
    expect(banner).toMatch(/ShieldCheck/);
    expect(banner).toMatch(/Cookie/);
  });

  it("aplica glassmorphism (backdrop-blur-xl + bg semitransparente)", () => {
    expect(banner).toMatch(/backdrop-blur-xl/);
    expect(banner).toMatch(/bg-background\/[67]0/);
  });

  it("mantém os 3 botões obrigatórios pela LGPD", () => {
    expect(banner).toMatch(/Prefer[êe]ncias/);
    expect(banner).toMatch(/Recusar/);
    expect(banner).toMatch(/Aceitar todos/);
  });
});
