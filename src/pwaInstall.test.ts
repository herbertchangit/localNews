import { describe, expect, it } from "vitest";
import { isIosDevice, shouldShowIosInstall } from "./pwaInstall";

describe("iPhone PWA installation guidance", () => {
  it("detects iPhone and touch-enabled iPad desktop user agents", () => {
    expect(
      isIosDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        5,
      ),
    ).toBe(true);
    expect(
      isIosDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/18.0 Safari/605.1.15",
        5,
      ),
    ).toBe(true);
  });

  it("shows help only before the iOS web app is installed", () => {
    const iPhone = {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      maxTouchPoints: 5,
      displayModeStandalone: false,
      navigatorStandalone: false,
    };
    expect(shouldShowIosInstall(iPhone)).toBe(true);
    expect(
      shouldShowIosInstall({ ...iPhone, navigatorStandalone: true }),
    ).toBe(false);
    expect(
      shouldShowIosInstall({ ...iPhone, displayModeStandalone: true }),
    ).toBe(false);
  });
});
