/** Construit une étiquette PNG (classe + code + QR) dans le navigateur. */
export async function buildLabeledSticker(opts: {
  qrDataUrl: string;
  title: string;
  /** Code court à saisir manuellement (ex. A1) */
  code?: string;
  subtitle?: string;
}): Promise<string> {
  await document.fonts?.ready?.catch?.(() => undefined);

  const width = 520;
  const headerH = opts.code ? 108 : 88;
  const footerH = 72;
  const pad = 36;
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
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (opts.code) {
    ctx.font = `600 28px ${sans}`;
    ctx.fillText(opts.title, width / 2, headerH / 2 - 16, width - 48);
    ctx.font = `700 22px ${sans}`;
    ctx.fillStyle = "#C8A84B";
    ctx.fillText(`Code : ${opts.code}`, width / 2, headerH / 2 + 22, width - 48);
  } else {
    ctx.font = `600 40px ${sans}`;
    ctx.fillText(opts.title, width / 2, headerH / 2 - 2, width - 48);
  }

  const img = await loadImage(opts.qrDataUrl);
  ctx.drawImage(img, (width - qrSize) / 2, headerH + pad, qrSize, qrSize);

  ctx.fillStyle = "#5A6A61";
  ctx.font = `500 15px ${sans}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    "Scannez le QR — ou saisissez le code",
    width / 2,
    height - 28,
    width - 48,
  );

  return canvas.toDataURL("image/png");
}

export function printStickerImage(stickerSrc: string, title: string) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Étiquette ${title}</title>
  <style>
    @page { margin: 12mm; }
    html, body { margin: 0; min-height: 100%; }
    body { display: flex; justify-content: center; align-items: center; background: #f4f5f7; }
    img { width: min(90mm, 92vw); height: auto; background: #fff; }
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
