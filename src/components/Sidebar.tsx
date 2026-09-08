import React from 'react';
import { LayoutDashboard, Send, Megaphone, MailCheck, Users, ShieldAlert, Server, BarChart3, Terminal, Settings, FileCode2, LogOut } from 'lucide-react';

export type NavTab = 'dashboard'|'send'|'campaigns'|'messages'|'contacts'|'suppression'|'senders'|'analytics'|'logs'|'settings'|'templates';
type ServiceStatus='healthy'|'degraded'|'offline'|'standby'|'unknown';
interface SidebarProps{currentTab:NavTab;onSelectTab:(tab:NavTab)=>void;kumoStatus?:string;sesStatus?:string;queueCount?:number;user?:{name?:string;email?:string;role?:string;plan?:string}|null;onLogout?:()=>void;}
const normalizeStatus=(s?:string):ServiceStatus=>s==='healthy'||s==='degraded'||s==='offline'||s==='standby'?s:'unknown';
const statusLabel=(s?:string)=>({healthy:'ONLINE',degraded:'DEGRADED',offline:'STANDBY',standby:'STANDBY',unknown:'STANDBY'}[normalizeStatus(s)]);
const statusClass=(s?:string)=>({healthy:'text-[#39ff9c]',degraded:'text-[#ffb454]',offline:'text-[#7c9188]',standby:'text-[#7c9188]',unknown:'text-[#4a5a53]'}[normalizeStatus(s)]);
export const Sidebar:React.FC<SidebarProps>=({currentTab,onSelectTab,kumoStatus='unknown',sesStatus='unknown',queueCount=0,user,onLogout})=>{
 const groups=[
  {label:'Monitor',items:[['dashboard','Overview',LayoutDashboard],['analytics','Deliverability',BarChart3]]},
  {label:'Send',items:[['campaigns','Campaigns',Megaphone],['templates','Templates',FileCode2],['send','Compose',Send],['messages','Messages',MailCheck]]},
  {label:'Data',items:[['contacts','Contacts',Users],['suppression','Suppression',ShieldAlert]]},
  {label:'System',items:[['senders','Infrastructure',Server],['settings','API & Settings',Settings],['logs','Technical Logs',Terminal]]}
 ] as const;
 return <aside className="w-[228px] bg-[#0b0e0d] border-r border-[#1e2825] flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto font-mono">
  <div className="px-5 pt-6 pb-5 border-b border-[#1e2825]"><div className="flex items-center gap-2.5"><span className="w-2 h-2 rounded-[2px] bg-[#39ff9c] shadow-[0_0_12px_#39ff9c]"/><span className="font-mono font-bold text-[15px] tracking-wide text-[#d8e6df]">EmailinOPS</span></div><div className="text-[9px] uppercase tracking-[0.18em] text-[#4a5a53] mt-1.5 pl-[18px]">mail delivery engine</div></div>
  <nav className="flex-1 px-3 py-3">{groups.map(g=><div key={g.label}><div className="text-[9px] uppercase tracking-[0.2em] text-[#4a5a53] px-2 py-3">{g.label}</div>{g.items.map(([id,label,Icon])=>{const active=currentTab===id;return <button key={id} onClick={()=>onSelectTab(id as NavTab)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[4px] text-[11.5px] mb-0.5 border-l-2 transition-all ${active?'bg-[#131917] text-[#39ff9c] border-[#39ff9c]':'text-[#7c9188] border-transparent hover:bg-[#131917] hover:text-[#d8e6df]'}`}><Icon className="w-3.5 h-3.5"/><span>{label}</span></button>})}</div>)}</nav>
   <div className="p-4 border-t border-[#1e2825]"><div className="p-3 rounded-[5px] border border-[#1e2825] bg-[#0f1412] space-y-2"><div className="flex justify-between text-[10px]"><span className="text-[#7c9188]">KumoMTA</span><span className={statusClass(kumoStatus)}>● {statusLabel(kumoStatus)}</span></div><div className="flex justify-between text-[10px]"><span className="text-[#7c9188]">SES Relay</span><span className={statusClass(sesStatus)}>● {statusLabel(sesStatus)}</span></div><div className="pt-2 border-t border-[#1e2825] flex justify-between text-[10px]"><span className="text-[#4a5a53]">QUEUE</span><span className="text-[#d8e6df]">{Number(queueCount)||0} msgs</span></div></div><div className="mt-3 flex items-center justify-between"><div className="min-w-0"><div className="text-[10px] text-[#d8e6df] truncate">{user?.name||user?.email||'Email Operator'}</div><div className="text-[8px] uppercase tracking-widest text-[#4a5a53] mt-0.5">{user?.role||'ADMIN'} · {user?.plan||'PRO'}</div></div>{onLogout&&<button onClick={onLogout} className="p-1.5 text-[#4a5a53] hover:text-[#ff5c5c]"><LogOut className="w-3.5 h-3.5"/></button>}</div></div>
 </aside>;
};
