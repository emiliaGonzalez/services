"use client";

import { useState } from "react";

interface ChatInputProps {
  placeholder?: string;
  /** Devuelve false para indicar que no se envió (no limpia el campo). */
  onSend: (value: string) => void | boolean;
}

export function ChatInput({
  placeholder = "Escribe tu respuesta...",
  onSend,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (!value.trim()) return;
    const result = onSend(value.trim());

    if (result !== false) setValue("");
  };

  return (
    <div className="w-full px-40 pb-6 pt-4">
      <div className="flex items-center w-full h-12 pl-[18px] pr-1.5 rounded-3xl border border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.04)] gap-2.5 bg-background">
        <input
          className="flex-1 bg-transparent outline-none text-sm text-[#1A1A1A] placeholder:text-[#9CA3AF]"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button
          type="button"
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-foreground-100 transition-colors"
          onClick={handleSubmit}
        >
          <svg
            className="w-4.5 h-4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
