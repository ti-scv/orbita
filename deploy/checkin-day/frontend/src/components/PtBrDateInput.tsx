import { useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { displayFixedDate, maskFixedDate, parseFixedDate } from "./report-canvas/data/fixedDate";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (isoDate: string) => void;
};

export default function PtBrDateInput({ value, onChange, className, ...props }: Props) {
  const [draft, setDraft] = useState(() => displayFixedDate(value));
  const pickerRef = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(displayFixedDate(value)), [value]);

  const ariaLabel = props["aria-label"];
  const openPicker = () => {
    const el = pickerRef.current;
    if (!el || props.disabled || props.readOnly) return;
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  };

  return (
    <div className={`ptbr-date-field${className ? ` ${className}` : ""}`}>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        aria-invalid={draft.length === 10 && !parseFixedDate(draft) ? true : undefined}
        value={draft}
        onChange={(event) => {
          const text = maskFixedDate(event.target.value);
          setDraft(text);
          const iso = parseFixedDate(text);
          event.target.setCustomValidity(
            text && !iso ? "Use uma data válida no formato dd/mm/aaaa." : "",
          );
          if (!text || iso) onChange(iso || "");
        }}
      />
      <button
        type="button"
        className="ptbr-date-picker-button"
        tabIndex={-1}
        disabled={props.disabled || props.readOnly}
        aria-label={
          typeof ariaLabel === "string" && ariaLabel
            ? `Selecionar ${ariaLabel.toLowerCase()}`
            : "Abrir calendário"
        }
        title="Abrir calendário"
        onClick={openPicker}
      >
        <CalendarDays size={14} aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        className="ptbr-date-native"
        value={value}
        min={typeof props.min === "string" ? props.min : undefined}
        max={typeof props.max === "string" ? props.max : undefined}
        disabled={props.disabled || props.readOnly}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
