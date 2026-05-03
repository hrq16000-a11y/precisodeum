import { describe, it, expect } from "vitest";
import { sanitizeMessage } from "@/pages/admin/AdminAuthHealthPage";

describe("AdminAuthHealthPage · sanitizeMessage", () => {
  it("redige JWTs (não exibe payload bruto)", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0.abcDEF1234567890_secret";
    const out = sanitizeMessage(`auth failed jwt ${jwt}`);
    expect(out).not.toContain("eyJ");
    expect(out).toContain("[token]");
  });

  it("redige JWT em formato chave=valor", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIn0.abcDEF1234567890_secret";
    const out = sanitizeMessage(`token=${jwt}`);
    expect(out).not.toContain("eyJ");
    expect(out).toMatch(/token=\[redacted\]|\[token\]/);
  });

  it("redige password=12345 como password=[redacted]", () => {
    const out = sanitizeMessage("login error password=12345 user ok");
    expect(out).toContain("password=[redacted]");
    expect(out).not.toContain("12345");
  });

  it("redige variantes (api_key, secret, authorization, senha)", () => {
    expect(sanitizeMessage("api_key=abc123")).toContain("api_key=[redacted]");
    expect(sanitizeMessage("secret: topsecret")).toContain("secret=[redacted]");
    expect(sanitizeMessage("authorization=Bearer xyz")).toContain("authorization=[redacted]");
    expect(sanitizeMessage("senha=minhaSenha")).toContain("senha=[redacted]");
  });

  it("redige e-mails como [email]", () => {
    const out = sanitizeMessage("falha em user@example.com");
    expect(out).toContain("[email]");
    expect(out).not.toContain("user@example.com");
  });

  it("trunca mensagens > 280 chars com reticências", () => {
    const long = "x".repeat(500);
    const out = sanitizeMessage(long);
    expect(out.length).toBeLessThanOrEqual(281);
    expect(out.endsWith("…")).toBe(true);
  });

  it("retorna — para input nulo/vazio", () => {
    expect(sanitizeMessage(null)).toBe("—");
    expect(sanitizeMessage(undefined)).toBe("—");
    expect(sanitizeMessage("")).toBe("—");
  });

  it("preserva mensagens curtas inofensivas", () => {
    expect(sanitizeMessage("perfil ausente após signup")).toBe("perfil ausente após signup");
  });
});
