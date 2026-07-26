import { describe, expect, it } from "vitest";
import { HEALTH_TERM_TRANSLATIONS, splitBilingualLabel } from "./I18n";

describe("bilingual UI labels", () => {
  it("splits slash-separated labels", () => {
    expect(splitBilingualLabel("Preview / 預覽")).toEqual({ en: "Preview", zh: "預覽" });
    expect(splitBilingualLabel("Story / event date / 新聞或活動日期"))
      .toEqual({ en: "Story / event date", zh: "新聞或活動日期" });
  });

  it("splits section labels at the divider nearest the Chinese text", () => {
    expect(splitBilingualLabel("NEWSROOM / STORIES · 新聞中心 / 新聞"))
      .toEqual({ en: "NEWSROOM / STORIES", zh: "新聞中心 / 新聞" });
  });

  it("does not split single-language or content-like text", () => {
    expect(splitBilingualLabel("Story preview")).toBeNull();
    expect(splitBilingualLabel("新聞預覽")).toBeNull();
    expect(splitBilingualLabel("12 photos · videos")).toBeNull();
  });

  it("provides the requested healthcare terms in both Chinese scripts", () => {
    expect(HEALTH_TERM_TRANSLATIONS["Talk With Doc"]).toEqual({ "zh-cn": "医你有约", "zh-tw": "醫你有約" });
    expect(HEALTH_TERM_TRANSLATIONS.Events).toEqual({ "zh-cn": "活动", "zh-tw": "活動" });
    expect(HEALTH_TERM_TRANSLATIONS.Appointments).toEqual({ "zh-cn": "预约", "zh-tw": "預約" });
    expect(HEALTH_TERM_TRANSLATIONS.Doctors).toEqual({ "zh-cn": "医生", "zh-tw": "醫生" });
    expect(HEALTH_TERM_TRANSLATIONS["Health Events"]).toEqual({ "zh-cn": "健康活动", "zh-tw": "健康活動" });
  });
});
