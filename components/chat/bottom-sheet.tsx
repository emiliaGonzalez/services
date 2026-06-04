"use client";

import { ReactNode } from "react";

interface BottomSheetProps {
  title: string;
  children: ReactNode;
  /** Ocupa toda la altura disponible (el contenedor define el alto); el contenido scrollea. */
  fullHeight?: boolean;
}

export function BottomSheet({ title, children, fullHeight = false }: BottomSheetProps) {
  return (
    <div
      className={`w-full rounded-t-[20px] bg-background shadow-[0_-4px_24px_rgba(0,0,0,0.07)] ${
        fullHeight ? "h-full flex flex-col" : "max-h-[85vh] overflow-y-auto"
      }`}
    >
      <div className="flex justify-center pt-3 pb-1 shrink-0">
        <div className="w-10 h-1 rounded-full bg-foreground-300" />
      </div>
      <div
        className={`px-8 pb-7 flex flex-col gap-4 ${
          fullHeight ? "flex-1 overflow-y-auto" : ""
        }`}
      >
        <h3 className="text-[17px] font-semibold text-foreground">{title}</h3>
        {children}
      </div>
    </div>
  );
}

interface NumberedOptionProps {
  number: number;
  label: string;
  highlighted?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
}

export function NumberedOption({
  number,
  label,
  highlighted,
  icon,
  onClick,
}: NumberedOptionProps) {
  return (
    <button
      type="button"
      className={`flex items-center gap-3.5 w-full px-3 py-3.5 rounded-[10px] text-left cursor-pointer transition-colors ${
        highlighted ? "bg-[#F3F4F6] hover:bg-[#ECEEF1]" : "hover:bg-[#F3F4F6]"
      }`}
      onClick={onClick}
    >
      <span className="shrink-0 w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[13px] font-semibold">
        {number}
      </span>
      <span className="flex items-center gap-2 text-[15px] text-[#1A1A1A]">
        {icon && <span className="shrink-0 text-[#6B7280]">{icon}</span>}
        {label}
      </span>
    </button>
  );
}
