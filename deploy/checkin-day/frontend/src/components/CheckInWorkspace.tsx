import PtBrDateInput from "./PtBrDateInput";
import {displayFixedDate, parseFixedDate} from "./report-canvas/data/fixedDate";
import {useCallback, useEffect, useState} from "react";
import type {FormEvent} from "react";
import {query, request} from "../api";
import InlineDialog from "./InlineDialog";
import "../autoagenda/console.css";
import "./checkin.css";

type Response = "pending" | "sent" | "confirmed" | "cancelled" | "no_response" | "reschedule";
type Attendance = "unknown" | "attended" | "absent";
type CheckIn = {id: number | string; appointment: number | string | null; booking: number | string | null; source_revision: number; cycle: number; scheduled_at: string | null; planned_send_at: string | null; sent_at: string | null; response_deadline: string | null; responded_at: string | null; attendance_checked_at: string | null; response: Response; attendance: Attendance; version: number; summary?: {patient:string;procedure:string;professional:string;external_id:string;completed:boolean;last_reply:{text:string;at:string;phone:string}|null;message:string;attendance_evidence?:{cd_atendimento?:number}}};
type Config = {enabled: boolean; booking_enabled: boolean; appointment_enabled: boolean; oracle_enabled: boolean; channel: "meta"; timezone: string; weekdays: number[]; business_start: string; business_end: string; holidays: string[]; lead_value: number; lead_unit: "hours" | "days"; template:number|null;parameter_map:string[]};
const responses: Record<Response,string> = {pending:"Pendente", sent:"Enviado", confirmed:"Confirmado", cancelled:"Solicitação de cancelamento", no_response:"Sem resposta",reschedule:"Reagendamento solicitado"};
const attendances: Record<Attendance,string> = {unknown:"Desconhecido", attended:"Concluído", absent:"Não compareceu"};
const days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const checkInLabel = (row: Pick<CheckIn, "response" | "attendance">) => row.attendance === "unknown" ? responses[row.response] : attendances[row.attendance];
const dateTime = (value: string | null, zone = "America/Sao_Paulo") => { if (!value) return "Não informado"; try {return new Date(value).toLocaleString("pt-BR", {timeZone:zone})} catch {return new Date(value).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})} };
const errorText = (error: unknown) => (error as {status?:number}).status === 409 ? "Os dados foram alterados ou a ação entrou em conflito. Feche a janela e atualize antes de tentar novamente." : (error as Error).message || "Não foi possível concluir a operação.";

