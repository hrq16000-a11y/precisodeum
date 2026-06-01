import { describe, it, expect } from "vitest";
import { filterSitemaps, shouldResubmit, type SitemapFilter } from "@/pages/admin/AdminSeoGscPage";

const sitemaps = [
  { path: "/sitemap.xml", lastSubmitted: "2026-05-30T10:00:00Z", errors: 0, warnings: 0 },
  { path: "/sitemap-cats.xml", lastSubmitted: "2026-05-31T10:00:00Z", errors: 2, warnings: 0 },
  { path: "/sitemap-cities.xml", lastSubmitted: "2026-05-29T10:00:00Z", errors: 0, warnings: 1 },
];

describe("AdminSeoGscPage helpers", () => {
  it("filterSitemaps: all returns full list", () => {
    expect(filterSitemaps(sitemaps, "all")).toHaveLength(3);
  });

  it("filterSitemaps: errors only", () => {
    const r = filterSitemaps(sitemaps, "errors");
    expect(r).toHaveLength(1);
    expect(r[0].path).toBe("/sitemap-cats.xml");
  });

  it("filterSitemaps: warnings only", () => {
    const r = filterSitemaps(sitemaps, "warnings");
    expect(r).toHaveLength(1);
    expect(r[0].path).toBe("/sitemap-cities.xml");
  });

  it("filterSitemaps: recent sorts by lastSubmitted desc", () => {
    const r = filterSitemaps(sitemaps, "recent");
    expect(r.map((s) => s.path)).toEqual([
      "/sitemap-cats.xml",
      "/sitemap.xml",
      "/sitemap-cities.xml",
    ]);
  });

  it("filterSitemaps: unknown filter falls back to all", () => {
    expect(filterSitemaps(sitemaps, "weird" as SitemapFilter)).toHaveLength(3);
  });

  it("shouldResubmit: false when there is no SEO change", () => {
    expect(shouldResubmit("2026-05-31T10:00:00Z", null)).toBe(false);
  });

  it("shouldResubmit: true when never submitted but content exists", () => {
    expect(shouldResubmit(null, "2026-05-31T10:00:00Z")).toBe(true);
  });

  it("shouldResubmit: true when content newer than last submit", () => {
    expect(shouldResubmit("2026-05-30T00:00:00Z", "2026-05-31T00:00:00Z")).toBe(true);
  });

  it("shouldResubmit: false when content older than last submit", () => {
    expect(shouldResubmit("2026-06-01T00:00:00Z", "2026-05-31T00:00:00Z")).toBe(false);
  });
});
