const DEFAULT_ML_INFERENCE_URL =
  "http://127.0.0.1:8000";

export function getMlInferenceUrl() {
  return (
    process.env.ML_INFERENCE_URL ??
    DEFAULT_ML_INFERENCE_URL
  ).replace(
    /\/+$/,
    "",
  );
}