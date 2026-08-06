import { MICROSCOPE_CONFIG } from "@/lib/microscope-config";

const CELLS = [
  [95, 95, 31],
  [175, 78, 29],
  [255, 118, 33],
  [338, 84, 30],
  [420, 126, 32],
  [515, 86, 29],
  [605, 120, 31],
  [705, 88, 30],
  [795, 124, 33],
  [130, 205, 30],
  [225, 225, 32],
  [322, 190, 29],
  [414, 232, 31],
  [505, 190, 33],
  [600, 230, 30],
  [695, 203, 32],
  [792, 228, 29],
  [88, 330, 32],
  [182, 355, 29],
  [280, 315, 31],
  [375, 360, 30],
  [475, 318, 32],
  [565, 365, 29],
  [665, 325, 31],
  [770, 360, 32],
  [135, 460, 30],
  [250, 445, 31],
  [350, 480, 29],
  [465, 445, 32],
  [585, 475, 30],
  [700, 450, 31],
  [810, 475, 29],
] as const;

const WHITE_CELLS = [
  [435, 285, 39],
  [735, 285, 37],
] as const;

export function blurForSimulationZ(z: number): number {
  const { optimalZ } = MICROSCOPE_CONFIG.simulation;
  return Math.min(7, Math.abs(z - optimalZ) / 5.5);
}

export function drawSyntheticBloodField(
  canvas: HTMLCanvasElement,
): void {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("2D canvas context is unavailable.");
  }

  const { width, height } = MICROSCOPE_CONFIG.canvas;

  const background = ctx.createRadialGradient(
    width / 2,
    height / 2,
    20,
    width / 2,
    height / 2,
    520,
  );

  background.addColorStop(0, "#fffaf6");
  background.addColorStop(1, "#efd9d5");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (const [x, y, radius] of CELLS) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(211, 104, 115, 0.60)";
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(132, 51, 66, 0.72)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + 2, y - 1, radius * 0.48, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 232, 221, 0.78)";
    ctx.fill();
  }

  for (const [x, y, radius] of WHITE_CELLS) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(154, 127, 201, 0.72)";
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(79, 55, 131, 0.85)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x - 9, y + 2, 13, 0, Math.PI * 2);
    ctx.arc(x + 10, y - 4, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(63, 42, 110, 0.85)";
    ctx.fill();
  }

  for (let index = 0; index < 28; index += 1) {
    const x = (index * 83 + 47) % width;
    const y = (index * 131 + 66) % height;

    ctx.beginPath();
    ctx.arc(x, y, 5 + (index % 3), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(126, 82, 155, 0.7)";
    ctx.fill();
  }
}
