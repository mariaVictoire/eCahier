/** Construit une étiquette PNG (classe + QR) dans le navigateur. */
export async function buildLabeledSticker(opts: {
  qrDataUrl: string;
  title: string;
  subtitle?: string;
}): Promise<string> {
  await document.fonts?.ready?.catch?.(() => undefined);

  const width = 520;
  const headerH = 88;
  const footerH = 64;
  const pad = 40;
  const qrSize = 300;
  const height = headerH + pad + qrSize + pad + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return opts.qrDataUrl;

  const sans =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--font-sans")
      .trim() || "system-ui, sans-serif";

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0B3D2E";
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = "#C8A84B";
  ctx.fillRect(0, headerH - 5, width, 5);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `600 40px ${sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(opts.title, width / 2, headerH / 2 - 2, width - 48);

  const img = await loadImage(opts.qrDataUrl);
  ctx.drawImage(img, (width - qrSize) / 2, headerH + pad, qrSize, qrSize);

  ctx.fillStyle = "#5A6A61";
  ctx.font = `500 15px ${sans}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    "Scannez pour le cahier de textes",
    width / 2,
    height - 28,
    width - 48,
  );

  return canvas.toDataURL("image/png");
}

export function printStickerImage(stickerSrc: string, title: string) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=480,height=640");
  if (!win) return;
  win.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Étiquette ${title}</title>
  <style>
    @page { margin: 12mm; }
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    img { width: 90mm; max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <img src="${stickerSrc}" alt="QR ${title}" />
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
  win.document.close();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
