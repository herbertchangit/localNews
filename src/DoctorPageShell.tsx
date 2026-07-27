import { ReactNode } from "react";
import PublicHeader from "./PublicHeader";

export default function DoctorPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="readerDashboardShell doctorPageShell">
      <PublicHeader
        className="homeHeader audienceDashboardHeader"
        hideSessionActions
        onMenu={() => window.dispatchEvent(new Event("local-news:open-reader-menu"))}
      />
      {children}
    </div>
  );
}
