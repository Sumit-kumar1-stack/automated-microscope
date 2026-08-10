type WorkspaceSectionHeaderProps = {
  index:
    string;

  eyebrow:
    string;

  title:
    string;

  description:
    string;

  status?:
    string;

  statusTone?:
    | "good"
    | "warning"
    | "neutral";
};


export function WorkspaceSectionHeader({
  index,
  eyebrow,
  title,
  description,
  status,
  statusTone =
    "neutral",
}: WorkspaceSectionHeaderProps) {
  return (
    <header className="workspaceSectionHeader">
      <div className="workspaceSectionIdentity">
        <span className="workspaceSectionIndex">
          {index}
        </span>

        <div>
          <span className="workspaceSectionEyebrow">
            {eyebrow}
          </span>

          <h2>
            {title}
          </h2>

          <p>
            {description}
          </p>
        </div>
      </div>


      {status && (
        <div
          className={
            statusTone ===
            "good"
              ? "workspaceSectionStatus workspaceSectionStatusGood"
              : statusTone ===
                  "warning"
                ? "workspaceSectionStatus workspaceSectionStatusWarning"
                : "workspaceSectionStatus"
          }
        >
          <span />

          {status}
        </div>
      )}
    </header>
  );
}