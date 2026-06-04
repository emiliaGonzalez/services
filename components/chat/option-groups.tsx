"use client";

import { useState } from "react";
import { Button } from "@heroui/react";

import { BottomSheet } from "./bottom-sheet";

export interface OGOption {
  id: string;
  name: string;
  prices: number[]; // [base] sin dependencia, o un precio por opción del grupo del que depende
}

export interface OGGroup {
  id: string;
  name: string;
  pricingMode: "fixed" | "per_pax";
  dependsOnId: string | null;
  options: OGOption[];
}

export interface OptionGroupsResult {
  groups: OGGroup[];
  summary: string;
}

interface OptionGroupsProps {
  fullHeight?: boolean;
  onDone: (result: OptionGroupsResult) => void;
}

const uid = () => Math.random().toString(36).slice(2);

function fmtPrice(n: number, perPax: boolean): { text: string; muted: boolean } {
  if (!n) return { text: "Incluido", muted: true };

  return {
    text: `+€${n.toLocaleString("es-ES")}${perPax ? "/pax" : ""}`,
    muted: false,
  };
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      aria-pressed={on}
      className={`relative w-8 h-[18px] rounded-full shrink-0 transition-colors ${
        on ? "bg-[#1A1A1A]" : "bg-[#E5E7EB]"
      }`}
      type="button"
      onClick={onChange}
    >
      <span
        className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${
          on ? "left-4" : "left-0.5"
        }`}
      />
    </button>
  );
}

const PlusIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export function OptionGroups({ fullHeight, onDone }: OptionGroupsProps) {
  const [groups, setGroups] = useState<OGGroup[]>([]);
  const [draft, setDraft] = useState<OGGroup | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Grupo del que puede depender el draft (el primero distinto al draft).
  const depGroup = draft
    ? groups.find((g) => g.id !== draft.id && g.options.length > 0) ?? null
    : null;

  const openNew = () => {
    setDraft({
      id: uid(),
      name: "",
      pricingMode: "fixed",
      dependsOnId: null,
      options: [{ id: uid(), name: "", prices: [0] }],
    });
    setIsNew(true);
  };

  const openEdit = (g: OGGroup) => {
    setDraft(structuredClone(g));
    setIsNew(false);
  };

  const save = () => {
    if (!draft) return;
    setGroups((prev) =>
      isNew ? [...prev, draft] : prev.map((g) => (g.id === draft.id ? draft : g)),
    );
    setDraft(null);
  };

  const patchDraft = (patch: Partial<OGGroup>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  const cols = draft?.dependsOnId && depGroup ? depGroup.options.length : 1;

  const patchOption = (i: number, patch: Partial<OGOption>) =>
    setDraft((d) =>
      d
        ? { ...d, options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }
        : d,
    );

  const setOptPrice = (i: number, col: number, v: number) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            options: d.options.map((o, j) =>
              j === i
                ? {
                    ...o,
                    prices: Array.from({ length: cols }, (_, c) =>
                      c === col ? v : o.prices[c] ?? 0,
                    ),
                  }
                : o,
            ),
          }
        : d,
    );

  const toggleDepends = () => {
    if (!draft || !depGroup) return;
    const turningOn = !draft.dependsOnId;
    const n = turningOn ? depGroup.options.length : 1;

    patchDraft({
      dependsOnId: turningOn ? depGroup.id : null,
      options: draft.options.map((o) => ({
        ...o,
        prices: Array.from({ length: n }, (_, c) => o.prices[c] ?? 0),
      })),
    });
  };

  // ---------------- Vista de edición ----------------
  if (draft) {
    return (
      <BottomSheet
        fullHeight={fullHeight}
        title={isNew ? "Nuevo grupo de opciones" : "Editar grupo de opciones"}
      >
        <div className="flex flex-col gap-5">
          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-500">
              Nombre del grupo
            </span>
            <input
              className="h-10 px-3.5 rounded-lg border border-[#E5E7EB] bg-background text-sm"
              placeholder="Ej: Duración, Tipo de menú…"
              value={draft.name}
              onChange={(e) => patchDraft({ name: e.target.value })}
            />
          </div>

          {/* Fijo / Por pax */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs ${
                draft.pricingMode === "fixed"
                  ? "text-foreground font-medium"
                  : "text-[#9CA3AF]"
              }`}
            >
              Fijo
            </span>
            <Toggle
              on={draft.pricingMode === "per_pax"}
              onChange={() =>
                patchDraft({
                  pricingMode: draft.pricingMode === "fixed" ? "per_pax" : "fixed",
                })
              }
            />
            <span
              className={`text-xs ${
                draft.pricingMode === "per_pax"
                  ? "text-foreground font-medium"
                  : "text-[#9CA3AF]"
              }`}
            >
              Por pax
            </span>
          </div>

          {/* Dependencia */}
          {depGroup && (
            <div className="rounded-[10px] bg-[#F9FAFB] px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-foreground">
                  El precio varía según {depGroup.name || "el otro grupo"}
                </span>
                <Toggle on={!!draft.dependsOnId} onChange={toggleDepends} />
              </div>
              <span className="text-[11px] text-foreground-500">
                Cada opción de {depGroup.name || "ese grupo"} tendrá un precio
                diferente
              </span>
            </div>
          )}

          {/* Tabla de opciones */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <span className="w-[140px] text-[11px] text-foreground-500">
                Opción
              </span>
              {draft.dependsOnId && depGroup ? (
                depGroup.options.map((o) => (
                  <span
                    key={o.id}
                    className="flex-1 text-[11px] text-foreground-500 truncate"
                  >
                    {o.name || "Opción"}
                  </span>
                ))
              ) : (
                <span className="flex-1 text-[11px] text-foreground-500">Precio</span>
              )}
              <span className="w-3.5" />
            </div>

            {draft.options.map((o, i) => (
              <div key={o.id} className="flex gap-2 items-center">
                <input
                  className="w-[140px] h-9 px-2.5 rounded-lg border border-[#E5E7EB] bg-background text-xs"
                  placeholder="Nombre"
                  value={o.name}
                  onChange={(e) => patchOption(i, { name: e.target.value })}
                />
                {Array.from({ length: cols }).map((_, c) => (
                  <div
                    key={c}
                    className="flex-1 flex items-center h-9 px-2.5 rounded-lg border border-[#E5E7EB] bg-background gap-1"
                  >
                    <span className="text-foreground-400 text-xs">€</span>
                    <input
                      className="w-full bg-transparent outline-none text-xs"
                      placeholder="0"
                      type="number"
                      value={o.prices[c] || ""}
                      onChange={(e) => setOptPrice(i, c, Number(e.target.value))}
                    />
                  </div>
                ))}
                <button
                  className="text-foreground-400 hover:text-danger w-3.5"
                  type="button"
                  onClick={() =>
                    patchDraft({ options: draft.options.filter((_, j) => j !== i) })
                  }
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <button
              className="text-xs text-foreground-500 flex items-center gap-1.5 mt-1 w-fit"
              type="button"
              onClick={() =>
                patchDraft({
                  options: [
                    ...draft.options,
                    { id: uid(), name: "", prices: Array(cols).fill(0) },
                  ],
                })
              }
            >
              <PlusIcon />
              Agregar opción
            </button>
          </div>

          <div className="flex justify-end gap-3">
            <Button size="sm" variant="outline" onPress={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              isDisabled={!draft.name.trim()}
              size="sm"
              variant="primary"
              onPress={save}
            >
              Guardar grupo
            </Button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  // ---------------- Vista lista ----------------
  return (
    <BottomSheet fullHeight={fullHeight} title="Grupos de opciones">
      <p className="text-sm text-foreground-500">
        Las opciones de un grupo pueden afectar el precio de opciones de otros
        grupos.
      </p>

      {groups.length === 0 && (
        <div className="text-center py-6 text-foreground-400 text-sm">
          Aún no has agregado grupos de opciones
        </div>
      )}

      {groups.map((g) => {
        const dep = g.dependsOnId
          ? groups.find((x) => x.id === g.dependsOnId)
          : null;
        const perPax = g.pricingMode === "per_pax";

        return (
          <div
            key={g.id}
            className="rounded-xl bg-[#F9FAFB] p-4 flex flex-col gap-2.5"
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">
                  {g.name || "Grupo sin nombre"}
                </span>
                {dep && (
                  <span className="flex items-center gap-1 w-fit rounded-md bg-[#FEF3C7] text-[#D97706] text-[10px] font-medium px-2 py-0.5">
                    <svg
                      className="w-2.5 h-2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    Depende de: {dep.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <button
                  className="text-foreground-500 hover:text-foreground"
                  type="button"
                  onClick={() => openEdit(g)}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                <button
                  className="text-foreground-500 hover:text-danger"
                  type="button"
                  onClick={() =>
                    setGroups((prev) => prev.filter((x) => x.id !== g.id))
                  }
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            </div>

            {g.options.map((o) => {
              const rep = g.dependsOnId ? Math.max(0, ...o.prices) : o.prices[0] ?? 0;
              const p = fmtPrice(rep, perPax);

              return (
                <div
                  key={o.id}
                  className="flex justify-between items-center rounded-lg bg-background px-3 py-2.5"
                >
                  <span className="text-[13px] text-foreground">
                    {o.name || "Opción"}
                  </span>
                  <span
                    className={`text-[13px] font-medium ${
                      p.muted ? "text-foreground-500" : "text-foreground"
                    }`}
                  >
                    {p.text}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      <div
        className={`flex justify-between items-center ${fullHeight ? "mt-auto pt-2" : ""}`}
      >
        <button
          className="text-sm text-foreground-500 flex items-center gap-1.5"
          type="button"
          onClick={openNew}
        >
          <PlusIcon />
          Agregar grupo
        </button>
        <Button
          size="sm"
          variant="primary"
          onPress={() =>
            onDone({
              groups,
              summary: groups.length
                ? groups.map((g) => g.name).join(", ")
                : "Sin grupos de opciones",
            })
          }
        >
          Finalizar servicio
        </Button>
      </div>
    </BottomSheet>
  );
}
