export function isIosDevice(userAgent: string, maxTouchPoints: number) {
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

export function shouldShowIosInstall({
  userAgent,
  maxTouchPoints,
  displayModeStandalone,
  navigatorStandalone,
}: {
  userAgent: string;
  maxTouchPoints: number;
  displayModeStandalone: boolean;
  navigatorStandalone?: boolean;
}) {
  return (
    isIosDevice(userAgent, maxTouchPoints) &&
    !displayModeStandalone &&
    !navigatorStandalone
  );
}
