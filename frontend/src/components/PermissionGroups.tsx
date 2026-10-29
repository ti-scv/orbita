import type { ReactNode } from "react";
import { Activity, MessageCircle, Settings2, WhatsApp } from "lucide-react";
const groups = [
  {name: "Mensagens", icon: MessageCircle, keys: ["overview", "messages", "groups", "issues"]},
  {name: "Configurações", icon: Settings2, keys: ["settings", "operationsAdmin", "users"]},
  {name: "Relatórios", icon: Activity, keys: ["reports"]},
  {name: "WhatsApp", icon: WhatsApp, keys: ["reportWhatsApp"]},
];
export function PermissionGroups({sections, render}: {sections: Record<string, string>; render: (key: string, label: string) => ReactNode}) {
  const known = groups.flatMap(group => group.keys);
  return <>{groups.map(({name, icon: Icon, keys}) => {
    const present = keys.filter(key => key in sections);
    return present.length ? <section className="permission-group" key={name} aria-label={name}><h4><Icon size={18}/>{name}</h4>{present.map(key => render(key, sections[key]))}</section> : null;
  })}{Object.keys(sections).some(key => !known.includes(key)) && <section className="permission-group"><h4>Outras permissões</h4>{Object.entries(sections).filter(([key]) => !known.includes(key)).map(([key, label]) => render(key, label))}</section>}</>;
}
