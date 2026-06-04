"use client";

// Toggle visible en ambos estados: track gris claro cuando esta apagado,
// negro cuando esta encendido, con el thumb blanco y sombra para contraste.
export function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      aria-pressed={on}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? "bg-foreground" : "bg-[#D6D9DE]"
      }`}
      type="button"
      onClick={() => onChange(!on)}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
