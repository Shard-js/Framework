export type LocaleDictionary = Record<
  string,
  string | ((params: Record<string, any>) => string)
>;

export interface I18nConfig {
  defaultLocale?: string;
  locales: Record<string, LocaleDictionary>;
}

export class I18n {
  public defaultLocale: string;
  private locales: Map<string, LocaleDictionary> = new Map();

  constructor(config: I18nConfig) {
    this.defaultLocale = config.defaultLocale || "en-US";
    for (const [locale, dict] of Object.entries(config.locales)) {
      this.locales.set(this.normalizeLocale(locale), dict);
    }
  }

  public normalizeLocale(locale: string): string {
    return locale.toLowerCase().replace(/_/g, "-");
  }

  public t(
    key: string,
    params?: Record<string, any>,
    preferredLocale?: string
  ): string {
    const localeKey = preferredLocale ? this.normalizeLocale(preferredLocale) : "";
    const defaultKey = this.normalizeLocale(this.defaultLocale);

    let dict = this.locales.get(localeKey);
    if (!dict && localeKey.includes("-")) {
      const baseLang = localeKey.split("-")[0];
      dict = this.locales.get(baseLang);
    }

    if (!dict || !(key in dict)) {
      dict = this.locales.get(defaultKey);
    }

    if (!dict || !(key in dict)) {
      return key;
    }

    const value = dict[key];
    if (typeof value === "function") {
      return value(params || {});
    }

    if (typeof value === "string") {
      if (!params) return value;
      return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
        return k in params ? String(params[k]) : `{${k}}`;
      });
    }

    return key;
  }
}

export function createI18n(config: I18nConfig): I18n {
  return new I18n(config);
}
