export function SystemStatusBar() {
  return (
    <footer className="labSystemBar">
      <div className="labSystemGroup">
        <SystemItem
          label="Application"
          value="Ready"
          status="good"
        />

        <SystemItem
          label="Environment"
          value="Research"
          status="neutral"
        />

        <SystemItem
          label="Inference"
          value="Service-backed"
          status="good"
        />
      </div>


      <div className="labSystemGroup">
        <SystemItem
          label="XY Stage"
          value="Simulated"
          status="warning"
        />

        <SystemItem
          label="Protocol"
          value="Blood Parasite"
          status="neutral"
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
  status,
}: {
  label:
    string;

  value:
    string;

  status:
    "good" |
    "warning" |
    "neutral";
}) {
  return (
    <div className="labSystemItem">
      <span
        className={
          status ===
          "good"
            ? "labSystemDot labSystemDotGood"
            : status ===
                "warning"
              ? "labSystemDot labSystemDotWarning"
              : "labSystemDot"
        }
      />

      <span className="labSystemLabel">
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}