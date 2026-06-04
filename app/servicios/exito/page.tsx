"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import confetti from "canvas-confetti";

const COLORS = [
  "#4F46E5",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#8B5CF6",
  "#EF4444",
  "#06B6D4",
  "#F97316",
];

function ExitoContent() {
  const router = useRouter();
  const params = useSearchParams();
  const name = params.get("name")?.trim() || "Tu servicio";

  useEffect(() => {
    // Estallido desde el centro, radiando en todas direcciones.
    const burst = (particleCount: number, startVelocity: number) =>
      confetti({
        particleCount,
        spread: 360,
        startVelocity,
        ticks: 220,
        gravity: 0.9,
        scalar: 0.9,
        origin: { x: 0.5, y: 0.5 },
        colors: COLORS,
      });

    burst(110, 38);
    setTimeout(() => burst(60, 26), 180);

    const timer = setTimeout(() => router.push("/servicios"), 5000);

    return () => {
      clearTimeout(timer);
      confetti.reset();
    };
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full bg-foreground-50 px-6">
      <div className="bg-background rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] w-full max-w-[600px] px-16 py-12 flex flex-col items-center text-center gap-6">
        <div className="w-[72px] h-[72px] rounded-full bg-[#10B981] flex items-center justify-center">
          <svg
            className="w-9 h-9 text-white"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            viewBox="0 0 24 24"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-[28px] font-bold text-[#1A1A1A]">
          ¡Servicio guardado!
        </h1>
        <p className="text-base leading-relaxed text-[#6B7280]">
          {name} se ha agregado a tu catálogo
        </p>

        <div className="flex flex-col items-center gap-3 pt-4">
          <span className="text-[13px] text-[#9CA3AF]">
            Redirigiendo al listado de servicios en 5s...
          </span>
          <div className="w-[200px] h-1 rounded-full bg-[#E5E7EB] overflow-hidden">
            <div className="h-full bg-[#4F46E5] rounded-full animate-[grow_5s_linear_forwards]" />
          </div>
        </div>

        <button
          className="flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-medium text-[#4F46E5] hover:bg-[#4F46E5]/5 transition-colors"
          type="button"
          onClick={() => router.push("/servicios")}
        >
          Ir al listado ahora
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ExitoPage() {
  return (
    <Suspense fallback={<div className="h-full bg-foreground-50" />}>
      <ExitoContent />
    </Suspense>
  );
}
