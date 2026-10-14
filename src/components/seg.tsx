"use client";

import { useState } from "react";

/** Control segmentado. Los radios no son controlados: React restablece el formulario al terminar la acción. */
export function Seg<T extends string>({ name, options, initial, onChange, cols }: { name: string; options: readonly { value: T; label: string }[]; initial: T; onChange?: (v: T) => void; cols?: number }) {
  const [value, setValue] = useState<T>(initial);
  return (
    <div className="grid gap-1 rounded-xl bg-[#e9e7df] p-1" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <label key={o.value} className={`cursor-pointer rounded-[9px] px-1 py-2 text-center text-[13px] font-semibold ${value === o.value ? "bg-white text-ink shadow-[0_1px_3px_rgba(16,35,29,.15)]" : "text-muted"}`}>
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={initial === o.value}
            onChange={() => {
              setValue(o.value);
              onChange?.(o.value);
            }}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
