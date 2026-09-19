import { describe, expect, it } from "vitest";
import { getWsUrl } from "@/lib/api/client";

describe("ops client helpers", () => {
  it("defaults websocket path to dashboard gateway", () => {
    expect(getWsUrl()).toContain("/ws/dashboard");
  });
});
