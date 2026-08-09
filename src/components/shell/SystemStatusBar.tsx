export function SystemStatusBar() {
  return (
    <footer className="labSystemBar">
      <div className="labSystemGroup">
        <SystemItem
          label="Application"
          value="Ready"
        />

        <SystemItem
          label="Environment"
          value="Research"
        />

        <SystemItem
          label="Protocol"
          value="Blood Parasite"
        />
      </div>

      <div className="labSystemGroup">
        <SystemItem
          label="Hardware"
          value="Workspace managed"
        />

        <div className="labSystemDisclaimer">
          NOT CLINICALLY VALIDATED
        </div>
      </div>
    </footer>
  );
}

function SystemItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="labSystemItem">
      <span className="labSystemDot labSystemDotGood" />

      <span className="labSystemLabel">
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}