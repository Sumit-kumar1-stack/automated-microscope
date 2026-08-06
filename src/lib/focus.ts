export function calculateLaplacianVariance(image: ImageData): number {
  const { data, width, height } = image;
  const gray = new Float32Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  let sumSquares = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const laplacian =
        gray[i - width] +
        gray[i - 1] -
        4 * gray[i] +
        gray[i + 1] +
        gray[i + width];

      sum += laplacian;
      sumSquares += laplacian * laplacian;
      count += 1;
    }
  }

  if (!count) return 0;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}
