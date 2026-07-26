export const CHECK_APP_UPDATE_EVENT = "local-news:check-app-update";
export const APP_UPDATE_RESULT_EVENT = "local-news:app-update-result";

export type AppUpdateResult = {
  status: "checking" | "latest" | "updating" | "error";
  message: string;
};