export default function CheckInWorkspace({unit, write}:{unit:string; write:boolean}) {
  const [rows,setRows] = useState<CheckIn[] | null>(null), [config,setConfig] = useState<Config | null>(null);
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const [filters,setFilters] = useState({start:today,end:today,source:"",response:"",attendance:"",search:""});
  const [templates,setTemplates]=useState<any[]>([]);
  useEffect(()=>{request<any>(query("templates",{unit})).then(d=>setTemplates(d.results||d)).catch(()=>{})},[unit]);
  const [page,setPage] = useState(1), [next,setNext] = useState(false), [count,setCount] = useState(0);
  const [error,setError] = useState(""), [modalError,setModalError] = useState(""), [busy,setBusy] = useState(false);
  const [detail,setDetail] = useState<CheckIn | null>(null), [edit,setEdit] = useState<Config | null>(null);
  const [action,setAction] = useState(false), [response,setResponse] = useState(""), [attendance,setAttendance] = useState(""), [reason,setReason] = useState(""), [key,setKey] = useState("");
  const [holidayText,setHolidayText] = useState("");
  const list = useCallback(async () => {
    try {
      const data = await request<{results: CheckIn[]; count:number; next:string | null}>(query("checkins",{unit,...filters,page:String(page)}));
      setRows(data.results); setCount(data.count); setNext(!!data.next); setError("");
    } catch(e) { setRows(null); setError(errorText(e)); }
  }, [unit, filters, page]);
  const loadConfig = useCallback(async () => {
    try { setConfig(await request<Config>(query("checkin-configuration",{unit}))); }
    catch(e) { setError(errorText(e)); }
  },[unit]);
  useEffect(()=>{void list()},[list]);
  useEffect(()=>{void loadConfig()},[loadConfig]);
  async function open(row:CheckIn) {
    try {setDetail(await request<CheckIn>(query("checkins/"+row.id,{unit})));setModalError("");}
    catch(e){setError(errorText(e))}
  }
  function startAction() {setResponse("");setAttendance("");setReason("");setKey(crypto.randomUUID());setModalError("");setAction(true)}
  async function saveAction(e:FormEvent) {
    e.preventDefault(); if (!reason.trim()) {setModalError("Informe o motivo.");return} if(!detail || (!response && !attendance)) {setModalError("Selecione uma alteração.");return}
    setBusy(true);setModalError("");
    try {
      await request(query("checkins/"+detail.id+"/transition",{unit}),"POST",{version:detail.version,idempotency_key:key,...(response?{response}:{}),...(attendance?{attendance}:{}),reason:reason.trim()});
      setAction(false); setDetail(null); await list();
    } catch(e){setModalError(errorText(e))} finally {setBusy(false)}
  }
  function update<K extends keyof Config>(field:K, value:Config[K]) {setEdit(c=>c?{...c,[field]:value}:c)}
  async function saveConfig(e:FormEvent) {
    e.preventDefault(); if(!edit)return;
    const holidayDates=holidayText.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
    const holidays=holidayDates.map(parseFixedDate);
    if (!edit.weekdays.length || !Number.isInteger(edit.lead_value) || edit.lead_value < 1 || edit.business_start >= edit.business_end || holidays.some(s=>!s) || !edit.timezone.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(edit.business_start.slice(0,5)) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(edit.business_end.slice(0,5))) {setModalError("Confira antecedência, dias, horários e datas dos feriados (dd/mm/aaaa).");return}
    setBusy(true);setModalError("");
    try {const {enabled,booking_enabled,appointment_enabled,oracle_enabled,channel,timezone,weekdays,business_start,business_end,lead_value,lead_unit,template,parameter_map}=edit; const result=await request<Config>(query("checkin-configuration",{unit}),"PATCH",{enabled,booking_enabled,appointment_enabled,oracle_enabled,channel,timezone,weekdays,business_start,business_end,lead_value,lead_unit,template,parameter_map,holidays});setConfig(result);setEdit(null)}
    catch(e){setModalError(errorText(e))}finally{setBusy(false)}
  }
  return <div className="aa-console checkin-workspace">
    <header className="aa-heading"><h1>Check-in</h1><div><button className="button secondary" onClick={()=>{void list();void loadConfig()}}>Atualizar</button>{write && <button className="button secondary" disabled={!config} onClick={()=>{setEdit(structuredClone(config!));setHolidayText(config!.holidays.map(displayFixedDate).join("\n"));setModalError("")}}>Configurar</button>}</div></header>
    {error && <p className="aa-error" role="alert">{error}</p>}
    {config && <div className="aa-status"><span>Envio automático de check-in {config.enabled?"ligado":"desligado"} na configuração</span><span>Envios de autoagendamento {config.booking_enabled?"ligados":"desligados"} na configuração</span><span>Envios de agendamentos {config.appointment_enabled?"ligados":"desligados"} na configuração</span><span>Apuração Oracle {config.oracle_enabled?"ligada":"desligada"} na configuração</span></div>}
    <div className="aa-filters"><label>Paciente / código<input value={filters.search} onChange={e=>{setFilters({...filters,search:e.target.value});setPage(1)}}/></label>
      <label>De <PtBrDateInput value={filters.start} onChange={value=>{setFilters({...filters,start:value});setPage(1)}}/></label>
      <label>Até <PtBrDateInput value={filters.end} onChange={value=>{setFilters({...filters,end:value});setPage(1)}}/></label>
      <label>Origem <select value={filters.source} onChange={e=>{setFilters({...filters,source:e.target.value});setPage(1)}}><option value="">Todas</option><option value="booking">Autoagendamento</option><option value="appointment">Agendamentos</option></select></label>
      <label>Resposta <select value={filters.response} onChange={e=>{setFilters({...filters,response:e.target.value});setPage(1)}}><option value="">Todas</option>{Object.entries(responses).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
      <label>Comparecimento <select value={filters.attendance} onChange={e=>{setFilters({...filters,attendance:e.target.value});setPage(1)}}><option value="">Todos</option>{Object.entries(attendances).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
    </div>
    <div className="aa-table"><table><thead><tr><th>Agendamento</th><th>Paciente</th><th>Procedimento / profissional</th><th>Última resposta</th><th>Origem</th><th>Estado</th><th>Resposta do check-in</th><th>Ação</th></tr></thead><tbody>{rows?.map(row=><tr key={row.id}><td>{dateTime(row.scheduled_at, config?.timezone)}</td><td>{row.summary?.patient}</td><td>{row.summary?.procedure}<br/>{row.summary?.professional}</td><td>{row.summary?.last_reply ? <>{row.summary.last_reply.text}<br/><small>{dateTime(row.summary.last_reply.at)}</small></>:"Sem resposta"}</td><td>{row.booking != null?"Autoagendamento":"Agendamentos"}</td><td>{checkInLabel(row)}</td><td>{responses[row.response]}</td><td><button className="button secondary" onClick={()=>void open(row)}>Detalhes</button></td></tr>)}</tbody></table>
      {!rows&&!error?<p role="status">Carregando…</p>:rows?.length===0?<p>Nenhum check-in neste filtro.</p>:null}
      {rows && <footer><span>{count} registros</span><button className="button secondary" disabled={page===1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>{page}</span><button className="button secondary" disabled={!next} onClick={()=>setPage(p=>p+1)}>Próxima</button></footer>}
    </div>
    {detail && !action && <InlineDialog title="Detalhes do check-in" subtitle="" onClose={()=>setDetail(null)} footer={<><button className="button secondary" onClick={()=>setDetail(null)}>Fechar</button>{write && <button className="button" onClick={startAction}>Registrar alteração</button>}</>}>
      <dl className="checkin-details"><dt>Paciente</dt><dd>{detail.summary?.patient}</dd><dt>Última resposta</dt><dd>{detail.summary?.last_reply?.text||"Sem resposta"}</dd><dt>Atendimento Oracle</dt><dd>{detail.summary?.attendance_evidence?.cd_atendimento||"Sem vínculo"}</dd><dt>Última mensagem</dt><dd>{detail.summary?.message||"Sem mensagem"}</dd><dt>Agendamento</dt><dd>{dateTime(detail.scheduled_at, config?.timezone)}</dd><dt>Origem</dt><dd>{detail.booking != null?"Autoagendamento":"Agendamentos"} · {detail.booking ?? detail.appointment}</dd><dt>Revisão / ciclo</dt><dd>{detail.source_revision} / {detail.cycle}</dd><dt>Estado</dt><dd>{checkInLabel(detail)}</dd><dt>Resposta</dt><dd>{responses[detail.response]}</dd><dt>Comparecimento</dt><dd>{attendances[detail.attendance]}</dd><dt>Envio previsto</dt><dd>{dateTime(detail.planned_send_at, config?.timezone)}</dd><dt>Enviado</dt><dd>{dateTime(detail.sent_at, config?.timezone)}</dd><dt>Prazo</dt><dd>{dateTime(detail.response_deadline, config?.timezone)}</dd><dt>Resposta registrada</dt><dd>{dateTime(detail.responded_at, config?.timezone)}</dd><dt>Comparecimento apurado</dt><dd>{dateTime(detail.attendance_checked_at, config?.timezone)}</dd></dl>
    </InlineDialog>}
    {detail && action && <InlineDialog title="Registrar alteração" subtitle="" busy={busy} onClose={()=>setAction(false)} footer={<><button className="button secondary" disabled={busy} onClick={()=>setAction(false)}>Cancelar</button><button className="button" type="submit" form="checkin-action" disabled={busy}>Salvar</button></>}>
      <form id="checkin-action" className="aa-config" noValidate onSubmit={saveAction}>{modalError&&<p className="aa-error" role="alert">{modalError}</p>}
        <label>Resposta<select value={response} onChange={e=>{setResponse(e.target.value);setKey(crypto.randomUUID())}}><option value="">Sem alteração</option>{Object.entries(responses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>Comparecimento<select value={attendance} onChange={e=>{setAttendance(e.target.value);setKey(crypto.randomUUID())}}><option value="">Sem alteração</option>{Object.entries(attendances).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>Motivo<textarea required maxLength={500} value={reason} onChange={e=>{setReason(e.target.value);setKey(crypto.randomUUID())}}/></label>
      </form>
    </InlineDialog>}
    {edit && <InlineDialog title="Configurar check-in" subtitle="" busy={busy} onClose={()=>setEdit(null)} footer={<><button className="button secondary" disabled={busy} onClick={()=>setEdit(null)}>Cancelar</button><button className="button" form="checkin-config" type="submit" disabled={busy}>Salvar</button></>}>
      <form id="checkin-config" className="aa-config" noValidate onSubmit={saveConfig}><label>Template Meta<select value={edit.template||""} onChange={e=>{const t=templates.find(t=>String(t.id)===e.target.value);update("template",t?.id||null);update("parameter_map",(t?.fields||[]).map(()=>"relative_day"))}}><option value="">Selecionar</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name} · {t.language}</option>)}</select></label>{edit.parameter_map?.map((v,i)=><label key={i}>Parâmetro {i+1}<select value={v} onChange={e=>update("parameter_map",edit.parameter_map.map((x,j)=>j===i?e.target.value:x))}>{[["relative_day","Hoje / amanhã"],["time","Hora"],["date","Data"],["patient","Paciente"],["procedure","Procedimento"],["professional","Profissional"]].map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>)}{modalError&&<p className="aa-error" role="alert">{modalError}</p>}
        <fieldset><legend>Ativação</legend>{([["enabled","Ativar check-in"],["booking_enabled","Autoagendamento"],["appointment_enabled","Agendamentos"],["oracle_enabled","Apuração Oracle"]] as const).map(([k,l])=><label key={k}><input type="checkbox" checked={edit[k]} onChange={e=>update(k,e.target.checked)}/>{l}</label>)}<p>Canal: WhatsApp Meta</p></fieldset>
        <fieldset><legend>Mensagem do template</legend><p>{templates.find(t=>t.id===edit.template)?.body || 'Selecione um template Meta.'}</p><span>SIM · NÃO · REMARCAR</span></fieldset>
        <fieldset><legend>Antecedência</legend><div className="aa-grid"><label>Valor<input type="number" min="1" step="1" required value={edit.lead_value} onChange={e=>update("lead_value",Number(e.target.value))}/></label><label>Unidade<select value={edit.lead_unit} onChange={e=>update("lead_unit",e.target.value as Config["lead_unit"])}><option value="hours">Horas</option><option value="days">Dias</option></select></label></div></fieldset>
        <fieldset><legend>Horário comercial</legend><div className="aa-grid"><label>Fuso horário<input required value={edit.timezone} onChange={e=>update("timezone",e.target.value)}/></label><label>Início<input type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5} required value={edit.business_start.slice(0,5)} onChange={e=>update("business_start",e.target.value)}/></label><label>Fim<input type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5} required value={edit.business_end.slice(0,5)} onChange={e=>update("business_end",e.target.value)}/></label></div><div className="checkin-weekdays">{days.map((day,i)=><label key={day}><input type="checkbox" checked={edit.weekdays.includes(i)} onChange={e=>update("weekdays",e.target.checked?[...edit.weekdays,i].sort():edit.weekdays.filter(d=>d!==i))}/>{day}</label>)}</div><label>Feriados (uma data dd/mm/aaaa por linha)<textarea rows={3} value={holidayText} onChange={e=>setHolidayText(e.target.value)}/></label></fieldset>
      </form>
    </InlineDialog>}
  </div>;
}
