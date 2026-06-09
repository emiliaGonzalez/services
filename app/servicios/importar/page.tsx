"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { takePendingPdf } from "@/lib/pending-import";

export default function ImportarPage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const file = takePendingPdf();

    if (!file) {
      router.replace("/servicios/nuevo");

      return;
    }

    (async () => {
      try {
        const fd = new FormData();

        fd.append("file", file);
        const res = await fetch("/api/servicios/import-pdf", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "No se pudo procesar el documento.");
        }
        router.replace("/servicios");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "No se pudo procesar el documento.",
        );
      }
    })();
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full bg-foreground-50 px-6">
      <div className="bg-background rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.10)] w-full max-w-[600px] px-16 py-12 flex flex-col items-center text-center gap-6">
        {error ? (
          <>
            <div className="w-[72px] h-[72px] rounded-full bg-danger-100 flex items-center justify-center">
              <svg
                className="w-9 h-9 text-danger-500"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">
              No pudimos importar
            </h1>
            <p className="text-base leading-relaxed text-[#6B7280]">{error}</p>
            <button
              className="flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-medium text-[#4F46E5] hover:bg-[#4F46E5]/5 transition-colors"
              type="button"
              onClick={() => router.replace("/servicios/nuevo")}
            >
              Volver a intentar
            </button>
          </>
        ) : (
          <>
            <div className="w-[72px] h-[72px] rounded-full border-4 border-[#E5E7EB] border-t-[#4F46E5] animate-spin" />
            <h1 className="text-2xl font-bold text-[#1A1A1A]">
              Procesando tu documento…
            </h1>
            <p className="text-base leading-relaxed text-[#6B7280]">
              Estamos analizando el catálogo y creando tus servicios. Esto puede
              tardar unos segundos.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
