import {
  type MicroscopeMode,
} from "@/lib/microscope-config";

type ResearchPipelinePanelProps = {
  mode: MicroscopeMode;
  detectorLabel: string;
};

type PipelineStepProps = {
  title: string;
  text: string;
};

function PipelineStep({
  title,
  text,
}: PipelineStepProps) {
  return (
    <div className="pipelineBox">
      <strong>
        {title}
      </strong>

      <span>
        {text}
      </span>
    </div>
  );
}

export function ResearchPipelinePanel({
  mode,
  detectorLabel,
}: ResearchPipelinePanelProps) {
  return (
    <div className="card researchCard">
      <div className="cardHeader">
        <div>
          RESEARCH PIPELINE
        </div>

        <span>
          AUTOMATED WORKSTATION
        </span>
      </div>

      <div className="pipeline">
        <PipelineStep
          title="Acquire"
          text={
            mode === "simulation"
              ? "Synthetic / research frame"
              : "Real camera frame"
          }
        />

        <b>
          →
        </b>

        <PipelineStep
          title="Focus"
          text={
            mode === "camera"
              ? "Live Laplacian measurement"
              : "Coarse + fine Z search"
          }
        />

        <b>
          →
        </b>

        <PipelineStep
          title="Analyze"
          text={
            detectorLabel
          }
        />

        <b>
          →
        </b>

        <PipelineStep
          title="Aggregate"
          text="Field results + slide summary"
        />

        <b>
          →
        </b>

        <PipelineStep
          title="Report"
          text="Snapshot + PDF + history"
        />
      </div>
    </div>
  );
}
