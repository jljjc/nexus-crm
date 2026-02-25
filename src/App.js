import { useState, useEffect, useRef } from "react";

/* ─── STYLES ───────────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sora', sans-serif; background: #080c14; color: #cbd5e1; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #0f1623; }
  ::-webkit-scrollbar-thumb { background: #2a3a52; border-radius: 3px; }
  button { cursor: pointer; font-family: inherit; }
  input, select, textarea { font-family: inherit; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .animate-fade { animation: fadeIn 0.3s ease forwards; }
  .animate-slide { animation: slideIn 0.25s ease forwards; }
`;

/* ─── CONSTANTS ─────────────────────────────────────────────────────────────── */
const JOB_STATUSES = ['New', 'In Progress', 'Awaiting Docs', 'Under Review', 'Completed', 'On Hold'];
const JOB_TYPES = ['Student Visa', 'Work Visa', 'Partner Visa', 'Bridging Visa', 'PR Application', 'Visitor Visa', 'Enrollment Support', 'Scholarship Application', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const CLIENT_TYPES = ['Student', 'Migration', 'Both'];
const CLIENT_STATUSES = ['Active', 'Pending', 'Completed', 'Inactive'];

const STATUS_STYLES = {
  'New':             { bg: '#0ea5e920', text: '#38bdf8', dot: '#38bdf8' },
  'In Progress':     { bg: '#f59e0b20', text: '#fbbf24', dot: '#f59e0b' },
  'Awaiting Docs':   { bg: '#a78bfa20', text: '#c4b5fd', dot: '#a78bfa' },
  'Under Review':    { bg: '#fb923c20', text: '#fdba74', dot: '#fb923c' },
  'Completed':       { bg: '#10b98120', text: '#34d399', dot: '#10b981' },
  'On Hold':         { bg: '#94a3b820', text: '#94a3b8', dot: '#64748b' },
  'Active':          { bg: '#10b98120', text: '#34d399', dot: '#10b981' },
  'Pending':         { bg: '#f59e0b20', text: '#fbbf24', dot: '#f59e0b' },
  'Inactive':        { bg: '#94a3b820', text: '#94a3b8', dot: '#64748b' },
};

const PRIORITY_STYLES = {
  'Low':    { bg: '#1e40af20', text: '#93c5fd' },
  'Medium': { bg: '#78350f20', text: '#fcd34d' },
  'High':   { bg: '#991b1b20', text: '#fca5a5' },
  'Urgent': { bg: '#7f1d1d', text: '#fca5a5' },
};

const TEAM_COLORS = ['#38bdf8','#34d399','#f59e0b','#a78bfa','#fb923c','#f472b6','#4ade80','#60a5fa'];

const INIT_TEAM = [
  { id: 't1', name: 'Sarah Chen',    role: 'Senior Consultant',    color: '#38bdf8' },
  { id: 't2', name: 'Mike Johnson',  role: 'Migration Agent',       color: '#34d399' },
  { id: 't3', name: 'Priya Patel',   role: 'Student Advisor',       color: '#f59e0b' },
  { id: 't4', name: 'James Wilson',  role: 'Case Manager',          color: '#a78bfa' },
  { id: 't5', name: 'Emma Davis',    role: 'Student Advisor',       color: '#fb923c' },
  { id: 't6', name: 'Tom Lee',       role: 'Migration Agent',       color: '#f472b6' },
  { id: 't7', name: 'Aisha Omar',    role: 'Document Specialist',   color: '#4ade80' },
  { id: 't8', name: 'Chris Brown',   role: 'Compliance Officer',    color: '#60a5fa' },
];

const INIT_CLIENTS = [
  { id: 'c1', name: 'Wei Zhang',      email: 'wei@email.com',    phone: '0412 345 678', type: 'Student',   status: 'Active',    nationality: 'Chinese',    notes: 'Masters at UNSW – needs CoE follow-up', createdAt: '2025-01-15' },
  { id: 'c2', name: 'Amara Okonkwo',  email: 'amara@email.com',  phone: '0423 456 789', type: 'Migration', status: 'Active',    nationality: 'Nigerian',   notes: 'Skilled 189 visa pathway', createdAt: '2025-02-01' },
  { id: 'c3', name: 'Rafael Santos',  email: 'rafael@email.com', phone: '0434 567 890', type: 'Student',   status: 'Pending',   nationality: 'Brazilian',  notes: 'Bachelor of IT at UTS', createdAt: '2025-02-20' },
  { id: 'c4', name: 'Yuna Kim',       email: 'yuna@email.com',   phone: '0445 678 901', type: 'Both',      status: 'Active',    nationality: 'Korean',     notes: 'Completed study, now PR pathway', createdAt: '2025-03-01' },
];

const INIT_JOBS = [
  { id: 'j1', clientId: 'c1', title: 'Student Visa Application',   type: 'Student Visa',       assignedTo: 't1', status: 'In Progress',   priority: 'High',   dueDate: '2025-04-10', notes: 'CoE received, lodging visa application', progress: 60, createdAt: '2025-01-15' },
  { id: 'j2', clientId: 'c2', title: 'Skills Assessment Review',   type: 'PR Application',     assignedTo: 't2', status: 'Awaiting Docs', priority: 'Urgent', dueDate: '2025-03-25', notes: 'Waiting for employer references x3',     progress: 40, createdAt: '2025-02-01' },
  { id: 'j3', clientId: 'c3', title: 'University Enrollment Help', type: 'Enrollment Support', assignedTo: 't3', status: 'New',           priority: 'Medium', dueDate: '2025-05-01', notes: 'Reviewing offer letter conditions',       progress: 10, createdAt: '2025-02-20' },
  { id: 'j4', clientId: 'c4', title: 'Bridging Visa Application',  type: 'Bridging Visa',      assignedTo: 't4', status: 'Under Review',  priority: 'High',   dueDate: '2025-03-30', notes: 'Submitted, awaiting departmental review', progress: 80, createdAt: '2025-03-01' },
  { id: 'j5', clientId: 'c4', title: 'PR Expression of Interest',  type: 'PR Application',     assignedTo: 't2', status: 'In Progress',   priority: 'Medium', dueDate: '2025-06-01', notes: 'Building EOI points checklist',           progress: 25, createdAt: '2025-03-05' },
];

/* ─── HELPERS ────────────────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split('T')[0];
const initials = (name) => name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
const fmtDate = (d) => d ? new Date(d+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '—';
const isOverdue = (d) => d && new Date(d) < new Date() ? true : false;

/* ─── COMPONENTS ─────────────────────────────────────────────────────────────── */

function StatusBadge({ status, small }) {
  const s = STATUS_STYLES[status] || { bg:'#1e293b', text:'#94a3b8', dot:'#64748b' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding: small ? '2px 8px':'3px 10px', borderRadius:20, fontSize: small?11:12, fontWeight:500, background:s.bg, color:s.text, whiteSpace:'nowrap' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot, flexShrink:0 }} />
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const p = PRIORITY_STYLES[priority] || PRIORITY_STYLES.Low;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600, background:p.bg, color:p.text, letterSpacing:'0.03em' }}>
      {priority === 'Urgent' ? '🔴 ' : ''}{priority}
    </span>
  );
}

