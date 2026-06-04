"use client";

import type { OptionGroup, OptionGroupOption } from "@/types/chat";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { Toggle } from "./toggle";

interface Props {
  group: OptionGroup;
  isNew: boolean;
  allGroups: OptionGroup[];
  onSave: (group: OptionGroup) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function reshape(
  options: OptionGroupOption[],
  parentLen: number | null,
): OptionGroupOption[] {
  return options.map((o) => {
    const prices: Record<string, number> = {};

    if (parentLen === null) {
      prices["0"] = o.prices["0"] ?? Object.values(o.prices)[0] ?? 0;
    } else {
      for (let j = 0; j < parentLen; j++) prices[String(j)] = o.prices[String(j)] ?? 0;
    }

    return { name: o.name, prices };
  });
}

export function EditGroupModal({
  group,
  isNew,
  allGroups,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const [g, setG] = useState<OptionGroup>(() => ({
    ...group,
    options: group.options.map((o) => ({ name: o.name, prices: { ...o.prices } })),
  }));

  // Grupos candidatos como padre (evita self y dependencias circulares directas).
  const candidates = allGroups.filter(
    (x) => x.id !== g.id && x.dependsOn !== g.id,
  );
  const parent = g.dependsOn
    ? allGroups.find((x) => x.id === g.dependsOn) ?? null
    : null;
  const parentOptions = parent?.options ?? [];

  const setName = (name: string) => setG((s) => ({ ...s, name }));

  const setPricingMode = (mode: "fixed" | "per_pax") =>
    setG((s) => ({ ...s, pricingMode: mode }));

  const setDependsOn = (depId: string | null) => {
    const p = depId ? allGroups.find((x) => x.id === depId) ?? null : null;

    setG((s) => ({
      ...s,
      dependsOn: depId,
      options: reshape(s.options, p ? p.options.length : null),
    }));
  };

  const toggleDepends = (on: boolean) => {
    if (!on) {
      setDependsOn(null);
    } else {
      setDependsOn(candidates[0]?.id ?? null);
    }
  };

  const setOptionName = (i: number, name: string) =>
    setG((s) => ({
      ...s,
      options: s.options.map((o, idx) => (idx === i ? { ...o, name } : o)),
    }));

  const setOptionPrice = (i: number, key: string, value: number) =>
    setG((s) => ({
      ...s,
      options: s.options.map((o, idx) =>
        idx === i ? { ...o, prices: { ...o.prices, [key]: value } } : o,
      ),
    }));

  const addOption = () =>
    setG((s) => ({
      ...s,
      options: [
        ...s.options,
        reshape([{ name: "", prices: {} }], parent ? parentOptions.length : null)[0],
      ],
    }));

  const removeOption = (i: number) =>
    setG((s) => ({
      ...s,
      options: s.options.filter((_, idx) => idx !== i),
    }));

  const canSave = g.name.trim().length > 0 && g.options.length > 0;

  const priceInput =
    "w-16 rounded-md border border-divider bg-background px-2 py-1 text-[13px] text-foreground outline-none focus:border-foreground-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[85vh] w-[560px] flex-col overflow-hidden rounded-2xl bg-background shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-divider px-6 py-4">
          <h3 className="text-base font-bold text-foreground">
            {isNew ? "Nuevo grupo" : "Editar grupo"}
          </h3>
          <button
            className="text-foreground-400 hover:text-foreground"
            type="button"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-500">
              Nombre del grupo
            </span>
            <input
              autoFocus
              className="h-11 w-full rounded-[10px] border border-divider bg-background px-3.5 text-[15px] text-foreground outline-none focus:border-foreground-400"
              placeholder="Ej. Servicio de meseros"
              value={g.name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <label className="flex items-center justify-between">
            <span className="text-[13px] text-foreground">
              Precio por persona (por pax)
            </span>
            <Toggle
              on={g.pricingMode === "per_pax"}
              onChange={(v) => setPricingMode(v ? "per_pax" : "fixed")}
            />
          </label>

          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between">
              <span className="text-[13px] text-foreground">
                El precio depende de otra opción
              </span>
              <Toggle on={!!g.dependsOn} onChange={toggleDepends} />
            </label>
            {g.dependsOn && (
              <div className="flex flex-col gap-1.5 pl-[46px]">
                <span className="text-xs text-foreground-500">
                  Cada opción tendrá un precio distinto según el grupo:
                </span>
                <select
                  className="h-9 w-full rounded-lg border border-divider bg-background px-2.5 text-[13px] text-foreground outline-none focus:border-foreground-400"
                  value={g.dependsOn}
                  onChange={(e) => setDependsOn(e.target.value)}
                >
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || "Grupo sin nombre"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tabla de opciones */}
          <div className="flex flex-col gap-2">
            {parent && parentOptions.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="flex-1 text-xs font-medium uppercase tracking-wide text-foreground-500">
                  Opción
                </span>
                {parentOptions.map((po, j) => (
                  <span
                    key={j}
                    className="w-16 text-center text-xs text-foreground-500"
                  >
                    {po.name || `#${j + 1}`}
                  </span>
                ))}
                <span className="w-5" />
              </div>
            )}

            {g.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="h-9 flex-1 rounded-lg border border-divider bg-background px-3 text-[13px] text-foreground outline-none focus:border-foreground-400"
                  placeholder="Nombre de la opción"
                  value={o.name}
                  onChange={(e) => setOptionName(i, e.target.value)}
                />
                {parent ? (
                  parentOptions.map((_, j) => (
                    <input
                      key={j}
                      className={priceInput}
                      inputMode="numeric"
                      type="number"
                      value={o.prices[String(j)] ?? 0}
                      onChange={(e) =>
                        setOptionPrice(i, String(j), Number(e.target.value) || 0)
                      }
                    />
                  ))
                ) : (
                  <input
                    className={priceInput}
                    inputMode="numeric"
                    type="number"
                    value={o.prices["0"] ?? 0}
                    onChange={(e) =>
                      setOptionPrice(i, "0", Number(e.target.value) || 0)
                    }
                  />
                )}
                <button
                  className="text-foreground-400 hover:text-danger"
                  type="button"
                  onClick={() => removeOption(i)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            <button
              className="flex items-center gap-1.5 self-start text-[13px] text-foreground-500 transition-colors hover:text-foreground"
              type="button"
              onClick={addOption}
            >
              <Plus size={14} />
              Agregar opción
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-divider px-6 py-4">
          {onDelete && (
            <button
              className="mr-auto text-sm text-danger transition-opacity hover:opacity-80"
              type="button"
              onClick={onDelete}
            >
              Eliminar grupo
            </button>
          )}
          <button
            className="h-10 rounded-[10px] border border-divider px-5 text-sm text-foreground-500 transition-colors hover:bg-foreground-50"
            type="button"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="h-10 rounded-[10px] bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={!canSave}
            type="button"
            onClick={() => onSave({ ...g, name: g.name.trim() })}
          >
            Guardar grupo
          </button>
        </div>
      </div>
    </div>
  );
}
