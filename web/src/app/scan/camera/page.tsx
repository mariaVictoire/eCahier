"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui";

function extractRoomId(raw: string): string | null {
  const value = raw.trim();
  const fromPath = value.match(/\/room\/([a-zA-Z0-9_-]+)/i);
  if (fromPath?.[1]) return fromPath[1];
  if (/^[a-zA-Z0-9_-]{2,64}$/.test(value)) return value;
  return null;
}

export default function ScanCameraPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraMsg, setCameraMsg] = useState("Initialisation de la caméra…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let raf = 0;
    let lastScan = 0;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFailed(true);
        setCameraMsg(
          "Ce navigateur ne peut pas ouvrir la caméra. Saisissez le code salle.",
        );
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        setFailed(true);
        setCameraMsg(
          "Caméra inaccessible (permission refusée ou appareil indisponible). Saisissez le code salle.",
        );
        return;
      }

      const video = videoRef.current;
      if (!video || stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;

      try {
        await video.play();
      } catch {
        setFailed(true);
        setCameraMsg("Impossible de démarrer la vidéo. Saisissez le code salle.");
        return;
      }

      setCameraMsg("Cadrez le QR de la salle");

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) {
        setFailed(true);
        setCameraMsg("Erreur d’affichage. Saisissez le code salle.");
        return;
      }

      const tick = () => {
        if (stopped || !videoRef.current) return;

        const v = videoRef.current;
        if (v.readyState >= 2 && v.videoWidth > 0) {
          const now = performance.now();
          // ~8 fps suffit pour un QR et limite la charge CPU
          if (now - lastScan >= 120) {
            lastScan = now;
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(image.data, image.width, image.height, {
              inversionAttempts: "attemptBoth",
            });
            if (code?.data) {
              const id = extractRoomId(code.data);
              if (id) {
                stopped = true;
                stream?.getTracks().forEach((t) => t.stop());
                router.replace(`/room/${id}`);
                return;
              }
              setCameraMsg("QR lu, mais ce n’est pas un code salle eCahier.");
            }
          }
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);
    }

    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <div className="page-shell">
      <AppHeader
        title="Scanner"
        backHref="/"
        backLabel="Accueil"
        showBrand={false}
      />
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--stroke)] bg-black">
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" aria-hidden />
      </div>
      <p className="mt-3 text-center text-sm text-[var(--muted)]">{cameraMsg}</p>
      {failed ? (
        <div className="mt-4">
          <Link href="/scan" className="block">
            <Button className="w-full" variant="secondary">
              Saisir le code salle
            </Button>
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-center text-sm">
          <Link href="/scan" className="text-[var(--muted)] underline-offset-2 hover:underline">
            Ou saisir le code manuellement
          </Link>
        </p>
      )}
    </div>
  );
}