function Avatar({ name, color, size=32 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background: color+'30', border:`2px solid ${color}60`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.33, fontWeight:600, color, flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}

function ProgressBar({ value }) {
  const color = value >= 100 ? '#10b981' : value >= 60 ? '#38bdf8' : value >= 30 ? '#f59e0b' : '#fb923c';
  return (
    <div style={{ height:4, borderRadius:4, background:'#1e293b', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(value,100)}%`, background:color, borderRadius:4, transition:'width 0.3s ease' }} />
    </div>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#0f1623', border:'1px solid #1e2d40', borderRadius:12, padding:20, ...style, cursor: onClick ? 'pointer' : 'default', transition:'border-color 0.2s, transform 0.15s', ...(onClick ? { ':hover':{borderColor:'#38bdf8'} } : {}) }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor='#38bdf830', e.currentTarget.style.transform='translateY(-1px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor='#1e2d40', e.currentTarget.style.transform='translateY(0)')}>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'#000000b0', backdropFilter:'blur(4px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="animate-fade" style={{ background:'#0f1623', border:'1px solid #2a3a52', borderRadius:16, padding:28, width:'100%', maxWidth: wide?720:480, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:18, fontWeight:600, color:'#e2e8f0' }}>{title}</h2>
          <button onClick={onClose} style={{ background:'#1e2d40', border:'none', borderRadius:8, width:32, height:32, color:'#94a3b8', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children, required }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}{required && <span style={{color:'#f87171'}}>*</span>}</label>
      {children}
    </div>
  );
}

const inputStyle = { width:'100%', background:'#080c14', border:'1px solid #1e2d40', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:14, outline:'none', transition:'border-color 0.2s' };
const selectStyle = { ...inputStyle, cursor:'pointer' };
const textareaStyle = { ...inputStyle, resize:'vertical', minHeight:80 };

/* ═══════════════════════════════════════════════════════════════════════════════
   VIEWS
═══════════════════════════════════════════════════════════════════════════════ */

/* ─── DASHBOARD ─────────────────────────────────────────────────────────────── */
function Dashboard({ clients, jobs, team, onGoTo }) {
  const active = clients.filter(c=>c.status==='Active').length;
  const inProgress = jobs.filter(j=>j.status==='In Progress').length;
  const urgent = jobs.filter(j=>j.priority==='Urgent' && j.status!=='Completed').length;
  const completed = jobs.filter(j=>j.status==='Completed').length;
  const overdue = jobs.filter(j=> j.status!=='Completed' && isOverdue(j.dueDate)).length;

  const recentJobs = [...jobs].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  const getClient = id => clients.find(c=>c.id===id);
  const getMember = id => team.find(t=>t.id===id);

  const memberLoad = team.map(m => ({
    ...m,
    count: jobs.filter(j=>j.assignedTo===m.id && j.status!=='Completed').length
  })).sort((a,b)=>b.count-a.count).slice(0,6);

  const statCards = [
    { label:'Active Clients',   value:active,     icon:'👥', color:'#38bdf8', sub:`of ${clients.length} total` },
    { label:'Jobs In Progress', value:inProgress, icon:'⚡', color:'#f59e0b', sub:`${jobs.length} total jobs` },
    { label:'Urgent Jobs',      value:urgent,     icon:'🔴', color:'#f87171', sub:'need immediate attention' },
    { label:'Completed',        value:completed,  icon:'✅', color:'#34d399', sub:'jobs finished' },
  ];

  return (
    <div className="animate-fade">
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:26, fontWeight:700, color:'#e2e8f0', marginBottom:4 }}>Good morning 👋</h1>
        <p style={{ color:'#475569', fontSize:14 }}>{new Date().toLocaleDateString('en-AU',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:28 }}>
        {statCards.map(s => (
          <Card key={s.label} style={{ position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-10, right:-10, fontSize:48, opacity:0.08 }}>{s.icon}</div>
            <div style={{ fontSize:13, color:'#475569', marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:36, fontWeight:700, color:s.color, marginBottom:4, fontFamily:"'JetBrains Mono',monospace" }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#334155' }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {overdue > 0 && (
        <div style={{ background:'#7f1d1d30', border:'1px solid #ef444440', borderRadius:10, padding:'12px 16px', marginBottom:24, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>⚠️</span>
          <span style={{ color:'#fca5a5', fontSize:14 }}><strong>{overdue} job{overdue>1?'s':''}</strong> {overdue>1?'are':'is'} overdue. <button onClick={()=>onGoTo('jobs')} style={{ background:'none', border:'none', color:'#f87171', textDecoration:'underline', fontSize:14, cursor:'pointer' }}>View jobs →</button></span>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Recent Jobs */}
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:600, color:'#e2e8f0' }}>Recent Jobs</h3>
            <button onClick={()=>onGoTo('jobs')} style={{ background:'none', border:'none', color:'#38bdf8', fontSize:13, cursor:'pointer' }}>View all →</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {recentJobs.map(j => {
              const client = getClient(j.clientId);
              const member = getMember(j.assignedTo);
              return (
                <div key={j.id} style={{ padding:'10px 12px', background:'#080c14', borderRadius:8, border:'1px solid #1e2d40' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', marginBottom:2 }}>{j.title}</div>
                      <div style={{ fontSize:12, color:'#475569' }}>{client?.name} · {j.type}</div>
                    </div>
                    <StatusBadge status={j.status} small />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <ProgressBar value={j.progress} />
                    {member && <div style={{ display:'flex', alignItems:'center', gap:5, marginLeft:10, flexShrink:0 }}><Avatar name={member.name} color={member.color} size={20} /><span style={{ fontSize:11, color:'#475569' }}>{member.name.split(' ')[0]}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Team Workload */}
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:600, color:'#e2e8f0' }}>Team Workload</h3>
            <button onClick={()=>onGoTo('team')} style={{ background:'none', border:'none', color:'#38bdf8', fontSize:13, cursor:'pointer' }}>View all →</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {memberLoad.map(m => {
              const pct = Math.min((m.count / 5) * 100, 100);
              return (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Avatar name={m.name} color={m.color} size={30} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, color:'#cbd5e1' }}>{m.name}</span>
                      <span style={{ fontSize:12, color:'#475569', fontFamily:"'JetBrains Mono',monospace" }}>{m.count} active</span>
                    </div>
                    <div style={{ height:4, borderRadius:4, background:'#1e293b', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background: pct>80?'#f87171':pct>50?'#f59e0b':m.color, borderRadius:4 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── CLIENTS ────────────────────────────────────────────────────────────────── */
function Clients({ clients, jobs, setClients }) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [modal, setModal] = useState(null); // null | 'add' | {client}
  const [form, setForm] = useState({});

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.nationality?.toLowerCase().includes(q)) &&
      (filterType === 'All' || c.type === filterType) &&
      (filterStatus === 'All' || c.status === filterStatus)
    );
  });

  const openAdd = () => { setForm({ name:'', email:'', phone:'', type:'Student', status:'Active', nationality:'', notes:'', createdAt:today() }); setModal('add'); };
  const openEdit = (c) => { setForm({...c}); setModal(c); };
  const closeModal = () => setModal(null);

  const save = () => {
    if (!form.name.trim()) return;
    if (modal === 'add') {
      setClients(prev => [...prev, { ...form, id: 'c'+uid() }]);
    } else {
      setClients(prev => prev.map(c => c.id === form.id ? form : c));
    }
    closeModal();
  };

  const del = (id) => { if (confirm('Delete this client?')) setClients(prev=>prev.filter(c=>c.id!==id)); };

  const clientJobCount = id => jobs.filter(j=>j.clientId===id).length;

  return (
    <div className="animate-fade">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:700, color:'#e2e8f0' }}>Clients</h1>
          <p style={{ color:'#475569', fontSize:14, marginTop:2 }}>{clients.length} total clients</p>
        </div>
        <button onClick={openAdd} style={{ background:'#38bdf8', border:'none', borderRadius:10, padding:'10px 18px', color:'#080c14', fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:18, lineHeight:1 }}>+</span> Add Client
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search clients..." style={{ ...inputStyle, width:260, padding:'9px 14px' }} />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ ...selectStyle, width:140 }}>
          <option value="All">All Types</option>
          {CLIENT_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...selectStyle, width:140 }}>
          <option value="All">All Status</option>
          {CLIENT_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #1e2d40' }}>
              {['Client','Type','Status','Jobs','Nationality','Created',''].map(h=>(
                <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', background:'#080c1460' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'#334155', fontSize:14 }}>No clients found</td></tr>
            )}
            {filtered.map((c,i) => (
              <tr key={c.id} style={{ borderBottom:'1px solid #0f1a2560', transition:'background 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='#0ea5e908'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ padding:'13px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:'#1e2d40', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#94a3b8' }}>{initials(c.name)}</div>
                    <div>
                      <div style={{ fontWeight:600, color:'#e2e8f0', fontSize:14 }}>{c.name}</div>
                      <div style={{ fontSize:12, color:'#475569' }}>{c.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding:'13px 16px' }}>
                  <span style={{ fontSize:12, color: c.type==='Student'?'#60a5fa':c.type==='Migration'?'#a78bfa':'#34d399', background: c.type==='Student'?'#1e40af20':c.type==='Migration'?'#6d28d920':'#05966920', padding:'2px 10px', borderRadius:20, fontWeight:500 }}>{c.type}</span>
                </td>
                <td style={{ padding:'13px 16px' }}><StatusBadge status={c.status} small /></td>
                <td style={{ padding:'13px 16px', color:'#94a3b8', fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>{clientJobCount(c.id)}</td>
                <td style={{ padding:'13px 16px', color:'#64748b', fontSize:13 }}>{c.nationality || '—'}</td>
                <td style={{ padding:'13px 16px', color:'#64748b', fontSize:13 }}>{fmtDate(c.createdAt)}</td>
                <td style={{ padding:'13px 16px' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>openEdit(c)} style={{ background:'#1e2d40', border:'none', borderRadius:7, padding:'5px 10px', color:'#94a3b8', fontSize:12 }}>Edit</button>
                    <button onClick={()=>del(c.id)} style={{ background:'#7f1d1d20', border:'none', borderRadius:7, padding:'5px 10px', color:'#f87171', fontSize:12 }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {modal && (
        <Modal title={modal === 'add' ? 'Add New Client' : 'Edit Client'} onClose={closeModal}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <FormField label="Full Name" required><input style={inputStyle} value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="John Smith" /></FormField>
            <FormField label="Email"><input style={inputStyle} value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="john@email.com" /></FormField>
            <FormField label="Phone"><input style={inputStyle} value={form.phone||''} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="04xx xxx xxx" /></FormField>
            <FormField label="Nationality"><input style={inputStyle} value={form.nationality||''} onChange={e=>setForm(f=>({...f,nationality:e.target.value}))} placeholder="e.g. Chinese" /></FormField>
            <FormField label="Client Type">
              <select style={selectStyle} value={form.type||'Student'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {CLIENT_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Status">
              <select style={selectStyle} value={form.status||'Active'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {CLIENT_STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Notes"><textarea style={textareaStyle} value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes about this client..." /></FormField>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
            <button onClick={closeModal} style={{ background:'#1e2d40', border:'none', borderRadius:8, padding:'9px 18px', color:'#94a3b8', fontWeight:500 }}>Cancel</button>
            <button onClick={save} style={{ background:'#38bdf8', border:'none', borderRadius:8, padding:'9px 20px', color:'#080c14', fontWeight:700 }}>Save Client</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── JOBS ────────────────────────────────────────────────────────────────────── */
function Jobs({ jobs, clients, team, setJobs }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterAssigned, setFilterAssigned] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [view, setView] = useState('list'); // 'list' | 'board'
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const getClient = id => clients.find(c=>c.id===id);
  const getMember = id => team.find(t=>t.id===id);

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const client = getClient(j.clientId);
    return (
      (!q || j.title.toLowerCase().includes(q) || client?.name.toLowerCase().includes(q) || j.type.toLowerCase().includes(q)) &&
      (filterStatus === 'All' || j.status === filterStatus) &&
      (filterAssigned === 'All' || j.assignedTo === filterAssigned) &&
      (filterPriority === 'All' || j.priority === filterPriority)
    );
  });

  const openAdd = () => { setForm({ title:'', type:'Student Visa', clientId: clients[0]?.id||'', assignedTo: team[0]?.id||'', status:'New', priority:'Medium', dueDate:'', notes:'', progress:0, createdAt:today() }); setModal('add'); };
  const openEdit = (j) => { setForm({...j}); setModal(j); };
  const closeModal = () => setModal(null);

  const save = () => {
    if (!form.title.trim()) return;
    if (modal === 'add') {
      setJobs(prev => [...prev, { ...form, id: 'j'+uid(), progress: parseInt(form.progress)||0 }]);
    } else {
      setJobs(prev => prev.map(j => j.id === form.id ? {...form, progress:parseInt(form.progress)||0} : j));
    }
    closeModal();
  };

  const del = id => { if(confirm('Delete this job?')) setJobs(prev=>prev.filter(j=>j.id!==id)); };
  const updateStatus = (id, status) => setJobs(prev => prev.map(j => j.id===id ? {...j, status} : j));

  const JobForm = () => (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <FormField label="Job Title" required>
          <input style={inputStyle} value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Visa Application" />
        </FormField>
        <FormField label="Job Type">
          <select style={selectStyle} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
            {JOB_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Client" required>
          <select style={selectStyle} value={form.clientId} onChange={e=>setForm(f=>({...f,clientId:e.target.value}))}>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Assign To">
          <select style={selectStyle} value={form.assignedTo} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))}>
            {team.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select style={selectStyle} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            {JOB_STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Priority">
          <select style={selectStyle} value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
            {PRIORITIES.map(p=><option key={p}>{p}</option>)}
          </select>
        </FormField>
        <FormField label="Due Date">
          <input type="date" style={inputStyle} value={form.dueDate||''} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} />
        </FormField>
        <FormField label={`Progress: ${form.progress||0}%`}>
          <input type="range" min={0} max={100} step={5} value={form.progress||0} onChange={e=>setForm(f=>({...f,progress:e.target.value}))} style={{ width:'100%', accentColor:'#38bdf8', marginTop:8 }} />
        </FormField>
      </div>
      <FormField label="Notes"><textarea style={textareaStyle} value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Work notes, reminders..." /></FormField>
    </>
  );

  /* Board view */
  if (view === 'board') {
    return (
      <div className="animate-fade" style={{ height:'100%' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div><h1 style={{ fontSize:24, fontWeight:700, color:'#e2e8f0' }}>Jobs</h1><p style={{ color:'#475569', fontSize:14, marginTop:2 }}>{jobs.length} total</p></div>
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ display:'flex', background:'#0f1623', borderRadius:8, border:'1px solid #1e2d40', overflow:'hidden' }}>
              {['list','board'].map(v=><button key={v} onClick={()=>setView(v)} style={{ padding:'7px 14px', background: view===v?'#1e2d40':'transparent', border:'none', color: view===v?'#e2e8f0':'#475569', fontSize:13, fontWeight:500, textTransform:'capitalize' }}>{v}</button>)}
            </div>
            <button onClick={openAdd} style={{ background:'#38bdf8', border:'none', borderRadius:10, padding:'9px 16px', color:'#080c14', fontWeight:700, fontSize:13 }}>+ New Job</button>
          </div>
        </div>
        <div style={{ display:'flex', gap:14, overflowX:'auto', paddingBottom:12 }}>
          {JOB_STATUSES.map(status => {
            const colJobs = filtered.filter(j=>j.status===status);
            const s = STATUS_STYLES[status];
            return (
              <div key={status} style={{ minWidth:260, flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'8px 12px', background:s.bg, borderRadius:8 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:s.dot }} />
                  <span style={{ fontSize:13, fontWeight:600, color:s.text }}>{status}</span>
                  <span style={{ marginLeft:'auto', fontSize:12, color:s.text, fontFamily:"'JetBrains Mono',monospace", background:'#00000030', borderRadius:10, padding:'1px 7px' }}>{colJobs.length}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {colJobs.map(j => {
                    const client = getClient(j.clientId);
                    const member = getMember(j.assignedTo);
                    return (
                      <div key={j.id} onClick={()=>openEdit(j)} style={{ background:'#0f1623', border:'1px solid #1e2d40', borderRadius:10, padding:14, cursor:'pointer', transition:'border-color 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor='#38bdf840'}
                        onMouseLeave={e=>e.currentTarget.style.borderColor='#1e2d40'}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', marginBottom:5 }}>{j.title}</div>
                        <div style={{ fontSize:11, color:'#475569', marginBottom:8 }}>{client?.name} · {j.type}</div>
                        <ProgressBar value={j.progress} />
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
                          <PriorityBadge priority={j.priority} />
                          {member && <Avatar name={member.name} color={member.color} size={24} />}
                        </div>
                        {j.dueDate && <div style={{ fontSize:11, color: isOverdue(j.dueDate)?'#f87171':'#475569', marginTop:8 }}>Due {fmtDate(j.dueDate)}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {modal && (
          <Modal title={modal==='add'?'New Job':'Edit Job'} onClose={closeModal} wide>
            <JobForm /><div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:8}}>
              <button onClick={closeModal} style={{background:'#1e2d40',border:'none',borderRadius:8,padding:'9px 18px',color:'#94a3b8',fontWeight:500}}>Cancel</button>
              <button onClick={save} style={{background:'#38bdf8',border:'none',borderRadius:8,padding:'9px 20px',color:'#080c14',fontWeight:700}}>Save Job</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  /* List view */
  return (
    <div className="animate-fade">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div><h1 style={{ fontSize:24, fontWeight:700, color:'#e2e8f0' }}>Jobs</h1><p style={{ color:'#475569', fontSize:14, marginTop:2 }}>{jobs.length} total jobs</p></div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ display:'flex', background:'#0f1623', borderRadius:8, border:'1px solid #1e2d40', overflow:'hidden' }}>
            {['list','board'].map(v=><button key={v} onClick={()=>setView(v)} style={{ padding:'7px 14px', background: view===v?'#1e2d40':'transparent', border:'none', color: view===v?'#e2e8f0':'#475569', fontSize:13, fontWeight:500, textTransform:'capitalize' }}>{v}</button>)}
          </div>
          <button onClick={openAdd} style={{ background:'#38bdf8', border:'none', borderRadius:10, padding:'9px 16px', color:'#080c14', fontWeight:700, fontSize:13 }}>+ New Job</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search jobs..." style={{ ...inputStyle, width:240 }} />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...selectStyle, width:160 }}>
          <option value="All">All Status</option>
          {JOB_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={filterAssigned} onChange={e=>setFilterAssigned(e.target.value)} style={{ ...selectStyle, width:160 }}>
          <option value="All">All Members</option>
          {team.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={{ ...selectStyle, width:140 }}>
          <option value="All">All Priority</option>
          {PRIORITIES.map(p=><option key={p}>{p}</option>)}
        </select>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.length === 0 && <Card><div style={{ textAlign:'center', color:'#334155', padding:30 }}>No jobs found</div></Card>}
        {filtered.map(j => {
          const client = getClient(j.clientId);
          const member = getMember(j.assignedTo);
          const overdue = isOverdue(j.dueDate) && j.status !== 'Completed';
          return (
            <Card key={j.id} style={{ padding:'14px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>{j.title}</span>
                    <PriorityBadge priority={j.priority} />
                    {overdue && <span style={{ fontSize:11, color:'#f87171', background:'#7f1d1d30', borderRadius:10, padding:'2px 8px' }}>Overdue</span>}
                  </div>
                  <div style={{ fontSize:12, color:'#475569' }}>{client?.name} · <span style={{ color:'#64748b' }}>{j.type}</span></div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                  <div style={{ width:120 }}>
                    <div style={{ fontSize:11, color:'#475569', marginBottom:4, textAlign:'right' }}>{j.progress}%</div>
                    <ProgressBar value={j.progress} />
                  </div>
                  <StatusBadge status={j.status} small />
                  {member && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:110 }}>
                      <Avatar name={member.name} color={member.color} size={26} />
                      <span style={{ fontSize:12, color:'#64748b' }}>{member.name.split(' ')[0]}</span>
                    </div>
                  )}
                  {j.dueDate && <div style={{ fontSize:12, color: overdue?'#f87171':'#475569', minWidth:80 }}>{fmtDate(j.dueDate)}</div>}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>openEdit(j)} style={{ background:'#1e2d40', border:'none', borderRadius:7, padding:'5px 10px', color:'#94a3b8', fontSize:12 }}>Edit</button>
                    <button onClick={()=>del(j.id)} style={{ background:'#7f1d1d20', border:'none', borderRadius:7, padding:'5px 10px', color:'#f87171', fontSize:12 }}>Del</button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {modal && (
        <Modal title={modal==='add'?'New Job':'Edit Job'} onClose={closeModal} wide>
          <JobForm />
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
            <button onClick={closeModal} style={{ background:'#1e2d40', border:'none', borderRadius:8, padding:'9px 18px', color:'#94a3b8', fontWeight:500 }}>Cancel</button>
            <button onClick={save} style={{ background:'#38bdf8', border:'none', borderRadius:8, padding:'9px 20px', color:'#080c14', fontWeight:700 }}>Save Job</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── TEAM ─────────────────────────────────────────────────────────────────── */
function Team({ team, jobs, setTeam }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const getMemberJobs = id => jobs.filter(j=>j.assignedTo===id && j.status!=='Completed');
  const getCompletedCount = id => jobs.filter(j=>j.assignedTo===id && j.status==='Completed').length;

  const openEdit = m => { setForm({...m}); setEditing(m.id); };
  const save = () => { setTeam(prev=>prev.map(m=>m.id===form.id?form:m)); setEditing(null); };

  return (
    <div className="animate-fade">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:700, color:'#e2e8f0' }}>Team</h1>
        <p style={{ color:'#475569', fontSize:14, marginTop:2 }}>8 members · click to edit details</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
        {team.map(m => {
          const activeJobs = getMemberJobs(m.id);
          const completedCount = getCompletedCount(m.id);
          return (
            <Card key={m.id} style={{ position:'relative' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:4, borderRadius:'12px 12px 0 0', background: `linear-gradient(90deg, ${m.color}80, ${m.color}20)` }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, marginTop:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Avatar name={m.name} color={m.color} size={44} />
                  <div>
                    <div style={{ fontWeight:600, color:'#e2e8f0', fontSize:15 }}>{m.name}</div>
                    <div style={{ fontSize:12, color:'#475569', marginTop:2 }}>{m.role}</div>
                  </div>
                </div>
                <button onClick={()=>openEdit(m)} style={{ background:'#1e2d40', border:'none', borderRadius:7, padding:'4px 10px', color:'#64748b', fontSize:12 }}>Edit</button>
              </div>
              <div style={{ display:'flex', gap:12, marginBottom:14 }}>
                <div style={{ flex:1, background:'#080c14', borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:700, color:m.color, fontFamily:"'JetBrains Mono',monospace" }}>{activeJobs.length}</div>
                  <div style={{ fontSize:11, color:'#475569' }}>Active</div>
                </div>
                <div style={{ flex:1, background:'#080c14', borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:700, color:'#34d399', fontFamily:"'JetBrains Mono',monospace" }}>{completedCount}</div>
                  <div style={{ fontSize:11, color:'#475569' }}>Done</div>
                </div>
              </div>
              {activeJobs.length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:'#334155', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Active Jobs</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {activeJobs.slice(0,3).map(j=>(
                      <div key={j.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:'#080c14', borderRadius:7 }}>
                        <span style={{ fontSize:12, color:'#94a3b8', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.title}</span>
                        <StatusBadge status={j.status} small />
                      </div>
                    ))}
                    {activeJobs.length > 3 && <div style={{ fontSize:12, color:'#334155', textAlign:'center', padding:'4px 0' }}>+{activeJobs.length-3} more</div>}
                  </div>
                </div>
              )}
              {activeJobs.length === 0 && <div style={{ fontSize:13, color:'#334155', textAlign:'center', padding:'10px 0' }}>No active jobs 🎉</div>}
            </Card>
          );
        })}
      </div>
      {editing && (
        <Modal title="Edit Team Member" onClose={()=>setEditing(null)}>
          <FormField label="Name"><input style={inputStyle} value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></FormField>
          <FormField label="Role"><input style={inputStyle} value={form.role||''} onChange={e=>setForm(f=>({...f,role:e.target.value}))} /></FormField>
          <FormField label="Color">
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
              {TEAM_COLORS.map(c=>(
                <button key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{ width:28, height:28, borderRadius:'50%', background:c, border: form.color===c?`3px solid white`:'3px solid transparent', cursor:'pointer' }} />
              ))}
            </div>
          </FormField>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
            <button onClick={()=>setEditing(null)} style={{ background:'#1e2d40', border:'none', borderRadius:8, padding:'9px 18px', color:'#94a3b8', fontWeight:500 }}>Cancel</button>
            <button onClick={save} style={{ background:'#38bdf8', border:'none', borderRadius:8, padding:'9px 20px', color:'#080c14', fontWeight:700 }}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [clients, setClients] = useState(INIT_CLIENTS);
  const [jobs, setJobs]       = useState(INIT_JOBS);
  const [team, setTeam]       = useState(INIT_TEAM);
  const [view, setView]       = useState('dashboard');
  const [loaded, setLoaded]   = useState(false);

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const c = await window.storage?.get('mig_clients'); if (c?.value) setClients(JSON.parse(c.value));
        const j = await window.storage?.get('mig_jobs');    if (j?.value) setJobs(JSON.parse(j.value));
        const t = await window.storage?.get('mig_team');    if (t?.value) setTeam(JSON.parse(t.value));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // Save to storage
  useEffect(() => { if (loaded) { try { window.storage?.set('mig_clients', JSON.stringify(clients)); } catch{} } }, [clients, loaded]);
  useEffect(() => { if (loaded) { try { window.storage?.set('mig_jobs',    JSON.stringify(jobs)); }    catch{} } }, [jobs, loaded]);
  useEffect(() => { if (loaded) { try { window.storage?.set('mig_team',    JSON.stringify(team)); }    catch{} } }, [team, loaded]);

  const nav = [
    { id:'dashboard', icon:'◈',  label:'Dashboard' },
    { id:'clients',   icon:'👤', label:'Clients',   count: clients.filter(c=>c.status==='Active').length },
    { id:'jobs',      icon:'📋', label:'Jobs',      count: jobs.filter(j=>j.status!=='Completed').length },
    { id:'team',      icon:'👥', label:'Team' },
  ];

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
        {/* Sidebar */}
        <div style={{ width:220, background:'#0a0f1a', borderRight:'1px solid #1a2333', display:'flex', flexDirection:'column', flexShrink:0 }}>
          {/* Logo */}
          <div style={{ padding:'22px 20px 18px', borderBottom:'1px solid #1a2333' }}>
            <div style={{ fontSize:17, fontWeight:700, color:'#e2e8f0', letterSpacing:'-0.02em' }}>
              <span style={{ color:'#38bdf8' }}>Nexus</span>CRM
            </div>
            <div style={{ fontSize:11, color:'#334155', marginTop:2 }}>Migration & Student Services</div>
          </div>
          {/* Nav */}
          <nav style={{ padding:'12px 10px', flex:1 }}>
            {nav.map(n => (
              <button key={n.id} onClick={()=>setView(n.id)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:9, border:'none', background: view===n.id?'#38bdf815':'transparent', color: view===n.id?'#38bdf8':'#475569', fontSize:14, fontWeight: view===n.id?600:400, marginBottom:2, transition:'all 0.15s', textAlign:'left' }}
                onMouseEnter={e=>{ if(view!==n.id) e.currentTarget.style.background='#ffffff08'; }}
                onMouseLeave={e=>{ if(view!==n.id) e.currentTarget.style.background='transparent'; }}>
                <span style={{ fontSize:15, width:18, textAlign:'center' }}>{n.icon}</span>
                <span style={{ flex:1 }}>{n.label}</span>
                {n.count !== undefined && n.count > 0 && (
                  <span style={{ fontSize:11, background: view===n.id?'#38bdf830':'#1e2d40', color: view===n.id?'#38bdf8':'#475569', borderRadius:10, padding:'1px 7px', fontFamily:"'JetBrains Mono',monospace" }}>{n.count}</span>
                )}
              </button>
            ))}
          </nav>
          {/* Footer */}
          <div style={{ padding:'14px 16px', borderTop:'1px solid #1a2333' }}>
            <div style={{ fontSize:11, color:'#1e2d40', textAlign:'center' }}>v1.0 · {clients.length} clients · {jobs.length} jobs</div>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex:1, overflowY:'auto', padding:'28px 32px', background:'#080c14' }}>
          {view === 'dashboard' && <Dashboard clients={clients} jobs={jobs} team={team} onGoTo={setView} />}
          {view === 'clients'   && <Clients clients={clients} jobs={jobs} setClients={setClients} />}
          {view === 'jobs'      && <Jobs jobs={jobs} clients={clients} team={team} setJobs={setJobs} />}
          {view === 'team'      && <Team team={team} jobs={jobs} setTeam={setTeam} />}
        </div>
      </div>
    </>
  );
}
