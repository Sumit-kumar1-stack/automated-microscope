type SidebarProps = {
  collapsed: boolean;
};

export function Sidebar({
  collapsed,
}: SidebarProps) {
  return (
    <aside className="labSidebar">
      <div className="labBrand">
        <div className="labBrandMark">
          AM
        </div>

        {!collapsed && (
          <div className="labBrandCopy">
            <strong>
              Autonomous
            </strong>

            <span>
              Microscopy
            </span>
          </div>
        )}
      </div>

      <div className="labSidebarDivider" />

      <nav className="labNavigation">
        <NavItem
          label="Microscope"
          active
          collapsed={collapsed}
        />

        <NavItem
          label="Slide Scan"
          collapsed={collapsed}
          disabled
        />

        <NavItem
          label="Experiments"
          collapsed={collapsed}
          disabled
        />

        <NavItem
          label="Validation"
          collapsed={collapsed}
          disabled
        />

        <NavItem
          label="Reports"
          collapsed={collapsed}
          disabled
        />

        <NavItem
          label="Hardware"
          collapsed={collapsed}
          disabled
        />

        <NavItem
          label="Settings"
          collapsed={collapsed}
          disabled
        />
      </nav>

      <div className="labSidebarSpacer" />

      <div className="labProtocol">
        {!collapsed && (
          <>
            <span className="labProtocolEyebrow">
              ACTIVE PROTOCOL
            </span>

            <strong>
              Blood Parasite Research
            </strong>

            <span className="labProtocolMeta">
              Engineering validation
            </span>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="labSidebarFooter">
          <span>
            RESEARCH USE ONLY
          </span>

          <small>
            Not clinically validated
          </small>
        </div>
      )}
    </aside>
  );
}

function NavItem({
  label,
  active = false,
  disabled = false,
  collapsed,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "labNavItem labNavItemActive"
          : "labNavItem"
      }
      disabled={disabled}
      title={
        collapsed
          ? label
          : undefined
      }
    >
      <span className="labNavIcon">
        •
      </span>

      {!collapsed && (
        <>
          <span className="labNavText">
            {label}
          </span>

          {disabled && (
            <span className="labNavSoon">
              SOON
            </span>
          )}
        </>
      )}
    </button>
  );
}