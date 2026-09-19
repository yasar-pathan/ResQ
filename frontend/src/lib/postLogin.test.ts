import { describe, expect, it } from "vitest";
import { postLoginPath } from "@/lib/postLogin";

describe("postLoginPath", () => {
  it("sends dispatcher to dashboard", () => {
    expect(postLoginPath("dispatcher", null)).toBe("/dashboard");
  });

  it("honors safe next for admin", () => {
    expect(postLoginPath("admin", "/alerts")).toBe("/alerts");
  });

  it("never sends citizen to dashboard", () => {
    expect(postLoginPath("citizen", "/dashboard")).toBe("/");
    expect(postLoginPath("citizen", null)).toBe("/");
  });

  it("sends field team to assignments", () => {
    expect(postLoginPath("field_team", null)).toBe("/field/assignments");
    expect(postLoginPath("field_team", "/field/assignments/abc")).toBe("/field/assignments/abc");
  });
});
