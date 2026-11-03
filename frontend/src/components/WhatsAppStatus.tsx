import type { Appointment } from "../types";
import { whatsappStatus } from "../whatsappStatus";
import { WhatsApp } from "./icons";

export default function WhatsAppStatus({ appointment }: { appointment: Appointment }) {
  const status = whatsappStatus(appointment);
  return (
    <span
      className={`whatsapp-status whatsapp-status-${status.state}`}
      role="img"
      aria-label={status.label}
      title={status.label}
    >
      <WhatsApp size={19} aria-hidden="true" focusable="false" />
    </span>
  );
}
