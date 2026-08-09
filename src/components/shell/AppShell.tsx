"use client";

import {
  type ReactNode,
  useState,
} from "react";

import { Sidebar } from "./Sidebar";

import { TopBar } from "./TopBar";

import { SystemStatusBar } from "./SystemStatusBar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({
  children,
}: AppShellProps) {
  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false);

  return (
    <div
      className={
        sidebarCollapsed
          ? "labApp labAppSidebarCollapsed"
          : "labApp"
      }
    >
      <Sidebar
        collapsed={sidebarCollapsed}
      />

      <div className="labStage">
        <TopBar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() =>
            setSidebarCollapsed(
              (current) => !current,
            )
          }
        />

        <div className="labContent">
          {children}
        </div>

        <SystemStatusBar />
      </div>
    </div>
  );
}