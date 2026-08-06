"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";

export default function ScanCameraPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraMsg, setCameraMsg] = useState("Initialisation de la caméra…");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let raf = 0;

    async function start() {
      if (!("BarcodeDetector" in window)) {
        setCameraMsg(
          "Ce navigateur ne lit pas les QR. Revenez en arrière et saisissez le code salle.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (!videoRef.current || stopped) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraMsg("Cadrez le QR de la salle");

        // @ts-expect-error BarcodeDetector experimental
        const detector = new BarcodeDetector({ formats: ["qr_code"] });

        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              const raw = String(codes[0].rawValue);
              const match =
                raw.match(/\/room\/([a-zA-Z0-9_-]+)/) ||
                raw.match(/^(rm_[a-zA-Z0-9_-]+)$/);
              const id = match?.[1];
              if (id) {
                stopped = true;
                router.replace(`/room/${id}`);
                return;
              }
            }
          } catch {
            /* ignore */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCameraMsg("Caméra inaccessible. Utilisez le code salle.");
      }
    }

    start();
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
        backHref="/scan"
        backLabel="Retour"
        showBrand={false}
      />
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--stroke)] bg-black">
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full object-cover"
          muted
          playsInline
        />
      </div>
      <p className="mt-3 text-center text-sm text-[var(--muted)]">{cameraMsg}</p>
    </div>
  );
}
