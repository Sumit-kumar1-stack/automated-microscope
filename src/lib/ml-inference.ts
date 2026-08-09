export type MlBoundingBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type MlParasiteStage =
  | "ring"
  | "trophozoite"
  | "schizont"
  | "gametocyte";

export type MlCandidate = {
  candidate_id: number;
  bbox: MlBoundingBox;
  detector_confidence: number;
  stage: MlParasiteStage;
  stage_confidence: number;
};

export type MlInferenceResult = {
  status: "complete";

  analysis_type: string;

  research_only: boolean;

  clinically_validated: boolean;

  model_version: string;

  image: {
    filename: string;
    width: number;
    height: number;
  };

  configuration: {
    detector_confidence: number;
    detector_image_size: number;
    classifier_image_size: number;
    context_scale: number;
  };

  candidate_count: number;

  candidates: MlCandidate[];

  timing_ms: {
    inference: number;
    total: number;
  };
};

export type MlHealthResult = {
  status: string;
  service: string;
  research_only: boolean;
  clinical_validation: boolean;
  models_loaded: boolean;
};

export type MlModelInfo = {
  status: string;

  research_only: boolean;

  clinically_validated: boolean;

  detector: {
    name: string;
    confidence_threshold: number;
    image_size: number;
  };

  classifier: {
    name: string;
    architecture: string;
    image_size: number;
    classes: MlParasiteStage[];
  };

  crop_context_scale: number;

  validation: {
    development: {
      detector_precision: number | null;
      detector_recall: number | null;
      detector_f1: number | null;
      end_to_end_macro_f1: number | null;
    } | null;

    external: {
      benchmark: string | null;
      images: number | null;
      ground_truth_objects: number | null;
      detector_precision: number | null;
      detector_recall: number | null;
      detector_f1: number | null;
      end_to_end_macro_f1: number | null;
    } | null;
  };
};


async function parseApiError(
  response: Response,
): Promise<string> {
  try {
    const data = await response.json();

    if (
      typeof data?.error === "string"
    ) {
      return data.error;
    }

    if (
      typeof data?.detail === "string"
    ) {
      return data.detail;
    }
  } catch {
    // Ignore malformed error bodies.
  }

  return (
    `ML request failed with HTTP ` +
    `${response.status}.`
  );
}


export async function getMlHealth(): Promise<MlHealthResult> {
  const response = await fetch(
    "/api/ml/health",
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
      ),
    );
  }

  return response.json();
}


export async function getMlModelInfo(): Promise<MlModelInfo> {
  const response = await fetch(
    "/api/ml/model-info",
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
      ),
    );
  }

  return response.json();
}


export async function runMlInference(
  image: Blob,
  filename = "microscope-frame.png",
): Promise<MlInferenceResult> {
  const formData =
    new FormData();

  formData.append(
    "file",
    image,
    filename,
  );

  const response = await fetch(
    "/api/ml/infer",
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(
      await parseApiError(
        response,
      ),
    );
  }

  return response.json();
}