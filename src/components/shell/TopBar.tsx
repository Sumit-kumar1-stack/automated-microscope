type TopBarProps = {
  sidebarCollapsed:
    boolean;

  onToggleSidebar:
    () => void;
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
          onClick={
            onToggleSidebar
          }
          aria-label={
            sidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          <span aria-hidden="true">
            ☰
          </span>
        </button>


        <div className="labTopBarIdentity">
          <div className="labBreadcrumb">
            Research Platform

            <span>
              /
            </span>

            Automated Microscopy
          </div>

          <div className="labWorkspaceTitle">
            Automated Microscopy Workstation
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


        <div className="labRuntimeBadge">
          <small>
            PLATFORM
          </small>

          <strong>
            PHASE 8
          </strong>
        </div>


        <div className="labResearchBadge">
          <div>
            <small>
              SCIENTIFIC STATUS
            </small>

            <strong>
              RESEARCH ONLY
            </strong>
          </div>
        </div>
      </div>
    </header>
  );
}