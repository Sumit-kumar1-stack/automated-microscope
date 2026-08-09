type TopBarProps = {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

export function TopBar({
  sidebarCollapsed,
  onToggleSidebar,
}: TopBarProps) {
  return (
    <header className="labTopBar">
      <div className="labTopBarLeft">
        <button
          type="button"
          className="labSidebarToggle"
          onClick={onToggleSidebar}
          aria-label={
            sidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          ☰
        </button>

        <div>
          <div className="labBreadcrumb">
            Research Platform
            <span>/</span>
            Workspace
          </div>

          <div className="labWorkspaceTitle">
            Microscope Control
          </div>
        </div>
      </div>

      <div className="labTopBarRight">
        <div className="labSessionBadge">
          <span className="labSessionDot" />

          <div>
            <small>
              SESSION
            </small>

            <strong>
              Engineering Validation
            </strong>
          </div>
        </div>

        <div className="labResearchBadge">
          <div>
            <small>
              STATUS
            </small>

            <strong>
              RESEARCH USE ONLY
            </strong>
          </div>
        </div>
      </div>
    </header>
  );
}