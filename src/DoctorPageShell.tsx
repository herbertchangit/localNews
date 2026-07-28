import { ReactNode } from "react";

export default function DoctorPageShell({ children }: { children: ReactNode }) {
  return <div className="doctorPageShell">{children}</div>;
}
