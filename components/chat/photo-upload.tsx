"use client";

import { useRef, useState } from "react";
import { Button } from "@heroui/react";

interface PhotoUploadProps {
  min?: number;
  onDone: (urls: string[]) => void;
}

interface Item {
  id: string;
  preview: string;
  status: "uploading" | "done" | "error";
  url?: string;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function PhotoUpload({ min = 3, onDone }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);

  const upload = async (file: File) => {
    const id = uid();
    const preview = URL.createObjectURL(file);

    setItems((prev) => [...prev, { id, preview, status: "uploading" }]);

    try {
      const fd = new FormData();

      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok || !data.url) throw new Error(data.error || "Error");
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, status: "done", url: data.url } : it,
        ),
      );
    } catch {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: "error" } : it)),
      );
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .forEach(upload);
  };

  const remove = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const done = items.filter((it) => it.status === "done");
  const uploading = items.some((it) => it.status === "uploading");

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className={`w-full h-28 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          dragging
            ? "border-[#4F46E5] bg-[#EEF0FB]"
            : "border-foreground-300 hover:bg-foreground-50"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setDragging(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <svg
          className="w-8 h-8 text-foreground-300"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path d="M12 16v-8m-4 4h8M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
        </svg>
        <span className="text-sm font-medium text-foreground">
          Arrastra o haz clic para subir fotos
        </span>
        <span className="text-xs text-foreground-500">PNG, JPG hasta 5MB</span>
      </button>

      <input
        ref={inputRef}
        multiple
        accept="image/*"
        className="hidden"
        type="file"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {items.length > 0 && (
        <div className="grid grid-cols-5 gap-2.5">
          {items.map((it) => (
            <div
              key={it.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-foreground-100 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                className="w-full h-full object-cover"
                src={it.preview}
              />
              {it.status === "uploading" && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
              )}
              {it.status === "error" && (
                <div className="absolute inset-0 bg-danger-500/70 flex items-center justify-center text-white text-[10px] font-medium">
                  Error
                </div>
              )}
              <button
                type="button"
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => remove(it.id)}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-sm text-foreground-500">
          {done.length} de {min} fotos mínimas
        </span>
        <Button
          isDisabled={uploading || done.length < min}
          size="sm"
          variant="primary"
          onPress={() => onDone(done.map((it) => it.url!))}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
