import { describe, it, expect } from "vitest";
import { createI18n } from "../src/index.js";

describe("I18n System", () => {
  const i18n = createI18n({
    defaultLocale: "en-US",
    locales: {
      "en-US": {
        welcome: "Welcome, {user}!",
        ping: "Pong! Latency is {ms}ms",
        farewell: "Goodbye!",
      },
      de: {
        welcome: "Willkommen, {user}!",
        ping: "Pong! Latenz beträgt {ms}ms",
        farewell: "Auf Wiedersehen!",
      },
      fr: {
        welcome: (p) => `Bienvenue, ${p.user}!`,
      },
    },
  });

  it("translates strings with parameter interpolation in default locale", () => {
    expect(i18n.t("welcome", { user: "Alice" })).toBe("Welcome, Alice!");
    expect(i18n.t("farewell")).toBe("Goodbye!");
  });

  it("translates into specific target locale", () => {
    expect(i18n.t("welcome", { user: "Bob" }, "de")).toBe("Willkommen, Bob!");
    expect(i18n.t("ping", { ms: 42 }, "de")).toBe("Pong! Latenz beträgt 42ms");
  });

  it("supports functional translations", () => {
    expect(i18n.t("welcome", { user: "Claire" }, "fr")).toBe("Bienvenue, Claire!");
  });

  it("falls back to default locale when key is missing in target locale", () => {
    // 'fr' only has 'welcome'
    expect(i18n.t("farewell", undefined, "fr")).toBe("Goodbye!");
  });

  it("returns key when missing in all locales", () => {
    expect(i18n.t("non_existent_key")).toBe("non_existent_key");
  });
});
