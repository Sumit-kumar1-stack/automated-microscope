import type {
  TestProfile,
} from "@/knowledge/test-profiles";

type Props = {
  profile: TestProfile;
};

export function KnowledgeBasePanel({
  profile,
}: Props) {
  return (
    <div className="card knowledgeCard">
      <details className="knowledgeDetails">
        <summary>
          <div className="knowledgeSummaryTitle">
            <strong>
              Protocol details
            </strong>

            <span>
              {profile.detector.label}
              {" "}
              •
              {" "}
              {profile.version}
            </span>
          </div>

          <span className="knowledgeChevron">
           ⌄
          </span>
        </summary>

        <div className="knowledgeBody">
          <div className="resultRow">
            <span>
              Protocol
            </span>

            <strong>
              {profile.name}
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Specimen
            </span>

            <strong>
              {profile.specimenType}
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Focus
            </span>

            <strong>
              Laplacian variance
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Detector
            </span>

            <strong>
              {profile.detector.label}
            </strong>
          </div>

          <div className="knowledgeBlock">
            <span>
              Target classes
            </span>

            {profile.targetClasses.length ===
            0 ? (
              <div className="knowledgeTags">
                <small>
                  Focus measurement only
                </small>
              </div>
            ) : (
              <div className="knowledgeTags">
                {profile.targetClasses.map(
                  (target) => (
                    <small key={target}>
                      {target}
                    </small>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="knowledgeBlock">
            <span>
              Measurements
            </span>

            <div className="knowledgeMeasurements">
              {profile.measurements.map(
                (measurement) => (
                  <small
                    key={
                      measurement.key
                    }
                  >
                    {measurement.label}
                  </small>
                ),
              )}
            </div>
          </div>

          {profile.status ===
            "research-config" && (
            <p className="knowledgeWarning">
              This protocol currently contains
              configuration only. A validated
              target-specific detector has not
              been installed.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}