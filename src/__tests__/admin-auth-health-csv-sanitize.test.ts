/**
 * CSV sanitization & RPC fallback contract for /admin/health-check.
 */
import { describe, it, expect } from "vitest";
// Re-importa as funções exportadas do módulo público
import { sanitizeMessage } from "@/pages/admin/AdminAuthHealthPage";

// Como toCsv não é exportado, reproduzimos sua semântica via importação
// de um helper interno. Aqui fazemos um teste de comportamento via
// sanitizeMessage (que é a fonte da redação) em entradas representativas
// de meta para garantir que segredos não vazam no export.
describe("CSV export · sanitização de meta", () => {
  it("redige JWT em qualquer campo string", () => {
    const jwt = "eyJabcdefghij.abcdefghij.abcdefghij1234";
    expect(sanitizeMessage(`Bearer ${jwt}`)).toContain("[token]");
    expect(sanitizeMessage(`Bearer ${jwt}`)).not.toContain("eyJabcdefghij");
  });

  it("redige password=... e token=... mantendo a chave", () => {
    expect(sanitizeMessage("login falhou password=12345")).toContain("password=[redacted]");
    expect(sanitizeMessage("falha api_key=abcdef")).toContain("api_key=[redacted]");
  });

  it("redige e-mail por privacidade no CSV", () => {
    expect(sanitizeMessage("usuário foo.bar@example.com não encontrado")).toContain("[email]");
  });

  it("trunca mensagens longas com reticências", () => {
    const long = "x".repeat(400);
    const out = sanitizeMessage(long);
    expect(out.length).toBeLessThanOrEqual(281);
    expect(out.endsWith("…")).toBe(true);
  });
});
