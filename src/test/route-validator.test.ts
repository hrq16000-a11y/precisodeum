import { describe, it, expect } from "vitest";
import { isValidRoute, safeInternalPath } from "@/lib/routeValidator";
import { sanitizeNextPath } from "@/lib/authRedirect";

describe("routeValidator.isValidRoute", () => {
  it("aceita rotas estáticas declaradas", () => {
    expect(isValidRoute("/")).toBe(true);
    expect(isValidRoute("/buscar")).toBe(true);
    expect(isValidRoute("/cadastro")).toBe(true);
    expect(isValidRoute("/cadastro-inicial")).toBe(true);
    expect(isValidRoute("/dashboard")).toBe(true);
    expect(isValidRoute("/dashboard/leads")).toBe(true);
    expect(isValidRoute("/ajuda")).toBe(true);
    expect(isValidRoute("/cookies")).toBe(true);
  });

  it("aceita rotas dinâmicas com :param", () => {
    expect(isValidRoute("/categoria/eletricista")).toBe(true);
    expect(isValidRoute("/categoria/eletricista/em/curitiba")).toBe(true);
    expect(isValidRoute("/profissional/joao-silva")).toBe(true);
    expect(isValidRoute("/dashboard/leads/abc-123")).toBe(true);
    expect(isValidRoute("/blog/meu-post")).toBe(true);
    expect(isValidRoute("/vaga/desenvolvedor-react")).toBe(true);
  });

  it("aceita rotas /admin/* (gate é no AdminGuard)", () => {
    expect(isValidRoute("/admin")).toBe(true);
    expect(isValidRoute("/admin/usuarios")).toBe(true);
    expect(isValidRoute("/admin/links-quebrados")).toBe(true);
  });

  it("aceita query string e hash", () => {
    expect(isValidRoute("/buscar?q=abc")).toBe(true);
    expect(isValidRoute("/dashboard#perfil")).toBe(true);
    expect(isValidRoute("/cadastro?next=/cadastro-inicial")).toBe(true);
  });

  it("rejeita rotas que não existem (caso histórico /signup)", () => {
    expect(isValidRoute("/signup")).toBe(false);
    expect(isValidRoute("/signin")).toBe(false);
    expect(isValidRoute("/register")).toBe(false);
    expect(isValidRoute("/profile")).toBe(false);
    expect(isValidRoute("/account")).toBe(false);
  });

  it("rejeita URLs externas e protocol-relative (open redirect)", () => {
    expect(isValidRoute("//evil.com/phishing")).toBe(false);
    expect(isValidRoute("https://evil.com")).toBe(false);
    expect(isValidRoute("javascript:alert(1)")).toBe(false);
    expect(isValidRoute("")).toBe(false);
    expect(isValidRoute(null)).toBe(false);
    expect(isValidRoute(undefined)).toBe(false);
  });
});

describe("safeInternalPath", () => {
  it("retorna o path quando é válido", () => {
    expect(safeInternalPath("/dashboard")).toBe("/dashboard");
  });

  it("retorna fallback quando inválido", () => {
    expect(safeInternalPath("/signup", "/cadastro")).toBe("/cadastro");
    expect(safeInternalPath("//evil.com", "/")).toBe("/");
    expect(safeInternalPath(null, "/")).toBe("/");
  });
});

describe("sanitizeNextPath integra com routeValidator", () => {
  it("rotas inválidas caem no fallback (anti-404)", () => {
    expect(sanitizeNextPath("/signup", "/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/rota-inexistente")).toBe("/dashboard");
  });

  it("rotas válidas são preservadas", () => {
    expect(sanitizeNextPath("/cadastro-inicial")).toBe("/cadastro-inicial");
    expect(sanitizeNextPath("/dashboard/leads")).toBe("/dashboard/leads");
  });

  it("protocol-relative continua bloqueada", () => {
    expect(sanitizeNextPath("//evil.com")).toBe("/dashboard");
  });
});
