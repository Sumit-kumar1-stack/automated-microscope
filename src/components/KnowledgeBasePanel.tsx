import type {
  TestProfile,
} from "@/knowledge/test-profiles";

type Props = {
  profile:
    TestProfile;
};

export function KnowledgeBasePanel({
  profile,
}: Props) {
  return (
    <div className="card knowledgeCard">
      <div className="cardHeader">
        <div>
          KNOWLEDGE BASE
        </div>

        <span>
          {
            profile.version
          }
        </span>
      </div>

      <div className="knowledgeBody">
        <KnowledgeRow
          label="Protocol"
          value={
            profile.name
          }
        />

        <KnowledgeRow
          label="Specimen"
          value={
            profile.specimenType
          }
        />

        <KnowledgeRow
          label="Focus"
          value="Laplacian variance"
        />

        <KnowledgeRow
          label="Detector"
          value={
            profile
              .detector
              .label
          }
        />

        <div className="knowledgeBlock">
          <span>
            TARGETS
          </span>

          {profile
            .targetClasses
            .length ===
          0 ? (
            <p>
              No biological classes
            </p>
          ) : (
            <div className="knowledgeTags">
              {profile.targetClasses.map(
                (
                  target,
                ) => (
                  <small
                    key={
                      target
                    }
                  >
                    {
                      target
                    }
                  </small>
                ),
              )}
            </div>
          )}
        </div>

        <div className="knowledgeBlock">
          <span>
            MEASUREMENTS
          </span>

          <div className="knowledgeMeasurements">
            {profile.measurements.map(
              (
                measurement,
              ) => (
                <small
                  key={
                    measurement.key
                  }
                >
                  {
                    measurement.label
                  }
                </small>
              ),
            )}
          </div>
        </div>

        {profile.status ===
          "research-config" && (
          <p className="knowledgeWarning">
            Detector configuration exists,
            but target-specific automated
            detection is not implemented.
          </p>
        )}
      </div>
    </div>
  );
}

function KnowledgeRow({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="resultRow">
      <span>
        {
          label
        }
      </span>

      <strong>
        {
          value
        }
      </strong>
    </div>
  );
}