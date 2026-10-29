import { describe, expect, it } from "vitest";
import { knownPage, markdownRewrite, mergeVary, prefersMarkdown } from "../lib/negotiate";

describe("prefersMarkdown", () => {
  it("opts in only on an explicit Markdown type", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
    expect(prefersMarkdown("text/x-markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html")).toBe(true);
  });
  it("keeps HTML for browsers, wildcards and HTML-first clients", () => {
    expect(prefersMarkdown(null)).toBe(false);
    expect(prefersMarkdown("*/*")).toBe(false);
    expect(prefersMarkdown("text/html")).toBe(false);
    expect(prefersMarkdown("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")).toBe(false);
    expect(prefersMarkdown("text/html, text/markdown;q=0.5")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
  });
});

describe("routing", () => {
  it("maps known pages and trailing slashes", () => {
    expect(knownPage("/")).toBe("/");
    expect(knownPage("/about/")).toBe("/about");
    expect(markdownRewrite("/")).toBe("/md/index");
    expect(markdownRewrite("/privacy")).toBe("/md/privacy");
    expect(markdownRewrite("/contact")).toBe("/md/contact");
  });
  it("sends unknown paths to the Markdown 404", () => {
    expect(markdownRewrite("/__probe")).toBe("/md/404?path=%2F__probe");
  });
});

describe("mergeVary", () => {
  it("appends Accept and keeps Next's RSC values", () => {
    expect(mergeVary("rsc, next-router-state-tree")).toBe("rsc, next-router-state-tree, Accept");
    expect(mergeVary(null)).toBe("Accept");
    expect(mergeVary("Accept, rsc")).toBe("Accept, rsc");
    expect(mergeVary("*")).toBe("*");
  });
});
