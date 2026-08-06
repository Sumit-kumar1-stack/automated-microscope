import {
  TEST_PROFILES,
  type TestProfile,
} from "@/knowledge/test-profiles";

type Props = {
  profile:
    TestProfile;

  onChange:
    (
      profileId:
        string,
    ) => void;
};

export function TestProfileSelector({
  profile,
  onChange,
}: Props) {
  return (
    <section className="card testProfileBar">
      <div className="testProfileInfo">
        <div>
          <span className="profileEyebrow">
            ACTIVE TEST PROTOCOL
          </span>

          <strong>
            {
              profile.name
            }
          </strong>
        </div>

        <div className="profileMeta">
          <span>
            v
            {
              profile.version
            }
          </span>

          <span>
            {
              profile.specimenType
            }
          </span>

          <span
            className={
              profile.status ===
              "ready"
                ? "profileReady"
                : "profileResearch"
            }
          >
            {profile.status ===
            "ready"
              ? "READY"
              : "CONFIG ONLY"}
          </span>
        </div>
      </div>

      <select
        value={
          profile.id
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        aria-label="Test profile"
      >
        {TEST_PROFILES.map(
          (
            candidate,
          ) => (
            <option
              key={
                candidate.id
              }
              value={
                candidate.id
              }
            >
              {
                candidate.name
              }
              {candidate.status ===
              "research-config"
                ? " — config only"
                : ""}
            </option>
          ),
        )}
      </select>
    </section>
  );
}