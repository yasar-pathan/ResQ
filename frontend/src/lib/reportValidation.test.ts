import { describe, expect, it } from "vitest";
import { nextSosStep, validateReportForm } from "@/lib/reportValidation";

describe("validateReportForm", () => {
  it("rejects missing location with a single location error", () => {
    const errors = validateReportForm({
      category: "fire",
      description: "Enough text for a valid description here",
      latitude: "",
      longitude: "",
      address_text: "",
      photo_url: "",
      is_anonymous: false,
    });
    expect(errors.location).toBeTruthy();
    expect(errors.latitude).toBeUndefined();
    expect(errors.longitude).toBeUndefined();
  });

  it("rejects invalid coordinates via location error", () => {
    const errors = validateReportForm({
      category: "fire",
      description: "Enough text for a valid description here",
      latitude: "100",
      longitude: "77",
      address_text: "",
      photo_url: "",
      is_anonymous: false,
    });
    expect(errors.location).toBeTruthy();
  });

  it("accepts a valid report payload", () => {
    const errors = validateReportForm({
      category: "medical",
      description: "Person injured near the park entrance",
      latitude: "12.97",
      longitude: "77.59",
      address_text: "",
      photo_url: "",
      is_anonymous: true,
    });
    expect(errors).toEqual({});
  });
});

describe("SOS ≤2 taps state machine", () => {
  it("moves idle → confirming → submitting in two actions", () => {
    const afterStart = nextSosStep("idle", "start");
    expect(afterStart).toBe("confirming");
    const afterConfirm = nextSosStep(afterStart, "confirm");
    expect(afterConfirm).toBe("submitting");
  });
});
