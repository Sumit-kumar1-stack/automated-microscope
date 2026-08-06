export function captureAnalyzedImage(
  sourceCanvas:
    HTMLCanvasElement,

  overlayCanvas?:
    HTMLCanvasElement | null,
): string {
  const output =
    document.createElement(
      "canvas",
    );

  output.width =
    sourceCanvas.width;

  output.height =
    sourceCanvas.height;

  const ctx =
    output.getContext(
      "2d",
    );

  if (
    !ctx
  ) {
    throw new Error(
      "Unable to create analysis snapshot.",
    );
  }

  /*
   * Base optical image.
   */
  ctx.drawImage(
    sourceCanvas,
    0,
    0,
  );

  /*
   * Detection overlay.
   */
  if (
    overlayCanvas
  ) {
    ctx.drawImage(
      overlayCanvas,
      0,
      0,
      output.width,
      output.height,
    );
  }

  /*
   * Add a small research
   * watermark directly into
   * the stored image.
   */
  const label =
    "RESEARCH PROTOTYPE • NOT FOR DIAGNOSTIC USE";

  ctx.font =
    "700 14px Arial";

  const width =
    ctx.measureText(
      label,
    ).width;

  ctx.fillStyle =
    "rgba(3, 12, 16, 0.80)";

  ctx.fillRect(
    12,
    output.height -
      38,
    width + 20,
    26,
  );

  ctx.fillStyle =
    "#ffffff";

  ctx.fillText(
    label,
    22,
    output.height -
      20,
  );

  return output.toDataURL(
    "image/png",
    1,
  );
}

export function downloadAnalysisImage(
  imageDataUrl: string,
  filename: string,
): void {
  const anchor =
    document.createElement(
      "a",
    );

  anchor.href =
    imageDataUrl;

  anchor.download =
    filename;

  anchor.click();
}