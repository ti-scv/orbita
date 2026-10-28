import { useEffect, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { displayFixedDate, maskFixedDate, parseFixedDate } from "./report-canvas/data/fixedDate";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (isoDate: string) => void;
};
export default function PtBrDateInput({value, onChange, ...props}: Props) {
  const [draft, setDraft] = useState(() => displayFixedDate(value));
  useEffect(() => setDraft(displayFixedDate(value)), [value]);
  return <input {...props} type="text" inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10}
    aria-invalid={draft.length === 10 && !parseFixedDate(draft) ? true : undefined}
    value={draft} onChange={event => {
      const text = maskFixedDate(event.target.value);
      setDraft(text);
      const iso = parseFixedDate(text);
      event.target.setCustomValidity(text && !iso ? "Use uma data válida no formato dd/mm/aaaa." : "");
      if (!text || iso) onChange(iso || "");
    }} />;
}
