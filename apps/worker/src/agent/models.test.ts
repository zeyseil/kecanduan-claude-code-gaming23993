import { describe, expect, it } from "vitest";
import {
  CURATED_MODELS,
  buildModelOptions,
  isSuitableForAgent,
  stripModelPrefix,
} from "./models";

describe("stripModelPrefix", () => {
  it("removes the models/ prefix", () => {
    expect(stripModelPrefix("models/gemini-flash-latest")).toBe("gemini-flash-latest");
  });
  it("leaves a bare id untouched", () => {
    expect(stripModelPrefix("gemini-flash-latest")).toBe("gemini-flash-latest");
  });
});

describe("isSuitableForAgent", () => {
  it("accepts a gemini model that supports generateContent", () => {
    expect(
      isSuitableForAgent({
        name: "models/gemini-3-pro",
        supportedGenerationMethods: ["generateContent"],
      }),
    ).toBe(true);
  });

  it("rejects a model without generateContent", () => {
    expect(
      isSuitableForAgent({
        name: "models/gemini-embedding",
        supportedGenerationMethods: ["embedContent"],
      }),
    ).toBe(false);
  });

  it("rejects non-gemini models", () => {
    expect(
      isSuitableForAgent({
        name: "models/text-bison",
        supportedGenerationMethods: ["generateContent"],
      }),
    ).toBe(false);
  });

  it("rejects excluded variants even if they are gemini + generateContent", () => {
    for (const id of [
      "gemini-embedding-001",
      "gemini-tts",
      "gemini-live-2.5",
      "imagen-3",
      "gemini-2.5-computer-use-preview-10-2025",
    ]) {
      expect(
        isSuitableForAgent({ name: `models/${id}`, supportedGenerationMethods: ["generateContent"] }),
      ).toBe(false);
    }
  });

  it("rejects entries with no name", () => {
    expect(isSuitableForAgent({ supportedGenerationMethods: ["generateContent"] })).toBe(false);
  });
});

describe("buildModelOptions", () => {
  it("keeps curated models first and always present", () => {
    const options = buildModelOptions([]);
    expect(options.slice(0, CURATED_MODELS.length).map((m) => m.id)).toEqual(
      CURATED_MODELS.map((m) => m.id),
    );
    expect(options.every((m, i) => (i < CURATED_MODELS.length ? m.curated : true))).toBe(true);
  });

  it("appends discovered suitable models, marked untested with null quota", () => {
    const options = buildModelOptions([
      { name: "models/gemini-3-pro", supportedGenerationMethods: ["generateContent"] },
    ]);
    const discovered = options.find((m) => m.id === "gemini-3-pro");
    expect(discovered).toMatchObject({ curated: false, quota: null });
  });

  it("does not duplicate a discovered model that is already curated", () => {
    const options = buildModelOptions([
      { name: "models/gemini-flash-lite-latest", supportedGenerationMethods: ["generateContent"] },
    ]);
    expect(options.filter((m) => m.id === "gemini-flash-lite-latest")).toHaveLength(1);
  });

  it("every curated entry carries quota figures", () => {
    for (const model of CURATED_MODELS) {
      expect(model.quota.rpm).toBeGreaterThan(0);
      expect(model.quota.rpd).toBeGreaterThan(0);
    }
  });
});
