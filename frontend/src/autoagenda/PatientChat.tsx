import {Send,MessageCircle,UserRound,Stethoscope,CalendarDays,Clock,ClipboardList} from "../components/icons";
import {useEffect,useRef,useState,Fragment} from "react";
import "./chat.css";
export type ChatView={message?:string;options?:{label:string;value:string;kind?:string}[];input?:string;grid?:boolean;done?:boolean;version:number;state:string;step:string;environment?:string;redirect_phone?:string;session_token?:string;conversation_id?:string;events?:{id:number;actor:string;text:string}[]};
function text(value:string){return value.split(/(\*\*.*?\*\*)/g).map((v,i)=>v.startsWith("**")?<strong key={i}>{v.slice(2,-2)}</strong>:<Fragment key={i}>{v}</Fragment>)}
function MessageContent({value}:{value:string}){
 const match=value.match(/^(.*?)\*\*([^\n]+)\*\*\n([^\n]+)\n([^\n]+)\n(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2})(?::\d{2})? · (Consulta|Retorno)\s*$/s);
 if(!match)return <>{value.split('\n').map((line,i)=><span className="sa-message-line" key={i} style={{animationDelay:`${i*220}ms`}}>{line?text(line):'\u00a0'}</span>)}</>;
 const [,intro,patient,specialty,professional,date,time,kind]=match;
 const [day,month,year]=date.split('/').map(Number);
 const weekday=new Intl.DateTimeFormat('pt-BR',{weekday:'long'}).format(new Date(year,month-1,day));
 const rows=[{Icon:UserRound,label:'Paciente',value:patient},{Icon:Stethoscope,label:'Especialidade',value:specialty},{Icon:UserRound,label:'Profissional',value:professional},{Icon:CalendarDays,label:'Data',value:weekday.charAt(0).toUpperCase()+weekday.slice(1)+', '+date},{Icon:Clock,label:'Horário',value:time},{Icon:ClipboardList,label:'Tipo',value:kind}];
 return <>{intro.trim()&&<p className="sa-summary-intro sa-message-line">{text(intro.trim())}</p>}<dl className="sa-booking-summary">{rows.map(({Icon,label,value},i)=><div key={label} style={{animationDelay:`${(i+1)*220}ms`}}><Icon size={19} className="sa-detail-icon" aria-hidden="true"/><dt>{label}:</dt><dd>{value}</dd></div>)}</dl></>;
}
export function formatCpf(value:string){const d=value.replace(/\D/g,"").slice(0,11);return d.replace(/^(\d{3})(\d)/,"$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/,"$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,"$1.$2.$3-$4")}
export default function PatientChat(){
 const [view,setView]=useState<ChatView|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[input,setInput]=useState("");
 const token=useRef(sessionStorage.getItem('scv-autoagenda-token')||""),started=useRef(false),locked=useRef(false),scroll=useRef<HTMLDivElement>(null),pending=useRef<{body:any;label:string}|null>(null);
 async function sendBody(body:any){const response=await fetch('/api/v1/autoagenda/public/',{method:'POST',headers:{'Content-Type':'application/json',...(token.current?{'X-Autoagenda-Session':token.current}:{})},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Object.assign(new Error(typeof data.detail==='string'?data.detail:'Não foi possível continuar. Tente novamente.'),{status:response.status});return data as ChatView}
 async function start(){setBusy(true);try{const ticket=new URLSearchParams(location.hash.slice(1)).get('ticket');let data:ChatView;if(ticket){data=await sendBody({action:'start',ticket});if(data.session_token){token.current=data.session_token;sessionStorage.setItem('scv-autoagenda-token',data.session_token)}history.replaceState(null,'',location.pathname)}else if(token.current)data=await sendBody({action:'resume'});else throw new Error('Abra o link de agendamento recebido para iniciar.');setView(data);setError('')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 useEffect(()=>{if(!started.current){started.current=true;void start()}},[]);
 useEffect(()=>{scroll.current?.scrollTo?.({top:scroll.current.scrollHeight,behavior:'smooth'})},[view,busy]);
 useEffect(()=>{if(view?.state!=='booking')return;const timer=setInterval(()=>{void sendBody({action:'resume'}).then(setView).catch(e=>setError(e.message))},5000);return()=>clearInterval(timer)},[view?.state]);
 async function act(action:string,value="",label=""){
  if(locked.current||!view)return;locked.current=true;setBusy(true);setError('');
  const body=pending.current?.body||{action,value,version:view.version,request_id:(typeof crypto.randomUUID==='function'?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=crypto.getRandomValues(new Uint8Array(1))[0]%16;return (c==='x'?r:(r&3)|8).toString(16)}))};pending.current={body,label};
  try{const data=await sendBody(body);pending.current=null;setView(data);setInput('')}
  catch(e){const status=(e as any).status;if(status&&status<500){pending.current=null;if(status===409){try{setView(await sendBody({action:'resume'}))}catch{}}}setError((e as Error).message)}finally{locked.current=false;setBusy(false)}
 }
 return <div className="sa-chat"><div className="app"><header className="topo"><img className="logo" src="/autoagenda/img/logo.png" alt="Sansaúde"/><div className="topo-info"><strong>Agendamento de Consultas</strong></div>{view?.environment==='homologation'&&<span className="selo-teste">HOMOLOGAÇÃO</span>}</header>
 <main className="conversa" ref={scroll} aria-live="polite">
 {view&&<div className="msg bot"><span className="avatar"/><div className="balao sa-welcome"><MessageCircle size={23} className="sa-welcome-icon" aria-hidden="true"/><p><span className="sa-message-line">Olá! Sou o assistente virtual do <strong>SanSaúde</strong></span><span className="sa-message-line" style={{animationDelay:'220ms'}}>e vou te ajudar a agendar sua consulta.</span></p></div></div>}
 {view?.events?.filter(e=>e.actor!=='operator').map(e=><div key={e.id} className={`msg ${e.actor==='patient'?'usuario':'bot'}`}>{e.actor!=='patient'&&<span className="avatar"/>}<div className="balao">{e.actor==='patient'?text(e.text):<MessageContent value={e.text}/>}</div></div>)}
 {!busy&&!pending.current&&view?.options?.length&&!view.done?<div className={`opcoes ${view.grid?'grade':'lista'}`}>{view.options.map(o=><button key={o.value} className={`opcao ${o.kind?'tipo-'+o.kind:''}`} onClick={()=>void act('opcao',o.value,o.label)}>{o.kind&&<small className="detalhe">{o.kind==='retorno'?'Retorno':'Consulta'}</small>}{o.label}</button>)}</div>:null}
 {busy&&<div className="msg bot digitando com-aviso"><span className="avatar"/><div className="balao"><em className="aviso-espera">{view?.step==='confirm'?'Verificando agendamento…':'Aguarde…'}</em><span/><span/><span/></div></div>}
 </main>{error&&<div className="sa-error" role="alert">{error}{pending.current&&<button className="nav-btn" onClick={()=>void act('retry')} disabled={busy}>Tentar novamente</button>}</div>}
 <footer className="rodape">{view?.input&&!view.done&&!pending.current&&<form className="campo" onSubmit={e=>{e.preventDefault();void act('texto',input)}}><input aria-label={view.input==='cpf'?'CPF do paciente':'Celular com DDD'} inputMode="numeric" autoComplete="off" maxLength={view.input==='cpf'?14:20} placeholder={view.input==='cpf'?'000.000.000-00':'DDD + celular'} value={input} disabled={busy} onChange={e=>setInput(view.input==='cpf'?formatCpf(e.target.value):e.target.value.replace(/[^0-9()+ -]/g,''))}/><button className="enviar" type="submit" disabled={busy||!input.trim()} aria-label="Enviar" title="Enviar"><Send size={21}/></button></form>}
 {view&&!view.done&&<nav className="navegacao"><button className="nav-btn" disabled={busy||!!pending.current||view.step==='cpf'||view.state==='booking'} onClick={()=>void act('voltar')}>Voltar</button><button className="nav-btn sair" disabled={busy||!!pending.current||view.state==='booking'} onClick={()=>void act('sair')}>Sair</button></nav>}
 {view?.done&&view.redirect_phone&&<a className="novo" href={'https://wa.me/'+view.redirect_phone}>Voltar ao WhatsApp</a>}
 {view?.done&&!view.redirect_phone&&<p className="encerrado">Atendimento encerrado.</p>}
 </footer></div></div>
}
