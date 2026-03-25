import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as mammoth from 'mammoth';
import SmartAI from './SmartAI';
import { writeSession as writeGmailSession } from './utils/gmailSession';
import { mergeClientData } from './utils/mergeProfile';

/* ─── i18n LANGUAGE SYSTEM ──────────────────────────────────────────────────── */
const LANG_ZH = {
  // Nav
  'Dashboard':'仪表板','Clients':'客户','Cases':'案件','Leads':'潜在客户',
  'Calendar':'日历','Invoices':'发票','Agents':'推荐代理','Team':'团队','Reports':'报告',
  // Top bar / auth
  'Sign out':'退出登录','Staff':'员工','Manager':'经理',
  // Clients page
  'Add Client':'+ 添加客户','Search clients...':'搜索客户...',
  'All Types':'所有类型','All Status':'所有状态',
  'CLIENT':'客户','TYPE':'类型','STATUS':'状态','CASES':'案件',
  'NATIONALITY':'国籍','NOTES':'备注','CREATED':'创建日期',
  'Edit':'编辑','Del':'删除',
  'total clients':'位客户',
  // Client modal tabs
  '👤 Profile':'👤 档案','📋 Cases':'📋 案件','📝 Notes':'📝 备注',
  '💬 WeChat':'💬 聊天导入','📥 Import Doc':'📥 导入文档',
  // Profile sections
  'Client —':'客户 —',
  'PERSONAL INFORMATION':'一、基本信息',
  'Full Name':'姓名','Gender':'性别','Date of Birth':'出生日期',
  'Birthplace':'出生地','Nationality':'国籍','Passport No':'护照号码',
  'Passport Expiry':'护照有效期','China ID':'身份证号',
  'Email':'邮箱','Mobile':'手机','AU Address':'澳洲地址',
  'Marital Status':'婚姻状况','QQ':'QQ','EA File No':'EA 档案号',
  'Consultant':'负责顾问','Visa Target':'签证目标',
  // Service agreement
  'SERVICE AGREEMENT':'二、服务合同',
  'Contract Date':'合同签署日期','Total Fee':'服务费合计',
  'Payment 1':'第一期付款','Payment 2':'第二期付款',
  'Paid':'已付','Pending':'待付',
  // Visa history
  'VISA HISTORY':'三、签证历史',
  'Visa Type':'签证类型','Application No':'申请编号',
  'Lodged':'递签日期','Granted':'下签日期','Expiry':'有效期',
  'Approved':'已获批','In Progress':'进行中','Refused':'被拒',
  'No records':'暂无记录',
  // Skills assessment
  'SKILLS ASSESSMENT':'四、职业评估',
  'Occupation':'职业','Application ID':'申请编号',
  'Submitted':'递交日期','Outcome':'评估结果',
  'Unsuccessful':'不通过','Successful':'通过',
  'Reason':'驳回原因','Appeal Deadline':'上诉截止日',
  'Further Docs Requested':'追加材料请求',
  'Add Assessment':'+ 添加评估',
  // Case timeline
  'CASE TIMELINE':'五、大事记',
  'Date':'日期','Event':'事件',
  'Completed':'已完成','Failed':'失败','Urgent':'紧急','Maintained':'维持原决定',
  'Add Event':'+ 添加事件',
  // Current status
  'CURRENT STATUS & NEXT STEPS':'六、当前状态与建议行动',
  'Status Summary':'状态摘要','Options to Consider':'可选路径',
  'Option':'选项','Action':'行动','Details':'详情',
  'High':'高','Medium':'中','Low':'低',
  'Add Option':'+ 添加选项',
  // Notes section
  'Add a note... (Ctrl+Enter to save)':'添加备注... (Ctrl+Enter 保存)',
  'No notes yet':'暂无备注',
  // Address / employment history
  'Address History (AU)':'地址历史（澳洲）',
  'Employment History':'工作经历',
  'From':'开始','To':'结束','Address':'地址',
  'Company':'公司','Role':'职位','Country':'国家',
  // Character checks
  'Character / Police Checks':'品行 / 无犯罪记录',
  'Form 80':'Form 80','AFP Police Check':'澳大利亚联邦警察无犯罪',
  'China PCC':'中国无犯罪证明',
  'Provided':'已提供','Missing':'未提供','Unknown':'未知',
  // Documents
  'Documents Checklist':'文件清单',
  'Document':'文件','Main Applicant':'主申请人','Sponsor':'担保人','Secondary':'随迁人员',
  // Key Issues
  'Key Issues & Action Items':'关键问题与待办事项',
  // Form fields & buttons
  'Full Name *':'姓名 *','Save Client':'保存客户','Cancel':'取消',
  'Client Type':'客户类型','Phone':'电话',
  'Add New Client':'添加新客户','Edit Client':'编辑客户',
  // Jobs page
  'New Case':'新案件','Save Case':'保存案件',
  'Case Title':'案件标题','Case Type':'案件类型','Client':'客户',
  'Assign To':'分配给','Priority':'优先级','Due Date':'截止日期',
  'Progress':'进度','CASE NOTES':'案件备注',
  'DOCUMENT CHECKLIST':'文件清单',
  'Edit Case':'编辑案件','Open in Cases →':'在案件页打开 →',
  // Dashboard
  'Active Clients':'活跃客户','Jobs In Progress':'进行中案件',
  'Urgent Jobs':'紧急案件',
  'of':'共','total cases':'个案件总计','jobs finished':'个案件已完成',
  'need immediate attention':'需要立即处理',
  'Recent Activity':'近期动态','Upcoming Deadlines':'即将到期',
  'View all →':'查看全部 →','View team →':'查看团队 →',
  // WeChat
  'Paste WeChat Chat Export':'粘贴聊天记录',
  'Analyse with AI':'AI 智能分析',
  'Analysing...':'分析中...',
  'Analysis Complete':'分析完成',
  'Summary':'摘要','Action Items':'待办事项',
  'Client Requests':'客户需求','Important Dates':'重要日期',
  'Topics':'话题标签',
  'Save Summary to Client Notes':'保存摘要到客户备注',
  'Saved':'已保存','Clear':'清除',
  // Edit profile tab
  '✏️ Edit Client':'✏️ 编辑客户',
  'Edit Profile':'编辑档案',
  'Profile':'档案',
  'Notes':'备注',
  'WeChat':'微信',
  'Import Doc':'导入文档',
  'Payment':'付款',
};

// Language context – stored in sessionStorage so it persists across pages
const getLang = () => sessionStorage.getItem('ozsky_lang') || 'en';
const setLang  = (l) => { sessionStorage.setItem('ozsky_lang', l); window.dispatchEvent(new Event('ozsky-lang-change')); };

// Hook: returns a translation function and current lang
function useLang() {
  const [lang, setLangState] = useState(getLang);
  useEffect(() => {
    const handler = () => setLangState(getLang());
    window.addEventListener('ozsky-lang-change', handler);
    return () => window.removeEventListener('ozsky-lang-change', handler);
  }, []);
  const t = (key) => lang === 'zh' ? (LANG_ZH[key] ?? key) : key;
  return { lang, t };
}

/* ─── STYLES ───────────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #eef0f6;
    color: #0f172a;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }

  button { cursor: pointer; font-family: inherit; }
  input, select, textarea { font-family: inherit; }

  @keyframes fadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(22px) scale(0.99); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes tooltipIn { from { opacity:0; transform:translateY(6px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes pulse  { 0%,100%{opacity:1;} 50%{opacity:0.45;} }
  @keyframes shake  { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
  @keyframes drawIn { from{transform:translateX(-100%)} to{transform:translateX(0)} }

  .animate-fade  { animation: fadeIn  0.32s cubic-bezier(.16,1,.3,1) both; }
  .animate-slide { animation: slideIn 0.28s ease both; }
  .tooltip-anim  { animation: tooltipIn 0.18s ease both; }

  /* ── SIDEBAR ─────────────────────────────────── */
  .oz-sidebar {
    width: 236px; min-height: 100vh; background: #1f1f3d;
    display: flex; flex-direction: column; flex-shrink: 0;
    position: sticky; top: 0; height: 100vh;
    box-shadow: 2px 0 20px rgba(0,0,0,0.15);
    z-index: 50; transition: transform 0.3s cubic-bezier(.16,1,.3,1);
  }
  .oz-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 13px; border-radius: 9px; border: none;
    width: 100%; text-align: left; font-size: 13.5px; font-weight: 500;
    margin-bottom: 1px; color: #b8c4d8; background: transparent;
    transition: all 0.15s; cursor: pointer;
  }
  .oz-nav-item:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; }
  .oz-nav-item.active {
    background: rgba(255,21,138,0.15);
    color: #ff8bc8; font-weight: 600;
    box-shadow: inset 3px 0 0 #ff158a;
  }
  .oz-nav-badge {
    margin-left: auto; font-size: 10px; padding: 1px 7px; border-radius: 99px;
    font-family: 'JetBrains Mono', monospace; font-weight: 600;
    background: rgba(255,255,255,0.09); color: #9ba5c0;
  }
  .oz-nav-item.active .oz-nav-badge { background: rgba(255,21,138,0.25); color: #ff8bc8; }

  /* ── TOPBAR ─────────────────────────────────── */
  .oz-topbar {
    position: sticky; top: 0; z-index: 40;
    background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
    border-bottom: 1px solid #e9eaf3;
    height: 58px; display: flex; align-items: center; padding: 0 28px; gap: 14px;
    box-shadow: 0 1px 6px rgba(0,0,0,0.05);
  }

  /* ── CARDS ─────────────────────────────────── */
  .oz-card {
    background: #fff; border-radius: 14px;
    border: 1px solid #e9eaf3;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04);
    transition: box-shadow 0.2s, transform 0.15s;
  }
  .oz-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.10); }

  /* ── KPI CARDS ─────────────────────────────── */
  .oz-kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px,1fr)); gap: 14px; margin-bottom: 28px; }
  .oz-kpi {
    background: #fff; border-radius: 14px; padding: 18px 20px;
    border: 1px solid #e9eaf3; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    transition: box-shadow 0.2s;
  }
  .oz-kpi:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.09); transform: translateY(-1px); }
  .oz-kpi-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #676879; margin-bottom: 8px; }
  .oz-kpi-val   { font-size: 30px; font-weight: 800; color: #323338; line-height: 1; }
  .oz-kpi-sub   { font-size: 12px; color: #676879; margin-top: 5px; }

  /* ── TABLE ─────────────────────────────────── */
  .oz-table { width: 100%; border-collapse: collapse; }
  .oz-table th {
    padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em; color: #4b5563;
    background: #f9fafb; border-bottom: 1px solid #e9eaf3; white-space: nowrap;
  }
  .oz-table td { padding: 13px 16px; border-bottom: 1px solid #f3f4f8; font-size: 13.5px; color: #374151; vertical-align: middle; }
  .oz-table tbody tr:hover td { background: #fafbff; }
  .oz-table tbody tr:last-child td { border-bottom: none; }

  /* ── BUTTONS ─────────────────────────────── */
  .oz-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 18px; border-radius: 9px; font-size: 13px; font-weight: 600;
    border: none; transition: all 0.15s; cursor: pointer;
  }
  .oz-btn-primary {
    background: linear-gradient(135deg, #ff158a, #ff5fae);
    color: #fff; box-shadow: 0 2px 10px rgba(255,21,138,0.35);
  }
  .oz-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(255,21,138,0.45); }
  .oz-btn-ghost {
    background: #f3f4f8; color: #374151;
    border: 1px solid #e5e7eb;
  }
  .oz-btn-ghost:hover { background: #ebebf5; color: #374151; }
  .oz-btn-danger { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; }
  .oz-btn-danger:hover { background: #fee2e2; }

  /* ── INPUTS ─────────────────────────────── */
  .oz-input {
    width: 100%; background: #f9fafb; border: 1.5px solid #e5e7eb;
    border-radius: 9px; padding: 9px 13px; color: #0f172a;
    font-size: 14px; outline: none;
    transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
  }
  .oz-input:focus { border-color: #ff158a; background: #fff; box-shadow: 0 0 0 3px rgba(255,21,138,0.12); }
  .oz-input::placeholder { color: #b0b7c3; }

  /* ── MODAL ─────────────────────────────── */
  .oz-overlay {
    position: fixed; inset: 0; background: rgba(17,24,39,0.5);
    backdrop-filter: blur(4px); z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeIn 0.15s ease both;
  }
  .oz-modal {
    background: #fff; border-radius: 18px; width: 100%; max-width: 640px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.22);
    animation: slideUp 0.28s cubic-bezier(.16,1,.3,1) both;
  }
  .oz-modal-wide { max-width: 900px; }
  .oz-modal-hd {
    padding: 22px 26px 18px; border-bottom: 1px solid #f3f4f8;
    display: flex; justify-content: space-between; align-items: center;
  }
  .oz-modal-title { font-size: 17px; font-weight: 700; color: #111827; }
  .oz-modal-body  { padding: 22px 26px 28px; }
  .oz-close-btn {
    background: #f3f4f8; border: none; border-radius: 8px;
    width: 32px; height: 32px; font-size: 16px; color: #4b5563;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s;
  }
  .oz-close-btn:hover { background: #fee2e2; color: #ef4444; }

  /* ── FORM ─────────────────────────────── */
  .oz-label {
    display: block; font-size: 11.5px; font-weight: 700; color: #374151;
    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;
  }
  .oz-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .oz-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .oz-full   { grid-column: 1/-1; }

  /* ── BADGES ─────────────────────────────── */
  .oz-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 600;
  }
  .oz-tag {
    display: inline-flex; align-items: center;
    padding: 2px 9px; border-radius: 7px; font-size: 11px; font-weight: 600;
  }

  /* ── SECTION HEADER ─────────────────────── */
  .oz-page-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
  .oz-page-title { font-size: 22px; font-weight: 800; color: #323338; }
  .oz-page-sub   { font-size: 13px; color: #676879; margin-top: 3px; }
  .oz-main-content { background: #f6f7fb; }

  /* ── MOBILE ─────────────────────────────── */
  .oz-hamburger {
    display: none; background: none; border: none; padding: 4px 6px;
    font-size: 22px; color: #374151; line-height: 1;
  }
  .oz-mob-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45);
    z-index: 49; backdrop-filter: blur(2px);
  }
  .oz-mob-nav {
    display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
    background: #1f1f3d; border-top: 1px solid #2d2d5e;
    padding: 4px 4px 8px; justify-content: space-around;
  }
  .oz-mob-btn {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    background: none; border: none; padding: 6px 8px; border-radius: 10px;
    color: #9ba5c0; font-size: 9.5px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em; min-width: 52px; transition: all 0.15s;
  }
  .oz-mob-btn:hover, .oz-mob-btn.active { color: #ff8bc8; background: rgba(255,21,138,0.2); }
  .oz-mob-btn .micon { font-size: 19px; }

  /* ── RESPONSIVE ─────────────────────────── */
  @media (max-width: 880px) {
    .oz-sidebar { position: fixed; left: 0; top: 0; height: 100vh; transform: translateX(-100%); z-index: 50; }
    .oz-sidebar.open { transform: translateX(0); animation: drawIn 0.3s cubic-bezier(.16,1,.3,1); }
    .oz-mob-overlay.open { display: block; }
    .oz-hamburger { display: block; }
    .oz-mob-nav { display: flex; }
    .oz-topbar { padding: 0 16px; }
    .oz-grid-2 { grid-template-columns: 1fr; }
    .oz-grid-3 { grid-template-columns: 1fr 1fr; }
    .oz-kpi-grid { grid-template-columns: 1fr 1fr; }
    .oz-main-content { padding: 18px 14px 80px !important; }
    .oz-page-hd { flex-direction: column; align-items: flex-start; }
  }
  @media (max-width: 560px) {
    .oz-kpi-grid { grid-template-columns: 1fr; }
    .oz-grid-3 { grid-template-columns: 1fr; }
    .oz-modal { border-radius: 18px 18px 0 0; margin: auto 0 0; max-height: 95vh; }
    .oz-overlay { align-items: flex-end; padding: 0; }
    .oz-table thead { display: none; }
    .oz-table tr { display: block; border: 1px solid #e9eaf3; border-radius: 12px; margin-bottom: 10px; background:#fff; }
    .oz-table td { display: flex; justify-content: space-between; align-items: center; border:none; padding: 9px 14px; }
    .oz-table td[data-label]::before { content: attr(data-label); font-weight:700; color:#9ca3af; font-size:10.5px; text-transform:uppercase; letter-spacing:0.05em; }
  }
`;

/* ─── CONSTANTS ─────────────────────────────────────────────────────────────── */
const JOB_STATUSES = ['New', 'In Progress', 'Awaiting Docs', 'Under Review', 'State Nomination', 'Awaiting Decision', 'S56 Request (Further Information)', 'Completed', 'On Hold'];
const JOB_TYPES = [
  // Skill Assessments
  'Skills Assessment – ACS (IT)',
  'Skills Assessment – Engineers Australia',
  'Skills Assessment – VETASSESS',
  'Skills Assessment – ANMAC (Nursing)',
  'Skills Assessment – CPA / CA (Accounting)',
  'Skills Assessment – NAATI (Translation)',
  'Skills Assessment – TRA (Trades)',
  // Student & Graduate
  'Subclass 500 – Student Visa',
  'Subclass 485 – Graduate Temp',
  // Skilled Independent & Regional
  'Subclass 189 – Skilled Independent',
  'Subclass 190 – Skilled Nominated',
  'Subclass 491 – Skilled Regional (State)',
  'Subclass 491 – Skilled Regional (Family)',
  'Subclass 494 – Employer Sponsored Regional',
  'Subclass 887 – Skilled (Residence)',
  // Work & Employer Sponsored
  'Subclass 482 – TSS (Short-term)',
  'Subclass 482 – TSS (Medium-term)',
  'Subclass 186 – ENS (Direct Entry)',
  'Subclass 186 – ENS (TRT)',
  'Subclass 407 – Training Visa',
  // Partner & Family
  'Subclass 820/801 – Partner (Onshore)',
  'Subclass 309/100 – Partner (Offshore)',
  'Subclass 300 – Prospective Marriage',
  // Visitor & Temporary
  'Subclass 600 – Visitor',
  'Subclass 408 – Temp Activity',
  // Bridging
  'Bridging Visa A',
  'Bridging Visa B',
  'Bridging Visa C',
  // Support Services
  'Enrollment Support',
  'Scholarship Application',
  'ART Appeal',
  'Other',
];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const CLIENT_TYPES = ['Student', 'Visa', 'Migration', 'Multiple'];
const CLIENT_STATUSES = ['Active', 'Pending', 'Completed', 'Inactive'];

const STATUS_STYLES = {
  'New':           { bg: '#ffd6ee', text: '#c11569', dot: '#c11569' },
  'In Progress':   { bg: '#ddf0ff', text: '#0073ea', dot: '#0073ea' },
  'Awaiting Docs': { bg: '#fff3c9', text: '#7a5800', dot: '#7a5800' },
  'Under Review':  { bg: '#fff3c9', text: '#7a5800', dot: '#7a5800' },
  'State Nomination': { bg: '#ddf0ff', text: '#0073ea', dot: '#0073ea' },
  'Completed':     { bg: '#c2f0db', text: '#0a6640', dot: '#0a6640' },
  'Awaiting Decision': { bg: '#f3f4f6', text: '#676879', dot: '#676879' },
  'S56 Request (Further Information)': { bg: '#ffd6d6', text: '#c11548', dot: '#c11548' },
  'On Hold':       { bg: '#f3f4f6', text: '#676879', dot: '#676879' },
  'Active':        { bg: '#c2f0db', text: '#0a6640', dot: '#0a6640' },
  'Pending':       { bg: '#fff3c9', text: '#7a5800', dot: '#7a5800' },
  'Inactive':      { bg: '#f3f4f6', text: '#676879', dot: '#676879' },
  'Urgent':        { bg: '#ffd6d6', text: '#c11548', dot: '#c11548' },
};

const PRIORITY_STYLES = {
  'Low':    { bg: '#1e40af20', text: '#93c5fd' },
  'Medium': { bg: '#78350f20', text: '#fcd34d' },
  'High':   { bg: '#991b1b20', text: '#fca5a5' },
  'Urgent': { bg: '#7f1d1d',   text: '#fca5a5' },
};

const TEAM_COLORS = ['#6366f1','#34d399','#f59e0b','#a78bfa','#fb923c','#f472b6','#4ade80','#60a5fa'];

/* Document checklists per job type */
const DOC_CHECKLISTS = {
  'Skills Assessment – ACS (IT)':              ['Passport', 'Academic Transcripts', 'Employment References', 'Resume/CV', 'RPL Evidence (if applicable)', 'English Evidence'],
  'Skills Assessment – Engineers Australia':   ['Passport', 'Academic Transcripts', 'Employment References', 'CDR (Career Episodes x3)', 'Summary Statement', 'CPD Evidence'],
  'Skills Assessment – VETASSESS':             ['Passport', 'Academic Transcripts', 'Employment References', 'Position Descriptions', 'English Evidence'],
  'Skills Assessment – ANMAC (Nursing)':       ['Passport', 'Nursing Registration Cert', 'Academic Transcripts', 'English Evidence (OET/IELTS)', 'Employment References', 'AHPRA Application'],
  'Skills Assessment – CPA / CA (Accounting)': ['Passport', 'Academic Transcripts', 'Employment References', 'Membership Certificate', 'English Evidence'],
  'Skills Assessment – NAATI (Translation)':   ['Passport', 'Language Qualification Proof', 'Interpreter Experience Evidence', 'Application Form'],
  'Skills Assessment – TRA (Trades)':          ['Passport', 'Trade Qualification Cert', 'Employment References', 'English Evidence', 'RPL if no cert'],
  'Subclass 500 – Student Visa':               ['CoE (Confirmation of Enrolment)', 'Valid Passport (6+ months)', 'English Test Results (IELTS/PTE)', 'Financial Evidence (AUD 21,041+)', 'OSHC (Health Cover)', 'GTE Statement', 'Academic Transcripts', 'Health & Character Checks'],
  'Subclass 485 – Graduate Temp':              ['CoE or Completion Letter', 'Passport', 'AQF Qualification Certificate', 'English Evidence', 'Health Insurance', 'Health & Character Checks'],
  'Subclass 189 – Skilled Independent':        ['Skills Assessment', 'English Test Results', 'EOI via SkillSelect', 'Passport', 'Health Examination', 'Police Clearance', 'Employment References'],
  'Subclass 190 – Skilled Nominated':          ['Skills Assessment', 'State Nomination Evidence', 'English Test Results', 'EOI via SkillSelect', 'Passport', 'Health Examination', 'Police Clearance', 'Employment References'],
  'Subclass 491 – Skilled Regional (State)':   ['Skills Assessment', 'State/Territory Nomination', 'English Test Results', 'EOI via SkillSelect', 'Passport', 'Health & Character Checks', 'Employment References'],
  'Subclass 491 – Skilled Regional (Family)':  ['Skills Assessment', 'Eligible Relative Sponsorship', 'English Test Results', 'EOI via SkillSelect', 'Passport', 'Health & Character Checks'],
  'Subclass 494 – Employer Sponsored Regional':['Employer Sponsorship Approval', 'Skills Assessment', 'Passport', 'Labour Market Testing Evidence', 'English Evidence', 'Health & Character Checks'],
  'Subclass 887 – Skilled (Residence)':        ['491/494 Grant Letter', 'Passport', 'Evidence of Regional Living/Working (2 yrs)', 'Health & Character Checks'],
  'Subclass 482 – TSS (Short-term)':           ['Approved Sponsorship', 'Job Offer / Contract', 'Passport', 'Skills Assessment (if required)', 'English Evidence', 'Health & Character Checks'],
  'Subclass 482 – TSS (Medium-term)':          ['Approved Sponsorship', 'Job Offer / Contract', 'Passport', 'Skills Assessment', 'English Evidence', 'Health & Character Checks', 'Labour Market Testing'],
  'Subclass 186 – ENS (Direct Entry)':         ['Employer Nomination Approval', 'Skills Assessment', 'Passport', 'English Evidence', 'Health & Character Checks', 'Employment References (3 yrs)'],
  'Subclass 186 – ENS (TRT)':                  ['Employer Nomination Approval', 'Passport', 'Evidence of 2 Years Employment with Sponsor', 'English Evidence', 'Health & Character Checks'],
  'Subclass 407 – Training Visa':              ['Training Plan', 'Sponsor Approval', 'Passport', 'English Evidence', 'Health & Character Checks'],
  'Subclass 820/801 – Partner (Onshore)':      ['Relationship Evidence (photos/comms/finance)', 'Joint Bank Statements', 'Statutory Declarations (x2)', 'Both Passports', 'Health Examination', 'Police Clearance'],
  'Subclass 309/100 – Partner (Offshore)':     ['Relationship Evidence', 'Joint Financial Evidence', 'Statutory Declarations', 'Both Passports', 'Health Examination', 'Police Clearance'],
  'Subclass 300 – Prospective Marriage':       ['Proof of Genuine Relationship', 'Passports', 'Evidence of Meeting in Person', 'Health & Character Checks'],
  'Subclass 600 – Visitor':                    ['Passport', 'Travel Itinerary', 'Financial Evidence', 'Ties to Home Country Evidence', 'Travel Insurance (recommended)'],
  'Subclass 408 – Temp Activity':              ['Passport', 'Sponsor Approval or Event Invitation', 'Activity Evidence', 'Health & Character Checks'],
  'Bridging Visa A':                           ['Current Visa Copy', 'Substantive Visa Application Receipt', 'Passport'],
  'Bridging Visa B':                           ['Current BVA Grant Letter', 'Passport', 'Evidence of Compelling Reason to Travel'],
  'Bridging Visa C':                           ['Current Application Reference', 'Passport'],
  'Enrollment Support':                        ['Offer Letter', 'Academic Transcripts', 'English Test Results', 'Passport Copy'],
  'Scholarship Application':                   ['Academic Transcripts', 'English Test Results', 'Research Proposal / Personal Statement', 'Referee Letters (2-3)', 'Passport', 'CV/Resume'],
  'Other':                                     ['Passport', 'Supporting Documents'],
};

const INIT_TEAM = [
  { id:'t1', name:'Liang Jiang',   role:'Senior Consultant',   email:'liang@ozsky.com.au',   phone:'0411 111 001', color:'#6366f1' },
  { id:'t2', name:'Mansi Mao',     role:'Migration Agent',     email:'mansi@ozsky.com.au',   phone:'0411 111 002', color:'#34d399' },
  { id:'t3', name:'Mia Ma',        role:'Student Advisor',     email:'mia@ozsky.com.au',     phone:'0411 111 003', color:'#f59e0b' },
  { id:'t4', name:'Nicole Chen',   role:'Case Manager',        email:'nicole@ozsky.com.au',  phone:'0411 111 004', color:'#a78bfa' },
  { id:'t5', name:'Cici Fu',       role:'Student Advisor',     email:'cici@ozsky.com.au',    phone:'0411 111 005', color:'#fb923c' },
  { id:'t6', name:'Momo Qiu',      role:'Admin Officer',       email:'momo@ozsky.com.au',    phone:'0411 111 006', color:'#f472b6' },
  { id:'t7', name:'Sandy Xu',      role:'Document Specialist', email:'sandy@ozsky.com.au',   phone:'0411 111 007', color:'#4ade80' },
  { id:'t8', name:'Zoya Chen',     role:'Compliance Officer',  email:'zoya@ozsky.com.au',    phone:'0411 111 008', color:'#60a5fa' },
];

/* Notes are stored as arrays: [{ id, text, createdAt }] newest-first */
const makeNote = (textOrObj) => {
  const { text, ...meta } = (typeof textOrObj === 'object' && textOrObj !== null) ? textOrObj : { text: textOrObj };
  return { id: 'n'+Math.random().toString(36).slice(2,8), text, createdAt: new Date().toISOString(), ...meta };
};
const normalizeNotes = (notes) => {
  if (!notes) return [];
  if (Array.isArray(notes)) return notes;
  if (typeof notes === 'string' && notes.trim()) return [{ id: 'n0', text: notes, createdAt: '2025-01-01T00:00:00.000Z' }];
  return [];
};


const INIT_CLIENTS = [];

const INIT_JOBS = [];


/* ─── HELPERS ────────────────────────────────────────────────────────────────── */
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split('T')[0];
const initials = (name) => name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
const fmtDate = (d) => { if (!d) return '—'; const s = String(d); const dt = new Date(s.includes('T') ? s : s+'T00:00:00'); return isNaN(dt) ? '—' : dt.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}); };
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) + ' ' + d.toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'});
};
const isOverdue = (d) => d && new Date(d) < new Date() ? true : false;



/* ─── CONTRACT GENERATION ─────────────────────────────────────────────────── */
const generateClientContractFile = async (client, jobs = []) => {
  const visaTypes = [...new Set((jobs||[]).map(j=>j.type).filter(Boolean))];
  const activeJobs = (jobs||[]).filter(j=>j.status!=='Completed');
  const serviceDescription = activeJobs.length
    ? activeJobs.map(j=>`${j.title}${j.type?` (${j.type})`:''}`).join('; ')
    : 'Migration consultation and related services';

  const res = await fetch('/api/generate-contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName:    client?.name || '',
      clientAddress: client?.profile?.auAddress || '',
      clientEmail:   client?.email || '',
      clientPhone:   client?.phone || '',
      visaTypes:     visaTypes.length ? visaTypes : [client?.type || 'Migration Service'],
      serviceDescription,
      totalFee:      parseFloat(client?.profile?.serviceAgreement?.totalFee) || 0,
      gstIncluded:   true,
      paymentMode:   'single',
      payment1Amount: parseFloat(client?.profile?.serviceAgreement?.totalFee) || 0,
      payment1Desc:  'Professional migration service fee',
      contractDate:  new Date().toLocaleDateString('en-AU'),
      consultant:    'Liang Jiang',
      marn:          '1800784',
      disbursements: [],
      bankAccountName: 'Ozsky Perth Pty Ltd',
      bankBSB:         '066166',
      bankAccountNumber: '10895257',
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(()=>'');
    throw new Error(msg || 'Unable to generate contract.');
  }
  const blob = await res.blob();
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(client?.name||'client').trim()} Service Contract.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

/* ─── LOGO ───────────────────────────────────────────────────────────────────── */
const LOGO_B64 = "data:image/jpeg;base64,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UUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//S/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//T/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//U/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//V/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//W/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//X/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//Q/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//R/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//S/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//T/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//U/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//V/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//W/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//X/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//Q/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//R/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//S/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//T/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//U/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//V/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUVHMgCiiirAKKKKACiiigAooooAO1ez/Br4I+L/AI1a42meHo1t7K2/4+725/1Ft/8AFP8A7NeXaLpGp+INZs9F0mFrm+v5VihhX+N5a/fD4KfCzT/hH4BsPCNlte7C+dfXCD/W3P8AF/wCvm82zSODp6bmFasoRPizUf8AgnmRp7nSfGwe/X7i3FiUib/x75a/P7xx4E8SfDvxHc+EfFdp9kv7T7391l/vq38S1/Rd161+f37fHw9/tXwro/xJs4sTaJL9guHVPv20v3P+/Lf+h18XlvEFSpX5anU46OK55WZ+UH60UdOlFfrB6YUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBJRRRWgH//W/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUDCiiigQUUUUDCiitrQ/DfiDxVfrpfhzTLnVL1/uw2kTO1RKajq2IxaK+8fhr+wn498QeRfePrtPDVnJ/y7r+9u/y/1a199fDz9mv4SfDMLcaPoiX1+h5vr0faJf8AyJ9z/vzXzmMz3DYfzZy1cTCGlz8lvhx+zP8AFj4mGO40jRHs9Ok/5fb39xDj/wBGN/wGvvj4d/sJeAfD5S+8eXj+I7hOPIT/AEazH/tZ6+5QgA8tfuD/AD1peBx6V+bYriWtVfu6HlVMbKWiONT4Y/DaLSjoq+FtMj0/bt+zmzh21+ZX7Wn7MOn/AA9VPiH4Btnj8P3D7b21Vt32Fv4WX/Yl/wDHa/WeqGq6VY61p1xo2qwJdWWoK0M0Lfcda8jD53Wp1rylcypYmUZan811SV9CftCfBS/+C/jSTS8NNo16fO0+5/vof4H/ANqOvnuv3nB4qOIoxqI+hjNShdEdFFFdpYUUUUAFFFe3/AH4S33xk8fWvh1N0emQ/vtRuP8Anjbf/FSfdrCtUjTjzMD7T/Yh+CLWUD/GHxJBh5ldNIRl+6n3XuT/AOPLF/wKv0aGevrVXT7Gy0iwtdKsIVtbK1hSGGJBhESL7i1ar+es2xssVXbR8vXrOciQVzHjnwpaeOPB+t+D7/Z5GsWzQ/P1X+6//fVdNG6zDzkfen95XpxxnI5rx6FV06ilsZ0vd1P5ttc0W/8AD+sXui6qjRXVjM8MyH+Bon8qsevuD9uL4dDwz8TofF1imyx8UQmZva7hHlP/AN/flavh/wCtf0lltf22HjM+og+aKYUUUV6RoFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBJRRRWgH/1/xDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUV7t8EfgT4m+N3iD7BpoSx0m2/wCP6+Zfki/3P7z/AOzX6R2H7C/wNi0k2N2moXV6et2LzY//AHzF+7/8g14+KzTD0dJPUiU4R+I/Gaiv0h8a/sAapaPNdfDzX1voeStpqKFJMf78X/2NfHXjb4I/FX4fzP8A8JX4bu7W3X/l5RRNAcekkX7unhsyw9TaRaqwa0Z5HRUlFem5gR17D8NPgb8SvirPv8JaYXs9+x7qZvKtl/4H/wDE16d+zV+zVqfxj1dPEHiBJLTwhZP+8m+4944/5YR/+1W7V+0WlaPpei6Xb6No1qlnp9mnkw28KhUVK+NzXO4UFyU37xx4rFRpI+Efh7+wX4S0jyLr4jam2t3AI/0ex/dQ+v3v9cxr7b8M+CfCngyy/sbwlpVto1sMZWCPaWx/5Gb/AIFXRfd9sUuTX5Tis1xNZ3Pn6mJqz2E6fhRk/nXnXjj4sfD34a2n2nxlrcOnuPmW3Z98rf8AAIf31fDHxC/b5lO/T/hho23kj7dqHc/7NvF/7N/3zToYLEYp3SCnh6k9WfpHeX9npVk17qtwltax/elmbYi/9/a+RviN+2v8KPCQmsvDr3HivUUGxfsnyWe7/r5l/wDZYmr8qPG/xQ8efEi9+2eNNbuNSwfljd/3Sf7qf6uvPa+5wPCq3rs9qlg4rc/dv9n7496T8bPDM148C6frNk+y6s433/L/AAuv+x/7NXvme4r+er4V/EnW/hP40sPGGit89uwWWLPyzwfxJX70+BfG/h/4h+FbLxh4cmM1jqKbv9pH6Mj/AO3DXzOdZO8LPmhsefjKHI7rY5z4u/CrRfi94MufDGsDyphma0uv+fa56K9fgv4u8La14J8SXnhrxJA1rf2Evkyr2/8A2a/o49uxr44/a1+AK/ErwufGfhi3H/CSaFGd6ouPtln/AHP96H/ljW/D+aTpVPZz2Zpg69nys/Gmiiiv3GB7wUUUdeKACv3X/Zm+ENn8J/hxZw3EWNa1qNb3UZR1Dyj5Lb/dhr8TvBuknxH4s0XQdu4X99bWmP8ArrJg/wA6/o3jjEEa2w/5YKF/KvzvifEyp01CL3PNxtRwjyoea+ef2lPjHb/CD4eTXllL/wAT3WN9pp6/3G/iuf8AtlX0N/H/AJ9K/Cb9pr4hX3j/AOLeuT3EmbHSbh9PsoR9xLaBv/ihX5/lWAeJxFuh5eDpKcrs+7/2HPiPdeJ/BWp+CNUnebUNDuRNFvPzNa3nzf8Aoe7/AL6r7qxivwh/Zm+Ih+Gvxd0TWLhzHp94/wDZ13j/AJ9p+D/49tb/AIDX7vdU+SujPctdCt7qsjfF0uWWh80fta/D5fiD8HtTNnHuv/D2dStz7Qj95j/tn/6DX4dV/S0VTy/nXen8dfgF8cPAJ+G/xM13wnGjG2tpd9o/9+2l+dP/AEP/AMdr6rhbHaOhJnVgqt04Hj1FFFfqR6oUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//Q/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUDCvefgd8DfEvxn8RRWdmjWekWTf8AEw1Db8sC/wBz/aek+A/wH8SfGvxIthp8b2uk2rf6dfbfkiT+6nbdX7c+EfA/h74feGrbwt4SthZ6fagBVA+Z2/jd3/iavj82zeOHi4QepxV66gg8EeC/Dfw/8N2PhnwtbJY6XbIdq/xu/wDeZ/4mrr+2RUfXAPIFeTfF/wCM3hH4OaHHqviNnnup32Wljbt+9l/+xr8fftsRO+7Pl37SpO6Z6sepNMIyCpGQeoPSvnzwN+1R8FvHCpHHrqaLfNx9n1f911/2/wDU/wDkavoOKS3uo0urV1mWT5ldDvVwenzU54bE0tWjRxqR6ni3jb9nP4NfEBXl1zw8lpfN/wAvVgPs03/kP73/AAKvmQfsA+EV8VWV5B4kmn0FHzcWksX+mP8A7Kt/9qr9Cs7/AGqPoc9666Oa4mEbKRtDF1IdSno2k6RoGmWmi6LbJY2Nonkw20K7UhStFFC8A5oz3r5p/aK/aN0b4MaSdK03bfeKL5f9Ht/4Il/5+bn/AD81cNGlVxVXzMEp4ipY3vjP+0P4H+DCw2OrxtqOr3K747O3f5gv95z/AAV+bvxF/bR+LfjYS2Whzp4VsHyuyybMzf71zL/7LXy14l8S6x4r1m613xDdPe6jevvlll53/SsE9Pav1nK8io0o81TVn01DDQgtS/eXN5e3T3l5O0802XZ3fe7GqmOtR/SjJr7enRpwXuo7bBRRRVCCvrz9lX4+S/CjxR/YuuzP/wAIrrT7LgHO2zn/AOfj/wCO/wCxXyHR0rjxuHjXo8skZTipKzP6XFkWaBJ0cOjYZWHel5f6V+ef7F/7QEerWkHwg8XTj7ZbLjSbh+sqd7Y/9c/+WNfoiq4r8DxmAnhqlkfL4inySPyX/bK+AH/CJapJ8UfCsGzRdSl/06FF/wCPa7lP38f3Zq+Ba/pM1jRdL8TaVd6DrUC3NjfQtDcRP0dK/Cj4+fBjVPgt42n0SfdcaZcF5dPunH+vt/7v+9HX6XkebKpH2VTc9vCV+dWZ4VR0oxiivvOh6R9A/sr6H/b/AMefCVoVykNybp/+2KM3Nfu/jGQK/Hv9gnRP7Q+Ld9rLLkaTpjv9PNKw1+wJOa/JOJpqVRI8LMJe9Yoajcrp2nXeoO22OCFm57eUlfzka3qbanql/qT/AHr2Zpm+sr+Ya/e74464fDXwe8X6oreW6afcqvrul/cqP/Hq/n8bgY/6aY/Su7heja8jfAU7IXaGr98/2efH7fEf4TaDr03z30UP2S8/6+LT5H/9kr8DSBk19+fsE/ET+zPFmr/DjUp8Qa7F9rtcngXMH/2H/oNfS8Q4X21C/Y78TT5oH6uSZKgEYzX5y/t7/D37ZpmhfEuxg/eWrf2dfc87P+XZv/Qv/Ha/RrnoTk1wfxO8EWfxE8Ba14NvDtOr27rG7fwXP3k/8fRa/HsvreyrqR8xRq8tQ/njqOr9/YXGmahcadeRtDdWzMkqMMFHj6g1Qr+iaU1KmpI+sW1wooopjCiiigYUUUUCCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAkooorQD//0fxDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAHXpXvHwM+A/iP41+JPsFhustJt2X7dfbflgT+6v956f8CPgX4j+NfiIWFjus9ItSv269dPlgX+6v956/bTwP4I8O/D/w7b+FPCNstnYWqgcD5nb+Nmf+9Xyma5tGjFwhuceIxSpqyGeCvB3hz4f+G7Lwr4Stls7C1AwMfO7/AN5/7zV2B96jxg14/wDGb40eGPgr4ZbWdWP2m+uE/wBBs0+9cN/7Kv8AtV+Ov2mIqd2fJ2qYioO+M/xn8MfBnwy+sau6zX8yf6FZK3z3Df8AsqV+IfxC+IXij4oeKLvxX4ruvOubjouPkiT+BET+FaPiD8QfE/xQ8TXfivxZd+dfT52pn5IV/hVF/hSuFr9bynKPqy5pbn1uHwipR8xxbAwOnf3rv/B/xT+Ifw+n8/wb4iutLIbG2GX5H/4D/qq8+qP2r6qWGpy3R1ezR+g/gT9vbxlphhtfHWjW+swp/wAtrd/ssw/9p19d+Ev2ufgp4sWLdrLaJckf6nUIvJ/8f/1P/kWvw9or5jF8PUKrvHQ46uFps/Y34wftl/D7wdo89n4CvI/EPiF/liMSt9kgJ/jZ+d/+7X5GeIvEuteLtauvEfiC6e+1C+ffNNM3zu9YtFdeW5RTwb01NqFGNPYCM9aKKK+kNwooooAKKKKACiiigDR0zUr/AEe+g1LTJmtb21ZZI5E++jxfxV+537OvxtsPjN4NS6nlVfEOnhYdRh/2v+flf9mavwgr0/4R/FDXPhN40tPFejN5nlnbcW54S5t/4o2+tfN5xgFiad0veOPEUVUif0IbxnPFeTfG/wCFGj/GbwbceGb5UhvUxLY3fVrafH/oP/Paus8H+MPD/j/wvp/i7w9P9qsL8BlcdU/vq3+1DXVdD1/ya/GqcpYevbsfLxcqcz+cnxR4W1fwhr174d8QQta6hZTeTNC45U1zXAr9hP2vPgInxC8Pf8J34Sh3+I9JhJnhRPmvLPH3R/tQ/wAq/KR/BHjBf9XoF8Mf9OzH/wBlr9rwOYwq07vc+toVlKKufor/AME89E22PjHxE0WC81paI/pku7f+y1+jw5Ir5C/Yk8MXnhj4MC5vYGtZ9W1C7mKypscr8sK/+g19cdK/Ks5qc+IsfPYyd6p8lftoa3/ZHwMvLUNiTV720tcf8C84/wDoNfi5yce5zX6jf8FBdb8nQPB/h1W/4+bi5u2X/riqw8/99Nivy5r9F4fpctC572E/hknauq8C+K7zwL4u0nxhZO32nSLhJk2t98fxr0/u1yNP6Cvq68PaQ5Wd3Q/o+0PXLDxNo2neIdJlWaxv7ZLuF1/iWXmtvORn8a/Dn4OftM/ET4PWw0nSZItS0YNvFldqzJE/+y0X7xa6v4i/to/E7x5pM+gWsFv4ftrriZrIuJZU/u7pecV+TVchrRre4vdPmZ4CftLxPGvjnqekaz8XvF2saKB9hm1C5eFl/jryOpJn8zPJP9ajr9Rw8OSmos+kgmo6hXsXw7+BPxO+KJR/CWivPZ78fabj91af99/xf8B3V9b/ALLn7KNr4jtbX4j/ABPtd+nzfNp+nSZX7Sn/AD83P/TP/Z/ir9OLG1gsYI7O0jWKCJdqQquxE/3VFfNY7PI0Xy0zza2KjA/LPSf+CffjK4to5NZ8V2NjI3VYYXm2f+iaNZ/4J++OIIS2ieK9PvW/hWeJrTd/6Mr9Vv8AgVQFMnJr46fENfm0PM/tKofgD4/+DHxK+FsxXxloktpDv2rdJ81o/wBHirymv6TNQ06y1W0msL+3W6sp12zQypvR0/20r8q/2of2V18DRXHj74dQtL4f3ZurL732H/aX/Y/9Br6rLs7jW92poz0qGOhV0Z8D0UUV9ueiFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//S/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFej+AfhT8Sfipf/ANmfDzwxqPiKcfK32G1eZE/32/1a19w+CP8AglR+1V4thSfWbXTPCsEmONQuwzL/AMBtlmrCdelD4maxpuWx+a9Fftrof/BGLxhIg/4SX4m2dswxn7HprT/+jZIq2Zv+CLjrF/o3xYLN/t6Ps/8AbmsPr9DudHsJH4Y0V+vvib/gjt8bdOEk3hbxhoeqCNflW5jmtnb/AMcmr5B+JP7CX7VHwy8y61vwLd31kn3rjTNuoof+/P73/wAhVVPF0pOyZi6UkfIFFTzQS2s72twrI8bbWR02OlM6cV1p3MrEdFHTrRTJCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooopgFe+fAj4FeIvjV4i+w2ObLRrcr9vvnT5YE/ur/AHmpnwH+BniT41eJPsdgHstEtnX+0L1l+SFP7q/3n/2a/bbwT4M8PfD7w3ZeFPCduLKwt0xtx8zt/ff+81fK5lmkaK5IPU87E4mNP3eong7wP4d+H3h2z8H+ErVLKxtk/wC+3/vM/wDE1dV0GKkPvXjnxm+M3hj4M+Gf7V1j/SdQuR/oVkr/ADXDf+yr/tV+W1YTxNWy3Z8pU9pVnaInxl+Mvhv4M+G31bVnSbUJubK0DfPcv/7KtfiN8RfiD4n+Jvie48WeJrjzrqb7q5+SJP4EVf4VpfiJ8Q/E3xP8UXXivxZdfaLqb7q5+SFf4VVf4Fr1Dwt+yP8AtI+OfDll4s8MfDrVNS0jUIRNb3EKLsmT+996v0XLMtp4WKnU3Pr8HheRaHzf3z3or6v/AOGH/wBrX/olus/9+l/+PUz/AIYi/ay7/CzWf+/S/wDxdfXe3pdz2/ZTPlOiux8f+AvGPwz8Ty+EvHmkXGhaxEiSyWl0io6JN9yuSxjit1JPVGDp9yOiiimYBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH2P+yh8fn+F3iFvDPiWbPhfWZdj724s7g/8ALz/u/wDPWv2P3RsoaN96vjBr+amv1L/ZL/aSsLrRofhn8Q9QWC9sRs0y7uH2rKvH+jO396PtX5xnmV816tM8PG4a/wC8gfoWFK9G/p/Kk+0OOFdv++mH8qamH6IH91NW0hdukTSH/Zr4H2dZdDwOeZVLsx55qxUjRTD71uw/4DXL+KPFHhvwXo8uueLNQi0y3h/jlf7/APu/3modGb2Q1zyex+XH7fGuG/8AiZouidtK0xMev752evg89TXr/wAb/iA3xP8AiVq/jBFMdrO2y2VvvLbxfKleP1+2ZXSdOgj7GjHlikFFFFeydIoOOlIcHmiigA5AwK99/Zq+F0fxV+KOnaNfIz6ZZL9uvsHrawfwf9tW2pXgVfqJ/wAE9/D9smjeLvE0iYeS4trVW7BIlaZ//QlrxcxrujQbW5liKnJTP0LREggWC1iSFAu1VT7ipVnnOT1qT6UV+IVKrm9T4KdS71I6KKKw5CQqtf2FpqVnNp99AtxDdKyzRN9xk/jUVZyKM1pBtO5cT8Cfjx8NpfhR8UNa8HLuNlFJ51ozdXtpfuf/ABP/AAGvHa/R7/goJotrFrvhHxGifNPb3VuzevkOuz/0Jq/OGv3bLqvtKCkfdUp88Ewooor1jcKKKKACu58A+Dr74geKrDwnpn7trlt0zfwQwRfvXf8A7Zrurhq/R74R/D3/AIVJ+zf4x+L2tK0Wu+ItMaKw3HD21tK+xP8Av8zK3/fNclfERoq8hTqWVj86rz7P9rn+ybvI3P5e7+5VapCccmo664bXGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUASUUUVoB/9P8Q2/1r0w9qe3+temHtX6YfLgetJSnrSUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUxBRRX6OfsV/sF+I/2ktQXxt4zFzoPw7tm+eVF2z6o/wDct/8Apl/z1k/78/8ATPCrUjTjzSOmnScz5W+C/wAAviv+0F4kbQPhroj30kPE903yWNmh/jubj+H/ANHV+7H7Pn/BKn4P/D6G11z4wOPHuup+8aKRPK02J+3+jf8ALb/tr/3zX6SfD74aeCvhT4WsvBnw/wBKh0fSbJdsMUCdf9p/7zf7TV6Tz3r5PEZhKekdj1adJROY8PeH9C8MaVb6D4esIdM061XbHbWqLFEn+6i4rp8dhRjvRXjuTe51cgvSkoopBZIZto2+1PyKKBnzH8af2UvgZ8ebZ7f4h+FLa9u9m1dQg/0e/i/3biP5/wDgLfLX4fftK/8ABLP4l/C2K68WfB24l8ceHoN7yWhh/wCJrbr/ALsX/Hx/2z+b/Yr+l2iuyliZwZy1aUZH8JbpJBcG3uFaORCVdWHOehqOv6f/ANsj/gnz4I/aDsr3xj4Egi8OfEBFLC5RNltqjf3Ltf7x/wCfj7/+9X80vjLwh4n+HvinUPBfjDT5NL1rTZPKuLW4T5kb8f4P9qvrsNjYVI2e55s6DRzVFFFeicYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRTAK90+B3wN8S/GvxJ/Z1lmy0i2ZPt19t+WJf7q/3m/2apfA74Oav8aPGUXh6zP2XT7dfOvrrj9xbf8AxdfuH4F8C+G/AHhqy8JeEbZbPT7VcKoHzu/95n/iavm80zNUYuEdzixOIVKPmTeB/BHh34eeHbfwn4Ssks7C3T5V/jdv4md/4mrqMfpR0+orx340/GPwz8F/DP8AbWrSrd383y2VkrfPO3/sif7VflE3Ur1Lnxr58RUD4z/Gbw38G/Db6tq7rNqFx/x5WSN89y3/ALIn+1X4ifEP4h+JPiZ4muPE3iy6+0XM2difwRJ/CiJ/AtN+IXxG8T/EnxHc+KvFdx9qu7j7q/wRJ/dX+6tcWeXJ9q/TssyuNJKctz7TCYWNJDAK/sA/Yf5/ZP8Ahaf+oHa/+z1/H8etf2BfsOc/snfC7P8A0A7X/wBmr0Mz/ho92gtWfWYalz7UtFfHpnrH8qv/AAVO5/bI8Sf9eOk/+kiV+etfoV/wVO/5PI8Sf9eOk/8ApIlfnrX32B/gI8Sr8TCo6kqOu44wooooEFFFFABRRRQAUUUUAFFFFABRRRQAVJHHnmOo+vFSxs9u++Bij/3hUWA1Bq+qRR+Wt7Ki/wBwStSLreqr0u5B/wACrq9Lm8H6+fs3ih20iftqNvF5sf8A28wf/G/+/NSeLfhZ4w8I2UGtX1qt9ol1kW+o2T+dYy/8D/h/3W21wOhRvaUQ9lE5H+3NX/5/JT/20/8Ar1Uu769uubmRn/333VRorX6vRjqohGlEB70UUV02AKKKK0AKKKKYBX6n/wDBPvVYm8K+L9DP+sgu7a6/4BMuz/2Wvywr6m/ZC+JVv4A+LFta6ncfZ9K19f7PuGb7itK3yMf+BV4maUfaUHYwxdNypaH7ZUvSkpQM1+HuNj4NrW7EoPSig9KoXMQknNJk0pBzTaiMQR+a3/BQTU0a48HaH/EsN5dt/wCOrX5sD2r6D/aa+Iy/Ev4qarqenzGfS7HZY2r/AN9If4/+2rbmr58yK/c8roOlh1Fn3eGg1SVwooor2DpCiiuw8EeDNf8AiB4msPCfhyB7i/vZdkf9xO25v9mplKyuB7h+y78FpPix45S51dGHhzRds165B/e/3Lce8v8A6DX2x+3N4l/sX4XaX4ZttkT6xep8qf8APtZp5v8A6Gy19K/Cv4Y6L8J/BOn+EdEQusPz3Nxt+a5uT95n/pX5u/t5eKP7R+JWk+Flk3jQrH58f37z95/6Dtr89niPrmMUeh4ql7SufDJ5qM9aeOlMPWv0JaI9oSiiiqAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCSiiitAP//U/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFem/B/4X+IvjR8SdD+GfhaLN/rNx5Xmv8AdgT+K5b/AGI03NWdWryK5rTp8zPr39g39jW9/aW8cN4m8XpJa/D7w3In22X7n265/wCfRf8A2s393/er+ovRdD0vw9pFtoeiWsdnp1jEkdvbwoESJYvuqq1wXwb+FfhL4L/DzRfht4NtPs2l6LFsT+/M/wDFM/8Atyt81ewe9fC4rFSrSfY9ulDlQ1FCD1Y9TTqKK4UdAUV8M/tP/t1fCH9mq2k0vVpn17xXIu6HRrF/3o/2p3/5Yr/49/sV+Enxh/4KN/tPfFu7uLWx1z/hDtEkJ2WmjfuX2H+F7nl2rvoYSpV2RE6ijuf1P6l4l0DRYydV1K2s0AzumlROPxrHtfiP4CvZBbWHiXTbmQ/wx3kLN/6FX8Sur61ruvTtd+Ir+51Sdznz7uZ5nz/vSVl7YB1iUf8AAK9iOVO2rOZ4hH92EE8VzGJYZFZPUc1Yr+LD4fftB/Gz4V3sVx4A8cappGP+WS3LvA3/AG7y/ua/W79nL/grgbm6t/Cf7SWmJAsmEXxBpyfIn/Xzaf8As0P/AH5rgr5dUgrjjXTP3hpcGuZ8NeJtD8YaJZeJPDWoQ6ppmow+bb3Nu2+KVP7ytXSivIaa0Z1bi9K/O39ub9jDQv2mfB8mueGYYbX4i6EmdOu5PkW8X/n0uH/uf882/gf/AIFX6Jc0bfatKdRwkmhNXR/C3qulatoOq3Oh6zavZ6hZTNBc28ybXieL76NWYSD2xX7j/wDBV/8AZUis5V/aW8F2vlrcMlv4jWJf4/u213/7Tl/4BX4dV91hq3tYXPBq0+VkdFFFdpzhRRRQAUUUUxhRRRQAUUUUhBRRRQAUUUUAFFFFABRRS4NAz9Ef+CfuuaTBq/irw1cusV/fQ200HbesO7cv/j9fqN6e1fzg6FreseGtVtfEGh3r2V/ZuHhmhbayN2r63sf25PjFBpn2CddPuZh1u2gw3/fP+p/8g18HmmWVKtXmieRi8LKrK8T9JfjL8ZfDPwY8M/23q5SXUpflsbBW2vcv/wCyrD/er8SfiH8Q/E3xP8TXPizxVc/aLmb7q/wRJ/CiL/CtVPG/j3xX8Qddn8SeLL+TUL6bPzSdET+6q/wrXFAnH1r08vyqNH35bmuGw0aS8wPNFFFfUnpBX9gf7Df/ACad8Lv+wHa/+zV/H5X9gn7Df/Jp3wu/7Adr/wCzV4Oa/Cj0aG59aUUUV8iesfyrf8FT/wDk8nxJ/wBeOk/+kiV+elfoX/wVP/5PJ8Sf9eOk/wDpIlfnhX3mA/go+exPxElR0UV6BgFFFFABRRRQAUUUUAFFFLg0AJRRRTAKKKKQBRk0UuDQAlev/Cr4z+MPhTfT/wBjOt7pV7xd6ddDdZ3adt6V5BxSisZU1LcD9FLD4N/A/wDaR0mfWfhRcf8ACH+Jol33elTNuhXA7J/dz/Ev/fNfJfxK+CHxK+Flzs8V6Q8dq33LyD97aP8A9tP/AIqvN/D/AIg1rwtqsGu+HLx9P1G1bfFNC211/Gv1x+Av7T3hr4uWq+CPHsUFp4gnj2hZf+PTUf8AgMn8X/TP/vzXz+LdahO8dUctRyh7yPx1or9i/ij+xh8NfGQkvfCmPDGpj/ngm+zf/gP/AMTX55/Ez9nD4pfDHfeavpjXmnLn/TrP97Cf97/lqv8AwKuzDY+E3ZlUsTTlo9zwCiiivaOjcKKKKBhRRRRuI/Wr9lz9qC08YWFl8PfHl6kOuwosNrdTP8l8mcbP+vj/ANDr7ur+aevrr4Y/tj/FDwHAmjatIniTS0+RYb5/3qJ/sXP/AMVur4LMsl5pe0png4rLufWB+z1GCK+C9K/b7+G8tt/xOvD2o20w/gt9ky/9974f5VDq/wC3z4EhhP8AYfh3Ub2TslxLHB/6K86vlP7Mrdjxll9VdD76wK/PH9qz9pqz0ywuPhr8PLhZr2ePytTvom+WJf4rZP8Aa/57NXzD8UP2tvij8RoJtLtp49A0mT5Gt7L5GdP9t/8AWPXyw7M5Mkjl2Pr+tfS5fk0oy5pnsYXAcr5pjGZpGLscljk+59abRx2or9DPfCijBq/YaffaneQafYwvcXU77Y4Y03OzUm0twE02wvdXvIbCwja6ubhtkMUK7nd/7q1+037M37Ptl8HvDg1XWEWTxVq6f6Ux62qdfsy/+1q5L9mX9mS1+GEEXjDxjGtx4pmUGGHG5NOSUf8AoX+1X2QFyevT2r4TNcx5vcpnzmNxqXuQZZ9hX8/nxn8XN43+KHiPxMku6G9vW8pv9iL92n/jq1+zvx38ZHwL8JfE/iJH2Tm0eG3Yf37z5E/9C3V+BpJY7m//AFVORYb33UKy2Gjmwooor74+hCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAJKKKK0A/9X8Q2/1r0w9qe3+temHtX6YfLgetJSnrSUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRTAK/f3/AIJGfAS10vwvrXx/1qDdeas/9maU8ifcs4P+Pl1H/TaT5f8AgFfgbY2N1ql/aaTYwNNdXcyQwqv8TyttWv7Tvg18O7H4R/C7wn8NdNRfs/h7TYLIsn/LR4k/eSf9tX3PXg5nV5VyI9DDU7s9bwF+buak3cVGRmjNfGpHsEgr8sP+CgP7cX/DPukS/DD4ZyxzeP8AU4N8k27culwS/wDLRv8ApvN/yyX/AIHX2r+0J8ZtI+AXwj8SfE7V2ST+ybctb27ZHn3cv7u3hGP+er1/Hl448X+I/iF4u1bxp4puXvdW164a4uZH/vzf+y17WCwntHdnPUqcphalqura1f3etavO97qN7M8txcXD75Znl6MzzVQyR7UmOx7UV9rSpqEbI8apW5hmSaSiimYBRRRS3Gtz7x/Yr/bS8V/sx+KodF1ky6p8PdRm/wCJjp2/d9mPX7Xaf7f+z/y2/wB75q/qb8NeI9B8X6Fp/ibw7eLqGl38MdxbXETZSWOX7rV/DnX7mf8ABJj9pi8M+ofs1+LLwvG6tqHh7zWzt/iubRf/AEdF/wBtK+azDCpe/E9ilWv7rP3sopBwOaWvmDvOI8feDdF+IPg/WPA3iSD7TpWu2ktpcJ6pKu01/GT8Vvh1rHwk+JXib4a+IBvv/Dd81k77f9an8Lj/AK6qVb/gVf221/ON/wAFe/hfFoHxe8MfFGwgCReLLF7S4cfx3mnf/a2T/vmvdy2rapyvqcdeF43R+QJBB6YowaefeivrzxOp9IaR+yH+074g0ex1zR/hprN9Y30KXFvNHb/JNbz/ALxX4rT/AOGJf2sv+iVa7/4Dp/8AHK/qk/Z6H/Fh/hz/ANgDS/8A0kjr2wIa+RnmM4y0PYhRiz+On/hin9rL/olOu/8AgP8A/Z0f8MU/tY/9Ep13/wAB/wD7Ov7Fse/+fyo2n1/X/wCtU/2nWNfq8T+On/hin9rH/olOu/8AgP8A/Z0o/Yp/axz/AMkp13/wH/8As6/sW2r60bV9aP7Tqh7CJ/HW/wCxZ+1in/NKdd/8Bv8A7OvJ/GPwg+LHw/UzeOPCGraDApw0t7YzRJ+LbfKr+2vIrL1GytdSt5LK+hW4glXa8brvRhW0c0nf3kZvDH8LlFfvH/wUA/YE8IaX4Q1X45fA/S00m70eNrjWdIt022k9t/FcwR/wPF9+Vfuuv/j/AODnXpX0FCvGrHmR5dSm4bhRRRXUYhRX1/8Asp/sg+PP2ovEzJpk39keF9MZf7Q1aVdyr/0xt0/jm/2a/ow+Cn7Ef7PXwJ0+Gbw74Yt9V1tRltT1SNLy8d/9nzPlj/7Z7a8uvjoUnZHXDDykfyo+HfhP8UPFUaT+HfCOs6pC3V7SwmmT/vqJa61P2av2hpBvT4a+Iv8AwXT/APxNf2fQWyRoqoiqqj7q/pVgKvp+teY82l2Or6qfxdH9mr9ov/omviH/AMF0/wD8TR/wzP8AtEYx/wAKz8Q4/wCwdP8A/E1/aPsX0FGxfQVP9ry/lK+qn8Xf/DNH7RP/AETXxD/4Lp//AImub8XfB74r+AdNXWPHHhDVtBsZG8lbi/s3hV3/ALm6Wv7aNo9K/J//AIK/DH7Muk/9jNZf+k9xW9LNHOXK0ZTw/Kj+aw/SmVIelR19EeaFf2B/sOf8mnfC3/sB2v8A7NX8flf2B/sOf8mnfC3/ALAdr/7NXh5n/DR6OH3PrWiiivjz1z+Vb/gqf/yeT4k/68dJ/wDSRK/PCv0P/wCCp/8AyeT4k/68dJ/9JEr88K+8wH8FHz2J+IKuWVrcaldwWNpA891cusUMSLuZ3l+4tU6/Tf8A4JefAZfiZ8dv+FkaxDv0L4fIL3c6/JJqEv8Ax7p/2z+Z/wDgK/3q2r1PZx5gpU+dnyn/AMMjftOByn/Cr/EPH/Ti/wDjT/8AhkT9pz/ol/iH/wAAHr+yIpFnIG2nbU7ivC/tV/ynqfVEfxt/8MiftOf9Ev8AEP8A4APXjvjDwT4t+H+uyeGPHWl3Gi6tCiM9pdxbJV837uV96/s4+KHxA8PfCjwF4g+I3iifydN0C0ku5AGwX8r/AJZp/tM/y/8AAq/jd+J/xA1z4sfEPxD8S/Ez79U8QXbXsgH3E837iL6LCm2P/gNdWFxE6sjlrUlA4Guo8JeB/Gfj3VH0nwPoN7r17HF5rW+nwPO6J/e/dVyh96/Vz/gj0P8AjI3xN/2LNx/6Vw16teThByOWmuZ2PhT/AIZo/aJ/6Jr4j/8ABZPR/wAM0ftD/wDRNfEf/gsmr+0LC/3aNq187/ak+x6Cwx/FH4n+Bnxh8IaNP4k8VeB9Z0bS7TZ51xd2MkMK+a21Pn/3q8r47V/Vh/wU6GP2M/Hn/XXS/wD0vt6/lMya9zC4l1Y8zRyVafIJR0ooruOM3/DHhbxH4z1eDw/4S0u41rVJ/wDUWtlA80z/APAYq9P/AOGaP2jf+iZ+JP8AwWz/APxNfRX/AATS/wCTxPB4H/PK+/8ASNq/q7wK8nFY90J8ijc9CFHmVz+L/wD4Zq/aIxz8NPEP/gtm/wDiay9U/Z/+Onh/S73Wdb8Aa3p+n2UXnXFxcWMyJCv9538qv7WCBivl/wDbNH/GLPxTP/UvX/8A6LrijmspNLlNfqx/HQQenep0d4WVkchl79j7VXXhRS/WvecVNWZ5rSe5+ov7NH7Wa6wbf4efFK9Md9nyrLU5eBKP7lzn+L/ar9DR+9EhMXmnk4H8X4Gv5ra/Sz9lj9qdttn8OPiPef8ATLT9Qlb/AL5t7jP/AJBavj8wy5w/eUz57G4L7dM+lviH+y38IfiSJbq4046PqD9LrT/k+b/aX/UtXwV8Qv2Kfid4WLXnhFk8T2Efz/6P+6u0/wCAS/8AstfsEV2fL3GKWvFw+Y1ae541HMatLc/nH1bSNW0S+Om6tZS2Vyn3oriJkasev6JPFfgXwl46szYeLdItNXhA+T7RFv2H/Yf+Gvj7xz+wf4C1cvceBdTuNAmbpDc/6VAf/ay/+P19XQzmnLSWh79DM6U/i0Pycor6w8X/ALHfxp8LmW5s9NXXbZT9/T5d7f8AfEuJf0r5s1bQta0K4On6/p9xp9yv/LK4iaJ/x82vcpYmlPZnrQrU5fCzCowDUhAHajArouUR0dKKKWgw69aKkwKMCjQWxHRXY+FfBHi3xpfppfhTS7jVbk/wW8W/bn+9/dr7l+GH7Ces323Vvinf/Y4O2n2jh5m/35OYl/4DurkrYmFPVnPOvTjuz4l+H/w48X/EzWo/D3hHT2vbrq7dEiX+8zfw1+vvwG/Zq8MfBu3j1eZk1fxQyfvb1l+SD/Zt1/h/369r8JeDfCngfSI/D/hbS4tMskAzHDzv/wBt2/1zf8CrqBx0r4fH5rKfuo+axGZOacYknUlieT196M4oor5T4mfOLWR+eX7fHjb7Lovh/wAA2rnzLp31G4/3Iv3dt/7NX5eJX0D+0v48X4h/F3X9Ytp99lBL9jtPmz/osB2j/wBmavn/ALV+oZXR5KSP0XCUeSihKKKK986wooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCSiiitAP/1vxDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH1h+w74Og8c/tUfDPR7lN0EGqpqEi9/+JcjXH/oSrX9gY4Jr+W7/glTp6Xn7XWlXEiZ+y6Tqsv/AI4sX/s9f1Ijqa+KzObcz2cNsyWiiivIPQPwm/4LHfFKa3tvA/wdsn2pdG41u9VWxu8k/Zrb/wBrf981+Ema/Rn/AIKr+ILjWv2vtT0iVt8eh6Tpdovp+9X7T/7Wr85hX3eXU7UjxsRP3gooor1jzyOiiisgCiiimAV6T8I/H1/8LPid4X+IWnsVuND1G2u93+zE3zr/AN87vwrzqlJJGKyq0lKJ0Ut7n9zmmalb6tYWuoWpEkN3Ekit/sS81r9K+cv2TtduvEv7NPwx12+fzLq98P2Ejt/teSK+jj1r88qR5ZNH0FxK/LL/AIK2+EIvEX7MEXieOPFz4X1mzuRJjOxJt1s3/j0i1+ptfEv/AAUQ05NS/Y5+JcDpnyrS2lX/ALYXcEv/ALLW1CVqkWZVfhZ/JLyevNFGKK/QOh871P7SP2ev+SD/AA5/7F7Sv/SSOvax0Ga/n/8Ahx/wV00jwL4B8OeCZvhjdXzaBp1pY+d/bCp5vkIsW7/j2rvP+H0+hf8ARJbn/wAHcP8A8j18NVwVZy+E9qlVVrn7i0V+Gn/D6fRf+iS3f/g5h/8Akaj/AIfTaJ/0Si7/APB1D/8AI1JYOt2N/bQP3LwKTivxL8Lf8Fe5fGfiCw8K+GPgvqGpazq0qwWlrFrCO8rydP8Al2r9ifDNzrt7o1lda9YrpV/JEjXFqs/2pYpf4k83Yu//AHq5atKUdyoT5jrMCiiisEanPa7pFtrOjXmj3yLLbXsMkEqN91klXYa/iC8Q6amj6/qekRf6uxu7m3Un/pk7L/7LX9mfx0+KWgfBL4U+I/iX4kn8i20a0eRefnmn+7BCvq00m1a/jCvr651K+mv7rb591K8z7f70rbq+my2+p5eKtYz66bwd4Y1bxz4u0TwTokfmX+u3VtZQL6vO21f/AEKuYPAJr7m/4Jy6Db+I/wBr/wACxXi5TS2vNRC/7cFu+z/x56+grvkptnBRV5an9M/wR+EPhn4F/DXRfhx4RhRLLSIdrPs2tcXH/LaZ/wDakevbKKDX5zUm27s+giktgppHpVGe5hsoWuZ5FjhhXc7t/AtflZ4p/wCCu37O+i6vfaXoGi6/rsVlLJD9ritoYoJ/K/ji3zedt/34Uq6dOUvhG5WP1jwKMCvx0/4fKfBH/oS/EX/kp/8AHqP+HynwR/6EvxF/5Kf/AB6upYSr2M/bRP2LwK/KD/gsD/ybHpH/AGM1l/6TXFcn/wAPlPgh/wBCb4i/K0/+PV8bftvf8FA/hz+1B8IrT4eeFNA1XSrq21W21B5r3ytgWFJE/wCWUn/TSumjhaqmm0Y1KkXE/Juig4zRX2x4YV/YH+w5/wAmnfC3/sB2v/s1fx+V/YH+w5/yad8Lf+wHa/8As1eHmf8ADR6GH3PrWiiivjz1z+Vb/gqf/wAnk+JP+vHSf/SRK/PSv0K/4Kn/APJ5PiT/AK8dJ/8ASRK/PGvu8B/BR4GIjeRIh/8AQ/8Aeav64v2HfgInwC/Z68P+G76FYdf1dP7X1cbcf6XeLny/+2S7U/4DX4Jf8E5v2fX+OX7QOnatq1r53hnwV5eq35dfke4j/wCPS3z/ANNW+f8A3Uav6vNuOorxcxrXlyo78NTtqKRk/SlwOtLXnPxL8eaB8LvAevfEPxNMYNL0K0kupj6+V/D/ALzn5a8FHpN2Pxm/4K6/tCCBND/Z30K5/eNt1bWNr9E/5d4fx+Zv++a/Cbr06V6B8UfiFr/xc+I3iD4meJpvM1PX7p7uQf3P7iL6JCu1f+A15/X3GEoezjc8TFVb6ElfrB/wR6/5OP8AEn/Ys3P/AKWW9fk/X6w/8Eef+TkfEn/Ys3P/AKWW1dGM1oyZzYf40f0p0YFFFfnh9Efn1/wU9z/wxl44/wCuul/+l8NfymDpX9Wv/BTv/kzLxv8A9dNL/wDS+3r+Uqvscs/hs8zFBRRRXto8o+9/+CZn/J5fg8f9ML7/ANI2r+sGv5Pv+CZf/J4/g/8A64X/AP6SNX9YI6V8jmv8Y93D/CFfMX7Zg/4xY+Kf/Yv3/wD6Lr6dr5i/bM/5NY+KX/Yv3/8A6LrxqfxI6z+OcdBTKeOgplfokPhPmAoooq7cwj9Tf2Sf2lRr4tfhd4+uv9PT5NMvZn/1/pbN/tf88a/QOv5tLe4lt5lnjdkaMhldeqGv2X/Zc+PifFXw+PDniSbHirSYf3rd7u2/5+P97/nt/wB/q+EzLLuR88T5fMMHb95A+sOnAoz3oor5Kx8mFZ2paVpOrwPZ6tYw31pJ96K5gR0P/f6tGirTmthxnJbHgniD9mb4GeJNz3vhOC2mP8Vi72347IP3NePaz+wr8Lb7c2j6nqenH+BGljlH0/e19uUV2U8bWhsz0IZhWj1Pzruv+Cf2j5P2Lxjce3nWaH/2tVMf8E/7b+Pxkf8AgFjX6QUV1rM63c61m1XsfA+mfsDeCEcf2r4m1G79Uggii/nXtHhj9k34E+GykiaB/akydZdQneX/AMc/1NfSFFZTzCtLS5z1Mxqy6lDTdL0nR4FstGsYdPtEGFht4URFq95maWjArz3WnLc811pSeod896KKKy3JJK8c+PHxAX4dfC3XvESP5dy0P2W0x/z8zful/L/Wf8Br1+vy5/bs+If2/wAS6T8N7GffDo6faLpVPH2mX7i/gn/oVd2EwsqlRI9PAUvaVUj8/ZpJJXcSH8PWmGn9TnHWiv1eFNRikj9CS0RHRRRViCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAJKKKK0A/9f8Q2/1r0w9qe3+temHtX6YfLgetJSnrSUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRTGfpL/wSjvUtf2u7ON/+XvQ9TjT/wAdf/2Sv6jh0r+Q39gfxZF4P/a2+G+pSS+TBe3r6dJ6D7ZbtCn/AI8Vr+vOvi81j+8PcobElFFFeMdZ/K//AMFT9LfTf2wdau3TEesaZpdwp/7dvs3/ALJX519OK/cX/gsh8N5F1XwD8W7RAQ8Vzod03/XL/Sbb/wBCmr8Ovc195l1ROlY8Ov8AEFFFFeocZHRRRWYBRRRQBJRRXZfDXwRf/Ev4g+G/AGmL5lz4g1C1sk9/Nf5qznK0TopK5/Xd+yRo0ug/s1fDHSLpds9p4e05JB/2xr6VNc7oej2Wg6PZ6RZII7WyjWKNR0VIf/1V0RBzX55UlzTbPchsJXxd/wAFDr5NP/Y3+Jlw/O6xgh/7/wB3DF/7NX2jX5d/8FY/Ff8Awj/7Kc+gwviXxJrNjZbAedkW65P/AKJWqoq81YqWx/Md0HFNyaeeBzUdfop4FXcKMCij6UGCZJVvTNL1PWtTt9J0a3e+1C8mSG2t4U3vK8p+VVqC0tJrueC1tFeeed9iwou5mav6Sf8Agn7+wpafBXTbb4ufFazSbx/fJutbR/mTSIZf0+0S/wDLRv4f9X/erhxGMVNWR3U4cx1n7B37EGl/s4+HoPHPjyCO7+IuqQjzm++unRNz9nt/Rv8Ans//ALLX6d1CgzU3aviK1WU5czPXppJWCuc1nXdN8PaXd63rd2ljp1lC81xcTNsSJIvvM1adzcwWNu1xdusUESlmdm2Kqj3r+a7/AIKB/tzz/GnVJ/hD8KrnyfAelzFbq7Q7P7Ymj+n/AC6xf8s/+en+s/uVpQoyqytEmpUSPLf28P2y9Q/aZ8ap4c8LM9r8PdAlf7FC3yNfXDfKbu5/9op/c/3q/PrkUf5/Kg19/h8PGlFJHhVajnIkr7d/4J0eJrTwv+174Ee7ZUXUXu9O37v4ry2bZ/49tX/gVfEVaOha5qnhfXdP8R6LM9rqek3CXVpMpxsngfej/wDfVPEw54cqLpOzP7o6D0r5P/ZR/aW8MftOfC+z8X6XIkGsWqww6vY5+e1u+n/fEn3oq+sO1fmtSnyyse+Up1VkYTJlHXaynvX87f7WX/BLbx94U1PU/Gn7P8Y8RaDcM8z6Vgf2la8l9kH/AD8L/wCRf96v6LXj81Kk6celbUqzpvQznHmVj+E+/wBOvdKu5tP1SF7S6gcpNDMux0cdmSq/+eK/sG+Pf7HnwU/aK06VfG2hx22t7NkWs2f7m+i/7af8tf8Adl3rX4JftG/8E2fjb8FDc+IfCcbeOvC6/N9psov9MhTr/pFt/wCzLur6jD46L0keXUoSWx+c3Hainumylr3DkI6KKKZkFf2B/sOf8mnfC3/sB2v/ALNX8flf2BfsOf8AJp3wt/7Adr/7NXh5n/DR6OH3Praiiivjz1z+bX/gox+z78b/AIi/tS+IPFXgXwHrmu6PLaWESXdjYvNE0sNsnmDcPSvmr4af8E9v2pviVr0Gmt4LufC9k7L517rKCzSFc/e2f61/+AxV/W3UlepTxs4R5YnPOipO58ufs2fs5eEP2Z/hvb+B/Cn+m3ErJc319JGiTXl3/eb+6ufljX/lnX1GCe/FFFefObk7s0jHl2CvwK/4K0ftK295Jp/7Nvha6V3hZL/X2jf7rD/j2tc/+RJvbZX2h+3P+1J8XPgR4bl0/wCFngDU72W4i+bxG9t52nWfm/3UT70v/XXYv+9X8vusaxrHifWL7xH4hvX1HUtQleW5uZ3LPK8v3nfNergsNzy5jGc9Cl0oo6dKK+zR89MK/WH/AII8/wDJyPiT/sWbn/0stq/J6v1h/wCCPP8Aycj4k/7Fm5/9LLaubGfwJHTh/jP6U6KKK/PD6I/Pz/gp3/yZl43/AOummf8ApfbV/KVX9Wv/AAU7/wCTMvG//XTTP/S+2r+Uqvscs/hs8zFBUg6VHUg6V7aPKPvT/gmP/wAnkeD/APrhq3/pI9f1fr90fSv5QP8AgmP/AMnkeD/+uGrf+kjV/V+v3R9K+RzX+Me7h/hFr5i/bM/5NY+KX/Yv3/8A6Lr6dr5i/bM/5NY+KX/Yv3//AKLrxqfxI6z+OcdBTKeOgplfosfhPmAoooq1uIM8V1Pg3xVrngbxJZeKPDtw1pfWL74X/wDZW/2a5apKzq0vaaBurH9AHwo+JGk/FHwXp/izRtqGddlxb7sNbXP8af5/hr0ivxb/AGWPjKfhZ48Sx1afb4e1zZDd7vuxN/Dcf9sa/Z5pE2xujffr85zDD+zqH5/mWG9nO6JqKKK8Q8sKKKKACiiigAooooAKKKKLCCiiigZheJPEFj4V0DUfEWqtsstPt2u5G/65dK/n68b+K9Q8b+KtS8V6r893q1y87/8AxNfpF+3N8TTp2iWXwu0t/wDSNQxe323p9ni/1a/99fN/wGvyz/Wvt8qo295n22V0OSHOwooor6494KKKKQBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf/Q/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAbPh3Wr7wxrmn+KNIl8q/0i7t7i3b+68L70/9Br+134aeOdN+I/gHw/490Y7rLX9Ptr2H/tvHu21/ETgV/Rh/wSW+Oq+MPhTqXwV1WbOqeB5xNZK7ZL6VeNu/8gvu/wC+kr5/M6PMlNHpYWfvWZ+xFFGRRXyR6583ftR/Bay+P/wT8S/DaZo47q8i87TpW58m/h+a3f8A76/9Cr+PDxD4d1jwprd74Z1+0ew1TSbl7S8gm+9FcRNtdPzr+6DFfjF/wUa/YZvviTHdfHf4SWT3Hie0izrGmxrufUbWL/ltCv8Az8RL/wAs/wDlqv8A02/1ns5fX5JWZxVqd1c/nozmilaMqzRt8rxnFIPevt07q54t+5HRR060VBIUUUUASV+yX/BJX9nm58ReMtQ/aB1+226Z4dD2OleYv+tvpU/0h1/64r/48/8As18F/stfsveMf2nvHkGgaOJrPQbJo21bU2TKWdq38Kf3riX/AJZLX9Z/w6+Hnhn4W+D9N8CeDLJdP0fSokht417D+83+1x1r57MMWox5InpUKbS1PRuCOaWj60V8puekGa/ni/4LEfE06t8Q/B3wls5d6+HrVtTu1Hd7z5Ez/wAAT/x6v338R+ItG8J6FqHibX51tNN0u3lurqZz8sUMK73b8q/jM+O3xU1P43fFzxX8T9UDIPEV68sELnPlWw/d26/9s1216uXUnKpcwrVPdseRsaZTmptfbnhsKKK/ej/gnd+wW+lPYfH/AONenbL9dtzoOlSJ/wAe3/T3cr/z2/54x/8ALP7/APrvucmIrxpRNaVJyvY7f/gnl+wVH8Obez+N/wAYbHPi2dN2laZMn/ILXH+tZf8An4/9F/71fsqgxxSLGFAC8AdKkAr4arXdSV2e1Tp2QtFFfhl/wUc/bt/sr7d+z/8ABu/K6p89vr2p27/8e39+zt2H/Lb/AJ7f3Puf677qp03N2RpKXKrnnH/BRb9vOPxdJqHwG+D9+W0KAeTrepW7/wDH45/5dI2H/Lv/AM9ZP4/u1+L+c04nsKbX2+EwqpRPHqz5iOiiiu84wozmiigZ6t8HfjZ8RPgT4ytfG3w41N7C/h+SZW+a3uYB/wAsrhf41r+if9mr/gpX8G/jWLLw943uF8C+LpPl+z3UubG6b/p2uf8A2WTb/wACr+YKpK8mvhI1Hc7addxP7tjwMCm1/Jr+zZ/wUC+N/wCzzLa6H/aLeKvCS/8AMM1N2fyVz/y73P31/wBz7lfvx+zn+3J8EP2jY4dO8Pap/Y/idwd+j6gyRXm7/plztl/4DXytfBzp7noRrxkfaX1qN0ikBWRQUPXNPH4/jSivOaa6nSnc/Pf9p3/gn/8ACD9oKC58Q2tonhXxiynbqunx7fOb/p7g/wCW/wDvffr+cT49fs+fEz9nXxo3hL4g6aYWkJe0vY8tb3y/37dv/Zf4a/tD4r5r/aQ/Z78HftG/DTU/APiaFVeaPzdPvQuXs7z/AJZzJ/7U/vLXsYTGyg0mctShHc/jborpPFnhfV/BfifV/CGvQG11PRbu4sruL+48LeXXN19sneNzxZKwV/YF+w5/yaf8Lf8AsB2v/s1fx+1/YF+w5/yaf8Lf+wHa/wDs1eHmT9xHo4T4j62ooor5E9UKK/E79s3/AIKJ/F/9nr496p8MfBmkaNdaZZWtpMrXyTPLvnTzX/1LV8t/8Phv2jP+hd8N/wDfqb/5JrthhpzV0jnnWjE/pVpOa/AnwB/wWP1YahBB8UPAUL2chw8ujXTIyerGO4zu/wC/1fsv8HvjF4C+O3g618c/DjVI9S0y5+Viv34XH3opUP3GFRVoThq0VTqxkeusvmLtbp/OvzA/ao/4JvfCz42WV54n+HllD4M8b/M6zQpssr5z/Dcxj7v+9H/49X6hAUEe1Z06sqbvFmjSe5/Dx468EeKPhx4r1XwP40sm07WtJm8q4hbja4PX/aX/AG65Kv6Ff+CtX7Ptr4h+Htl8ftFhxq/hhorXU3RfmmsJX2qz4/54s3/j1fz1denSvtsFX9pFXPErU0mFfrD/AMEef+TkfEn/AGLNz/6WW1fk9X6vf8Ef3CftKeIo/wC94auf/SyGt8d/BkOgveP6VqKKK/PD2z8/P+CnX/JmXjf/AK6aX/6X29fylV/WJ/wUk0y61P8AYy+IiWfMluljcbf9mHUbeRv/AB2v5O6+xyx/u2eZigooor20eUfe/wDwTG/5PI8Hf9cdV/8ASNq/rAX7o+lfyr/8EuNMe/8A2v8Aw7dwplbDTtVuG9lMPk/+zV/VQOgr4/NHese7h/hFr5i/bM/5NY+KX/Yv3/8A6Lr6dr5c/bTcR/so/FV3/wChev8A/wBArx6fxI6mfx2joKZTx0FMr9Gj8J8yFFFFWtxBRRRSAK/Z39kv4pj4h/DePSNWk8zWvDf+izM/33tj/wAezf8Asv8AwGvxir6P/Zf+JDfDf4r6ZeXT7dM1N/sF3z8qpP8Adb/tm1ePmNFVIHn42gqlI/bmiiivzzlPzthRRRU2OQKKKKYgooooAKKKKBhWN4h1mx8MaNe6/q1x5VlYQvNK3+xHWzX53ftvfFoW8Fp8JtHkxJNsutUZD/3xb/8As3/fNduHoKpNI9PB4f2tRJnwV8UPHF/8SfGmreL9SPlyajNvVf8Ankn8Cf8AfNee9Klk5zUVfo9GnyQUT9NpxUIcoUUUV0CCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCSiiitAP/9H8Q2/1r0w9qe3+temHtX6YfLgetJSnrSUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRTAK9x/Z0+N2vfs9fF/QfifoYeb+z5tt3bo2PtlnLxcW/wD3z0/21WvDqKzqw9pHlNYT5Xc/uD8EeNfD3xG8I6X448KXS3uia1bpcW0yHh0lrtMAHFfzL/8ABOb9tcfA7xAnwi+Jdzs8C65ceZb3bN8ulXk38fP/AC7yf8tf7n3/APnpX9LsEyTxLPCyyRyKGVlP3vxr4CvQlSlys96FRSLvemkBgQRkHrS0uDXKan5dftb/APBNz4f/AB5mvfHPgJl8HeN5/nkdE/0G/f8A6eY/4W/6aJ/49X4L/F79lP48fAi7li+InhW7trVX2pqFqn2iwl/3biIf+Ottr+yw8VWmt4LhGjljWRH4ZW6H9K9Khjpw0OWdCMnc/hWK7ePvYqHv6V/ZX4r/AGUv2dvGs32rxT8O9Evpm+8xsY0Zj9VrjrP9hL9kaz/fWvws0ZW/2oXb/wBnr2Y5pFLVHL9UR/JBomg654r1K30fw3plxq99O22K3sommd2/3Iq/Uj9nP/glh8VvHtzaeI/jcz+CPDr/ADtYo+7VblP7pT/VW/8AwL5v9mv6GfCvw68C+Brb7L4O8P2Whwbduyyto4f/AEXXeVxVsxlLSOhpTw1jy74Z/CvwN8HPCVl4J+H2kxaRpFkvyRwry7f3pH6s/wDtNXp454p1FeHJ33O9JLoFFCV8TftfftYeFf2Wfh4+pOyXfi3U0dNH07f/AK1/+ezf9MIv/sacIylLliJnxJ/wVZ/afg0PQIP2cvCF1/xMNcC3OvPG+PKs/vQ2/GP9c3zTf9MV/wCmlfz/AJ9P/wBVb3i3xX4g8ceJdT8Y+KbxtQ1nVrh7m7mmxuleXmud/SvuMHh1ShrueLWqXYUVJX3p/wAE9P2abL9ob4yPJ4qg8/wr4Pji1DUYT9y6ff8A6Nbv/szMjN/uq1d1eap0+dmdNc259c/8E6f2DG8Qtp/7Qfxo0/GlhhJoGkzp/wAfP928uV/55/8APFf4vvf6nZ5n7/xxLHF5ceBg+nYVUtreG0hW3t1VI0XaqL/DWkBjivz3E4qVWR7cI8qsLRRXjfxd0z4r6r4D1TTvg5f6fo/ii6Qx299qPmGG23/el2Ism5x/DxXIjU/Nz/got+3U/wAJrC4+C/wk1Bf+E0vVKajewN/yC7eX+FP+niX/AMh1/Oo0r3DSSyuSzvud2+ev181L/gkJ+0Nq17d6rqvj7Qb66u5nmkmme8Z5nl+87t5f3qiH/BHH48jgeMvDf53f/wAj19XhZ0KSu2eXW55OyPyGor9eP+HOPx5H/M5eG/8Ayb/+R6k/4c5fHj/ocvDf/k3/API9ev8A2hR7nL7KR+QdFfr5/wAOcvjz/wBDl4Z/8m//AJHr8u/ij8PtS+FvxE8RfDnVbiK91Dw3eyWVxNFkRO8f8a//AK6qGMpzdokckuxw9FFfXn7L37G/jb9q5PEM3g3WNP0mLw09sk51EzfObzdt2eUsv9010VKqhHmYrM+RMGkr9df+HOXx5/6HHw3/AN9Xf/xml/4c5fHr/ocPDf8A33ef/Ga4vr1LubexkfkTsp1rLPazreWEzRXEbbkdW2Mje1frp/w5y+PX/Q3eHP8Av5ef/Gatwf8ABG342O/+k+NPD8C/7K3bf+yVMsZRfUfsZnJ/ssf8FOviR8NdR0/wr8bZ38XeEWdIft0r79RsE/vbv+XhYv8Aa+b/AGq/pYjdZUWSM/K+Olfit8KP+CPfhPQtcsta+K3jNvEtrbSpK2nWVn9milP9x7hppZiv+7sr9r1UAADgDtXyeLcHK8D1KaaWo4+gpKKK4kbM/kt/4KN6BD4d/bF8fW9pF5MF79gvP+B3lpCz/wDj26vhmvtX/goX4og8Vfti/Ea/tJMw2dxbaf8A8Ds7aOFv/Hkaviqv0XDX9jG58/V0kFf2B/sOf8mnfC3/ALAdr/7NX8flf2B/sOf8mnfC3/sB2v8A7NXk5n/DR24T4j61ooor5E9U/lY/4Kk/8nj+JP8Arx0r/wBJlr88iBmv0N/4Klf8nj+Jf+wdpX/pMtfneetfeYFfuUeBX+ITr1r9KP8Agl38aNV+HP7R9l4Ce6ZPD/jpGsp4H+4l5Em63k/3vl2f8Dr81692/Zkv5NK/aI+Gd/bnDw+IdKbP/bzitcVTUqTKpN8x/aARgAZ6Ghhweaj5YZPcA/nU5UmvzqZ7iPC/2h/CEPjz4HePvBzRCf8AtXQ76OJf+m/kMyMP+B7a/i9XoK/ukvQstrNDKMq6svtX8Lk8flySRofubq+nyqpvc87FLQK/Rn/glfrv9j/tcaZZkhV1nSr+3G5vvYXzuf8Av3X5yngE17L+zz8QT8J/jl4H+IcsnlwaFqdrNcf9exbybj/xxmr3sV71No5Ke6P7UKKpWF5a3tpBdW0nmRzruVv7w9au1+fM9w8++JPgjTfiL4D8Q/D/AFgZsdfsJ7KbP9ydPLr+Mn4mfDnxJ8JPHGtfDzxfC9rq2h3DxSq6/wCs/wCeckf+xMvz1/bxj2r4t/ae/Yw+FP7UdkknimObSfEVmuy01mz/AOPhE/uOrfLKn+z/AOg16eExTpu3Q46tLmR/IxUlfsBr/wDwRv8AjZb3znwr448PahZdVlvRd2cmP+ucaXf/AKNr2v4Qf8Ee9I07U7bWPjf4sTVYoG3f2Zo8bpBJn+/cy/Nt/wB2FK+g/tCked7B3KP/AASE+B+padY+KPjzrEHkw6sn9k6S7JjzUiffcXKf7O/an/AWr9165rQPD2ieF9GsfD3h2zj0/TNPjWG3t4l2xxRxfdVVrpa+Vr1vaz5j16UWo6hXxT/wUJ1620D9j74lz3LbTeaetknP8V5MkP8A7PX2tX47f8FgfiZHonwa8N/CyCbF74s1Pz5U9bPTv3hP/f5oaeHhzTSCq/dP50KKKK/QT54KKKKBBRR0ooAKkqOlBxQHkfvn8EvGf/CwPhN4c8SSPvunt0huG/6eYv3L/wDoNeqV8FfsFeJpbzwbr/hOeff/AGVdpdIv91bpcf8AoaV941+d4ugozsfmeYQdOvJElFR0Vx+zR45JRUdFHs0BJRUdFHs0BJRUdFHs0M4H4oeP9H+GvgvUfF2rfvFtk2QQ/wDPW5l5Ra/B7xZ4l1bxZ4kv/EWtTvPe6hM00sn+3LX03+1j8aW+JXi8+HdDkEmhaE7RQ7PuXNx/Hcf+yxV8h19bgMLaPMz9Ly3CezhzMaxyabRRX0Z7IUUUUCCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCSiiitAP/0vxDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBJX63fsK/8FF7v4TrZ/CD42XLXXgtf3VjqmGaXS+fuN/E1v/4+lfkbUlctehGrG0jWlV5T+4/Q/EWi+KNItdf8P3seoabex+db3FuyvDLGf4laukHTiv4/P2bv2yPi7+zJqKJ4Tuv7T8OO2640a9d3s29WT/ni3+0v/j1fv58Af+Ch/wAAPjhFbadc6r/whviSUbW0/V5VUPJ3+zXP+rkH/fP+7Xx1bCSps9mnVTP0IZuRig4B3VEh3DNSZyBXn2OoWlyaSikAUUUUAFFeXfEn4sfDj4TaLJr/AMRfElr4fso/+Wl0+1m/3V++3/Aa/FL9pn/grVd6jDdeFv2cdPbT1bKtr2op++/7dLf+H/em/wC/dddKhKo9DJ1Ej9Hv2rv22fh3+zBoslrM0Wu+Mbxf9C0eKbL4/v3H/PFK/lx+LHxZ8bfHDxzf/ED4gX7ahq982dx+VIUz8kVun8KR1xOsazrfiXVrnXPEt7NqmqXreZc3VzKzTzOf4neXNZfevqcJgvZ6s82rXvsGOcnk+p60UUV7CPPJK/eX/gjBPaf2T8VYB/x+faNGd/8Ac23eP/Zq/Bqvsn9iH9pNf2ZfjHH4j1hWfwvrUP2DV4kXeyJvylyv+3C3/ju6uTHxc6NkdVJpM/rrorj/AAN458KfEXw5Z+K/BWqQazo96u6G6t33xuPY12Ffnrp8rse4mrBSFVPUDmloo5RjdijoBTqKKAFyaMmkooAXJr+N79s//k674uf9jJeV/ZBX8b/7Z/8Aydd8XP8AsZLyvay7+IYVfhPmYdBX7yf8EXf+PD4pf9dtK/8AQZq/Bxegr94/+CLv/Hh8VP8Ar40v/wBAmr3cd/BZ5lD4j91smjJpKK+KPWCiiig0CiiikAV4l8evi1oPwN+E3iL4oeIh+40WCSSOI/8ALe5+7BD/ANtX2itT4q/F74dfBnw3P4u+Juv2+habF0aV/nlP92JPvs3+7X8yX7a37afif9qTxSmmaOsuj+ANIk3afZs/z3L/APP3cD+//wA8V/h/76rrw9CdSVkY1J20PinxJreqeJfEWoeJNYZptQ1e4e6uJGf77yt5jVj1DwSO9Or9Ape6jwZtt6hX9gf7Dn/Jp3wt/wCwHa/+zV/H5X9gX7Dv/Jpvwu/7Adt/7NXiZl/DR6GE3PraiiivkD1D+Vj/AIKlf8nj+Jf+wdpX/pMtfneetfoh/wAFSv8Ak8fxL/2DtK/9Jlr87z1r73A/wUeDX+IQ9K9g/Z4/5Lv8O/8AsYdK/wDSla8fPSvYf2eP+S7/AA8/7GHSv/Spa663wsdL4j+1Q/dFSCoz90VIK/NZHuFC5H+jTf7jmv4Xbr/j7m7ZZ6/uiuj/AKNN/uMa/hduv+PqbH/PV/yr38s+M8zFbFcDsak5pnen19bI8xH9M3/BND9p60+MvwjtPhlrtx/xWPgO2ht5Ff713p/3YJv+2f8Aq5P/ALKv1OHvX8QXw1+JXjL4QeM9N8ffDvUG03WdLbdHInCsn8aOn8STf3a/pj/ZU/4KE/Cb9oGysfD/AIjuofCXjhl2vY3cvlxXDf8ATpO/3/8Adb56+LxeFcXeK0Pbp1U1qfo1RSKQwBU5B70teQdYmBjGOKUKAeB7UUUDDFFFeOfF341fDH4JaA3ij4meIbbRbP8AhWV/31wR/BBH96Rv92kkB2vi3xXoHgfw5qHi/wAV3senaPpsL3F1czNtSKOPvX8h37V37QOpftI/GfVvHzo0WkRn7JpFq2f9HsYvu8f3pPvy/wC9Xsf7aP7cvi39p7UF8MaClxoHw+spN9vYs2Jb5+1xd7P/ACEn3Vr4HHHSvqsDhXFc8zya1W70I6KKK+jPNCiiigA60UUUAFKBmkqSgZ92fsFam8PxE8QaZvOy60zf9TE6/wDxdfqpX5EfsNb/APhb17s/6BM//odvX6718lmUHzn57ncf34UUUV4h8yFFFFMQUUUUAFfFf7XXx2HgnQX+H3hi4zrWtQ/6Syf8u1n/APFzf+g17x8Z/ixo3wi8KN4gvVWe/n+Sytf+etx6/wC7X4c+KfEWs+K9evPEOtXD3V7fS+dPK/8AE9etg8NeV5H1+VYJN89QwXbMhbPzfzqMnJ5o6nPej3r66J9yFFFFWAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf/9P8Q2/1r0w9qe3+temHtX6YfLgetJSnrSUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB9KfCn9rz9oj4LRRWfgPxpe2unwfdsbh/ttj/37uPN2f8AANtfffgf/gsV8VtPijtviD4J0rXkT781lO9i7f8AAJPOWvxwqSuGeEpS3R2wrySsf0J6R/wWW+GEq41n4e6xZ+vlXVpOn6+VW/N/wWN+BkSfuPB3iB3/ALuyBP8A2ev5zaHrkeX0i/rEj93vEv8AwWdsvJdfBnw0mknH3Xv79ET8fKSvjv4jf8FS/wBqbxwk9r4fv7DwTaTf9A+23y/9/wC587/x3bX5y1HW8MDSXQmWIkdJ4n8W+JvHGsz+IPGGr3utX833rm+naZ+f9uWubqStGx0nV9UVn0iyuL3y/vfZoHfZ/wB+q9BUoQRjfnM7rUdTGK4ile2uY2ikT5WVk2OhrQPhzxALT7fNpd0Lbbv85oX27f8Aeq0zJwM2iita70bVtOt47q/0+4toJPuTTQuqtVk2Mmlwa1rPQ9Y1JPM0/T7i6X+/DC7LU3/CJeK/+gLqP/gHL/8AE0ueHU0SfY634b/GD4o/CPU31P4ZeLL7w3PI3742UrIk/s6/6lv+BV9aad/wU7/bH01BbzeLbe9x3u9MtN5/78pDXw2/hXxRHE0z6JeoifM7vbSqv/oNZ9lpuoajcfZ9LtXu32b9kKM/9K46lCjN3aOuMprY/Qb/AIenfth/9B3Tf/BVFR/w9O/bD/6Dum/+CqKvg3/hE/F//QAvv/AKb/4mqt9out6ZAJ9U0uaxX1midF/8i4qPq1DsX7WZ9+f8PTv2w/8AoO6d/wCCqKpP+Hp37Yf/AEHdO/8ABVFX56WemXupyNHZWU1w6/f+zxO+ytb/AIRPxT/0Bb//AMBJv8KX1Wj/ACi9pPufev8Aw9O/bD/6Dunf+CqKj/h6d+2F/wBB3Tv/AAVRV+dsqSRym0njZZIv4X+VvxFNhtbm4lS3s42muH6LEm92p/VaP8pHtpdz9FP+Hp/7X/8A0HdO/wDBTF/jXwp488b+I/iN4w1bxz4rdLjVdcuWvrtkXajXEv8AsVz+oaRq+klF1Szlti3QXELJ/wCjaNP0/UdRuPI0u1nu5f7sUTv/AOiq0hQpRd4BKcpLUpe9fRXwN/ao+MH7OC62vwnv7fTjrr2xujcWyXe7yg23/Xf71eA3Nrd6fMbfUoGtpu8cyujfrVdXEkhjt0xn/ZrepSjKLTOem2mfoR/w9K/bH/6GPTv/AAWQ0f8AD0r9sj/oY9O/8FkNfBF74f1rT4HuNQ024t4lbb500LItVbKwu9Rk+z2cDzXH8KwJvZq4fqlHsdXtpn6Bf8PSf2yf+hi07/wWQ0f8PSf2yf8AoYtO/wDBZDXwr/wiPi0cf2LqP/gNL/8AE0f8Ij4tPH9i6j/4DS//ABNR9Wodh+1mfdMn/BUn9siWPB8Uacn+7p1pXn/iH/goL+2H4ngeK8+JF7bI+fksILSz6/7UK+ZXx5cWN1Bcm0uoXhuV/wCWMy7W/GrF/wCHdb05PtN/p89srcbpo3SpVCj2D2sy74l8VeJ/F+sPrvi7Vr7XNRm+9cajcvdzZ/3p6wetR/XtXXeGvBHjTxpI9v4P8P32uun3xp9rNef+iVrppqMWczcpbs5Wit7xD4T8UeFL37D4s0m90W5zjyr2BoHz/wBtqwa6+ZMTpsK+2PAH/BQ79qD4XeDNI8CeDdasYNF0K2S0tUlsYXdEGf4u9fIEOha5eWf2+DTruW0/57JC7p/31WUVxkHt+dYzpwqK0zWF4u5+h4/4Km/tj4/5GLTv/BVDR/w9N/bH/wChk07/AMFUNfAP9h6xHbf2hJp92lv/AM/BgfZ/31WFs75rlWDodjX2sj1P4ufF7xx8d/HNx8RPiJMlzrtzAsM0kMSxpsiXy0+SvNOnFamn6HrOqR79L0+4ul/vQws9VLiG6tJWguoTFJHwyOu1x9RXdTcYLlSOOom9StW54Z8S6x4O8S6V4t0SZYL/AEa4S6t3ZNwV4m81f1rKgjuLmVLeyhaWV/uxRJvdqu6hperaYyLqdlNZSP0W4iZP/RtJtMUbo+//APh6T+2F/wBDDp3/AIKYaP8Ah6T+2EP+Zh07/wAFMNfngPeisfqlH+UftZdz9Dj/AMFTP2wjx/wkGm/+CqGvzwdvMcyH+Ik0tGBW1PD04axRFSo5KzGHrSUUVoQKOtTRu8bfJJUFGBS0A+vvhX+3N+078HUg0/wz4zuL3Soj8thqf/ExgVP7qeb+9X/gEtf0t/snfFXxH8bPgF4T+J/i9YodY1q3aS4FojR2+4SMvyRs0lfxzV/Wv/wTs/5M6+G3/XnL/wClMlfNZjQhGPMj06Mm0fcI6UUUV8weqfhp/wAFFv21fjz8FPizH8KPhnqdvoen3GjWd692tskt9ulebd88v7tP9X/dr8O/F3jHxh4+1l/EHjnWr7XdUf713qEzzv8A+Ra/RT/grX/ydbD/ANi5pf8A6Muq/MI89a+1wWHi6XMzysRUknZBk+uf/rUUUV655gUUUUAFFFFABRRRQAUUUUAfe/7BOlG48d+ItaxlbTTlh/Gdl/8AiK/U2viP9hnwk+lfDXUvE0ybZNcv3RW/2LT5f/Qt1fblfNY9qUj88zmopVtA3/5x/wDXo3/5x/8AXo2f5z/9ajZ/nP8A9avHsfNBv/zj/wCvRv8A84/+vRs/zn/61Jsz/wDr/wDrU7AKXx/+quY8Y+M9E8A+G7zxV4lZILGyTJBPzM/8KqP7xq9r2vaN4X0W517XrhbexsV3TTP/AACvxe+Pnx81n4y+IMLus9BsWxZWobgY/ib/AGq6qFDmke5l+ClWnd/CjF+J/wASPFfxz8fpdXTEvdTJZ6fabvlhWVtqJX6k/DH9mj4ceANKtYdQ0y313Vto+0Xt5D5ys3pGk37tK/HTwJ4g/wCEX8Z6L4ikjMi6ZfWt069dwgfca/oSivLW/t47qCTdDIisrr/GlevXSpQtE+jzSfsaSUD5b+Mn7L/gXxz4fvX8NaXbaHr8ETNby2q7Y5ni/hdYv/Qq/GmeFop2hcbXRirr/dI61/R9nHI/D8a/Dn9pbwh/whnxi8RaVap5dtdz/bYMD+C7+fiqwdVtcrJyXFSqxlCbPAelFFFeyfVhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUASUUUVoB//U/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRnNFFABRRRQBJX7zf8EXv+QF8V/wDr60v/ANAua/Bmv3n/AOCLv/IC+K//AF96X/6Bc15uYfwjuw61PyR/aj/5OZ+KX/Yx3/8A6Umv6ef2frPwprH7Inwq8KeM/Km0/wASeEdH094Jvu3HnadH+7/74r+Yb9qT/k5n4p/9jHf/APpTX7tfFHWdY8Mf8Exvh/448Pz/AGXU/CugeD9VtZP7stn9k2V5mLk/ZwOyj8bPwl/aW+B2pfs7fGfX/hfqIaaGyl87Trhl/wCPmwl+e2b/AL5+Wb/aVq/bz/gqjj/hjnwr765pH/pJcVwv7bXg7w7+11+yn4a/as+HVt5mqeG7YXlzCBvY2Yb/AEuGT/r0fc3/AH1Xaf8ABU27S/8A2MPB14g3LdazorLj/prZXdYzrubhciMbXPzp/Y6/b9g/ZP8AAGr+Cp/BM3iifVtTfUfM/tH7Ht/0eNdn/HtN/cr94P2dP2kk/aF+Bsnxni0A6FGj3yfZGn8/H2Q/89NkP+tr+QbkfhX9LX/BOX/kw+5/67+IP/Zq2x1KKfMiqa3Pkz4if8FeLTxz4J8R+Bf+FXPY/wBv6feaf9oOtK/k/bLZk37PsPzferyr/gkAvk/tH61F/c8N3J/8mYa/K2X/AF3/AAI1+rf/AASE/wCTk9cP/Uu3P/pTb1s6Kp0G0HPzOx99/tQ/8FK4f2bfi/qHwqk+HTeITaW9pP8Aak1RbXf9sXeF2fZ5f/Qq/NX9sH/goJF+1P8ADG0+HR8Cv4b+zalb6kLptT+1bvKjZNhT7ND/AM9v/Ha/UT9pbwZ/wTt1n4rXt/8AtD6tZWvjh4bVbpZtSvbZ/LiX/R/3cT+V9yvxj/bY8NfsvaD4s8OW/wCyve293pU9kx1F7S8mvP8ASd/yf8fD/L8tcmDUZSTsKbdj7K/4I0cfEf4j/wDYKtP/AEpavoT9oD/gqRe/A/41eJPhf/wrpdat/DVwkP2v+0jC8/yq/wDz7TbfvV8+f8EZQR8RviMD20m06/8AXy/pX038cf8AgmFoHxx+NPiL4nap8SptP/t2dJm06GwR3iTYq7PM+0/7P/PKsK9vbu5ME1HQ1Pi/4L+DX7dH7JeofG/QNBTSfEMWn3d/aXflRrfwXmmmQvaXE38Sy7dn/At9fj5/wTvbP7Zfw4bH3bi7/wDTdcV+vH7SnxW+DX7EX7Mt7+zl4GumuPE15pU9hZWBcSXiRaj5iNe3Ljp95v8AgX3V21+Q/wDwTx5/bF+GnvdXn/pBNXXSlL2cktjOoj90/wDgoD8AdO/aO+DGqQeG0W48a+AWOpWKI/zn5N01tn/pqn/jyrX5Kf8ABKJtn7VrD+9ol9/6EtfqR8TvjjZ/A39v/wAN+Htcn8rw/wDEzw3aWVwW+7Ffw3cyWkv/ALJ/20/2a8p8BfASL4B/8FJodT0SH7P4b+Iuianf6cirtSK4i2vew/8AAG2yf7s1ctKvy0nB9TWVPRWPze/4Kkf8nieJ/wDry0v/ANJErl/+Cdvwqk+KH7VXhYXEPm6b4XZ9buNyf8+f/Ht/5Mbf++a6z/gqPk/tleJ/+vDSf/SRa+8/+CRnw6j8K/C/xt8btUt3kk1WX7FbBU3OLPTl3ybP+urv/wCO16rq2wkTJfFY+2/jCnhz9qb4UfG/4J6Enm6n4bZ9M5/5/wCK2hvbZv8Av98n/Aa/ml/Zl+Nf/DN/xq0f4q3OiPr39ireQtZ+f9m3+bbvbf6zZL/qt/8Azxr9c/8Agm9qPxpsvjp8Ubj4n+E9X0m38fefrP2i+tHgiS8iud23dt/uzf8AjtfmH+3F8Mv+FT/tM+OPDFtGIbK8uzq1kvpBqPz4/wC+91cGGleTps0l3P2+/ZI/4KGRftT/ABOuPhzH4Dfw28GnPqH2r+0vtWfKdV2bPs8P96sz9qn/AIKQw/sx/Fu6+E7eAX8SS2tpBdfav7W+x7/PXcF2/ZpjxX5yf8Eis/8ADUl7/wBi7ef+h29cj/wVU/5PA1P/ALBGlf8AoArP6tH2/J0KsuXmPnn4y/GOH9oH9om6+LiaR/Yia/qOnt9haf7T5PlJDbfe2xb/APVbv9V/FX7b/wDBYPj9mnQ/fxNZ/wDpPNX86XhP/katG/6/rb/0Ov6LP+Cwf/JtOg/9jNZ/+k81dVeHs6kEiaeqZ+Q37C/7M9v+0x8aItD8QecnhfQoP7Q1d0+R5U3+Uttv/h85/wDx3fX7BftI/tw/C79iq/s/gr8MPB0Wo6nZW6PJZ2zpY2GnJL/q1k2rlmZfm/75+evC/wDgjDaWn2H4pXkn/H68+lK/+5tuP/sq/Lz9sy61S+/an+Kct2zGZPEF4o/3IPkXFLl9rW5JDh8Lkfux8DP2gvgl/wAFD/Bes/Dj4heFlh1TTo99xp90/nfu5PljubSfG5W3H/gNfgP+0t8EdT/Z4+M2u/C++Z7iCwk+0WN267ftNnOPMtmx/wCOzf7atX0l/wAEu57iH9r3w7aLu2XWm6osqf3l+zcfrXr/APwWCtLCL9oTwveQ8XUvh5TJ7iK5udv/ALNW1Feyr8kSlZq5+oX/AATxurO0/Yt8Bf2xKqWrfa4+fu/vtQkRV/76bbX4Oftx/s7N+zr8ddX0LSYGj8L61u1HR2P3Bby4323/AGxb5P8Ad2V+uHwZtri7/wCCS9/JFK8M9l4c127hdPvq9nc3NynP+8orm/iRZWH/AAUR/YZsvHWiRo3xA8Ho8roow/8AaFomLu27fLdJ88X+15dcEK3JXbIlDsdj8ex/xqtteMf8U7on/o63r+bev6O/jXexaj/wSf06+g/1cvh3QyMnP/Lxb1+EfwA+HU3xf+NHg/4aKm9Nd1C3S4/69ov3tz/44jV6eFlpJ+phONrM/op/ZQj0j9ln9lL4VweJ4fIu/Heq2a3H8Oy68QSf6P8A9+4/KSvy0/4Ku/CxPBP7Q1v45tIdtj43sUuHOPk+2Wf+j3H/AI75NfZ3/BU2y+Ketr8OPBnwo8N6nqFtok0mstNp9nNMkU8G1bdf3Xf/AFjV1n/BRnwbffGX9jzw38Yp9Oks9V8Nix1Wa3lTbPbQajGsV3Ht/vxu8Z/4DXl0qrjUv3NHC8T8dv2Ff+Tvfhjjp/aif+gNX6Cf8FnePF3ww/69b/8A9GRV+fn7DGP+GvvheQSR/aqc/wDAG61+gf8AwWe/5G74Yf8AXrqH/oyKu+q39ZViqa/d6n4nHqaSnN94/Wm19Ajy2FFFFAgooooAKKKKBhX9bH/BOn/kzr4b/wDXnL/6UyV/JPX9bH/BOn/kzr4b/wDXnL/6UyV4mZ/w0elh9z7gooor489Vn8w3/BW3/k6uE/8AUt6X/wClN3X5gV+n/wDwVt/5Oqh/7FvS/wD0pu6/MCv0DC/wYni4n4gooorrOEKKKKACiiigAooooAKv6Tpt3rOpW2lacnn3N3MkMa/3mlqhX3v+xZ8JjqutT/E/WIP9B0hvs9iWXO682/O4/wCuK/8AoVctWpymFetGlTcpH6P+AfCVn4D8G6J4QsgNmlWixuw/jf8Aif8A76rrcioMn1zS5NfK1qjlK5+P16zqTcmT0VXorM5ixWL4j8RaL4S0W68Q+IbpbOws13Syt/DWB448d+GPh7oM3iTxXdpbWqD5UH3pm/uKn8b1+O3xv+P/AIg+M+r/AOkAadoNuxNrp0Z+RP8Aab+81dVKi5s+gy7LJ1pc0tjof2g/2gdX+MGr/YLDfZ+GrFz5FsCcysOtxIP73/oNfL5Az1pmaK+npUFTifpNGlGlHlihxPav3F/Zl8VHxf8ABbw9fSMHkso/7Pk9d9p+75+sfl1+HFfor+wb4v23fiLwJcN/rlXUYs+sB2Pz+K1x4qF0eZm1D2tA/S+vzj/b18Ih/wDhHPHlshyN2n3Hr/fT8v3lfoxnua8N/aO8JDxp8H/EGlxg/abSD+0bcju1p85rx6MuWR8Tl9b2VZH4Y0UUV9WfqAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf/9X8Q2/1r0w9qe3+temHtX6YfLgetJSnrSUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBKOtfvL/wRdOPD/wAV8/8AP1pP/oFzX4M17z8Hv2kvjd8A4tTtvhB4kbQINXZJLrbbWk/mvF93/j5jm2ferjxdF1YWRvCbSD9qT/k5n4p/9jHf/wDpTX7lfGvn/gkhpX/YleG//bWv53vFHifXfGfiHUvF/ie8a/1XV7h7i7nZVTzZ5fvP+6r2bV/2sfj34g+FifBDVfFLzeC4LWLT00/7HYp/otnt8td32fzv4V/5bVw1MPKUYrsddKorn3Z/wS4+P1po/ifVf2a/HEizeH/Gys9gtx86fb9m2eH/ALeE/wDHlr7C/wCCqmi2nhT9j3wr4U0vP2XSdf0e1h3MXby4LS7VPxwtfztaFq+q+HNa0/xFo1y1nqGnXCXdvcL96KeFtyN/31X0B8WP2uf2hvjf4di8GfFLxadd0WK4W6SFrO0h/wBJiVkR99tbwzfxNWLwb9pGRTrI+aue9f0w/wDBOLn9g+5/6+PEP82r+aL/AD/nNfSvw6/a9/aJ+E3gsfDfwB4rOj+HN1wz2iWdjL/x+ff+ea3mmrvxeHdRLlM6VVJnzU/M/wDwJ6/Vf/gkAcftG64f+pbuf/Sm3r8pycyE/U/nXqHwk+NPxP8Agb4km8WfCrWW0HVri3e2eVIYZ90ef7tyssf8PpV1KfNT5DKnUSlqfsH+3P8AsI/tDfHf9ofVviN8O7Oxm0e+tLGFWuL5Yn3Qp5L/ACV+eHxq/Ya/aB+BHgqX4g/ESysIdIguLa0dre+Sd90z7U+XjvW3/wAPIP20P+ijSf8Agt0n/wCQa89+KP7Yn7R3xn8JTeBfif4vbWtDnmSWS1axsIA7xfc+e2t4Zq4aWHq0tjV1Ys/QP/gjQNvxH+Iw9NKs/wD0pevA/wBof42eIPgZ/wAFFPFHxI0d3b+xdWtvNtN7bbizlhVbmL/tqtfIfwj+PfxZ+BOpX+rfCfX38P3WrxJHcskEM+5If+vlZa4n4heNvFHxK8W6l438Z6gdU13Vn3XE5iRPNfb/AHYf3VJ4Wbm5MpVUlY/f7/gof8GND/aV/Z80n9or4Zompah4esf7RSSEHfeaLMvmOn/bL7//AAF6/Jv/AIJ5f8nj/DT/AK+rz/0gmrkPhv8AtjftK/CrwdD8O/A/jFtN8PWzS+XZtaWV0qCXlkzc283yf7P+9Xj3gf4j+Lvhr4z074g+Bb4aZ4i0uZ5re6WCF/KeZWRvkmTyfus3/LGtKWGnGnKLFOaex+n3/BYszR/H3wPJbSvDJF4Z+9G+xv8Aj7m4Ffph+xl8W9B/ag+EfhLxt4gX7R43+HFw9ldOuA/2r7M9uZj/ALN1bt/31/u1/Nh8Wvjl8Tvjjrlj4j+LGuHXtQsrb7DFM0EMW223btv+jJF/E71b+Dvx7+LXwF1O+1f4TeI20K51KFIrjbDDOsqRPvX5blJoq5ZYO1NLqX7ay0PqL/gqFHLN+2d4kggDSO9no6IqffZ/siV+vfjrxwf2Bf2H/CkOlafBe65psNjp0Vvc8Qy395/pN2ziP+Hd5zV/Ov4v+M/xH8f/ABGh+LnjbWm1PxZDNaTLfNBEnz2ePs3yQr5P8H/PGuq+MP7UXxz+O2mWWifFXxS2v6fp0zT20YtbSDY5Xyt3+jQw7v8AgVavDtwhG5kqivc/Rj4f/wDBW74q6p438P6J4w8KaFYaFqOoWdve3Vot35kEE7KrOuX+9trvf+CyPwtF5Y+A/jNpoAeB30W9b/Zl/wBItz/45NX4TInc/wD6q+m/H37YX7RHxS8EH4afEDxY2seHSYt1pLYWS/8AHr9354rfzf4P+e1WsHyTjOI+e6Pqb/gkXx+1HejOf+KdvP8A0O3rmv8Agq1/yd9qf/YH0r/0Cviv4WfGP4j/AAS8UyeMPhfq39g6s9u0DXCQQz/upfvJtuVmFHxP+Knj740+L5vHHxO1X+2tZmhSF7l4YYMLD91dsKxR10zw8vb+0B1Lw5Tj/CX/ACNejf8AX9bf+jK/ou/4LB/8m1aB/wBjNZ/+iJq/nEs7u4027gv7Q+XNCysj/wB1o+/8q+hfip+1d+0B8cfD0HhH4q+LjrukWt0t4kDWdpBsuYkZFbfaW8M38VZ16Mp1IyRnRqJaM+i/+CZv7QmkfBL42XfhzxZdLZ+H/HcaWE8kjbEt7yB/9Ed/9n5mj/7aV9oft2/8E7viD8UviXdfGD4Jpa38uuBG1HTppVtnNxEu37SrN8r7vl+WvwVkj3YBOf8A639a+v8A4W/t6ftQfCHR4fDfhjxa11pFquyGz1GGO+SJeyo0v71V/wBnzairhqil7SB0RqLY/XX9g79ivWv2YJtb+Mnxru7O11g2r28USSq8Wn2f+tnaSf8AvfLX48ftq/HSz/aE/aH8Q+NNHfzNCtEXTNMf+9aWe/5/+2zMze26sb4yftkftFfHXTBonxC8VSS6Vu3vZWkSWMT8fxLD97/gVfMw9u9TRoTc+eQp1IpJJn9J3wEP/GprVwOP+KQ8Vf8At3X5pf8ABNH9o0/BT40weDNen8rwr462Wk29tkdtff8ALpN/6Ekn/XT/AKZ1846N+1x+0F4f+Fr/AAR0PxW1t4LltbuwbT/slk/+i3e/zl3/AGbzv42/5a188RlozFIh2vHjJHUfTFJYH4mw5z+ov9uzwlo3gL9hHxr4a8Pw/ZtNsvs/kw/880lvo32f+PV+dX/BIL4VjXvip4o+LWowDyvCtklpaOf+fvUev/kNG/77r4o8b/tmftKfEvwVN8NfG/jJtV8P30dvDLavaWKb0iZGT54bbzfvp/z1rB+EX7VXx++BWg3PhX4VeKm8O6ZfXJvZoUsbGfzLnYqbi9xbzS/cRc1lDDVVBwHzo/UH44/8FWviX4A+L/jDwL4I8MaJqGj6BqF1Y29xd/aXeX7H8kj/ALltv3lavs39lr48P+3J8APGum/EHT7XT7ydrvRr63slbyltry3G1wJm+98zf981/Ldf3d7dzzX127T3dw7zTSN1d5K9t+EP7Rnxm+A/9pn4UeJG8PLq4tzdlbaGbd5PC/8AHyk3970p/U1y+7ujNVker/sg+FtW8H/tt+BPC2rps1HRvEjWFwg/gaz3RNn/AL5r9dP+Ckf7J3xk/aV1/wAEal8K7W1uItBt7yO4N3drbf69kfP/AI7X4P23xh+Lc/xXb42WeqNN48e6/tE6hFbQ73uf9Vu+z7Ps/wD5Br6xsP20v+CjGp8WHiLWLsf7OhWZ/wDbGnPDVOZSiNV4JbnG/Ev/AIJ6/tK/CzwRrHxE8ZWGmQaLoMBuLpre/WV9gbHypXw9nNfpL4r+Jn/BRb4u+DtU8EeL7i+1HQddh8m6t7iw06zLJ/vlIZq8G039jT46ahjzNLtbP/r4vI//AGia9GlKa+M4Z16Pc+U6K+59O/YV+JRx/a+s6VZeuxnmx/37hrs9N/YInyP7R8ZofXybP/469dPtI9zy54/DreR+ctFfqTbfsC+C0hJbxTqEsndvsyr/AFr5K+NH7NXjP4QyPqfOraBu2R6hbpwvp9pX+Cs/bxvYqjjaFWXLGR810UGjp1rpO8K/rY/4J2f8mc/Db/rzl/8ASmSv5J6+2vhV/wAFB/2lPg/4F0v4d+DNS06DRdFRltkuLBZnVd2/7/8AwKvJxlGVSNonZh6ltGf1vUV/LR/w9X/a+/6Cuj/+Clf/AIqj/h6v+19/0FdH/wDBSv8A8XXhLLqp6DxETe/4K2/8nVwj/qXNL/8ASm7r8wK9h+N3xz8f/tBeMR4++JM1vNqyWtvaI1pB5CeREX2fJ/20avHq+ow8XCmos8+rNSdwooorrOMKKKKACiiigAo5pcE11ng3wb4j8eeILXwx4YtXutQujtVP7v8AtP8A7NK4m7HT/Cf4Xa18V/GFr4W0lGjDfPdXHVLa3/jd6/cjwr4X0bwZ4d0/wpoMHlafp0PlRjOd3+23+1XnPwR+Dui/BrwnHpVjtm1S7Aa/uh0kfrj/AHK9mJNeDiK13ZH5xm2Y+0fJDYjxjj0ooqCeeC0glu7tlgggTc80zbUVa4rHySjJ7FuvDvjF8d/CXwhsW+3T/btalTdb6dE3zf77/wB1a+dPjT+2NZ6X53h/4TSedOcrNqMi/Kn/AF7JL0/3mr80dX1rVNbvptT1Kd7m5uH3ySStuZm/2jXVRocyuz7bLsocveqnefFD4reKvinrsmteIrrzO0MS/wCqgT+6gry9V28ty38qdk0V7lKlGJ93ThCEeWAUUUVuaBXuf7O3jE+B/i/4c1Utsgnufs8p/wBi6/dYP4mvEK3fDWg6/wCJdctdF8OWT3upXTbYoYV+fdXPV+EitFOnys/oazuC85xxkd6Y9nbXEUlrdpugkUqyHoynqKy/DK6z/YOnr4iCjU4rZftW196fadnzf+PVscnrXzsz8Vqvkqn4C/FDwq3gjx7rvhaUf8g+7aFf9z+H/wAdrz2vuP8Abl8J/wBl/EbTvFCJtTX7TLf79p+7/wDQNlfDlfRUKnNE/YcHUVSjGQUUUVudgUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUASUUUVoB//W/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAfWiiigAooopgFFFFIAwKKKKACiiimBJRUdFAxxPavuf8AY8+Cfh/xvJqHjzxhaLqFrpsv2e0tJk/dT3H32Zv+uXyfLXw1X61/sN/8kf1D/sM3X/pMtYVXaJ5uOrypUXKO59bNomi3GmjSrvTLaSyT5fszwJ5P/fFflX+1v8FNF+GuuWXiHwnEbfRdc3f6PjC21zF/Cv8As1+tPf8AGvhH9vH/AJErwr/1+3P/AKDXmwqPmPisqxdWVazZ+W9HSgUV7CP0YMZooooGR+1HSiigQuT1zSe9FFFwuHfNFexfD/4F/Ef4luknhvSG+zv/AMvdx+6i/wC+q+7vh9+w54R0nyr34h6g+r3K9bS2Jis1P+//AKx6y9oo7HHWxtGn8TPzP8O+F/Efiu9Gl+HdPn1G4c/6m3i3mvtD4f8A7Dni/WI4rzx1fJoURwfs8Q+2Xn6fuUr9LPDXhXw54P08aR4Z0y30y2XHy28Ww8f+hVuDiuSVZs+TxWfSWlI+KLX9hb4XRSAX2p6pe/ULFmu1tP2OvgRa4J0u7ucf8/F6z/8AomvqPJ9aMmsfas8T+2MR3PFtN/Zx+BmnxoLbwfZMw7zF5/8A0c1dxp/w1+G2j7X0nwvplvIv8S2cP/xNdhRWXtJXOOWOxM/tECQWtoPLtYUhHoibatxg45L1AFJHBz9Kiaa2t/8AXzrH/vPtpOUzjqYirLcuMo9MUm0Vy97468GaZ/yEfEGm2v8A13uVrh9Q+Pfwc03mfxbZyY/54sJf/RNK8uo1SrT2R67ShOa+cb39rb4J2edusvdY/wCeNpP/AO1lrhL79uD4UQ5+zWWq3L+0MaL/AOhioszeGX4me0T7UU4AGap3ltBf2s1neQLPBKu10dN6stfNfwq/ak+HvxQ1JtBYNo+pn/j3huXXZc/7rf3/APZr6Qz6dKhRe5jVw1ai7zifnJ8ff2QDbG58X/CiFng+9caWnLxg/wDPv6/7tfnnNDJDLJHNE6Mh+ZWH3fav6K8Y4r5j+N/7Mvhr4qQT61ou3SvEwB/fqny3IP8Az8r/AOz13Ua/I7M+vy7OtoVj8Y+Oo6VJ2I9a63xn4G8UeAdbm8P+K9PewvYv4G+66/3lb+Ja5KvUjJM+5jNNXRHRRRVFXCiiikIKKKKACiiigAoor6f+Cv7MXi/4qMus6ju0Xw5/z9TJ88//AF7r/F/vfdpEznGCvI8j+HPw18WfFLXofDvhS3a4mf8A1srf6mBB/EzV+x/wX+Cfhn4N6CbbS1F7q9yv+m6g6fNLn+Ff7q/7Ndn4D+Hvhj4d+H4vDnhC0WytUGXf/lrO3953/irsxkcV5VWr0R+fZlms6j5Kewbs1IOleI/EP9oX4Y/DmN4NR1L+0NQT/l0stszbv9v+7X53fFP9rn4geODLpnh6Q+HNKfP7u1f964/2pP8A9mvPhScjy8JllXEas/QH4pftG/Dz4XQtbXVz/amrL92ytR8//A5P4P8A0Kvy6+LP7Qnj74t3H2fV7gWekb/ksrZsRLk/xf3mrwySWR382XLu5/n3qLp0r2qVHktqfoOCyynh466skYgjC8YqLJPymkLZ+7Sjiuw9awUUUUAFFFfQfwP/AGf/ABX8YdQWSAGw0C3b/SNQdP8Axxf7zUmwqVIwjzSOH+HPwx8V/FbXk0Dwra+dJ1nkb/VQp/ed6/YT4PfBXwf8G9IMGkRi91WVQLrUZk+aX1VP7if7Fdn4H8B+Gvhvodv4b8LW6QWq53nPzTv/AH3b+KuzIAO09q8ytVvofm+PzeVT3IbDxk8jvzReXtpYW8t5eOkUMS7mZn2IlYfijxP4f8F6HL4j8SXq2Wn2/Vj/AB/7K/3mr8kPj1+0pr/xUuJNE0dn0zw5G3y2wc758dHf/wCJrijT5jhweX1MRPmkO/aq+MGlfFLxnbxeHX8/StEheG3m2bfNaX7z/wC7XyhSk5pK9ilBwR+oUaSpQUIhRRRXSbBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBJRRRWgH/1/xDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUwJK/Uz9hTW7Cb4e694bRv9OttQ+1sn+xKiwo3/fStX5Z16p8G/ibqXwr8c2Ximw3PAny3UA4E1v8AxLUVY3icGNo+0oSij94hzivIvjp8K7L4teAL7w/8i6pCTd2UhHK3EX8A/wBmavR9H1fTNb0y01zRplubK+hSa3df40k71qDivISsfklGvUw9Y/na1PTrvSNQuNMvoXhurZmjljf76NH1/Ksyv0a/bQ+Cxhu/+FteGoMRTHZqSp/C/wBxLj6Gvzl/WvTp1NLM/YMHWjXpqSCiiuz8KeAvF3ji+/s7wjpNxqc//Tuu9V/4F/DWl7nVJqO5xnarkEV3dyLb2sTzTt9xEXczV9//AA4/YWv73bqHxL1VLCAY/wBC0755/wDgTTfd/wCA7q+6vBPwn+Hnw3iQeEdIhtJIxzclC94/v9pqHM8DF5tQo6LU/L74efse/FXxisN7rccfhmwb5t18MSn/AHbfr/31tr7v+Hn7K3wk8Bsl5JZNr1+mP9I1D50/4An+p/nX0jwf/r0fSuVyPjMRndarpHQfEI4Ilgt41SJPuonybcUtQOyQxSTXEixxr95pH+RK+dvH37U3wr8DI8Fve/25fr8vkWXzov8Avv8A6mubU8elSr15WifSFeeeO/iv8PPhzE3/AAl+tQ203/PunzzP/wABhr8xfiF+158SfGPmWGhyr4c09/8AljZ/65v964I86vla8u7vUJnuLtmeRuWZm+9WkKLkfV4XIm9ax+jviH9vPSkuJI/DvhJrmD+Ca8uir/8AfMK/+1a861D9u/x5Pn+z9B0y2/3vOf8A9nr4Vo69a6PYo+lp5Zho/ZPrbUv20PjPe/8AHvc2Vl/1ws0/9q5ri9Q/ac+OWoZ3eLLyLP8Az77If/RNfPtFa+xid6wuHS0iel3/AMYvihqhP27xTqM/+9dSf1rir7XdY1Ft9/fPck/89H3/AK1k0U/ZxN40KUdok3nP3OPoKPNc/wAX6VDRWns0XZdhdzE8mnA0yjOKOVFEnmSI+9W2sv3Wr9AvgH+17d6Z9m8I/FR2urH7kWpZ3SRD/p4/vr/tV+fPXg0VjUp82xzVqEKsOWSP6L9M1Cz1Swg1PT7hLm1uk3QzQtvRk/vK3pVkH05/rX4n/Bb9oTxX8JLtbJHfUNAmb99p0rcD/aT+41frt8PviJ4S+JmhjXfCV0s0B4mhztmtnP8AA6VwzoH5jmOVSoPmjsM+I/wy8H/FHQ30XxTZLPn/AFNwo2S2zf7LV+RPxs/Z88XfCO+eWZG1DQnbFvfxJ8n+6391q/bPr05qhqWnWOr2E2l6rAlzbXC7JYZk3I6/7VOlzReosBms6D5ZbH861GDX358ff2QbzRDc+LfhfC99pg+abTh889t/u/30/wBn79fA5V0fmvUufplDEU60bwZHRRRVHYFFFFAhR1ruPBvw+8ZfEPWBofg3TJNSuf49n3Y/95/4a2vAw+FWmn7f49/tHV/+nKxVIlb/AH7mX/2X/vqvpdP2zE8MacNI+GXgex0HTx93zH8z/wBE+TSqbKxE5Sj8Kue9fB/9jzwz4QWDWfiEya7q8eGS3T/jxi/H/l4r6t8ReOPBvge0i/4STVrPSVQYEMkvzH/gNfjx4u/ac+MXiwPHdeIGs4ZOPJs9kHH/AGxrwS91C+vZmuLqZpZ35dnb+feuVwlI+dqZdVru9SR+pvjr9t/wRpAnsvBFhNrsg+7LPmzhH/tavijx/wDtMfFb4hu9tf6m2m2Eh5tdP/cRY/2v+Wr/APA5K+eyxJ5OaSqhQX2juoZdRo7R1JWmlY5zz/n0pMmo6K3cVsj1eVdCTJDZph60lFMtMKKKKBByaKsW9tcXUqW1sjO8jbFVP4m7V+lP7PX7JEOni18Z/FOBJpxta20t/uJ/t3P/AMTSbOSviIUY80zyP9n/APZY1b4heT4w8eRtp/h7/WQxfcnv/X/dj/2/+/Nfqno2l6VoOmW+i6PbrZ2Nsu2CGFdqItWo40VERECxqD34I6VN9K4J1D8xx+aTxMuVbAf5dK8w+KXxY8JfCLRf7Y8STeZPJ/x72kXEty4/9l/2q4f45/tC+GfhHp72Fk66j4jmU+XaI3yQ5/iuP7v0r8g/HfjrxF4/12bxJ4nvHurqf+Jv4MfwL7ViqfNudeWZTOrPnqfCdf8AFn4z+LfixrbX+tS+XZo/+jWUTfuIF9v/AIqvHz1z3qOpB0rtpw5D9PhRjThyxCmHrT6YetdIhKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCSiiitAP/0PxDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFLnBzSUUAfov+xj8Y/sdwfhR4hn/AHN07SaUz/wSn78H4/er9He9fzu6Zf3Wl3cF7ZTNBc2zebFIv8D9a/cH4G/Fay+LngW21v5V1W3HlahH123P9/8A3JvvVyTp9T8+zzAOL9tA9P1jSrDXdMvdF1iFbnT7+FoZom53LX5Oap+yB8TZfH+oeGNDtlFlbSHyr+4lVYWt/wCGv12570mOc9zXMk0z53A5rWw6aifF/gD9inwF4aKXvjed/EV2uCVz5Fpn/d/1r/8AAq+w9I0nRtD09dK0ixt9PsoAAsNtCiKvp8tXaK0UmKvj8TiH8QcdqK8n8f8Axu+GPw1LR+I9VSW8X/l1t/30v/kP7v8AwKvhj4hftveKtREth4C09NFhHS4lHm3n/wAbWk22PDZZicTrY/R/xH4p8N+FbD+0/FOow6Xb4yGuG2fp/FXxv8Qv22/C+liSz+HemNqU/wDz8XeYovT5U/1jV+bPiTxh4i8U376l4gv5dQupOd9xLveudyTyetWqb3PuMJkVOFpVD174hfHH4kfEaR08R6y0ls3S1h+WBf8AgEdeRF3b7/P60lFdSgj6j2dOEUooZ34FGSaSitCwooooAKKKKACiiigAooooAKKKKACiiigArs/Avj3xP8O9fh8ReE757O6j67fuTL/ddf41rjKKAaurM/Z/4HftJ+GfixBBpN5s0vxIFH+iFsRXP+1bv/7J96vpXnv1r+dG2mudOuEu7KR0lRt6svG01+jfwF/a9DfZfDHxYkbj5IdT7/8Abz/8VXPKD6H5/mmS/wDLygfooQSMngetfI/x4/Zb8O/E7zvEnhLZpPiQHe3y7ILtu+7ptbj71fWUU9tdRx3NvOs0DoGV0bej1Ln8KxTdz5HC4qrhalz+fHxT4T13wfrNxoviSxbT720bY0Uq/wCdy1zNfvR8VfhL4P8Aivoh0vxPADdJ/wAe97FgS23snqn+zX5E/GT4EeMfg7qYTWYPtGmTvm3vYRmFx2z/AHW/2a7oz0P1PL80p4mNnueG0UUe9B7gUUUUCCiiigYUUUUCCiiigAooooGFbvhrw5rfirVrbw94csWv7+7bakUS5P8An8a6n4afC7xX8WPEKeH/AAtB5jxjfNO/yxQJ/eZvSv2K+D3wS8J/BnSRa6REl1qdyoF1esn72X/YTP3E/wBmkeTjcfTwqvM82+Af7M2ifDFIfEviRE1PxW3Qt80Nmf8AYz/H/t/9+a+relH6Zpl7NZaZZzahezLBDCu+WV/lRVrkqH5di8dVxE7j/avib9oT9qux8H/avBnw7kW81n7lxeffitP+uf8Aff8A8dryD9oP9rK51lLjwZ8MJnttN+7c3/3Huv8AZXj5Y6+C3LSMX37n7/TvRTp8yuz67LMn0VSuizq2rX+r3s+qarO93ezvvkllbe8pNUuvUfhUf161JXRZLY+6jpsR0UUVoUFFFFBmFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBJRRRWgH//0fxDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAyT2r339nb4u3Xwj8fQX1yzPo+o4tNRiz/yyP8QH96OvAqj+lJq4q8Y1IcjR/Rda3Npf2kWoWEy3VtOu+KZDlHX2pbq5tLKGW6v51toI/vTTNsVa/DHwd8dPit8PrQaZ4Z8QXFtZDn7O3zRf98y1k+Nvit4/+IDo3i3W7jUFTlImf5F/4BWXIfny4bm535vdP1C8fftb/DDwcZ7XR538TagmRiD5LT/wI/8AiK+EfiB+1V8UPHZltLTUP7CsXP8Ax72J2cdvn/1zfnXzISSOeajyK0VNH1GFyqhR6XLDTNI5leQuzn5m9arnqaKKvlR7a0CiiikIKKKKBBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH0/8Df2lvE3wolXR9QLap4eLZe0Zvmi/wBqBv8A2Wv1k8F+O/CnxC0KDX/Cd6t7bv8AeC8NE/8AcdP4Wr+fyvRfh/8AErxV8MtZTWfDN2baXpJE3+qlX+46/wAVYuHU+azDKaeITlFWkfvmeayda0nStd06fSNctVv7C5TY8Ey7lavEfgt+0P4W+LNmLbKabryr+8sJWyX/ANq3Y/fX/wAer6Azms2fmdajWwtTlsflv8b/ANkHWfD00/iH4ZQvqul53tZr893bH/Z5+Za+HJraW2meCaNldSdysMbMda/orryT4kfA/wCHvxShkfxBpqw6mfuX1t8kqfl97/gVXGVtz63BcQJWhWPwm+lGRX1x8Vv2SvHngQzX/hxD4i0mLD+ZbIfNiT/bTr/3zXyY6PHJIjx7WrZO595Rr060eaDIqKBRTOgKKKKACiiigAr6B+CP7Pfib4y6iLqHdp3h63bbcagy9P8AZQfxPXqX7P8A+yzqPj14vFPjaOXT/DR+aKAfLLeY7f7K/wC1/F/yxr9UdH0vStE0230fRrWGxsbVNsMMSbFVfpQfOY/NIYf3YPUwPAfgPw38N/DUHhzwnZJaWkGGf+NpW/vM/wDE1df15NOyNuK8y+J/xY8J/CfQ/wC1vEbbp5P+Pa1i/wBbK3/xH+1Wcj8yqVKuJqXXvM6jxL4p0PwXo8+veI7lLKyh+8z8bv8Ac/vtX5MfHn9pTxB8VLiXSNI36Z4cRzttlY75sdGuMd64D4u/GfxV8XdcbUNYfybNG/0ezRv3FuhrxnualRufo+WZRGiuep8REST1oHHTiiitj6nyCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAkooorQD//0vxDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAEluvNHfNFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFdB4a8L6/4w1q28PeGLKTUtSu22xwxjc59T7AdSTwB1r7v8If8E8fHGq2AufGPiW00GaQAiCCA3rjPZz5kKg/QsPesZVYx3LUGz88KK/RjxZ/wTq8Y6bYG58IeKrTW7hOsNzbPZE+yMHnBP1wPevhDxl4K8U/D7XZvDXi/TpdN1CE5Mco+8p6MrDhlPYjilCrGQ3Bo5aiilwa3MxKKXBpKACiiigA6Uv1r0b4VfDHXfi74ztvBHhy4trW8uo5JFku3ZIgIhuOTGsh6dOKPip8Mtd+EPjK58DeJLi3ur20jikZ7V2eIiVNy4MiIeh54qeZXt1A4iwvLjTrmO/0+d4J4W3xSRPtZW+tfot8Hv2z0NrB4f+KsDSSp8q6jbpu3/wDXwv8A7Mtfmz2qQEjocU7HHiMHTrx5ZH9C+ieIdA8T2Can4bvoNQs36S277krWzjoa/AbwX8SfGnw/1Map4R1SewuP49rfI/8AvL/FX6G/C/8AbV0LVxDpXxNsxpVyflF9aruiYdPnX/WJSsfnmNyGdP36ep91bg3TntivDfiZ+zz8OfilHJcaxY/YNTI+S+svklP+9j9y3/Aq9j0fVtG8QWC6rolyl7bSfcntnDq2K0HU461TSPm6OJxOHleJ+OXxT/ZV+Ivw887UNKX+39JTk3dmnzL/AL6V8wbDH9+v6KwMV4F8UP2avh18SS1+1r/ZOqyjJvLVNu//AHk/1TUkfcYTiGPwYhH4mmj619IfFP8AZl+Inw0Et+1t/bGjrz9us03Kv++v+sWvDvDXhrW/F2sWvh/w9aPe39021IYl7mmfb0q9OUOeJiwQXV1MttbKzM3yqqfeav0q/Z+/ZMs9KEHjD4qQLNefft9MYfKn+1c/7X+xXsHwD/Zq0T4Www+IPEEaal4nkwfNx+5s/wDYT/a/26+oT1NB8Rmmc2XJSY2OMqqoiiJE6DFOor4l+P37Vdl4Q8/wp8OpFuNW+5NffeWD/rn/AHmoPi8Jhq2JnZHpvxx/aF8NfCOyfTYAuoeI3X93aq3yQ/7VxivyL8YeO/EPxA1yfxF4jvHubuUn53z8uf4UrB1bUtQ1S9mvr+drqWZtzSStud3rOPNB+s5fltLCxv8AaFPTApKKKD1wooooEFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBJRRRWgH/0/xDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABS0lXdPj87ULWF/+Wksan8SKBn67/APwl4c/Zq/Z+uvjB4ntRJrOpWoupC2AwjfHkWyk9N+QW9z3wK/N74l/Hf4l/FjVbm/8SaxNHZSMfLsYJGjt4k7IsYPOB3bJNfpL+3deyaJ8BNA0K0+SC61G0t2Uf8APOK3kkH6qK/HevNw8ef35HVUdlyo9T+Hnxk+Inwu1KC/8Ja1PbxQsCbVpGe2kUdUaInbg+2D6Gv1J8faP4d/a9/Z4j8b6NZRxeIrCGSaAcNJFcQH97b7upV8cfUGvxjr9bv+Cd9/c3XgHxXpUzbra3v42jU9vNi+b89tViIqKU0TSlrZn5sfDv4S+P8A4r313pXgHSv7Tu7BBLNH58MG1CcA5mkQHnsMmvW/+GMP2lf+hPH/AIMLD/5IrjJviD43+DPxK8VH4eau+lSSXlxbu6RxSFo0mJC/vFYce1eieFf2kP2p/G3iGy8L+GfFNxeajqDiKKNba16nux8nhQOST0FbOc1qtiOWG2pm/wDDGH7Sv/QoD/wYWH/yRXzpqui6lomt3vhzUoCmoWNxJaTRBhIwnicxsoKkg4ZSOCQe1ftT8UPjDqH7Nvwnt4fFWut4n8d6oh8ky7EBmI2tJ5cYULDF24yx69Tj4g/Yp0/S/HH7QF54g8YOl5qMVvc6lGJAP3l1JKgeTHTI3senU57VjCtJptrYfKr2R5PoX7J37QviTTo9W0vwbcC3lGU+0TW9q5X18ueVG/SvPvHXwi+JXwzkC+OvD1zpSE4WVgskJPoJoyyE+wavuX9pf44/tS+A/Hupw6U1xoPheBwlnPDZxSwyx8YZ5nST5if4cjHpVjwb+1/4L8dfCTWvBf7Qkpm1K5WSCN7ezLecjp8smEGxZFbvx2IHaiNWb1sW4LueB/sQc/tCaP8A9et7/wCijR+2/wD8nDa1/wBe1n/6JWk/Yf8A+ThNH/69bz/0Ua+sviD+zXqXxs/af1vWta32fhHTorMXEw+V7hxApMMR7cH5m7D3NE6ihVuwjG8LeZ+fngP9nv4w/EvRJPEXgzw899psbFPPknt7ZGZeu03Ese8DuRkCneDP2ffi34/bVl8G6LDqg0ac290Yr+zASQDOAWmAZfRlyp7Gvqn9p39pnTbfTpfgl8GNlhoFggtLq5tvkDrHwYIcYxGMYdv4uR0znjP2FPiLH4S+K7eE76TZZ+KoTCmeguosyRn8RuX6kVSqVORyI0vY+Kbi2urO6msrmMxzwOUkRuCjKcEEeoNdr8P/AIbeOPinrUvh/wACaWdUv4YjO6CWKEKikAkvM6L1PTOT2r2r9sT4fJ4C+N+qvaQ+TZa8F1CEYwMy583H/bQMfxr6q/Yw0K0+Gvwa8W/G/XlWMXEcvlMf+fezB5H/AF0lyPfAq51f3akupCim7M+G9P8AFPxY+AHjC70KC4bStVsGVby0E0dxCzEBsS+UzQZwRxnjvX3T8Lv2zvCWvtDpnxEhGhajJ8n2qEbrM/7393ivzA8Raze+Jde1HxDqL+Zc6lcS3MjHu0rlzx+NZAPFdkL21PIxeX4etutT+iTT9Q0/VbRL/Sp0vbWf5kmifejZ/wBqrtfhJ8OvjN49+F92k/hbU3it/wDlraSHdBL7FK/RT4X/ALYngzxh5Wk+OEHhzUGx++DbrR/+B/wf5+anY/P8bkU6fvQ1R9jHJHArlNI8E+EfD+p3msaJo1rp+oX/APr5beLYzV00Vxa3tslzazrPA5yjo29G+hqUcc1J8i69WHurYO1RXl3bWNvNeX0i28MK7mmZ9iIlY3iXxT4f8I6HN4h8TXS2VlB99m/9l/vV+Svx6/aP8Q/FeVtK0ndp/hyJvkt1fDS/7dx/nbQe1luXVcXPml8J6l8f/wBrW48QLceD/hvI1ppf3Li9+7Pc/wCyv91K+C5J3aUvKepzUROTk9aeeaD9bw2FpUIqMCPrRRRQdgUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUASUUUVoB//1PxDb/WvTD2p7f616Ye1fph8uB60lKetJQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAB05qaCU29xFcJ1jZWH1U5/pUNHSgD9mfj7Yf8L1/ZP07xT4dX7XcWkNtqiqnLZiUxzrj1UM3HtX4zV9p/srftQJ8H5pPBnjKNrnwpqEm7eg3NZyPw7Bf4o2/iA57j0P0x4n/ZM+B/xuvLrxh8JvFkOmvfHzZIbXy7i3EjfNnytytFnqVyB6KK86nL2LcZbHVJc6TR+Slfsj+xvoqfCv9n3V/iB4oU2UGotPqRaT5cW1vHtQ8/38Ej1yK43w/wDsX/B/4V3Fv4p+L3jCO/t7RvMEE/l2dvIU5w4LM0g/2QefpXjv7Vn7VWl/EHTj8MPhmrR+G4iguLkKY/tPlj5I4k42xDHcc+gHUm/bNRjsCioas+HdUurvxN4iu72CFpLnVrmSRY13MxediwAx1OTiv1d+EHw+8K/sjfCy6+LHxMRX8TXkQAjBUyR7xujtYv8AaY8yEfyFeC/sM6D8L4tX1Xx5461Oxs9T0l0hsI724ihCmRNzSoJCMsOgPb619LfHH4X/AA3+OmvW+ra/8XLGysbJCltZQ3NqYYt3325lGWbufTipqz97lewRVlc/Kz4nfEfxD8V/Gd74y8Sy77i6OEjH3IYgTsiT2UfmcnvTvhjL8R9P8U2uv/C+zv7vWtLbzFNhbPcum/I+ZUVvlYZGCMGvuL/hjj4Ff9Fftf8Av/Z//Ha8v+GvxA0H9lX9oDWNJsNU/t/wlKsNpc3MGyTzEeNJRMuwkExMxGAeme9aqcXHlgjO2tz27wt/wUDv9NL6D8V/B7pe2zGG5e1JjIYHawktp+VI7jf17Dt6tpvhH9l/9rDQNVuPCOmJpWsWq5llhthZ3UEkmSsjonySAkHPXPfBrhvH/wAFf2YvjZrk3xB0L4hWmhz6kfNuEW4gCSS/xN5UzKyue/v2rT8P+Jv2eP2QfB+rP4W8RL4r8R6mASkMiyySugPloTFlIowSSxJz9TgVxtJfw1ZnQvPY+Yv2SvDl94R/apTwvqRH2rSv7StZCOjNErJuHscZFfc/xH/ausPh38c9K+F97ZBdJk2i/vZDgxtcgGEqOmxOPMJ9fbn4C/ZV8bQ3X7S0XjTxhqFvYnUBqFxcXE8iRQiSdScb3IA5OAM1j/tk6tpWt/HjVtR0S9g1G0e3tQs1vIssZIiAOGQkcfWtZ0VOpZkRlyx07nrH7bvwKHhTX1+K3heAHRddkxeIg4gun53cfwS9c/3s+or4Y8P63eeG9c07xBp7bLrTZ47iI/7cbhh/Kv1J/Zx+MHgb4s/BzUPg/wDGDUra3nsYPswlvZ1i8+2YYiZZJCB5kRG3rngGvzQ+IPhRfBHjDU/DEd7DqUNpKRDdW0iyxTRNyjh0JHI6jseK6aDuuR9DOejuj9O/2tvC0Xxp+Dngz4p+FIhPes9uibeWMOobV2H3SXaOenNc7+1vqdv8JPgH4S+CWkyhJ71IluNhwWittrMfpJMQfwNdj+wb4xg8W/DXU/h/q4EzeG7uO4iRjn9zK3mxn/gMimvhD9q/4hv8RfjTrV1FL5ljpT/YLXH3dkBIYj/ekLGuCnFup7Poi5PS585HPNJQOlLg17Ry3EopcGkpiPY/ht8dPiD8MLhf+Ee1Nnst2Xspzus2/wCAV9gw/t72j2J8/wAIN9v2/wAN5+5/9F1+bdFBw18Bh6kuaUT2P4q/Gfxf8V9U+3+JJ9tvF/x72sX+qgz2WvGgKdRQddOjGmrQ0Ciiig0CiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAkooorQD//V/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUDCiiigAooooAKTrQBjrS0AFFFFAgr3D4D/Be4+OPiW98MWWsRaRc21o10jTRGRZNrKhXggqec55rw+r2n6jqGlXAu9MuZLSYDbvhcxtg9tyEGk1daDP1tu9M8NfsTfA/XLa21iLUvF/iAFYZAgjeSZgUjZYtxYJCCSSTyfTIFfkMzM7GZyWZjkk/MxLdSTV+/1bU9Vm+0ardzXs2Mb5pGkbHpliTWd7VhTpcjbbvcuUrn1P4L/Y7+Mvjzwvp3i/QIrBtP1SITQmS52ttb1Gw4rqP+GC/j3/zy03/wM/8Asa+UrXxb4rsbdLSy1q9t4IxhI47mREQegUHAqx/wnHjX/oYNQ/8AAuX/AOKocZ9GO8ex9S/8MF/Hv/nlpv8A4Gf/AGNef/Ez9lX4r/CjwrN4x8Wx2S6fA8cZMFx5j7pDtHGBXjP/AAnHjX/oYdQ/8C5f/iqp3/ifxNqlsbTU9Xu7uAkExzXEkiEjpw5IoSqrqgvHsYVFFFdBkFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf/W/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFGM0lLQAUUUUAFFFFAB/WiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigCSiiitAP//X/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//Q/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//R/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//S/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//T/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//U/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//V/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//W/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//X/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//Q/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//R/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//S/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//T/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//U/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//V/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//W/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//X/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAElFFFaAf//Q/ENv9a9MPant/rXph7V+mHy4HrSUp60lABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUA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";

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

const STATUS_PROGRESS = {
  'New': 5, 'In Progress': 40, 'Awaiting Docs': 25,
  'Under Review': 70, 'State Nomination': 85,
  'Awaiting Decision': 100, 'S56 Request (Further Information)': 90,
  'Completed': 100, 'On Hold': 100,
};

function ProgressBar({ value, status }) {
  const pct = status ? (STATUS_PROGRESS[status] ?? value ?? 0) : (value ?? 0);
  const color = pct >= 100 ? '#10b981' : pct >= 70 ? '#6366f1' : pct >= 40 ? '#f59e0b' : '#fb923c';
  return (
    <div style={{ height:4, borderRadius:4, background:'#1e293b', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(pct, 100)}%`, background:color, borderRadius:4, transition:'width 0.3s ease' }} />
    </div>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#ffffff', border:'1px solid #e9eaf3', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', ...style, cursor: onClick ? 'pointer' : 'default', transition:'all 0.2s' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)', e.currentTarget.style.transform='translateY(-1px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)', e.currentTarget.style.transform='translateY(0)')}>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  // Lock body scroll while modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const overlay = (
    <div
      style={{
        position:'fixed', top:0, left:0, width:'100%', height:'100%',
        background:'rgba(17,24,39,0.55)', backdropFilter:'blur(4px)',
        zIndex:9999, display:'flex', alignItems:'flex-start',
        justifyContent:'center', overflowY:'auto', padding:'40px 16px 40px',
      }}
      onClick={e => e.target===e.currentTarget && onClose()}
    >
      <div
        className="animate-fade"
        style={{
          background:'#fff', borderRadius:18, width:'100%',
          maxWidth: wide ? 760 : 560,
          boxShadow:'0 24px 80px rgba(0,0,0,0.22)',
          flexShrink:0,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'center',
          padding:'20px 26px 18px', borderBottom:'1.5px solid #e2e8f0',
          position:'sticky', top:0, background:'#fff', zIndex:1,
          borderRadius:'18px 18px 0 0',
        }}>
          <h2 style={{ fontSize:17, fontWeight:700, color:'#111827', margin:0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background:'#f3f4f6', border:'none', borderRadius:8, width:32, height:32, color:'#1f2937', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, lineHeight:1 }}
            onMouseEnter={e=>{e.currentTarget.style.background='#fee2e2';e.currentTarget.style.color='#ef4444';}}
            onMouseLeave={e=>{e.currentTarget.style.background='#f3f4f6';e.currentTarget.style.color='#9ca3af';}}
          >×</button>
        </div>
        {/* Body */}
        <div style={{ padding:'22px 26px 28px' }}>
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function FormField({ label, children, required }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{label}{required && <span style={{color:'#f87171'}}>*</span>}</label>
      {children}
    </div>
  );
}

const inputStyle = { width:'100%', background:'#ffffff', border:'2px solid #c7d2e0', borderRadius:9, padding:'9px 12px', color:'#1f2937', fontSize:14, outline:'none', transition:'all 0.18s' };
const selectStyle = { ...inputStyle, cursor:'pointer' };
const textareaStyle = { ...inputStyle, resize:'vertical', minHeight:72 };

/* ─── NOTES PANEL ────────────────────────────────────────────────────────────── */
function NotesPanel({ notes, onAddNote, onDeleteNote }) {
  const [text, setText] = useState('');
  const sorted = [...(notes||[])].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleAdd = () => {
    if (!text.trim()) return;
    onAddNote(text.trim());
    setText('');
  };

  return (
    <div style={{ marginTop:8 }}>
      <div style={{ fontSize:12, fontWeight:600, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Case Notes ({sorted.length})</div>
      {/* Add note */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <textarea
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter' && (e.ctrlKey||e.metaKey)) handleAdd(); }}
          placeholder="Add a note… (Ctrl+Enter to save)"
          style={{ ...textareaStyle, minHeight:60, flex:1, fontSize:13 }}
        />
        <button onClick={handleAdd} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, padding:'0 14px', color:'#fff', fontWeight:700, fontSize:13, alignSelf:'stretch', minWidth:60 }}>Add</button>
      </div>
      {/* Notes list */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:260, overflowY:'auto' }}>
        {sorted.length === 0 && <div style={{ fontSize:13, color:'#1f2937', textAlign:'center', padding:'16px 0' }}>No notes yet</div>}
        {sorted.map((n, i) => (
          <div key={n.id} style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:8, padding:'10px 12px', position:'relative' }}>
            {i === 0 && <span style={{ position:'absolute', top:8, right:36, fontSize:10, background:'#eef2ff', color:'#6366f1', borderRadius:6, padding:'1px 6px' }}>Latest</span>}
            <div style={{ fontSize:13, color:'#1f2937', lineHeight:1.5, marginBottom:6, paddingRight:24 }}>{n.text}</div>
            <div style={{ fontSize:11, color:'#1f2937' }}>🕐 {fmtDateTime(n.createdAt)}</div>
            <button onClick={()=>onDeleteNote(n.id)} style={{ position:'absolute', top:8, right:8, background:'none', border:'none', color:'#1f2937', fontSize:14, lineHeight:1, padding:2 }} title="Delete note">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── CLIENT HOVER SNAPSHOT ──────────────────────────────────────────────────── */
function ClientSnapshot({ client, jobs, visible, anchorRef }) {
  const clientJobs = jobs.filter(j => j.clientId === client.id);
  const activeJobs = clientJobs.filter(j => j.status !== 'Completed');
  const latestNote = [...(normalizeNotes(client.notes))].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0];

  if (!visible) return null;

  return (
    <div className="tooltip-anim" style={{
      position:'fixed', zIndex:2000,
      background:'#ffffff', border:'1.5px solid #d1d5db',
      borderRadius:14, padding:18, width:300,
      boxShadow:'0 20px 60px #000000cc',
      pointerEvents:'none',
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, paddingBottom:12, borderBottom:'2px solid #e2e8f0' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#1f2937', flexShrink:0 }}>{initials(client.name)}</div>
        <div>
          <div style={{ fontWeight:700, color:'#111827', fontSize:15 }}>{client.name}</div>
          <div style={{ fontSize:12, color:'#1f2937', marginTop:2 }}>{client.email}</div>
          {client.phone && <div style={{ fontSize:11, color:'#1f2937', marginTop:1 }}>{client.phone}</div>}
        </div>
      </div>
      {/* Stats row */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <StatusBadge status={client.status} small />
        <span style={{ fontSize:12, color: client.type==='Student'?'#60a5fa':client.type==='Migration'?'#a78bfa':'#34d399', background: client.type==='Student'?'#1e40af20':client.type==='Migration'?'#6d28d920':'#05966920', padding:'2px 10px', borderRadius:20, fontWeight:500 }}>{client.type}</span>
        {client.nationality && <span style={{ fontSize:12, color:'#1f2937', background:'#e5e7eb', padding:'2px 10px', borderRadius:20 }}>{client.nationality}</span>}
      </div>
      {/* Jobs */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, color:'#1f2937', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Active Jobs ({activeJobs.length})</div>
        {activeJobs.length === 0 && <div style={{ fontSize:12, color:'#1f2937' }}>No active jobs</div>}
        {activeJobs.slice(0,3).map(j => (
          <div key={j.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{ fontSize:12, color:'#1f2937', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:8 }}>{j.title}</span>
            <StatusBadge status={j.status} small />
          </div>
        ))}
        {activeJobs.length > 3 && <div style={{ fontSize:11, color:'#1f2937' }}>+{activeJobs.length-3} more</div>}
      </div>
      {/* Latest note */}
      {latestNote && (
        <div style={{ background:'#ffffff', borderRadius:8, padding:'8px 10px', borderLeft:'3px solid #38bdf840' }}>
          <div style={{ fontSize:11, color:'#1f2937', marginBottom:4 }}>📝 Latest note · {fmtDateTime(latestNote.createdAt)}</div>
          <div style={{ fontSize:12, color:'#1f2937', lineHeight:1.4 }}>{latestNote.text.length > 90 ? latestNote.text.slice(0,90)+'…' : latestNote.text}</div>
        </div>
      )}
      <div style={{ marginTop:10, fontSize:11, color:'#1f2937' }}>Client since {fmtDate(client.createdAt)} · {clientJobs.length} total cases</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   VIEWS
═══════════════════════════════════════════════════════════════════════════════ */

/* ─── DASHBOARD ─────────────────────────────────────────────────────────────── */
function Dashboard({ clients, jobs, team, onGoTo, setJobsMemberFilter, setJobsStatusFilter }) {
  const { t } = useLang(); // eslint-disable-line no-unused-vars
  const [selectedJob, setSelectedJob] = useState(null);

  const active = clients.filter(c=>c.status==='Active').length;
  const inProgress = jobs.filter(j=>j.status==='In Progress').length;
  const awaitingDecision = jobs.filter(j=>j.status==='Awaiting Decision').length;
  const urgent = jobs.filter(j=>j.priority==='Urgent' && j.status!=='Completed').length;
  const completed = jobs.filter(j=>j.status==='Completed').length; // eslint-disable-line no-unused-vars
  const overdue = jobs.filter(j=> j.status!=='Completed' && j.status!=='Awaiting Decision' && isOverdue(j.dueDate)).length;
  const recentJobs = [...jobs].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  const getClient = id => clients.find(c=>c.id===id);
  const getMember = id => team.find(t=>t.id===id);
  // Always show Liang (t1) and Mansi (t2) first, then rest by workload
  // Exclude owners Liang (t1) and Mansi (t2) from workload display
  const memberLoad = team
    .filter(m => m.id !== 't1' && m.id !== 't2')
    .map(m => ({ ...m, count: jobs.filter(j=>j.assignedTo===m.id && j.status!=='Completed' && j.status!=='Awaiting Decision').length }))
    .sort((a,b) => b.count - a.count)
    .slice(0, 6);

  // Upcoming deadlines in next 14 days
  const now = new Date();
  const in14 = new Date(now); in14.setDate(now.getDate()+14);
  const upcoming = jobs
    .filter(j => j.status!=='Completed' && j.dueDate)
    .filter(j => { const d = new Date(j.dueDate); return d >= now && d <= in14; })
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0,5);

  // Pipeline counts
  const pipeline = ['New','In Progress','Awaiting Docs','Under Review','On Hold'].map(s => ({
    status: s,
    count: jobs.filter(j=>j.status===s).length
  }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const statCards = [
    { label:'Active Clients',    value:active,           icon:'👥', color:'#ff158a', sub:`of ${clients.length} total`,   onClick:()=>onGoTo('clients') },
    { label:'Jobs In Progress',  value:inProgress,       icon:'⚡', color:'#579bfc', sub:`${jobs.length} total cases`,   onClick:()=>{ setJobsStatusFilter('In Progress'); onGoTo('jobs'); } },
    { label:'Urgent Cases',      value:urgent,           icon:'🔴', color:'#e2445c', sub:'need immediate attention',     onClick:()=>{ setJobsStatusFilter('Urgent'); onGoTo('jobs'); } },
    { label:'Awaiting Decision', value:awaitingDecision, icon:'⏳', color:'#676879', sub:'lodged · pending outcome',     onClick:()=>{ setJobsStatusFilter('Awaiting Decision'); onGoTo('jobs'); } },
  ];

  const selectedClient = selectedJob ? getClient(selectedJob.clientId) : null;
  const selectedMember = selectedJob ? getMember(selectedJob.assignedTo) : null;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:26, fontWeight:700, color:'#111827', marginBottom:4 }}>{greeting} 👋</h1>
        <p style={{ color:'#1f2937', fontSize:14 }}>{new Date().toLocaleDateString('en-AU',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
      </div>

      {/* Stat cards – all clickable */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, marginBottom:28 }}>
        {statCards.map(s => (
          <Card key={s.label} onClick={s.onClick} style={{ position:'relative', overflow:'hidden', borderTop:`4px solid ${s.color}` }}>
            <div style={{ position:'absolute', top:-10, right:-10, fontSize:48, opacity:0.08 }}>{s.icon}</div>
            <div style={{ fontSize:13, color:'#1f2937', marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:38, fontWeight:800, color:s.color, marginBottom:4, fontFamily:"'JetBrains Mono',monospace" }}>{s.value}</div>
            <div style={{ fontSize:12, color:'#1f2937' }}>{s.sub}</div>
            <div style={{ position:'absolute', bottom:10, right:12, fontSize:11, color:s.color+'80' }}>click →</div>
          </Card>
        ))}
      </div>

      {overdue > 0 && (
        <div style={{ background:'#7f1d1d30', border:'1px solid #ef444440', borderRadius:10, padding:'12px 16px', marginBottom:24, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>⚠️</span>
          <span style={{ color:'#fca5a5', fontSize:14 }}><strong>{overdue} job{overdue>1?'s':''}</strong> {overdue>1?'are':'is'} overdue. <button onClick={()=>onGoTo('jobs')} style={{ background:'none', border:'none', color:'#f87171', textDecoration:'underline', fontSize:14, cursor:'pointer' }}>View jobs →</button></span>
        </div>
      )}

      {/* Pipeline summary bar */}
      <Card style={{ marginBottom:20, padding:'16px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ fontSize:15, fontWeight:600, color:'#0f172a' }}>Pipeline Overview</h3>
          <button onClick={()=>onGoTo('jobs')} style={{ background:'none', border:'none', color:'#ff158a', fontSize:13, cursor:'pointer' }}>View all →</button>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {pipeline.map(p => {
            const s = STATUS_STYLES[p.status];
            return (
              <div key={p.status} onClick={()=>{ setJobsStatusFilter(p.status); onGoTo('jobs'); }} style={{ flex:1, minWidth:90, background:s.bg, borderRadius:10, padding:'10px 12px', cursor:'pointer', transition:'filter 0.15s' }}
                onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.2)'}
                onMouseLeave={e=>e.currentTarget.style.filter='none'}>
                <div style={{ fontSize:20, fontWeight:700, color:s.text, fontFamily:"'JetBrains Mono',monospace" }}>{p.count}</div>
                <div style={{ fontSize:11, color:s.text+'99', marginTop:2 }}>{p.status}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Recent Jobs – clickable rows */}
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:600, color:'#0f172a' }}>Recent Cases</h3>
            <button onClick={()=>onGoTo('jobs')} style={{ background:'none', border:'none', color:'#ff158a', fontSize:13, cursor:'pointer' }}>View all →</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {recentJobs.map(j => {
              const client = getClient(j.clientId);
              const member = getMember(j.assignedTo);
              return (
                <div key={j.id} onClick={()=>setSelectedJob(j)} style={{ padding:'10px 12px', background:'#ffffff', borderRadius:8, border:'1.5px solid #cbd5e1', cursor:'pointer', transition:'border-color 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='#38bdf860'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='#e5e7eb'}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:2 }}>{j.title}</div>
                      <div style={{ fontSize:12, color:'#1f2937' }}>{client?.name} · {j.type}</div>
                    </div>
                    <StatusBadge status={j.status} small />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ flex:1 }}><ProgressBar value={j.progress} status={j.status}/></div>
                    {member && <div style={{ display:'flex', alignItems:'center', gap:5, marginLeft:10, flexShrink:0 }}><Avatar name={member.name} color={member.color} size={20} /><span style={{ fontSize:11, color:'#1f2937' }}>{member.name.split(' ')[0]}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Team Workload – clickable */}
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:600, color:'#0f172a' }}>Team Workload</h3>
            <button onClick={()=>onGoTo('team')} style={{ background:'none', border:'none', color:'#ff158a', fontSize:13, cursor:'pointer' }}>View team →</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {memberLoad.map(m => {
              const pct = Math.min((m.count / 5) * 100, 100);
              return (
                <div key={m.id} onClick={()=>{ setJobsMemberFilter(m.id); onGoTo('jobs'); }} style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 8px', borderRadius:8, cursor:'pointer', transition:'background 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#38bdf810'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <Avatar name={m.name} color={m.color} size={30} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, color:'#1f2937' }}>{m.name}</span>
                      <span style={{ fontSize:12, color:'#1f2937', fontFamily:"'JetBrains Mono',monospace" }}>{m.count} active</span>
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

      {/* Upcoming Deadlines */}
      {upcoming.length > 0 && (
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:15, fontWeight:600, color:'#111827' }}>📅 Upcoming Deadlines <span style={{ fontSize:12, color:'#1f2937', fontWeight:400 }}>(next 14 days)</span></h3>
            <button onClick={()=>onGoTo('jobs')} style={{ background:'none', border:'none', color:'#ff158a', fontSize:13, cursor:'pointer' }}>View all →</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {upcoming.map(j => {
              const client = getClient(j.clientId);
              const daysLeft = Math.ceil((new Date(j.dueDate) - now) / 86400000);
              const urgency = daysLeft <= 3 ? '#f87171' : daysLeft <= 7 ? '#f59e0b' : '#34d399';
              return (
                <div key={j.id} onClick={()=>setSelectedJob(j)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'#ffffff', borderRadius:8, border:'1.5px solid #cbd5e1', cursor:'pointer', transition:'border-color 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='#38bdf860'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='#e5e7eb'}>
                  <div style={{ minWidth:42, height:42, borderRadius:8, background:urgency+'20', border:`2px solid ${urgency}40`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:urgency, lineHeight:1 }}>{daysLeft}</div>
                    <div style={{ fontSize:9, color:urgency+'99' }}>days</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.title}</div>
                    <div style={{ fontSize:12, color:'#1f2937' }}>{client?.name} · Due {fmtDate(j.dueDate)}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                    <PriorityBadge priority={j.priority} />
                    <StatusBadge status={j.status} small />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Job Quick-View Modal (from dashboard) */}
      {selectedJob && (
        <Modal title={`Case Details – ${selectedJob.title}`} onClose={()=>setSelectedJob(null)} wide>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
            <div>
              <div style={{ fontSize:11, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Client</div>
              <div style={{ fontSize:14, color:'#111827', fontWeight:600 }}>{selectedClient?.name || '—'}</div>
              <div style={{ fontSize:12, color:'#1f2937' }}>{selectedClient?.email}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Assigned To</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {selectedMember && <Avatar name={selectedMember.name} color={selectedMember.color} size={28} />}
                <div style={{ fontSize:14, color:'#111827' }}>{selectedMember?.name || '—'}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Status / Priority</div>
              <div style={{ display:'flex', gap:8 }}><StatusBadge status={selectedJob.status} /><PriorityBadge priority={selectedJob.priority} /></div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Due Date</div>
              <div style={{ fontSize:14, color: isOverdue(selectedJob.dueDate) && selectedJob.status!=='Completed' ? '#f87171':'#e2e8f0' }}>{fmtDate(selectedJob.dueDate)}</div>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Progress – {selectedJob.progress}%</div>
            <ProgressBar value={selectedJob.progress} />
          </div>
          {normalizeNotes(selectedJob.notes).length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Notes ({normalizeNotes(selectedJob.notes).length})</div>
              {[...normalizeNotes(selectedJob.notes)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,3).map(n => (
                <div key={n.id} style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:8, padding:'10px 12px', marginBottom:8 }}>
                  <div style={{ fontSize:13, color:'#1f2937' }}>{n.text}</div>
                  <div style={{ fontSize:11, color:'#1f2937', marginTop:4 }}>{fmtDateTime(n.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:4, borderTop:'1.5px solid #e2e8f0', paddingTop:16 }}>
            <button onClick={()=>setSelectedJob(null)} style={{ background:'#e5e7eb', border:'none', borderRadius:8, padding:'9px 18px', color:'#1f2937', fontWeight:500 }}>Close</button>
            <button onClick={()=>{ setSelectedJob(null); onGoTo('jobs'); }} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, padding:'9px 20px', color:'#fff', fontWeight:700 }}>Open in Cases →</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* ─── CLIENT DETAIL MODAL (tabbed + AI import) ────────────────────────────── */
function ClientDetailModal({ client, jobs, setJobs, team, onClose, onEdit, onSaveProfile }) {
  const { t } = useLang();
  const [tab, setTab]               = useState('profile');
  const [importing, setImporting]   = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [applyMsg, setApplyMsg]     = useState('');
  const fileRef                     = useRef(null);
  const [contractBusy, setContractBusy] = useState(false);
  const [quickJob, setQuickJob]         = useState(false);
  const [editingJob, setEditingJob]     = useState(null);
  const [jobForm, setJobForm]           = useState({});
  const [qform, setQform]               = useState({});
  const [viewJob, setViewJob]           = useState(null); // case detail from client tab

  const handleGenerateContract = async () => {
    try {
      setContractBusy(true);
      await generateClientContractFile(client, clientJobs);
    } catch (err) {
      window.alert('合同生成失败: ' + (err?.message || err));
    } finally {
      setContractBusy(false);
    }
  };

  // WeChat import state
  const [wchat, setWchat]           = useState('');
  const [wchatParsing, setWchatParsing] = useState(false);
  const [wchatResult, setWchatResult]   = useState(null);
  const [wchatSaved, setWchatSaved]     = useState(false);

  // Email import state
  const [email, setEmail]           = useState('');
  const [emailParsing, setEmailParsing] = useState(false);
  const [emailResult, setEmailResult]   = useState(null);
  const [emailSaved, setEmailSaved]     = useState(false);

  // Openclaw snapshot state
  const [ocName, setOcName]         = useState('');
  const [ocFetching, setOcFetching] = useState(false);

  // Paste-text import state (Import Tab)
  const [pasteText, setPasteText]         = useState('');
  const [pasteImporting, setPasteImporting] = useState(false);

  // Generate snapshot state (Profile Tab)
  const [generatingSnapshot, setGeneratingSnapshot] = useState(false);

  // Note quick-add state
  const [noteImportText, setNoteImportText] = useState('');
  const [noteImportParsing, setNoteImportParsing] = useState(false);
  const [noteImportResult, setNoteImportResult] = useState(null);
  const [noteImportSaved, setNoteImportSaved] = useState(false);
  const clientJobs                  = jobs.filter(j => j.clientId === client.id);


  const extractAndParseJson = (raw) => {
    if (!raw || typeof raw !== 'string') throw new Error('Empty AI response');

    // Strip markdown fences
    let text = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Extract outermost { ... }
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start)
      throw new Error('No JSON object found in AI response');

    text = text.slice(start, end + 1)
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/^\uFEFF/, '');

    // Strip non-printable control chars but KEEP \n \r
    text = Array.from(text, ch => {
      const c = ch.charCodeAt(0);
      return (c < 32 && c !== 10 && c !== 13) ? ' ' : ch;
    }).join('');

    // ── Pass 1: Convert Chinese COLON only (outside strings) ─────────────────
    // Also fixes unescaped quotes inside string values: when a "closing" quote is
    // followed by something other than a JSON structural char, treat it as escaped.
    {
      let out = ''; let inStr = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
          if (ch === '\\') { out += ch + (text[++i] || ''); }
          else if (ch === '"') {
            // Peek ahead: is the next non-whitespace char a JSON structural element?
            let j = i + 1;
            while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++;
            const next = text[j] || '';
            if (next === ',' || next === ':' || next === '}' || next === ']' ||
                next === '\n' || next === '\r' || next === '' ) {
              // Looks like a real end-quote
              out += ch; inStr = false;
            } else {
              // Unescaped quote inside string — escape it
              out += '\\"';
            }
          } else {
            out += ch;
          }
        } else {
          if      (ch === '"') { inStr = true; out += ch; }
          else if (ch === '：') out += ':';
          else                  out += ch;
        }
      }
      text = out;
    }

    // ── Pass 2: Full character-level state machine ────────────────────────────
    // Tracks JSON structure depth so it knows exactly when a value is expected.
    // Any unquoted token that doesn't start with a valid JSON value character
    // is collected and wrapped in double-quotes.
    {
      let out = ''; let i = 0; const n = text.length;
      let inStr = false;
      let expectVal = false;
      const ctxStack = []; // 'obj' | 'arr'

      while (i < n) {
        const ch = text[i];

        // ── Inside a string ──────────────────────────────────────────────────
        if (inStr) {
          if (ch === '\\') { out += ch + (text[++i] || ''); i++; continue; }
          if (ch === '"') {
            // Peek ahead: real end-quote or unescaped quote inside string?
            let j = i + 1;
            while (j < n && (text[j] === ' ' || text[j] === '\t')) j++;
            const next = text[j] || '';
            if (next === ',' || next === ':' || next === '}' || next === ']' ||
                next === '\n' || next === '\r' || j >= n) {
              out += ch; inStr = false; // real end quote
            } else {
              out += '\\"'; // unescaped quote inside string — escape it
            }
            i++; continue;
          }
          out += ch; i++; continue;
        }

        // ── Whitespace (preserve, keep expectVal state) ──────────────────────
        if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
          out += ch; i++; continue;
        }

        // ── Expecting a value ────────────────────────────────────────────────
        if (expectVal) {
          expectVal = false;

          if (ch === '"') { inStr = true; out += ch; i++; continue; }
          if (ch === '{') { ctxStack.push('obj'); out += ch; i++; continue; }
          if (ch === '[') { ctxStack.push('arr'); expectVal = true; out += ch; i++; continue; }
          if (ch === ']') { if (ctxStack.length) ctxStack.pop(); out += ch; i++; continue; }
          if (ch === '}') { if (ctxStack.length) ctxStack.pop(); out += ch; i++; continue; }

          // null / true / false / number
          const rem = text.slice(i);
          const kw = rem.match(/^(null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
          if (kw) { out += kw[0]; i += kw[0].length; continue; }

          // ── Unquoted bare value ──────────────────────────────────────────
          // Collect to next structural delimiter.
          // In ARRAY context : any comma (ASCII or Chinese) stops the element.
          // In OBJECT context: ASCII comma stops only if lookahead shows a key/closer;
          //                    Chinese comma '，' is part of the value text.
          // Newline: only stop if next non-blank line starts with a key/closer.
          // This handles multi-line bare values that AI splits across lines.
          const inArr = ctxStack[ctxStack.length - 1] === 'arr';
          let raw2 = '';
          let terminatedByChinComma = false;
          while (i < n) {
            const c = text[i];
            if (c === '}' || c === ']') break;
            if (c === '\n' || c === '\r') {
              // Peek ahead past whitespace — stop if next visible char is key/closer
              let j = i + 1;
              while (j < n && (text[j] === ' ' || text[j] === '\t' || text[j] === '\n' || text[j] === '\r')) j++;
              if (j >= n || text[j] === '"' || text[j] === '}' || text[j] === ']') break;
              // Otherwise: multi-line bare value — merge with a space
              raw2 += ' '; i++; continue;
            }
            if (c === '，') {
              if (inArr) { terminatedByChinComma = true; i++; break; }
              raw2 += c; i++; continue;
            }
            if (c === ',') {
              if (inArr) break;
              let j = i + 1;
              while (j < n && (text[j] === ' ' || text[j] === '\t')) j++;
              if (j >= n || text[j] === '"' || text[j] === '}' || text[j] === ']' || text[j] === '\n') break;
            }
            raw2 += c; i++;
          }
          const val = raw2.trim();
          if (!val) {
            out += 'null';
          } else if (val === 'null' || val === 'true' || val === 'false') {
            out += val;
          } else if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(val)) {
            out += val;
          } else {
            out += '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
          }
          if (terminatedByChinComma) { out += ','; expectVal = true; }
          continue;
        }

        // ── Normal structural characters ─────────────────────────────────────
        if (ch === '"') { inStr = true; out += ch; i++; continue; }
        if (ch === ':') { expectVal = true; out += ch; i++; continue; }
        if (ch === '{') { ctxStack.push('obj'); out += ch; i++; continue; }
        if (ch === '[') { ctxStack.push('arr'); expectVal = true; out += ch; i++; continue; }
        if (ch === '}' || ch === ']') { if (ctxStack.length) ctxStack.pop(); out += ch; i++; continue; }
        if (ch === ',') {
          if (ctxStack[ctxStack.length - 1] === 'arr') expectVal = true;
          out += ch; i++; continue;
        }
        if (ch === '，') {
          // Chinese comma as structural separator
          if (ctxStack[ctxStack.length - 1] === 'arr') expectVal = true;
          out += ','; i++; continue;
        }
        out += ch; i++;
      }
      text = out;
    }

    // ── Pass 3: Remove trailing commas before } or ] ─────────────────────────
    text = text.replace(/,(\s*[}\]])/g, '$1');

    // ── Pass 4: Nullify "JSON-injection" contaminated strings ─────────────────
    text = text.replace(/"((?:[^"\\]|\\.)*)"/g, (match, inner) => {
      if (/",\s*"[a-zA-Z_]/.test(inner) ||
          /[a-zA-Z_]"\s*:\s*(?:null|true|false|\d|")/.test(inner)) {
        return 'null';
      }
      return match;
    });

    // ── Parse ────────────────────────────────────────────────────────────────
    try {
      const result = JSON.parse(text);
      // ── Post-process: fix array fields that AI returned as strings/null ───
      if (result && result.profile) {
        const arrFields = ['skillsAssessments','visaHistory','addressHistory',
                           'employmentHistory','keyIssues','documents','caseTimeline','nextSteps'];
        for (const f of arrFields) {
          if (result.profile[f] !== undefined && !Array.isArray(result.profile[f])) {
            result.profile[f] = [];
          }
        }
      }
      return result;
    } catch (err) {
      const posMatch = /position\s+(\d+)/i.exec(err?.message || '');
      if (posMatch) {
        const pos = Number(posMatch[1]);
        const snippet = text.slice(Math.max(0, pos - 80), Math.min(text.length, pos + 80));
        throw new Error(`JSON parse failed near: ${snippet}`);
      }
      throw err;
    }
  };

  /* ── WeChat chat import ─────────────────────────────── */
  const parseWeChat = async () => {
    if (!wchat.trim()) return;
    setWchatParsing(true); setWchatResult(null); setWchatSaved(false);
    try {
      const res = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:3000,
          messages:[{ role:'user', content:
`You are an immigration CRM assistant. Analyse this client communication for "${client.name}".

LANGUAGE RULE: Detect the primary language of the chat content. If primarily Chinese → write all JSON string values in Chinese. If primarily English → write in English. Mixed → use dominant language.

Chat Content:
${wchat.slice(0,6000)}

Return ONLY valid JSON (no markdown, no explanation):
{
  "summary": "2-3 sentence overview of what was discussed",
  "keyTopics": ["topic1","topic2"],
  "clientRequests": ["what the client asked for or needed"],
  "actionItems": ["things the agent/team needs to do"],
  "importantDates": ["any dates mentioned e.g. visa expiry, appointment dates"],
  "sentiment": "positive|neutral|concerned|urgent",
  "language": "English|Mandarin|Mixed",
  "messageCount": <number>,
  "dateRange": "earliest to latest date found or null",
  "tags": ["visa type mentioned","document mentioned","etc"]
}`
          }]
        })
      });
      const data = await res.json();
      const raw = (data.content || []).map(c => c?.text || '').join('');
      setWchatResult(extractAndParseJson(raw));
    } catch(e) {
      setWchatResult({ summary:'Parse error: '+e.message, keyTopics:[], clientRequests:[], actionItems:[], importantDates:[], sentiment:'neutral', language:'Unknown', messageCount:0, dateRange:null, tags:[] });
    }
    setWchatParsing(false);
  };

  const saveWchatNote = () => {
    if (!wchatResult) return;
    const noteText = [
      '💬 WeChat Import',
      `Summary: ${wchatResult.summary}`,
      wchatResult.actionItems?.length ? `Action Items: ${wchatResult.actionItems.join('; ')}` : '',
      wchatResult.clientRequests?.length ? `Client Requests: ${wchatResult.clientRequests.join('; ')}` : '',
      wchatResult.importantDates?.length ? `Key Dates: ${wchatResult.importantDates.join(', ')}` : '',
      wchatResult.dateRange ? `Chat Period: ${wchatResult.dateRange}` : '',
    ].filter(Boolean).join('\n');
    onSaveProfile({ ...client, notes: [makeNote(noteText), ...normalizeNotes(client.notes)] });
    setWchatSaved(true);
  };

  /* ── Email import ─────────────────────────────── */
  const parseEmail = async () => {
    if (!email.trim()) return;
    setEmailParsing(true); setEmailResult(null); setEmailSaved(false);
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role:'user', content:
`You are an immigration CRM assistant. Analyse this email conversation involving client "${client.name}" and extract a structured communication summary.

Email Content:
${email.slice(0,6000)}

Return ONLY valid JSON (no markdown, no preamble):
{
  "summary": "2-3 sentence summary of the email thread",
  "subject": "email subject or topic",
  "dateRange": "date range of email e.g. 12 Mar 2026",
  "actionItems": ["list of things agent needs to do"],
  "clientRequests": ["what client is asking for"],
  "importantDates": ["any deadlines or key dates mentioned"],
  "sentiment": "positive|neutral|concerned|urgent",
  "tags": ["topic tags e.g. visa-application, documents, fees"]
}`
          }]
        })
      });
      const data = await res.json();
      const raw = (data.content||[]).map(b=>b.text||'').join('');
      const cleaned = raw.replace(/```json|```/g,'').trim();
      setEmailResult(JSON.parse(cleaned));
    } catch(e) {
      setEmailResult({ summary:'Parse error — check API connection.', actionItems:[], clientRequests:[], importantDates:[], tags:[], sentiment:'neutral' });
    } finally {
      setEmailParsing(false);
    }
  };

  const saveEmailNote = () => {
    if (!emailResult) return;
    const noteText = [
      `📧 Email Import${emailResult.subject ? ` — ${emailResult.subject}` : ''}`,
      `Summary: ${emailResult.summary}`,
      emailResult.actionItems?.length ? `Action Items: ${emailResult.actionItems.join('; ')}` : '',
      emailResult.clientRequests?.length ? `Client Requests: ${emailResult.clientRequests.join('; ')}` : '',
      emailResult.importantDates?.length ? `Key Dates: ${emailResult.importantDates.join(', ')}` : '',
      emailResult.dateRange ? `Email Date: ${emailResult.dateRange}` : '',
    ].filter(Boolean).join('\n');
    onSaveProfile({ ...client, notes: [makeNote(noteText), ...normalizeNotes(client.notes)] });
    setEmailSaved(true);
  };

  /* ── Quick Note paste + AI summarize ─────────────────── */
  const parseNoteImport = async () => {
    if (!noteImportText.trim()) return;
    setNoteImportParsing(true); setNoteImportResult(null); setNoteImportSaved(false);
    try {
      const res = await fetch('/api/claude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:1000,
          messages:[{ role:'user', content:
`Summarise this note for an immigration CRM client record. Write the summary in the SAME LANGUAGE as the input (Chinese input → Chinese output, English input → English output).
Return ONLY a plain text summary (no JSON, no markdown, no preamble), 2-4 sentences, capturing key points, dates, and any action items.

Note content:
${noteImportText.slice(0,4000)}`
          }]
        })
      });
      const data = await res.json();
      const summary = (data.content||[]).map(b=>b.text||'').join('').trim();
      setNoteImportResult(summary);
    } catch(e) {
      setNoteImportResult('AI error: ' + e.message);
    }
    setNoteImportParsing(false);
  };

  const saveNoteImport = (useAI) => {
    const text = useAI ? `📝 AI摘要\n${noteImportResult}` : `📝 备注\n${noteImportText}`;
    onSaveProfile({ ...client, notes: [makeNote(text), ...normalizeNotes(client.notes)] });
    setNoteImportSaved(true);
    setNoteImportText(''); setNoteImportResult(null);
  };
  const p                           = client.profile || {};

  /* ── Openclaw snapshot fetch ─────────────────────────── */
  const handleOpenclawFetch = async () => {
    const name = ocName.trim();
    if (!name) return window.alert('请输入客户姓名');
    setOcFetching(true); setImportPreview(null);
    try {
      const res = await fetch('http://127.0.0.1:18789/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 315099a9ddf69fc50928803a3193f6dfa42d59bf236c887b',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai-codex/gpt-5.4',
          messages: [{
            role: 'user',
            content: `快照 ${name}。请只返回JSON（不要markdown，不要多余文字），严格使用以下结构：
{
  "name":"","nameChinese":"","email":"","phone":"","nationality":"","type":"Migration",
  "profile":{
    "sex":null,"dob":null,"birthplace":null,"passportNo":null,"passportExpiry":null,
    "auAddress":null,"maritalStatus":null,"chinaId":null,"qq":null,"eaFileNo":null,
    "consultant":null,"visaTarget":null,
    "visaHistory":[{"type":"","appNo":"","lodgeDate":"","grantDate":"","expiry":"","status":""}],
    "addressHistory":[{"from":"","to":"","address":""}],
    "employmentHistory":[{"from":"","to":"","company":"","role":"","country":""}],
    "character":{"form80":null,"afpCheck":null,"pcc":null},
    "sponsor":{"name":null,"sex":null,"dob":null,"nationality":null,"passportNo":null,"address":null,"occupation":null,"priorMaritalStatus":null},
    "marriage":{"date":null,"location":null,"registrationNo":null},
    "keyIssues":[{"priority":"High","item":"","detail":""}],
    "documents":[{"name":"","mainApplicant":"","sponsor":"","secondary":""}],
    "serviceAgreement":{"visaTarget":null,"contractDate":null,"totalFee":null,"payment1Amount":null,"payment1Detail":null,"payment2Amount":null,"payment2Detail":null},
    "skillsAssessments":[{"appId":"","occupation":"","body":"","lodgeDate":"","outcome":"Pending","rejectReason":null,"reviewApp":null,"appealDeadline":null}],
    "caseTimeline":[{"date":"","event":"","status":"Completed"}],
    "currentStatus":null,
    "nextSteps":[]
  }
}
规则：缺失字段用null，数组无数据用[]，所有字符串值必须用双引号包裹。`
          }]
        })
      });
      const d = await res.json();
      const raw = d?.choices?.[0]?.message?.content || '';
      if (!raw) throw new Error('Openclaw返回内容为空');
      setImportPreview(extractAndParseJson(raw));
    } catch(err) {
      window.alert('Openclaw快照获取失败: ' + err.message);
    } finally {
      setOcFetching(false);
    }
  };

  /* ── Generate client snapshot (.txt) ────────────────── */
  const generateSnapshot = async () => {
    setGeneratingSnapshot(true);
    try {
      const today = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' });
      const p2 = client.profile || {};

      // Build a structured data summary to feed Claude
      const dataBlock = JSON.stringify({
        name: client.name,
        nameChinese: p2.nameChinese,
        dob: p2.dob,
        sex: p2.sex,
        nationality: client.nationality,
        passportNo: p2.passportNo,
        passportExpiry: p2.passportExpiry,
        chinaId: p2.chinaId,
        auAddress: p2.auAddress,
        maritalStatus: p2.maritalStatus,
        email: client.email,
        phone: client.phone,
        consultant: p2.consultant,
        visaTarget: p2.visaTarget,
        serviceAgreement: p2.serviceAgreement,
        visaHistory: p2.visaHistory,
        skillsAssessments: p2.skillsAssessments,
        caseTimeline: p2.caseTimeline,
        currentStatus: p2.currentStatus,
        nextSteps: p2.nextSteps,
        sponsor: p2.sponsor,
        marriage: p2.marriage,
        keyIssues: p2.keyIssues,
        notes: (client.notes || []).slice(0, 10).map(n => typeof n === 'string' ? n : n.text),
      }, null, 2);

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role: 'user', content:
`You are an expert Australian immigration consultant assistant. Generate a professional bilingual (Chinese/English) client snapshot document based on the following client data.

Client Data (JSON):
${dataBlock}

Generate date: ${today}
Agent: ${p2.consultant || 'Ozsky Migration'}

FORMAT REQUIREMENTS:
- Use the exact same format as the example below (═══ borders, ━━━ section dividers, Chinese section numbers)
- Bilingual headers: Chinese | ENGLISH
- For any field with no data, write: —（未记录）
- Include ALL sections even if empty
- Dates: keep original format from data
- Status icons: ✅ = approved/completed, 🔄 = in progress, ⏳ = pending, ❌ = refused

OUTPUT FORMAT (follow this structure exactly):
═══════════════════════════════════════════════════════════════
             客户档案快照 | CLIENT SNAPSHOT
             [Full Name]
             生成日期：[today]
             经办代理：[consultant]
═══════════════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
一、申请人基本信息 | APPLICANT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Fill in all personal info fields with label : value format]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
二、担保人信息 | SPONSOR DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Sponsor details if available, otherwise note 无担保人信息]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
三、签证申请历史 | VISA APPLICATION HISTORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[All visa history entries with dates and status]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
四、职业评估 | SKILLS ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Skills assessment entries or 暂无职业评估记录]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
五、当前签证状态摘要 | CURRENT VISA STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Current status summary table and next steps]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
六、时间线 | TIMELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[All case timeline events in chronological order]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
七、案件备注 | CASE NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Key issues and notes]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
经办代理：[consultant]
邮箱：[email if known] | BP No: [if known]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output ONLY the document text, no preamble, no markdown fences.` }]
        }),
      });
      const d = await res.json();
      const snapshotText = (d.content || []).map(c => c?.text || '').join('').trim();
      if (!snapshotText) throw new Error('AI 返回内容为空');

      // Download as .txt
      const safeName = (client.name || 'client').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\- ]/g, '').trim();
      const dateStr  = new Date().toISOString().slice(0, 10);
      const blob = new Blob([snapshotText], { type: 'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${safeName}_Client_Snapshot_${dateStr}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(err) {
      window.alert('快照生成失败: ' + err.message);
    } finally {
      setGeneratingSnapshot(false);
    }
  };

  /* ── Paste-text direct import ───────────────────────── */
  const handlePasteImport = async () => {
    if (!pasteText.trim()) return;
    setPasteImporting(true); setImportPreview(null);
    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role:'user', content:
`Extract client data from this Australian immigration document and return ONLY valid JSON, no markdown, no explanation.

Document:
${pasteText.slice(0,10000)}

Return EXACTLY this structure. Each field MUST be on its own line. Use null for missing/unknown fields:
{
  "name": "",
  "nameChinese": "",
  "email": null,
  "phone": null,
  "nationality": null,
  "type": "Migration",
  "profile": {
    "sex": null,
    "dob": null,
    "birthplace": null,
    "passportNo": null,
    "passportExpiry": null,
    "auAddress": null,
    "maritalStatus": null,
    "chinaId": null,
    "qq": null,
    "eaFileNo": null,
    "consultant": null,
    "visaTarget": null,
    "visaHistory": [{"type":"","appNo":"","lodgeDate":"","grantDate":"","expiry":"","status":""}],
    "addressHistory": [{"from":"","to":"","address":""}],
    "employmentHistory": [{"from":"","to":"","company":"","role":"","country":""}],
    "character": {"form80": null, "afpCheck": null, "pcc": null},
    "sponsor": {"name": null, "sex": null, "dob": null, "nationality": null, "passportNo": null, "address": null, "occupation": null, "priorMaritalStatus": null},
    "marriage": {"date": null, "location": null, "registrationNo": null},
    "keyIssues": [{"priority":"High","item":"","detail":""}],
    "documents": [{"name":"","mainApplicant":"","sponsor":"","secondary":""}],
    "serviceAgreement": {"visaTarget": null, "contractDate": null, "totalFee": null, "payment1Amount": null, "payment1Detail": null, "payment2Amount": null, "payment2Detail": null},
    "skillsAssessments": [{"appId":"","occupation":"","body":"","lodgeDate":"","outcome":"Pending","rejectReason":null,"reviewApp":null,"appealDeadline":null}],
    "caseTimeline": [{"date":"","event":"","status":"Completed"}],
    "currentStatus": null,
    "nextSteps": []
  }
}

CRITICAL RULES — YOU MUST FOLLOW THESE:
1. EACH JSON field MUST contain ONLY its own value. NEVER put multiple fields in one string value.
   WRONG: "sex": "null,\\"dob\\":\\"24 Feb\\",\\"birthplace\\":null"
   RIGHT:  "sex": null,  (then "dob" on the next line as a separate field)
2. If a field value is unknown/missing → use JSON null (no quotes), NOT the string "null".
3. ALL string values MUST be in double quotes, including Chinese text.
4. 四、职业评估 / SKILLS ASSESSMENT → skillsAssessments array (one entry per application)
5. Timeline rows / 大事记 → caseTimeline array; status: "Completed"/"In Progress"/"Urgent"/"Pending"
6. Current status summary → currentStatus string; bullet points → nextSteps array
7. Extract ALL visa rows into visaHistory.
8. Return [] for empty arrays, NOT null.
9. If 四、职业评估 says 不适用 or N/A → set "skillsAssessments": [].` }] }),
      });
      const d = await res.json();
      const raw = (d.content || []).map(c => c?.text || '').join('');
      setImportPreview(extractAndParseJson(raw));
    } catch(err) {
      window.alert('Import failed: ' + err.message);
    } finally {
      setPasteImporting(false);
    }
  };

  /* ── AI document import ─────────────────────────────── */
  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportPreview(null);
    try {
      let rawText = '';
      if (file.name.endsWith('.txt')) {
        rawText = await file.text();
      } else {
        const buf = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
        rawText = value;
      }

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{ role:'user', content:
`Extract client data from this Australian immigration document and return ONLY valid JSON, no markdown, no explanation.

Document:
${rawText.slice(0,10000)}

Return EXACTLY this structure. Each field MUST be on its own line. Use null for missing/unknown fields:
{
  "name": "",
  "nameChinese": "",
  "email": null,
  "phone": null,
  "nationality": null,
  "type": "Migration",
  "profile": {
    "sex": null,
    "dob": null,
    "birthplace": null,
    "passportNo": null,
    "passportExpiry": null,
    "auAddress": null,
    "maritalStatus": null,
    "chinaId": null,
    "qq": null,
    "eaFileNo": null,
    "consultant": null,
    "visaTarget": null,
    "visaHistory": [{"type":"","appNo":"","lodgeDate":"","grantDate":"","expiry":"","status":""}],
    "addressHistory": [{"from":"","to":"","address":""}],
    "employmentHistory": [{"from":"","to":"","company":"","role":"","country":""}],
    "character": {"form80": null, "afpCheck": null, "pcc": null},
    "sponsor": {"name": null, "sex": null, "dob": null, "nationality": null, "passportNo": null, "address": null, "occupation": null, "priorMaritalStatus": null},
    "marriage": {"date": null, "location": null, "registrationNo": null},
    "keyIssues": [{"priority":"High","item":"","detail":""}],
    "documents": [{"name":"","mainApplicant":"","sponsor":"","secondary":""}],
    "serviceAgreement": {"visaTarget": null, "contractDate": null, "totalFee": null, "payment1Amount": null, "payment1Detail": null, "payment2Amount": null, "payment2Detail": null},
    "skillsAssessments": [{"appId":"","occupation":"","body":"","lodgeDate":"","outcome":"Pending","rejectReason":null,"reviewApp":null,"appealDeadline":null}],
    "caseTimeline": [{"date":"","event":"","status":"Completed"}],
    "currentStatus": null,
    "nextSteps": []
  }
}

CRITICAL RULES — YOU MUST FOLLOW THESE:
1. EACH JSON field MUST contain ONLY its own value. NEVER put multiple fields in one string value.
   WRONG: "sex": "null,\\"dob\\":\\"24 Feb\\",\\"birthplace\\":null"
   RIGHT:  "sex": null,  (then "dob" on the next line as a separate field)
2. If a field value is unknown/missing → use JSON null (no quotes), NOT the string "null".
3. ALL string values MUST be in double quotes, including Chinese text.
4. 四、职业评估 / SKILLS ASSESSMENT → skillsAssessments array (one entry per application)
5. Timeline rows / 大事记 → caseTimeline array; status: "Completed"/"In Progress"/"Urgent"/"Pending"
6. Current status summary → currentStatus string; bullet points → nextSteps array
7. Extract ALL visa rows into visaHistory.
8. Return [] for empty arrays, NOT null.
9. If 四、职业评估 says 不适用 or N/A → set "skillsAssessments": [].` }] })
      });
      const d = await res.json();
      const raw = (d.content || []).map(c => c?.text || '').join('');
      setImportPreview(extractAndParseJson(raw));
    } catch(err) {
      window.alert('Import failed: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const applyImport = async () => {
    if (!importPreview) return;
    const merged = mergeClientData(client, importPreview, false);
    await onSaveProfile(merged);
    setImportPreview(null);
    setApplyMsg('✅ Client record updated!');
    setTimeout(() => setApplyMsg(''), 3000);
  };

  /* ── Section helpers ─────────────────────────────────── */
  const S = ({ icon, title, children }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:12, color:'#6366f1', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  );

  const Field = ({ label, value, warn }) => (
    <div style={{ background:'#f9fafb', borderRadius:8, padding:'9px 13px', border: warn ? '1px solid #f59e0b60' : '1px solid #e5e7eb' }}>
      <div style={{ fontSize:10, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, color: warn ? '#d97706' : '#111827', fontWeight:500, wordBreak:'break-word' }}>{value || '—'}</div>
    </div>
  );

  const Table = ({ heads, rows }) => (
    <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid #e5e7eb' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ background:'#f8fafc' }}>
            {heads.map(h => <th key={h} style={{ padding:'7px 12px', color:'#1f2937', fontWeight:600, textAlign:'left', whiteSpace:'nowrap', textTransform:'uppercase', fontSize:10, letterSpacing:'0.05em' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={heads.length} style={{ padding:'10px 12px', color:'#1f2937', textAlign:'center', fontSize:12 }}>No records</td></tr>
            : rows.map((r, i) => (
              <tr key={i} style={{ borderTop:'1px solid #e9eaf3', background: i%2===0 ? '#fff' : '#f9fafb' }}>
                {r.map((cell, j) => <td key={j} style={{ padding:'7px 12px', color: cell?.startsWith?.('⚠️') || cell?.startsWith?.('❌') ? '#d97706' : '#374151' }}>{cell || '—'}</td>)}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );

  const allNotes = normalizeNotes(client.notes);
  const gmailNoteCount = allNotes.filter(n => n.type === 'gmail').length;
  const regularNoteCount = allNotes.length - gmailNoteCount;

  const tabs = [
    { id:'profile',  label:'👤 Profile' },
    { id:'jobs',     label:`📋 Cases (${clientJobs.length})` },
    { id:'notes',    label:`📝 ${t('Notes')||'Notes'} (${regularNoteCount})` },
    { id:'wechat',   label:`💬 ${t('WeChat')||'聊天导入'}` },
    { id:'email',    label:`📧 Email${gmailNoteCount ? ` (${gmailNoteCount})` : ''}` },
    { id:'import',   label:`📥 ${t('Import Doc')||'Import Doc'}` },
    { id:'ai',       label:`🤖 AI 助手` },
  ];

  return (
    <Modal title={`${t('Client —')} ${client.name}`} onClose={onClose} wide>
      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid #e2e8f0', paddingBottom:0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'8px 16px', background:'none', border:'none', color: tab===t.id ? '#ff158a' : '#6b7280', fontWeight: tab===t.id ? 700 : 400, fontSize:13, borderBottom: tab===t.id ? '2px solid #ff158a' : '2px solid transparent', cursor:'pointer', marginBottom:-1 }}>{t.label}</button>
        ))}
      </div>

      {/* ── PROFILE TAB ──────────────────────────────────── */}
      {tab === 'profile' && (
        <div style={{ paddingRight:2 }}>

          {/* ── SNAPSHOT HEADER CARD ─────────────────────── */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, padding:'16px 20px', background:'linear-gradient(135deg,#1c1f3a,#2d3563)', borderRadius:14, color:'#fff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'#fff', flexShrink:0, border:'2px solid rgba(255,255,255,0.3)' }}>{initials(client.name)}</div>
              <div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>CLIENT SNAPSHOT CARD</div>
                <div style={{ fontSize:20, fontWeight:800, letterSpacing:'0.02em' }}>{client.name}</div>
                {(p.nameZh || p.nameChinese) && <div style={{ fontSize:14, color:'rgba(255,255,255,0.7)', marginTop:1 }}>{p.nameZh || p.nameChinese}</div>}
                {p.dob && <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:3 }}>DOB: {p.dob}</div>}
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
              <StatusBadge status={client.status} />
              <button onClick={onEdit} style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:8, padding:'5px 12px', color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}>✏️ {t('Edit Profile')}</button>
              <button
                onClick={generateSnapshot}
                disabled={generatingSnapshot}
                style={{ background: generatingSnapshot ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.85)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:8, padding:'5px 12px', color:'#fff', fontSize:11, fontWeight:600, cursor: generatingSnapshot ? 'default' : 'pointer', whiteSpace:'nowrap' }}
              >
                {generatingSnapshot ? '⏳ 生成中...' : '📥 生成快照 .txt'}
              </button>
            </div>
          </div>

          {/* ── 一、PERSONAL INFORMATION ────────────────── */}
          <S icon="👤" title={`一、${t('PERSONAL INFORMATION')}`}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              <Field label={t('Full Name')}       value={client.name} />
              <Field label={t('Gender')}          value={p.sex} />
              <Field label={t('Date of Birth')}   value={p.dob} />
              <Field label={t('Birthplace')}      value={p.birthplace} />
              <Field label={t('Nationality')}     value={client.nationality} />
              <Field label={t('Email')}           value={client.email} />
              <Field label={t('Mobile')}          value={client.phone} />
              <Field label="QQ"                   value={p.qq} />
              <Field label={t('EA File No')}      value={p.eaFileNo} />
              <Field label={t('Passport No')}     value={p.passportNo} />
              <Field label={t('Passport Expiry')} value={p.passportExpiry} warn={p.passportExpiry && new Date(p.passportExpiry) < new Date(Date.now()+6*30*24*3600*1000)} />
              <Field label={t('China ID')}        value={p.chinaId} />
              <Field label={t('AU Address')}      value={p.auAddress} />
              <Field label={t('Marital Status')}  value={p.maritalStatus} />
              <Field label={t('Consultant')}      value={p.consultant} />
            </div>
          </S>

          {/* ── 二、SERVICE AGREEMENT ───────────────────── */}
          {(p.serviceAgreement?.contractDate || p.serviceAgreement?.totalFee || p.visaTarget) && (
            <S icon="📄" title={`二、${t('SERVICE AGREEMENT')}`}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:10 }}>
                <Field label={t('Visa Target')}    value={p.visaTarget || p.serviceAgreement?.visaTarget} />
                <Field label={t('Contract Date')}  value={p.serviceAgreement?.contractDate} />
                <Field label={t('Total Fee')}      value={p.serviceAgreement?.totalFee} />
              </div>
              {(p.serviceAgreement?.payments||[]).length > 0 && (
                <Table
                  heads={['#', t('Amount'), t('Status'), t('Details')]}
                  rows={(p.serviceAgreement.payments||[]).map((pay,i)=>[
                    `${t('Payment')} ${i+1}`,
                    pay.amount,
                    pay.status,
                    pay.includes || pay.details || '—'
                  ])}
                />
              )}
              {p.serviceAgreement?.payment1Amount && (
                <Table
                  heads={['#', t('Amount'), t('Status'), t('Details')]}
                  rows={[
                    [`${t('Payment')} 1`, p.serviceAgreement.payment1Amount, t('Paid'), p.serviceAgreement.payment1Details||'—'],
                    [`${t('Payment')} 2`, p.serviceAgreement.payment2Amount, t('Pending'), p.serviceAgreement.payment2Details||'—'],
                  ]}
                />
              )}
            </S>
          )}

          {/* ── 三、VISA HISTORY ────────────────────────── */}
          <S icon="🛂" title={`三、${t('VISA HISTORY')}`}>
            {(p.visaHistory||[]).length === 0
              ? <div style={{ fontSize:12, color:'#1f2937', padding:'8px 0' }}>{t('No records')}</div>
              : <Table
                  heads={[t('Visa Type'), t('Application No'), t('Lodged'), t('Granted'), t('Status')]}
                  rows={(p.visaHistory||[]).map(v=>[
                    v.type, v.number, v.lodged||v.lodgeDate, v.grantDate||v.granted,
                    v.status==='Approved'?`✅ ${t('Approved')}`:v.status==='In Progress'?`⏳ ${t('In Progress')}`:v.status==='Refused'?`❌ ${t('Refused')}`:v.status||'—'
                  ])}
                />
            }
          </S>

          {/* ── 四、SKILLS ASSESSMENT ───────────────────── */}
          {(p.skillsAssessments||[]).length > 0 && (
            <S icon="📊" title={`四、${t('SKILLS ASSESSMENT')}`}>
              {(p.skillsAssessments||[]).map((sa, idx) => {
                const isUnsuc = sa.outcome?.toLowerCase().includes('unsuccessful') || sa.outcome?.toLowerCase().includes('不通过');
                const outColor = sa.outcome ? (isUnsuc ? '#ef4444' : '#16a34a') : '#6b7280';
                return (
                  <div key={idx} style={{ marginBottom:14, background:'#f9fafb', borderRadius:12, padding:'14px 16px', border:`1px solid ${isUnsuc?'#fecaca':'#e5e7eb'}`, borderLeft:`4px solid ${isUnsuc?'#ef4444':'#ff158a'}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>{t('Application ID')}: {sa.applicationId}</div>
                      {sa.outcome && <span style={{ fontSize:11, fontWeight:700, color:outColor, background:outColor+'15', padding:'3px 10px', borderRadius:20 }}>{isUnsuc?`❌ ${t('Unsuccessful')}`:`✅ ${t('Successful')}`}</span>}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      <Field label={t('Occupation')}   value={sa.occupation} />
                      <Field label={t('Submitted')}    value={sa.submitted||sa.lodgeDate} />
                      <Field label={t('Outcome')}      value={sa.outcome} warn={isUnsuc} />
                      {sa.furtherDocs && <Field label={t('Further Docs Requested')} value={sa.furtherDocs} />}
                      {sa.reason && <Field label={t('Reason')} value={sa.reason} warn />}
                      {sa.appealDeadline && <Field label={t('Appeal Deadline')} value={sa.appealDeadline} warn={new Date(sa.appealDeadline) < new Date(Date.now()+30*24*3600*1000)} />}
                    </div>
                  </div>
                );
              })}
            </S>
          )}

          {/* ── 五、CASE TIMELINE ───────────────────────── */}
          {(p.caseTimeline||[]).length > 0 && (
            <S icon="📅" title={`五、${t('CASE TIMELINE')}`}>
              <div style={{ position:'relative', paddingLeft:20 }}>
                <div style={{ position:'absolute', left:7, top:8, bottom:8, width:2, background:'linear-gradient(to bottom, #6366f1, #e5e7eb)', borderRadius:2 }} />
                {(p.caseTimeline||[]).map((ev, i) => {
                  const stCol = ev.status==='Completed'?'#16a34a':ev.status==='Failed'?'#dc2626':ev.status==='Urgent'?'#d97706':ev.status==='Maintained'?'#dc2626':'#6366f1';
                  return (
                    <div key={i} style={{ display:'flex', gap:14, marginBottom:12, alignItems:'flex-start' }}>
                      <div style={{ width:12, height:12, borderRadius:'50%', background:stCol, border:'2px solid #fff', boxShadow:`0 0 0 2px ${stCol}40`, flexShrink:0, marginTop:3, zIndex:1 }} />
                      <div style={{ flex:1, background:'#fff', borderRadius:8, padding:'9px 13px', border:'1px solid #e5e7eb' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'#111827' }}>{ev.event}</span>
                          <span style={{ fontSize:10, fontWeight:700, color:stCol, background:stCol+'15', padding:'2px 8px', borderRadius:20 }}>{ev.status}</span>
                        </div>
                        <div style={{ fontSize:11, color:'#1f2937' }}>{ev.date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </S>
          )}

          {/* ── 六、CURRENT STATUS & NEXT STEPS ──────────── */}
          {(p.currentStatus || (p.nextSteps||[]).length > 0) && (
            <S icon="⚡" title={`六、${t('CURRENT STATUS & NEXT STEPS')}`}>
              {p.currentStatus && (
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'12px 16px', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span>⚠️</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#dc2626' }}>{t('Status Summary')}</span>
                  </div>
                  <div style={{ fontSize:13, color:'#7f1d1d', lineHeight:1.6 }}>{p.currentStatus}</div>
                </div>
              )}
              {(p.nextSteps||[]).length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:'#1f2937', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{t('Options to Consider')}</div>
                  {(p.nextSteps||[]).map((step, i) => {
                    const col = step.priority==='High'?'#ef4444':step.priority==='Medium'?'#f59e0b':'#22c55e';
                    return (
                      <div key={i} style={{ display:'flex', gap:12, marginBottom:8, background:'#f9fafb', borderRadius:8, padding:'10px 14px', border:'1.5px solid #cbd5e1', borderLeft:`3px solid ${col}` }}>
                        <div style={{ width:22, height:22, borderRadius:'50%', background:col+'20', border:`1px solid ${col}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:col, flexShrink:0 }}>{i+1}</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:3 }}>{step.action}</div>
                          <div style={{ fontSize:12, color:'#1f2937', lineHeight:1.5 }}>{step.details}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </S>
          )}

          {/* ── 七、NOTES ───────────────────────────────── */}
          <S icon="📝" title={`七、${t('NOTES')}`}>
            <NotesPanel notes={normalizeNotes(client.notes).filter(n => n.type !== 'gmail')} onAddNote={(text) => onSaveProfile({...client, notes:[makeNote(text),...normalizeNotes(client.notes)]})} onDeleteNote={(nid)=>onSaveProfile({...client,notes:normalizeNotes(client.notes).filter(n=>n.id!==nid)})} />
          </S>

          {/* empty state */}
          {!p.dob && !p.passportNo && !(p.visaHistory?.length) && !(p.skillsAssessments?.length) && !(p.caseTimeline?.length) && (
            <div style={{ textAlign:'center', padding:'30px 20px', color:'#1f2937', background:'#f9fafb', borderRadius:12, border:'2px dashed #e5e7eb' }}>
              <div style={{ fontSize:32, marginBottom:10 }}>📥</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#1f2937', marginBottom:6 }}>No detailed profile yet</div>
              <div style={{ fontSize:12, marginBottom:14 }}>Import a document or fill in manually via Edit</div>
              <button onClick={()=>setTab('import')} style={{ padding:'9px 18px', background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>📥 Import Document →</button>
            </div>
          )}
        </div>
      )}

      {/* ── JOBS TAB ─────────────────────────────────────── */}
      {/* ── JOBS TAB ─────────────────────────────────────── */}
      {tab === 'jobs' && (
        <div>
          {/* Header with Add button */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:13, color:'#374151', fontWeight:600 }}>{clientJobs.length} 个案件</span>
            <button onClick={() => { setQform({ title:'', type:'Subclass 500 – Student Visa', clientId:client.id, assignedTo:team[0]?.id||'', status:'New', priority:'Medium', dueDate:'', progress:0 }); setQuickJob(true); }}
              style={{ padding:'6px 14px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              + 新建案件
            </button>
          </div>

          {/* Quick create form */}
          {quickJob && (
            <div style={{ background:'#f8fafc', border:'1.5px solid #6366f130', borderRadius:10, padding:'14px 16px', marginBottom:14 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#4f46e5', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.07em' }}>新建案件</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <input style={{ ...inputStyle, fontSize:13 }} placeholder="案件标题 *" value={qform.title||''} onChange={e=>setQform(f=>({...f,title:e.target.value}))} />
                <select style={{ ...selectStyle, fontSize:13 }} value={qform.type} onChange={e=>setQform(f=>({...f,type:e.target.value}))}>
                  {JOB_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
                <select style={{ ...selectStyle, fontSize:13 }} value={qform.assignedTo} onChange={e=>setQform(f=>({...f,assignedTo:e.target.value}))}>
                  {team.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select style={{ ...selectStyle, fontSize:13 }} value={qform.status} onChange={e=>setQform(f=>({...f,status:e.target.value}))}>
                  {JOB_STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
                <select style={{ ...selectStyle, fontSize:13 }} value={qform.priority} onChange={e=>setQform(f=>({...f,priority:e.target.value}))}>
                  {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                </select>
                <input type="date" style={{ ...inputStyle, fontSize:13 }} value={qform.dueDate||''} onChange={e=>setQform(f=>({...f,dueDate:e.target.value}))} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={() => setQuickJob(false)} style={{ padding:'7px 16px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:7, color:'#374151', fontSize:12 }}>取消</button>
                <button onClick={async () => {
                  if (!qform.title?.trim()) return;
                  const newJob = { ...qform, id: 'j'+uid(), createdAt: new Date().toISOString(), progress: 0 };
                  setJobs(prev => [...prev, newJob]);
                  try { await sbInsert('jobs', { id: newJob.id, data: newJob }); } catch(e) { console.warn(e); }
                  setQuickJob(false);
                }} style={{ padding:'7px 16px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:7, color:'#fff', fontSize:12, fontWeight:600 }}>保存案件</button>
              </div>
            </div>
          )}

          {/* Jobs list */}
          {clientJobs.length === 0 && !quickJob
            ? <div style={{ color:'#374151', fontSize:14, padding:'20px 0', textAlign:'center' }}>暂无关联案件，点击"新建案件"开始。</div>
            : clientJobs.map(j => (
              <div key={j.id} onClick={()=>setViewJob(j)} style={{ background:'#ffffff', borderRadius:10, padding:'13px 16px', border:'1.5px solid #cbd5e1', cursor:'pointer', marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'#111827' }}>{j.title}</span>
                  <StatusBadge status={j.status} />
                </div>
                <div style={{ fontSize:12, color:'#374151', marginBottom:8 }}>{j.type} · Due {fmtDate(j.dueDate)||'—'}</div>
                <ProgressBar value={j.progress} status={j.status} />
                {j.priority && <div style={{marginTop:6}}><PriorityBadge priority={j.priority} /></div>}
              </div>
            ))
          }
        </div>
      )}

      {/* ── CASE DETAIL MODAL from Client tab ──────────── */}
      {viewJob && (() => {
        const checklist3 = DOC_CHECKLISTS[viewJob.type] || [];
        const docs3 = viewJob.docs || {};
        const pct3 = STATUS_PROGRESS[viewJob.status] ?? viewJob.progress ?? 0;
        const docsReceived3 = checklist3.filter(d=>docs3[d]).length;
        const getMember3 = id => team.find(t=>t.id===id);
        return (
          <Modal title={viewJob.title} onClose={()=>setViewJob(null)} wide>
            <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius:12, padding:'14px 18px', marginBottom:16, color:'#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:3 }}>案件进度</div>
                  <div style={{ fontSize:15, fontWeight:700 }}>{client.name} · {viewJob.type}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)', marginTop:2 }}>负责人: {getMember3(viewJob.assignedTo)?.name||'—'} · Due {fmtDate(viewJob.dueDate)||'—'}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:28, fontWeight:800, color: pct3>=100?'#34d399':pct3>=70?'#a5b4fc':'#fbbf24', lineHeight:1 }}>{pct3}%</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{viewJob.status}</div>
                </div>
              </div>
              <div style={{ height:5, borderRadius:5, background:'rgba(255,255,255,0.15)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct3}%`, background: pct3>=100?'#34d399':pct3>=70?'#818cf8':'#fbbf24', borderRadius:5 }} />
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>最新进展 <span style={{ color:'#9ca3af', fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 }}>(失焦自动保存)</span></div>
                <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:6, color:'#374151', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  📄 上传快照
                  <input type="file" accept=".docx,.pdf,.txt" style={{display:'none'}} onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    try {
                      let rawText = '';
                      if (file.name.endsWith('.txt')) { rawText = await file.text(); }
                      else { const buf = await file.arrayBuffer(); const { value } = await mammoth.extractRawText({ arrayBuffer: buf }); rawText = value; }
                      const res = await fetch('/api/claude', { method:'POST', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:2000,
                          messages:[{ role:'user', content:`Extract case timeline and current status from this immigration snapshot. Return ONLY valid JSON:
{"snapshot":"brief 1-2 sentence current status","caseTimeline":[{"date":"","event":"","status":"Completed"}]}
Status values: Completed/In Progress/Urgent/Pending
Document:
${rawText.slice(0,5000)}` }]
                        })
                      });
                      const d = await res.json();
                      const txt = (d.content?.[0]?.text||'').replace(/```json|```/g,'').trim();
                      const parsed = JSON.parse(txt);
                      const updated = { ...viewJob, ...(parsed.snapshot?{snapshot:parsed.snapshot}:{}), ...(parsed.caseTimeline?.length?{caseTimeline:parsed.caseTimeline}:{}) };
                      setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
                      try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
                    } catch(err) { window.alert('Import failed: '+err.message); }
                    e.target.value='';
                  }} />
                </label>
              </div>
              <textarea style={{ width:'100%', background:'#f8fafc', border:'2px solid #c7d2e0', borderRadius:9, padding:'9px 12px', fontSize:13, color:'#111827', resize:'vertical', minHeight:72, fontFamily:'inherit', lineHeight:1.55, outline:'none', boxSizing:'border-box' }}
                placeholder="记录最新案件进展..." defaultValue={viewJob.snapshot||''}
                onBlur={async e => {
                  if (e.target.value===(viewJob.snapshot||'')) return;
                  const updated={...viewJob,snapshot:e.target.value};
                  setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
                  try { await sbUpdate('jobs',updated.id,{data:updated}); } catch(er){ console.warn(er); }
                }}
              />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:2 }}>案件信息</div>
                {[['类型', viewJob.type], ['截止日期', fmtDate(viewJob.dueDate)], ['创建', fmtDate(viewJob.createdAt)]].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', background:'#f8fafc', borderRadius:8, padding:'7px 11px', border:'1.5px solid #e2e8f0' }}>
                    <span style={{ fontSize:11, color:'#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{l}</span>
                    <span style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{v}</span>
                  </div>
                ))}
                {(() => { const vm = getMember3(viewJob.assignedTo); return vm ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:8, padding:'7px 11px', border:'1.5px solid #e2e8f0' }}>
                    <span style={{ fontSize:11, color:'#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', flex:1 }}>负责人</span>
                    <Avatar name={vm.name} color={vm.color} size={22} />
                    <span style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{vm.name}</span>
                  </div>
                ) : null; })()}
              </div>
              {checklist3.length > 0 && (
                <div>
                  <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>材料清单 ({docsReceived3}/{checklist3.length})</div>
                  <div style={{ background:'#f9fafb', borderRadius:8, padding:'8px 10px', maxHeight:150, overflowY:'auto', border:'1.5px solid #e2e8f0' }}>
                    {checklist3.map(doc=>(
                      <div key={doc} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', borderBottom:'1px solid #f1f5f9' }}>
                        <span style={{ fontSize:14, color:docs3[doc]?'#34d399':'#cbd5e1' }}>{docs3[doc]?'✓':'○'}</span>
                        <span style={{ fontSize:12, color:docs3[doc]?'#94a3b8':'#374151', textDecoration:docs3[doc]?'line-through':'none' }}>{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {(viewJob.caseTimeline||[]).length > 0 && (
              <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:14, marginBottom:14 }}>
                <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>大事记</div>
                <div style={{ position:'relative', paddingLeft:18, maxHeight:160, overflowY:'auto' }}>
                  <div style={{ position:'absolute', left:5, top:6, bottom:6, width:2, background:'linear-gradient(to bottom,#6366f1,#e2e8f0)', borderRadius:2 }} />
                  {(viewJob.caseTimeline||[]).map((ev,i) => {
                    const col=ev.status==='Completed'?'#16a34a':ev.status==='Urgent'?'#d97706':ev.status==='Failed'?'#dc2626':'#6366f1';
                    return (
                      <div key={i} style={{ display:'flex', gap:12, marginBottom:8, alignItems:'flex-start' }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background:col, border:'2px solid #fff', flexShrink:0, marginTop:3 }} />
                        <div style={{ flex:1, background:'#fff', borderRadius:7, padding:'7px 11px', border:'1px solid #e5e7eb' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <span style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{ev.event}</span>
                            <span style={{ fontSize:10, fontWeight:700, color:col, background:col+'15', padding:'2px 7px', borderRadius:10 }}>{ev.status}</span>
                          </div>
                          <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{ev.date}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', gap:8 }}><StatusBadge status={viewJob.status} /><PriorityBadge priority={viewJob.priority} /></div>
                <button onClick={()=>setViewJob(null)} style={{ padding:'8px 16px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:8, color:'#374151', fontSize:13 }}>关闭</button>
                <button onClick={()=>{ setJobForm({...viewJob}); setEditingJob(viewJob); }} style={{ padding:'8px 18px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>✏️ 编辑案件</button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── INLINE CASE EDIT ── */}
      {editingJob && (
        <Modal title={`编辑案件: ${editingJob.title}`} onClose={()=>setEditingJob(null)} wide>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:5 }}>状态</label>
              <select value={jobForm.status||''} onChange={e=>setJobForm(f=>({...f,status:e.target.value, progress: STATUS_PROGRESS[e.target.value] ?? f.progress ?? 0}))} style={{ width:'100%', background:'#fff', border:'2px solid #c7d2e0', borderRadius:8, padding:'8px 10px', fontSize:13, color:'#111827', outline:'none' }}>
                {JOB_STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:5 }}>优先级</label>
              <select value={jobForm.priority||''} onChange={e=>setJobForm(f=>({...f,priority:e.target.value}))} style={{ width:'100%', background:'#fff', border:'2px solid #c7d2e0', borderRadius:8, padding:'8px 10px', fontSize:13, color:'#111827', outline:'none' }}>
                {['Low','Medium','High','Urgent'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:5 }}>截止日期</label>
              <input type="date" value={jobForm.dueDate?.slice(0,10)||''} onChange={e=>setJobForm(f=>({...f,dueDate:e.target.value}))} style={{ width:'100%', background:'#fff', border:'2px solid #c7d2e0', borderRadius:8, padding:'8px 10px', fontSize:13, color:'#111827', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div><label style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:5 }}>负责人</label>
              <select value={jobForm.assignedTo||''} onChange={e=>setJobForm(f=>({...f,assignedTo:e.target.value}))} style={{ width:'100%', background:'#fff', border:'2px solid #c7d2e0', borderRadius:8, padding:'8px 10px', fontSize:13, color:'#111827', outline:'none' }}>
                <option value="">— 未分配 —</option>
                {team.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          {(DOC_CHECKLISTS[editingJob.type]||[]).length > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>材料清单</div>
              <div style={{ background:'#f9fafb', borderRadius:8, padding:'8px 10px', border:'1.5px solid #e2e8f0' }}>
                {(DOC_CHECKLISTS[editingJob.type]||[]).map(doc=>(
                  <label key={doc} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', cursor:'pointer' }}>
                    <input type="checkbox" checked={!!(jobForm.docs||{})[doc]} onChange={e=>setJobForm(f=>({...f,docs:{...(f.docs||{}),[doc]:e.target.checked}}))} />
                    <span style={{ fontSize:12, color:'#374151' }}>{doc}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingTop:14, borderTop:'1.5px solid #e2e8f0' }}>
            <button onClick={()=>setEditingJob(null)} style={{ padding:'9px 18px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:8, color:'#374151', fontSize:13 }}>取消</button>
            <button onClick={async()=>{
              const updated = {...editingJob, ...jobForm};
              setJobs(prev=>prev.map(j=>j.id===updated.id?updated:j));
              setViewJob(updated); setEditingJob(null);
              try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
            }} style={{ padding:'9px 22px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>💾 保存</button>
          </div>
        </Modal>
      )}

      {/* ── NOTES TAB ────────────────────────────────────── */}
      {tab === 'notes' && (
        <div style={{ maxHeight:'65vh', overflowY:'auto' }}>

          {/* Quick paste + AI note panel */}
          <div style={{ background:'linear-gradient(135deg,#f8fafc,#f1f5f9)', border:'1.5px solid #cbd5e1', borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:8 }}>📋 粘贴/添加备注 Add Note</div>
            <textarea
              value={noteImportText}
              onChange={e=>{ setNoteImportText(e.target.value); setNoteImportResult(null); setNoteImportSaved(false); }}
              placeholder="粘贴备注内容或直接输入… Paste or type note here (Chinese/English)…"
              style={{ ...inputStyle, minHeight:90, fontSize:13, resize:'vertical', background:'#fff' }}
            />
            {noteImportResult && (
              <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:8, padding:'10px 12px', marginTop:8, fontSize:13, color:'#0c4a6e', lineHeight:1.6 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#0369a1', marginBottom:4 }}>🤖 AI摘要 Summary</div>
                {noteImportResult}
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
              {noteImportText.trim() && !noteImportResult && (
                <button onClick={parseNoteImport} disabled={noteImportParsing} style={{ padding:'7px 16px', background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                  {noteImportParsing ? '⏳ AI处理中…' : '🤖 AI摘要 Summarise'}
                </button>
              )}
              {noteImportText.trim() && (
                <button onClick={()=>saveNoteImport(false)} style={{ padding:'7px 16px', background:'#f3f4f6', border:'1.5px solid #cbd5e1', borderRadius:8, color:'#374151', fontWeight:600, fontSize:12, cursor:'pointer' }}>
                  📝 直接保存 Save as-is
                </button>
              )}
              {noteImportResult && (
                <button onClick={()=>saveNoteImport(true)} style={{ padding:'7px 16px', background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                  ✅ 保存AI摘要 Save Summary
                </button>
              )}
              {noteImportSaved && <span style={{ fontSize:12, color:'#10b981', fontWeight:600, alignSelf:'center' }}>✅ 已保存！</span>}
            </div>
          </div>

          {/* Existing notes list */}
          {normalizeNotes(client.notes).filter(n => n.type !== 'gmail').length === 0
            ? <div style={{ color:'#1f2937', fontSize:14, padding:20, textAlign:'center' }}>No notes yet.</div>
            : [...normalizeNotes(client.notes).filter(n => n.type !== 'gmail')].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(n => (
              <div key={n.id} style={{ background:'#ffffff', borderRadius:8, padding:'12px 14px', border:'1.5px solid #cbd5e1', marginBottom:8 }}>
                <div style={{ fontSize:13, color:'#1f2937', whiteSpace:'pre-wrap', lineHeight:1.55 }}>{n.text}</div>
                <div style={{ fontSize:11, color:'#1f2937', marginTop:6 }}>{fmtDateTime(n.createdAt)}</div>
              </div>
            ))
          }
        </div>
      )}


      {/* ── WECHAT TAB ───────────────────────────────────── */}
      {tab === 'wechat' && (
        <div style={{ maxHeight:'65vh', overflowY:'auto', paddingRight:4 }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, padding:'14px 16px', background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderRadius:12, border:'1px solid #86efac' }}>
            <div style={{ fontSize:28 }}>💬</div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#15803d' }}>Communication Import 沟通记录导入</div>
              <div style={{ fontSize:12, color:'#4ade80', marginTop:2 }}>Paste any chat history (WeChat/SMS/etc) — AI extracts key info &amp; summaries 粘贴任意聊天记录</div>
            </div>
          </div>

          {/* Paste area */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7 }}>
              粘贴聊天记录 / Paste Chat Export
              <span style={{ marginLeft:8, fontSize:10, fontWeight:500, color:'#1f2937', textTransform:'none', letterSpacing:0 }}>
                (微信 · SMS · 任意聊天记录 — 直接粘贴即可)
              </span>
            </label>
            <textarea
              value={wchat}
              onChange={e => { setWchat(e.target.value); setWchatResult(null); setWchatSaved(false); }}
              placeholder="粘贴聊天记录（支持中文/英文）e.g. 2024-01-15 10:23 客户: 您好，我想咨询签证问题... / e.g. Client: Hi I need help with my student visa..."
              style={{ ...inputStyle, minHeight:180, fontFamily:"'JetBrains Mono',monospace", fontSize:12.5, resize:'vertical', background:'#f9fafb', lineHeight:1.6 }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
              <span style={{ fontSize:12, color:'#1f2937' }}>{wchat.length > 0 ? `${wchat.length.toLocaleString()} chars · ${Math.ceil(wchat.length/4)} tokens` : '最多分析6000字符'}</span>
              <div style={{ display:'flex', gap:10 }}>
                {wchat && <button onClick={()=>{setWchat('');setWchatResult(null);}} style={{ padding:'8px 14px', background:'#f3f4f6', border:'1.5px solid #cbd5e1', borderRadius:8, fontSize:12, color:'#1f2937', fontWeight:600 }}>Clear</button>}
                <button
                  onClick={parseWeChat}
                  disabled={wchatParsing || !wchat.trim()}
                  style={{ padding:'9px 20px', background: wchatParsing||!wchat.trim() ? '#e5e7eb' : 'linear-gradient(135deg,#22c55e,#16a34a)', border:'none', borderRadius:9, color: wchatParsing||!wchat.trim() ? '#9ca3af' : '#fff', fontWeight:700, fontSize:13, cursor: wchatParsing||!wchat.trim() ? 'default':'pointer', display:'flex', alignItems:'center', gap:7, transition:'all 0.15s' }}
                >
                  {wchatParsing ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⏳</span> Analysing...</> : '🤖 Analyse with AI'}
                </button>
              </div>
            </div>
          </div>

          {/* AI result */}
          {wchatResult && (
            <div style={{ background:'#fff', border:'1.5px solid #cbd5e1', borderRadius:14, overflow:'hidden', marginTop:4 }}>
              {/* Result header */}
              <div style={{ padding:'14px 18px', background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderBottom:'1px solid #bbf7d0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#15803d' }}>✅ Analysis Complete</div>
                  {wchatResult.dateRange && <div style={{ fontSize:12, color:'#4ade80', marginTop:2 }}>📅 {wchatResult.dateRange} · {wchatResult.messageCount} messages · {wchatResult.language}</div>}
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {/* Sentiment badge */}
                  {wchatResult.sentiment && (
                    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700,
                      background: wchatResult.sentiment==='urgent' ? '#fef2f2' : wchatResult.sentiment==='positive' ? '#f0fdf4' : wchatResult.sentiment==='concerned' ? '#fffbeb' : '#f0f9ff',
                      color: wchatResult.sentiment==='urgent' ? '#dc2626' : wchatResult.sentiment==='positive' ? '#16a34a' : wchatResult.sentiment==='concerned' ? '#d97706' : '#0284c7'
                    }}>
                      {wchatResult.sentiment==='urgent'?'🚨':wchatResult.sentiment==='positive'?'😊':wchatResult.sentiment==='concerned'?'⚠️':'💬'} {wchatResult.sentiment}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding:'16px 18px' }}>
                {/* Summary */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Summary</div>
                  <div style={{ fontSize:13.5, color:'#1f2937', lineHeight:1.6, background:'#f9fafb', padding:'10px 14px', borderRadius:9, border:'1px solid #e5e7eb' }}>{wchatResult.summary}</div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                  {/* Action Items */}
                  {wchatResult.actionItems?.length > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>🎯 Action Items</div>
                      {wchatResult.actionItems.map((item,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:5 }}>
                          <span style={{ width:18, height:18, borderRadius:99, background:'#fef2f2', border:'1px solid #fecaca', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#dc2626', flexShrink:0, marginTop:1 }}>{i+1}</span>
                          <span style={{ fontSize:12.5, color:'#1f2937', lineHeight:1.5 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Client Requests */}
                  {wchatResult.clientRequests?.length > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>💬 Client Requests</div>
                      {wchatResult.clientRequests.map((req,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:5 }}>
                          <span style={{ fontSize:13, flexShrink:0 }}>•</span>
                          <span style={{ fontSize:12.5, color:'#1f2937', lineHeight:1.5 }}>{req}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Important Dates */}
                {wchatResult.importantDates?.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>📅 Important Dates</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {wchatResult.importantDates.map((d,i) => (
                        <span key={i} style={{ padding:'4px 10px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, fontSize:12, color:'#2563eb', fontWeight:500 }}>{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Topics / Tags */}
                {wchatResult.tags?.length > 0 && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>🏷 Topics</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {wchatResult.tags.map((t,i) => (
                        <span key={i} style={{ padding:'3px 9px', background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:7, fontSize:11.5, color:'#7c3aed', fontWeight:500 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save to notes */}
                <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:14, display:'flex', justifyContent:'flex-end', gap:10 }}>
                  {wchatSaved && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600, alignSelf:'center' }}>✅ Saved to client notes!</span>}
                  <button onClick={saveWchatNote} disabled={wchatSaved} style={{ padding:'9px 20px', background: wchatSaved ? '#f3f4f6' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:9, color: wchatSaved ? '#9ca3af':'#fff', fontWeight:700, fontSize:13, cursor: wchatSaved ? 'default':'pointer' }}>
                    {wchatSaved ? '✅ Saved' : '💾 Save Summary to Client Notes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EMAIL TAB ───────────────────────────────────── */}
      {tab === 'email' && (
        <div style={{ maxHeight:'65vh', overflowY:'auto', paddingRight:4 }}>
          {/* ── Gmail saved email notes ── */}
          {(() => {
            const gmailNotes = [...normalizeNotes(client.notes)]
              .filter(n => n.type === 'gmail')
              .sort((a, b) => new Date(a.emailDate || a.createdAt) - new Date(b.emailDate || b.createdAt));
            if (gmailNotes.length === 0) return null;
            const urgencyColorMap = { high:'#ef4444', medium:'#f59e0b', low:'#10b981', neutral:'#6366f1' };
            return (
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
                  📧 Gmail History ({gmailNotes.length})
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:300, overflowY:'auto' }}>
                  {gmailNotes.map(n => (
                    <div key={n.id} style={{
                      border:'1px solid #e5e7eb',
                      borderLeft:`3px solid ${urgencyColorMap[n.urgency] || '#6366f1'}`,
                      borderRadius:8, padding:'9px 12px', background:'#fff', position:'relative',
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <div style={{ fontWeight:600, fontSize:13, color:'#1f2937', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:8 }}>
                          {n.subject || '（无主题）'}
                        </div>
                        <div style={{ fontSize:11, color:'#6b7280', whiteSpace:'nowrap' }}>
                          {n.emailDate ? fmtDate(n.emailDate) : fmtDateTime(n.createdAt)}
                        </div>
                      </div>
                      <div style={{ fontSize:12, color:'#374151', whiteSpace:'pre-line', lineHeight:1.5 }}>{n.text}</div>
                      <button onClick={() => onSaveProfile({ ...client, notes: normalizeNotes(client.notes).filter(note => note.id !== n.id) })}
                        style={{ position:'absolute', top:8, right:8, background:'none', border:'none', color:'#9ca3af', fontSize:14, lineHeight:1, padding:2, cursor:'pointer' }} title="Delete">×</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, padding:'14px 16px', background:'linear-gradient(135deg,#eff6ff,#dbeafe)', borderRadius:12, border:'1px solid #93c5fd' }}>
            <div style={{ fontSize:28 }}>📧</div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'#1d4ed8' }}>Email Communication Import</div>
              <div style={{ fontSize:12, color:'#3b82f6', marginTop:2 }}>Paste email thread — AI will summarise key points &amp; action items into client notes</div>
            </div>
          </div>

          {/* Tip */}
          <div style={{ padding:'10px 14px', background:'#fefce8', border:'1px solid #fde68a', borderRadius:9, fontSize:12, color:'#92400e', marginBottom:14 }}>
            💡 <strong>Tip:</strong> Forward or CC client emails to your inbox, then paste the thread here. The AI will extract key information and save it as a timestamped note.
          </div>

          {/* Paste area */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7 }}>
              Paste Email Thread
              <span style={{ marginLeft:8, fontSize:10, fontWeight:500, color:'#6b7280', textTransform:'none', letterSpacing:0 }}>
                (粘贴邮件内容 — 支持中英文)
              </span>
            </label>
            <textarea
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailResult(null); setEmailSaved(false); }}
              placeholder="Paste email content here. Include subject, date, and body. e.g.&#10;From: client@email.com&#10;Subject: Re: Student Visa Application&#10;Date: 12 Mar 2026&#10;&#10;Hi, I have a question about my visa..."
              style={{ width:'100%', padding:'12px 14px', border:'1.5px solid #cbd5e1', borderRadius:10, fontSize:12.5, fontFamily:"'JetBrains Mono',monospace", minHeight:180, resize:'vertical', background:'#f9fafb', lineHeight:1.6, boxSizing:'border-box' }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
              <span style={{ fontSize:12, color:'#6b7280' }}>{email.length > 0 ? `${email.length.toLocaleString()} chars` : 'Max 6000 chars will be analysed'}</span>
              <div style={{ display:'flex', gap:10 }}>
                {email && <button onClick={()=>{setEmail('');setEmailResult(null);setEmailSaved(false);}} style={{ padding:'8px 14px', background:'#f3f4f6', border:'1.5px solid #cbd5e1', borderRadius:8, fontSize:12, color:'#374151', fontWeight:600, cursor:'pointer' }}>Clear</button>}
                <button
                  onClick={parseEmail}
                  disabled={emailParsing || !email.trim()}
                  style={{ padding:'9px 20px', background: emailParsing||!email.trim() ? '#e5e7eb' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)', border:'none', borderRadius:9, color: emailParsing||!email.trim() ? '#9ca3af' : '#fff', fontWeight:700, fontSize:13, cursor: emailParsing||!email.trim() ? 'default':'pointer', display:'flex', alignItems:'center', gap:7, transition:'all 0.15s' }}
                >
                  {emailParsing ? <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⏳</span> Analysing...</> : '🤖 Analyse with AI'}
                </button>
              </div>
            </div>
          </div>

          {/* AI result */}
          {emailResult && (
            <div style={{ background:'#fff', border:'1.5px solid #cbd5e1', borderRadius:14, overflow:'hidden', marginTop:4 }}>
              {/* Result header */}
              <div style={{ padding:'14px 18px', background:'linear-gradient(135deg,#eff6ff,#dbeafe)', borderBottom:'1px solid #bfdbfe', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1d4ed8' }}>✅ Email Analysed</div>
                  {emailResult.dateRange && <div style={{ fontSize:12, color:'#3b82f6', marginTop:2 }}>📅 {emailResult.dateRange}{emailResult.subject ? ` · ${emailResult.subject}` : ''}</div>}
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {emailResult.sentiment && (
                    <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700,
                      background: emailResult.sentiment==='urgent' ? '#fef2f2' : emailResult.sentiment==='positive' ? '#f0fdf4' : emailResult.sentiment==='concerned' ? '#fffbeb' : '#eff6ff',
                      color: emailResult.sentiment==='urgent' ? '#dc2626' : emailResult.sentiment==='positive' ? '#16a34a' : emailResult.sentiment==='concerned' ? '#d97706' : '#1d4ed8'
                    }}>
                      {emailResult.sentiment==='urgent'?'🚨':emailResult.sentiment==='positive'?'😊':emailResult.sentiment==='concerned'?'⚠️':'📧'} {emailResult.sentiment}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding:'16px 18px' }}>
                {/* Summary */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Summary</div>
                  <div style={{ fontSize:13.5, color:'#1f2937', lineHeight:1.6, background:'#f9fafb', padding:'10px 14px', borderRadius:9, border:'1px solid #e5e7eb' }}>{emailResult.summary}</div>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                  {emailResult.actionItems?.length > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>🎯 Action Items</div>
                      {emailResult.actionItems.map((item,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:5 }}>
                          <span style={{ width:18, height:18, borderRadius:99, background:'#fef2f2', border:'1px solid #fecaca', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#dc2626', flexShrink:0, marginTop:1 }}>{i+1}</span>
                          <span style={{ fontSize:12.5, color:'#1f2937', lineHeight:1.5 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {emailResult.clientRequests?.length > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>💬 Client Requests</div>
                      {emailResult.clientRequests.map((req,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:5 }}>
                          <span style={{ fontSize:13, flexShrink:0 }}>•</span>
                          <span style={{ fontSize:12.5, color:'#1f2937', lineHeight:1.5 }}>{req}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {emailResult.importantDates?.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>📅 Important Dates</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {emailResult.importantDates.map((d,i) => (
                        <span key={i} style={{ padding:'4px 10px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, fontSize:12, color:'#2563eb', fontWeight:500 }}>{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {emailResult.tags?.length > 0 && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>🏷 Topics</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {emailResult.tags.map((tag,i) => (
                        <span key={i} style={{ padding:'3px 9px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:7, fontSize:11.5, color:'#1d4ed8', fontWeight:500 }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save to notes */}
                <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:14, display:'flex', justifyContent:'flex-end', gap:10 }}>
                  {emailSaved && <span style={{ fontSize:13, color:'#16a34a', fontWeight:600, alignSelf:'center' }}>✅ Saved to client notes!</span>}
                  <button onClick={saveEmailNote} disabled={emailSaved} style={{ padding:'9px 20px', background: emailSaved ? '#f3f4f6' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)', border:'none', borderRadius:9, color: emailSaved ? '#9ca3af':'#fff', fontWeight:700, fontSize:13, cursor: emailSaved ? 'default':'pointer' }}>
                    {emailSaved ? '✅ Saved' : '💾 Save Summary to Client Notes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── IMPORT TAB ───────────────────────────────────── */}
      {tab === 'import' && (
        <div style={{ maxHeight:'65vh', overflowY:'auto' }}>
          {applyMsg && <div style={{ padding:'10px 14px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, color:'#15803d', fontSize:13, marginBottom:14 }}>{applyMsg}</div>}

          {!importPreview && (
            <div>
              {/* ── Openclaw 快照 ── */}
              <div style={{ background:'linear-gradient(135deg,#f0f4ff,#e8f0fe)', border:'1px solid #c7d2fe', borderRadius:12, padding:'18px 20px', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:22 }}>🤖</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1e1b4b' }}>Openclaw 快照导入</div>
                    <div style={{ fontSize:11, color:'#4338ca' }}>按客户姓名直接从 Openclaw Bot 拉取档案</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    value={ocName}
                    onChange={e => setOcName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !ocFetching && handleOpenclawFetch()}
                    placeholder="输入客户姓名，如：孙丽芳 / Sun Lifang"
                    disabled={ocFetching}
                    style={{ flex:1, padding:'10px 13px', border:'1px solid #a5b4fc', borderRadius:8, fontSize:13, outline:'none', background: ocFetching ? '#f3f4f6' : '#fff', color:'#111827' }}
                  />
                  <button
                    onClick={handleOpenclawFetch}
                    disabled={ocFetching}
                    style={{ padding:'10px 18px', background: ocFetching ? '#e5e7eb' : 'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8, color: ocFetching ? '#6b7280' : '#fff', fontWeight:700, fontSize:13, cursor: ocFetching ? 'default' : 'pointer', whiteSpace:'nowrap' }}
                  >
                    {ocFetching ? '⏳ 获取中...' : '🔍 获取快照'}
                  </button>
                </div>
              </div>

              {/* ── 分割线 ── */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
                <span style={{ fontSize:11, color:'#9ca3af', fontWeight:500 }}>或粘贴文本</span>
                <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
              </div>

              {/* ── 粘贴文本导入 ── */}
              <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'1px solid #c4b5fd', borderRadius:12, padding:'16px 18px', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:20 }}>📋</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#4c1d95' }}>粘贴文本导入 Paste Text Import</div>
                    <div style={{ fontSize:11, color:'#7c3aed' }}>直接粘贴客户快照文本（支持中英文）— 无需上传文件</div>
                  </div>
                </div>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder="粘贴客户档案快照文本... Paste client snapshot text here..."
                  style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #c4b5fd', borderRadius:8, fontSize:12.5, minHeight:120, resize:'vertical', background:'#fff', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box', outline:'none', color:'#111827' }}
                />
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10, gap:8 }}>
                  {pasteText && <button onClick={()=>setPasteText('')} style={{ padding:'7px 14px', background:'#f3f4f6', border:'1.5px solid #cbd5e1', borderRadius:7, fontSize:12, color:'#374151', fontWeight:600, cursor:'pointer' }}>清除</button>}
                  <button
                    onClick={handlePasteImport}
                    disabled={pasteImporting || !pasteText.trim()}
                    style={{ padding:'8px 18px', background: pasteImporting||!pasteText.trim() ? '#e5e7eb' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', border:'none', borderRadius:8, color: pasteImporting||!pasteText.trim() ? '#9ca3af' : '#fff', fontWeight:700, fontSize:12, cursor: pasteImporting||!pasteText.trim() ? 'default':'pointer' }}
                  >
                    {pasteImporting ? '⏳ 分析中...' : '🤖 AI 提取信息'}
                  </button>
                </div>
              </div>

              {/* ── 分割线 ── */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
                <span style={{ fontSize:11, color:'#9ca3af', fontWeight:500 }}>或上传文件</span>
                <div style={{ flex:1, height:1, background:'#e5e7eb' }} />
              </div>

              {/* ── 原有 docx 上传 ── */}
              <div style={{ textAlign:'center', padding:'32px 24px', border:'2px dashed #dde1f0', borderRadius:12 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
              <div style={{ fontSize:15, fontWeight:600, color:'#111827', marginBottom:6 }}>Upload Client Information Card</div>
              <div style={{ fontSize:13, color:'#1f2937', marginBottom:20 }}>Supports <strong style={{color:'#1f2937'}}>.docx / .txt</strong> files — AI will extract all fields automatically</div>
              <input ref={fileRef} type="file" accept=".docx,.pdf,.txt" onChange={handleFile} style={{ display:'none' }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                style={{ padding:'11px 24px', background: importing ? '#e5e7eb' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:9, color: importing ? '#6b7280' : '#fff', fontWeight:700, fontSize:14, cursor: importing ? 'default' : 'pointer' }}
              >
                {importing ? '⏳ Analysing document...' : '📥 Select File (.docx / .txt)'}
              </button>
              <div style={{ marginTop:16, fontSize:11, color:'#1f2937' }}>Powered by Claude AI · Your files are not stored</div>
            </div>
            </div>
          )}

          {importPreview && (
            <div>
              <div style={{ padding:'10px 14px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, color:'#15803d', fontSize:13, marginBottom:16 }}>
                ✅ Document analysed — review the extracted data below, then click <strong>Apply to Record</strong>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:16 }}>
                {[
                  ['Name',        importPreview.name],
                  ['Email',       importPreview.email],
                  ['Phone',       importPreview.phone],
                  ['Nationality', importPreview.nationality],
                  ['DOB',         importPreview.profile?.dob],
                  ['Passport No', importPreview.profile?.passportNo],
                  ['Passport Exp',importPreview.profile?.passportExpiry],
                  ['AU Address',  importPreview.profile?.auAddress],
                  ['Sponsor',     importPreview.profile?.sponsor?.name],
                  ['Marriage Date', importPreview.profile?.marriage?.date],
                ].map(([l,v]) => v ? (
                  <div key={l} style={{ background:'#f9fafb', borderRadius:8, padding:'9px 13px', border:'1px solid #e5e7eb' }}>
                    <div style={{ fontSize:10, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:3 }}>{l}</div>
                    <div style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{v}</div>
                  </div>
                ) : null)}
              </div>

              {/* ── 四、Skills Assessment preview ── */}
              {(importPreview.profile?.skillsAssessments||[]).filter(s=>s.appId||s.occupation).length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, fontWeight:700 }}>📊 四、职业评估 ({importPreview.profile.skillsAssessments.filter(s=>s.appId||s.occupation).length} entries)</div>
                  {importPreview.profile.skillsAssessments.filter(s=>s.appId||s.occupation).map((sa,i) => (
                    <div key={i} style={{ background:'#f9fafb', borderRadius:7, padding:'8px 12px', border:'1px solid #e5e7eb', marginBottom:6, fontSize:12, color:'#374151' }}>
                      <div style={{ fontWeight:600, color:'#111827' }}>{sa.occupation || '—'} {sa.appId ? `(ID: ${sa.appId})` : ''}</div>
                      <div style={{ marginTop:2 }}>Lodge: {sa.lodgeDate||'—'} · Outcome: <span style={{ fontWeight:700, color: sa.outcome==='Pending'?'#d97706':'#16a34a' }}>{sa.outcome||'—'}</span></div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── 五、Case Timeline preview ── */}
              {(importPreview.profile?.caseTimeline||[]).filter(e=>e.event).length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, fontWeight:700 }}>📅 五、大事记 ({importPreview.profile.caseTimeline.filter(e=>e.event).length} events)</div>
                  <div style={{ maxHeight:160, overflowY:'auto', display:'flex', flexDirection:'column', gap:4 }}>
                    {importPreview.profile.caseTimeline.filter(e=>e.event).map((ev,i) => {
                      const col = ev.status==='Completed'?'#16a34a':ev.status==='Urgent'?'#dc2626':'#6366f1';
                      return (
                        <div key={i} style={{ background:'#f9fafb', borderRadius:7, padding:'7px 11px', border:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                          <div style={{ fontSize:12, color:'#374151' }}><span style={{ fontWeight:600, color:'#111827' }}>{ev.date||'—'}</span> · {ev.event}</div>
                          <span style={{ fontSize:10, fontWeight:700, color:col, background:col+'15', padding:'2px 7px', borderRadius:10, flexShrink:0 }}>{ev.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 六、Current Status preview ── */}
              {(importPreview.profile?.currentStatus || (importPreview.profile?.nextSteps||[]).length > 0) && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, color:'#6366f1', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, fontWeight:700 }}>⚡ 六、当前状态</div>
                  {importPreview.profile.currentStatus && (
                    <div style={{ background:'#fff7ed', borderRadius:7, padding:'8px 12px', border:'1px solid #fed7aa', fontSize:12, color:'#92400e', marginBottom:6, lineHeight:1.5 }}>{importPreview.profile.currentStatus}</div>
                  )}
                  {(importPreview.profile.nextSteps||[]).map((s,i) => (
                    <div key={i} style={{ background:'#f0fdf4', borderRadius:7, padding:'6px 10px', border:'1px solid #86efac', fontSize:12, color:'#14532d', marginBottom:4 }}>→ {s}</div>
                  ))}
                </div>
              )}

              {importPreview.profile?.keyIssues?.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, color:'#ef4444', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, fontWeight:700 }}>🚨 Key Issues Detected ({importPreview.profile.keyIssues.length})</div>
                  {importPreview.profile.keyIssues.map((issue,i) => (
                    <div key={i} style={{ background:'#f9fafb', borderRadius:7, padding:'8px 12px', borderLeft:'3px solid #ef4444', marginBottom:6, fontSize:12, color:'#1f2937' }}>
                      <strong style={{color:'#fca5a5'}}>{issue.priority}:</strong> {issue.item}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>setImportPreview(null)} style={{ padding:'9px 18px', background:'#e5e7eb', border:'none', borderRadius:8, color:'#1f2937', fontWeight:500, cursor:'pointer' }}>← Re-upload</button>
                <button onClick={applyImport} style={{ flex:1, padding:'10px 20px', background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>✅ Apply to Client Record</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AI 助手 TAB ───────────────────────────────────── */}
      {tab === 'ai' && (
        <div style={{ maxHeight:'70vh', overflowY:'auto', paddingRight:2 }}>
          <SmartAI
            selectedClient={client}
            selectedCase={clientJobs[0] || null}
            onImportClient={(data, overwrite = false) => {
              const merged = mergeClientData(client, data, overwrite);
              onSaveProfile(merged);
            }}
            onImportCase={(data) => {
              // Build a new case/job from AI-extracted case data
              const priorityMap = { urgent:'Urgent', high:'High', medium:'Medium', low:'Low' };
              const newJob = {
                id: 'j' + Math.random().toString(36).slice(2,9),
                clientId: client.id,
                title: data.visaType || 'New Case',
                type: data.visaType || '',
                status: 'New',
                priority: priorityMap[data.priority] || 'Medium',
                assignedTo: data.assignee || '',
                notes: [data.keyNeeds, data.nextAction].filter(Boolean).join('\n'),
                progress: 0,
                createdAt: new Date().toISOString(),
              };
              setJobs(prev => [...prev, newJob]);
              try { sbInsert('jobs', { id: newJob.id, data: newJob }); } catch(e) { console.warn('Case insert error', e); }
            }}
            onAddNote={(text) => {
              onSaveProfile({ ...client, notes: [makeNote(text), ...normalizeNotes(client.notes)] });
            }}
          />
        </div>
      )}

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginTop:18, borderTop:'1.5px solid #e2e8f0', paddingTop:16 }}>
        <button
          onClick={handleGenerateContract}
          disabled={contractBusy}
          style={{ padding:'9px 18px', background: contractBusy ? '#e5e7eb' : 'linear-gradient(135deg,#0f766e,#0d9488)', border:'none', borderRadius:8, color: contractBusy ? '#9ca3af' : '#fff', fontSize:13, fontWeight:600, cursor: contractBusy ? 'not-allowed' : 'pointer', boxShadow: contractBusy ? 'none' : '0 2px 8px rgba(15,118,110,0.35)' }}
        >
          {contractBusy ? '⏳ 生成中…' : '📄 生成合同'}
        </button>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ padding:'9px 18px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:8, color:'#1f2937', fontSize:13, fontWeight:500 }}>关闭</button>
          <button onClick={onEdit}  style={{ padding:'9px 20px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, boxShadow:'0 2px 8px rgba(79,70,229,0.3)' }}>✏️ 编辑客户</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── CLIENTS ────────────────────────────────────────────────────────────────── */
function Clients({ clients, jobs, setClients, setJobs, team }) {
  const { t } = useLang(); // eslint-disable-line no-unused-vars
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [hoverId, setHoverId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x:0, y:0 });
  const [viewClient, setViewClient] = useState(null);
  const hoverTimer = useRef(null);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.nationality?.toLowerCase().includes(q)) &&
      (filterType === 'All' || c.type === filterType) &&
      (filterStatus === 'All' || c.status === filterStatus)
    );
  }).sort((a, b) => {
    if (sortBy === 'newest') return (b.createdAt||'').localeCompare(a.createdAt||'');
    if (sortBy === 'oldest') return (a.createdAt||'').localeCompare(b.createdAt||'');
    if (sortBy === 'name_az') return (a.name||'').localeCompare(b.name||'');
    if (sortBy === 'name_za') return (b.name||'').localeCompare(a.name||'');
    return (b.createdAt||'').localeCompare(a.createdAt||'');
  });

  const openAdd = () => {
    setForm({ name:'', email:'', phone:'', type:'Student', status:'Active', nationality:'', notes:[], createdAt:today() });
    setModal('add');
  };
  const openEdit = (c) => { setForm({ ...c, notes: normalizeNotes(c.notes) }); setModal(c); };
  const closeModal = () => setModal(null);

  const save = async () => {
    if (!form.name.trim()) return;
    if (modal === 'add') {
      const newClient = { ...form, id: 'c'+uid(), createdAt: new Date().toISOString() };
      setClients(prev => [...prev, newClient]);
      try { await sbInsert('clients', { id: newClient.id, data: newClient }); } catch(e) { console.warn('Save error:', e); }
    } else {
      setClients(prev => prev.map(c => c.id === form.id ? form : c));
      try { await sbUpdate('clients', form.id, { data: form }); } catch(e) { console.warn('Save error:', e); }
    }
    closeModal();
  };

  const del = async (id) => {
    if (window.confirm('Delete this client?')) {
      setClients(prev=>prev.filter(c=>c.id!==id));
      try { await sbDelete('clients', id); } catch(e) { console.warn('Delete error:', e); }
    }
  };
  const clientJobCount = id => jobs.filter(j=>j.clientId===id).length;

  const generateContractFromForm = async () => {
    if (!form.name?.trim()) { window.alert('请先填写客户姓名。'); return; }
    try {
      const relevantJobs = modal === 'add' ? [] : jobs.filter(j => j.clientId === form.id);
      await generateClientContractFile({ ...form, profile: form.profile || {} }, relevantJobs);
    } catch (err) {
      window.alert('合同生成失败: ' + (err?.message || err));
    }
  };

  const addNote = (text) => setForm(f => ({ ...f, notes: [makeNote(text), ...normalizeNotes(f.notes)] }));
  const deleteNote = (nid) => setForm(f => ({ ...f, notes: normalizeNotes(f.notes).filter(n=>n.id!==nid) }));

  const handleRowEnter = (e, id) => {
    clearTimeout(hoverTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipW = 310;
    const tooltipH = 420;
    // Prefer right side; fall back to left if it would clip
    let x = rect.right + 14;
    if (x + tooltipW > window.innerWidth - 8) x = rect.left - tooltipW - 14;
    if (x < 8) x = 8;
    // Align top with row; push up if it would clip bottom
    let y = rect.top;
    if (y + tooltipH > window.innerHeight - 8) y = window.innerHeight - tooltipH - 8;
    if (y < 8) y = 8;
    hoverTimer.current = setTimeout(() => { setTooltipPos({ x, y }); setHoverId(id); }, 350);
  };
  const handleRowLeave = () => { clearTimeout(hoverTimer.current); setHoverId(null); };

  const hoveredClient = hoverId ? clients.find(c=>c.id===hoverId) : null;

  return (
    <div className="animate-fade">
      {/* Hover snapshot – rendered at fixed position */}
      {hoveredClient && (
        <div style={{ position:'fixed', left: tooltipPos.x, top: tooltipPos.y, zIndex:2000, pointerEvents:'none' }}>
          <ClientSnapshot client={hoveredClient} jobs={jobs} visible={true} />
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:700, color:'#111827' }}>Clients</h1>
          <p style={{ color:'#1f2937', fontSize:14, marginTop:2 }}>{clients.length} total clients</p>
        </div>
        <button onClick={openAdd} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:10, padding:'10px 18px', color:'#fff', fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontSize:18, lineHeight:1 }}>+</span> Add Client
        </button>
      </div>

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
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ ...selectStyle, width:160 }}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name_az">Name A→Z</option>
          <option value="name_za">Name Z→A</option>
        </select>
      </div>

      <Card style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'2px solid #e2e8f0' }}>
              {['Client','Type','Status','Cases','Nationality','Notes','Created',''].map(h=>(
                <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em', background:'#f9fafb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'#1f2937', fontSize:14 }}>No clients found</td></tr>
            )}
            {filtered.map((c) => {
              const notes = normalizeNotes(c.notes);
              return (
                <tr key={c.id}
                  style={{ borderBottom:'1px solid #0f1a2560', transition:'background 0.15s', cursor:'default' }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='#0ea5e908'; handleRowEnter(e, c.id); }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; handleRowLeave(); }}>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', background:'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#1f2937' }}>{initials(c.name)}</div>
                      <div>
                        <div onClick={()=>setViewClient(c)} style={{ fontWeight:600, color:'#ff158a', fontSize:14, cursor:'pointer' }}>{c.name}</div>
                        <div style={{ fontSize:12, color:'#1f2937' }}>{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'13px 16px' }}>
                    <span style={{ fontSize:12, color: c.type==='Student'?'#60a5fa':c.type==='Migration'?'#a78bfa':'#34d399', background: c.type==='Student'?'#1e40af20':c.type==='Migration'?'#6d28d920':'#05966920', padding:'2px 10px', borderRadius:20, fontWeight:500 }}>{c.type}</span>
                  </td>
                  <td style={{ padding:'13px 16px' }}><StatusBadge status={c.status} small /></td>
                  <td style={{ padding:'13px 16px', color:'#1f2937', fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>{clientJobCount(c.id)}</td>
                  <td style={{ padding:'13px 16px', color:'#1f2937', fontSize:13 }}>{c.nationality || '—'}</td>
                  <td style={{ padding:'13px 16px' }}>
                    <span style={{ fontSize:12, color: notes.length>0?'#6366f1':'#334155', background: notes.length>0?'#38bdf815':'transparent', padding:'2px 8px', borderRadius:10, fontFamily:"'JetBrains Mono',monospace" }}>
                      {notes.length > 0 ? `📝 ${notes.length}` : '—'}
                    </span>
                  </td>
                  <td style={{ padding:'13px 16px', color:'#1f2937', fontSize:13 }}>{fmtDate(c.createdAt)}</td>
                  <td style={{ padding:'13px 16px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>openEdit(c)} style={{ background:'#e5e7eb', border:'none', borderRadius:7, padding:'5px 10px', color:'#1f2937', fontSize:12 }}>Edit</button>
                      <button onClick={()=>del(c.id)} style={{ background:'#7f1d1d20', border:'none', borderRadius:7, padding:'5px 10px', color:'#f87171', fontSize:12 }}>Del</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {modal && (
        <Modal title={modal === 'add' ? 'Add New Client' : `Edit Client – ${form.name}`} onClose={closeModal} wide>
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
          {/* ── Profile Details ── */}
          <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:16, paddingTop:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Profile Details</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormField label="Date of Birth"><input style={inputStyle} value={form.profile?.dob||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),dob:e.target.value}}))} placeholder="YYYY-MM-DD" /></FormField>
              <FormField label="Chinese Name (中文姓名)"><input style={inputStyle} value={form.profile?.nameZh||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),nameZh:e.target.value}}))} placeholder="乔帅帅" /></FormField>
              <FormField label="Passport No"><input style={inputStyle} value={form.profile?.passportNo||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),passportNo:e.target.value}}))} placeholder="E12345678" /></FormField>
              <FormField label="Passport Expiry"><input style={inputStyle} value={form.profile?.passportExpiry||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),passportExpiry:e.target.value}}))} placeholder="YYYY-MM-DD" /></FormField>
              <FormField label="AU Address"><input style={inputStyle} value={form.profile?.auAddress||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),auAddress:e.target.value}}))} placeholder="Perth, WA, Australia" /></FormField>
              <FormField label="Marital Status"><input style={inputStyle} value={form.profile?.maritalStatus||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),maritalStatus:e.target.value}}))} placeholder="Single / Married" /></FormField>
              <FormField label="Visa Target"><input style={inputStyle} value={form.profile?.visaTarget||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),visaTarget:e.target.value}}))} placeholder="e.g. Subclass 820 Partner Visa" /></FormField>
              <FormField label="Consultant"><input style={inputStyle} value={form.profile?.consultant||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),consultant:e.target.value}}))} placeholder="Liang Jiang" /></FormField>
              <FormField label="China ID (身份证)"><input style={inputStyle} value={form.profile?.chinaId||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),chinaId:e.target.value}}))} placeholder="身份证号码" /></FormField>
              <FormField label="EA File No"><input style={inputStyle} value={form.profile?.eaFileNo||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),eaFileNo:e.target.value}}))} placeholder="EA File Number" /></FormField>
              <FormField label="Service Fee (Total)"><input style={inputStyle} value={form.profile?.serviceAgreement?.totalFee||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),serviceAgreement:{...(f.profile?.serviceAgreement||{}),totalFee:e.target.value}}}))} placeholder="AUD 3,080" /></FormField>
              <FormField label="Contract Date"><input style={inputStyle} value={form.profile?.serviceAgreement?.contractDate||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),serviceAgreement:{...(f.profile?.serviceAgreement||{}),contractDate:e.target.value}}}))} placeholder="YYYY-MM-DD" /></FormField>
            </div>
          </div>

          {/* ── Sponsor Details ── */}
          <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:16, paddingTop:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>担保人 Sponsor Details</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormField label="Sponsor Name"><input style={inputStyle} value={form.profile?.sponsor?.name||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),sponsor:{...(f.profile?.sponsor||{}),name:e.target.value}}}))} placeholder="Sponsor full name" /></FormField>
              <FormField label="Relationship"><input style={inputStyle} value={form.profile?.sponsor?.relationship||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),sponsor:{...(f.profile?.sponsor||{}),relationship:e.target.value}}}))} placeholder="Spouse / De Facto" /></FormField>
              <FormField label="Sponsor DOB"><input style={inputStyle} value={form.profile?.sponsor?.dob||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),sponsor:{...(f.profile?.sponsor||{}),dob:e.target.value}}}))} placeholder="YYYY-MM-DD" /></FormField>
              <FormField label="Sponsor Nationality"><input style={inputStyle} value={form.profile?.sponsor?.nationality||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),sponsor:{...(f.profile?.sponsor||{}),nationality:e.target.value}}}))} placeholder="Australian" /></FormField>
              <FormField label="Sponsor Passport No"><input style={inputStyle} value={form.profile?.sponsor?.passportNo||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),sponsor:{...(f.profile?.sponsor||{}),passportNo:e.target.value}}}))} placeholder="Passport number" /></FormField>
              <FormField label="Sponsor Address"><input style={inputStyle} value={form.profile?.sponsor?.address||''} onChange={e=>setForm(f=>({...f,profile:{...(f.profile||{}),sponsor:{...(f.profile?.sponsor||{}),address:e.target.value}}}))} placeholder="Residential address" /></FormField>
            </div>
          </div>

          {/* ── Visa History ── */}
          <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:16, paddingTop:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em' }}>签证历史 Visa History</div>
              <button onClick={()=>setForm(f=>({...f,profile:{...(f.profile||{}),visaHistory:[...(f.profile?.visaHistory||[]),{type:'',applicationNo:'',lodgeDate:'',grantDate:'',status:''}]}}))} style={{ background:'#e0e7ff', border:'none', borderRadius:6, padding:'4px 10px', color:'#4f46e5', fontSize:12, cursor:'pointer' }}>+ Add Row</button>
            </div>
            {(form.profile?.visaHistory||[]).length === 0
              ? <div style={{ fontSize:12, color:'#9ca3af', padding:'6px 0' }}>No visa history records</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {(form.profile?.visaHistory||[]).map((v,idx) => (
                    <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr auto', gap:5, alignItems:'center' }}>
                      <input style={{...inputStyle,fontSize:11,padding:'5px 8px'}} value={v.type||''} onChange={e=>setForm(f=>{const a=[...(f.profile?.visaHistory||[])];a[idx]={...a[idx],type:e.target.value};return{...f,profile:{...(f.profile||{}),visaHistory:a}}})} placeholder="Visa Type" />
                      <input style={{...inputStyle,fontSize:11,padding:'5px 8px'}} value={v.applicationNo||v.appNo||''} onChange={e=>setForm(f=>{const a=[...(f.profile?.visaHistory||[])];a[idx]={...a[idx],applicationNo:e.target.value};return{...f,profile:{...(f.profile||{}),visaHistory:a}}})} placeholder="App No" />
                      <input style={{...inputStyle,fontSize:11,padding:'5px 8px'}} value={v.lodgeDate||v.lodged||''} onChange={e=>setForm(f=>{const a=[...(f.profile?.visaHistory||[])];a[idx]={...a[idx],lodgeDate:e.target.value};return{...f,profile:{...(f.profile||{}),visaHistory:a}}})} placeholder="Lodged" />
                      <input style={{...inputStyle,fontSize:11,padding:'5px 8px'}} value={v.grantDate||v.granted||''} onChange={e=>setForm(f=>{const a=[...(f.profile?.visaHistory||[])];a[idx]={...a[idx],grantDate:e.target.value};return{...f,profile:{...(f.profile||{}),visaHistory:a}}})} placeholder="Granted" />
                      <input style={{...inputStyle,fontSize:11,padding:'5px 8px'}} value={v.status||''} onChange={e=>setForm(f=>{const a=[...(f.profile?.visaHistory||[])];a[idx]={...a[idx],status:e.target.value};return{...f,profile:{...(f.profile||{}),visaHistory:a}}})} placeholder="Status" />
                      <button onClick={()=>setForm(f=>({...f,profile:{...(f.profile||{}),visaHistory:(f.profile?.visaHistory||[]).filter((_,i)=>i!==idx)}}))} style={{ background:'none', border:'none', color:'#f87171', fontSize:15, cursor:'pointer', padding:'0 4px' }}>✕</button>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* ── Case Timeline ── */}
          <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:16, paddingTop:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.07em' }}>案件时间线 Case Timeline</div>
              <button onClick={()=>setForm(f=>({...f,profile:{...(f.profile||{}),caseTimeline:[...(f.profile?.caseTimeline||[]),{date:'',event:'',status:'Completed'}]}}))} style={{ background:'#e0e7ff', border:'none', borderRadius:6, padding:'4px 10px', color:'#4f46e5', fontSize:12, cursor:'pointer' }}>+ Add Row</button>
            </div>
            {(form.profile?.caseTimeline||[]).length === 0
              ? <div style={{ fontSize:12, color:'#9ca3af', padding:'6px 0' }}>No timeline records</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {(form.profile?.caseTimeline||[]).map((ev,idx) => (
                    <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 3fr 1fr auto', gap:5, alignItems:'center' }}>
                      <input style={{...inputStyle,fontSize:11,padding:'5px 8px'}} value={ev.date||''} onChange={e=>setForm(f=>{const a=[...(f.profile?.caseTimeline||[])];a[idx]={...a[idx],date:e.target.value};return{...f,profile:{...(f.profile||{}),caseTimeline:a}}})} placeholder="YYYY-MM-DD" />
                      <input style={{...inputStyle,fontSize:11,padding:'5px 8px'}} value={ev.event||''} onChange={e=>setForm(f=>{const a=[...(f.profile?.caseTimeline||[])];a[idx]={...a[idx],event:e.target.value};return{...f,profile:{...(f.profile||{}),caseTimeline:a}}})} placeholder="Event description" />
                      <select style={{...selectStyle,fontSize:11,padding:'5px 6px'}} value={ev.status||'Completed'} onChange={e=>setForm(f=>{const a=[...(f.profile?.caseTimeline||[])];a[idx]={...a[idx],status:e.target.value};return{...f,profile:{...(f.profile||{}),caseTimeline:a}}})}>
                        <option>Completed</option><option>In Progress</option><option>Pending</option><option>Urgent</option>
                      </select>
                      <button onClick={()=>setForm(f=>({...f,profile:{...(f.profile||{}),caseTimeline:(f.profile?.caseTimeline||[]).filter((_,i)=>i!==idx)}}))} style={{ background:'none', border:'none', color:'#f87171', fontSize:15, cursor:'pointer', padding:'0 4px' }}>✕</button>
                    </div>
                  ))}
                </div>
            }
          </div>

          <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:8, paddingTop:18 }}>
            <NotesPanel notes={normalizeNotes(form.notes).filter(n => n.type !== 'gmail')} onAddNote={addNote} onDeleteNote={deleteNote} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginTop:18 }}>
            <button onClick={generateContractFromForm} style={{ padding:'9px 18px', background:'linear-gradient(135deg,#0f766e,#0d9488)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, boxShadow:'0 2px 8px rgba(15,118,110,0.3)' }}>📄 生成合同</button>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={closeModal} style={{ background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:8, padding:'9px 18px', color:'#1f2937', fontSize:13, fontWeight:500 }}>{t('Cancel')}</button>
              <button onClick={save} style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8, padding:'9px 20px', color:'#fff', fontSize:13, fontWeight:700, boxShadow:'0 2px 8px rgba(79,70,229,0.3)' }}>{t('Save Client')}</button>
            </div>
          </div>
        </Modal>
      )}
      {viewClient && (
        <ClientDetailModal
          client={viewClient}
          jobs={jobs}
          setJobs={setJobs}
          team={team}
          onClose={() => setViewClient(null)}
          onEdit={() => { setViewClient(null); openEdit(viewClient); }}
          onSaveProfile={async (merged) => {
            setClients(prev => prev.map(c => c.id === merged.id ? merged : c));
            setViewClient(merged);
            try {
              const result = await sbUpdate('clients', merged.id, { data: merged });
              if (result === null) throw new Error('No rows updated — check client ID');
            } catch(e) {
              console.error('Profile save error:', e);
              window.dispatchEvent(new CustomEvent('ozsky-db-error', { detail: `Profile save failed: ${e.message}` }));
            }
          }}
        />
      )}
    </div>
  );
}

/* ─── JOBS ────────────────────────────────────────────────────────────────────── */
function Jobs({ jobs, clients, team, setJobs, openJobId, setOpenJobId, jobsMemberFilter, setJobsMemberFilter, jobsStatusFilter, setJobsStatusFilter }) {
  const { t } = useLang(); // eslint-disable-line no-unused-vars
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterAssigned, setFilterAssigned] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  const [view, setView] = useState('list');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [viewJob, setViewJob] = useState(null);
  const [clientSearch, setClientSearch] = useState('');

  // Open specific job from calendar or other navigation
  useEffect(() => {
    if (openJobId) {
      const j = jobs.find(x => x.id === openJobId);
      if (j) setViewJob(j);
      if (setOpenJobId) setOpenJobId(null);
    }
  }, [openJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply member filter from Dashboard Team Workload click
  useEffect(() => {
    if (jobsMemberFilter) {
      setFilterAssigned(jobsMemberFilter);
      setFilterStatus('active_not_awaiting');
      if (setJobsMemberFilter) setJobsMemberFilter(null);
    }
  }, [jobsMemberFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply status filter from Dashboard card clicks
  useEffect(() => {
    if (jobsStatusFilter) {
      if (jobsStatusFilter === 'Urgent') {
        setFilterStatus('active_not_awaiting');
        setFilterPriority('Urgent');
      } else {
        setFilterStatus(jobsStatusFilter);
        setFilterPriority('All');
      }
      if (setJobsStatusFilter) setJobsStatusFilter(null);
    }
  }, [jobsStatusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const sortedClients = [...clients].sort((a,b) => a.name.localeCompare(b.name));

  // doc checks handled via form.docs directly

  const getClient = id => clients.find(c=>c.id===id);
  const getMember = id => team.find(t=>t.id===id);

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const client = getClient(j.clientId);
    const statusMatch = filterStatus === 'All'
      ? true
      : filterStatus === 'active_not_awaiting'
        ? j.status !== 'Completed' && j.status !== 'Awaiting Decision'
        : j.status === filterStatus;
    return (
      (!q || j.title.toLowerCase().includes(q) || client?.name.toLowerCase().includes(q) || j.type.toLowerCase().includes(q)) &&
      statusMatch &&
      (filterAssigned === 'All' || j.assignedTo === filterAssigned) &&
      (filterPriority === 'All' || j.priority === filterPriority)
    );
  }).sort((a, b) => {
    if (sortBy === 'urgency') {
      const PORDER = { Urgent:0, High:1, Medium:2, Low:3 };
      const pa = PORDER[a.priority] ?? 99, pb = PORDER[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      // Secondary: soonest deadline first
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1; if (b.dueDate) return 1;
      return 0;
    }
    if (sortBy === 'progress') {
      return (b.progress || 0) - (a.progress || 0);
    }
    // default: newest first
    return (b.createdAt||'').localeCompare(a.createdAt||'');
  });

  const openAdd = () => { setForm({ title:'', type:'Subclass 500 – Student Visa', clientId: clients[0]?.id||'', assignedTo: team[0]?.id||'', status:'New', priority:'Medium', dueDate:'', notes:[], progress:0, createdAt:today() }); setModal('add'); };
  const openEdit = (j) => {
    setClientSearch(clients.find(c=>c.id===j.clientId)?.name||'');
    const effectiveProgress = j.progress ?? STATUS_PROGRESS[j.status] ?? 0;
    setForm({ ...j, notes: normalizeNotes(j.notes), progress: effectiveProgress });
    setModal(j);
  };
  const closeModal = () => setModal(null);

  const save = async () => {
    if (!form.title.trim()) return;
    if (modal === 'add') {
      const newJob = { ...form, id: 'j'+uid(), progress: parseInt(form.progress)||0 };
      setJobs(prev => [...prev, newJob]);
      try { await sbInsert('jobs', { id: newJob.id, data: newJob }); } catch(e) { console.warn('Save error:', e); }
    } else {
      const updated = {...form, progress:parseInt(form.progress)||0};
      setJobs(prev => prev.map(j => j.id === form.id ? updated : j));
      try { await sbUpdate('jobs', form.id, { data: updated }); } catch(e) { console.warn('Save error:', e); }
    }
    closeModal();
  };

  const del = async (id) => {
    if(window.confirm('Delete this case?')) {
      setJobs(prev=>prev.filter(j=>j.id!==id));
      setModal(null);
      setViewJob(null);
      try { await sbDelete('jobs', id); } catch(e) { console.warn('Delete error:', e); }
    }
  };

  const addNote = (text) => setForm(f => ({ ...f, notes: [makeNote(text), ...normalizeNotes(f.notes)] }));
  const deleteNote = (nid) => setForm(f => ({ ...f, notes: normalizeNotes(f.notes).filter(n=>n.id!==nid) }));



  /* Board view */
  if (view === 'board') {
    return (
      <div className="animate-fade">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div><h1 style={{ fontSize:24, fontWeight:700, color:'#111827' }}>Cases</h1><p style={{ color:'#1f2937', fontSize:14, marginTop:2 }}>{jobs.length} total cases</p></div>
          <div style={{ display:'flex', gap:10 }}>
            <div style={{ display:'flex', background:'#ffffff', borderRadius:8, border:'1.5px solid #cbd5e1', overflow:'hidden' }}>
              {['list','board'].map(v=><button key={v} onClick={()=>setView(v)} style={{ padding:'7px 14px', background: view===v?'#e5e7eb':'transparent', border:'none', color: view===v?'#e2e8f0':'#475569', fontSize:13, fontWeight:500, textTransform:'capitalize' }}>{v}</button>)}
            </div>
            <button onClick={openAdd} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:10, padding:'9px 16px', color:'#fff', fontWeight:700, fontSize:13 }}>+ New Case</button>
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
                    const jnotes = normalizeNotes(j.notes);
                    return (
                      <div key={j.id} onClick={()=>setViewJob(j)} style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:10, padding:14, cursor:'pointer', transition:'border-color 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor='#38bdf840'}
                        onMouseLeave={e=>e.currentTarget.style.borderColor='#e5e7eb'}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:5 }}>{j.title}</div>
                        <div style={{ fontSize:11, color:'#1f2937', marginBottom:8 }}>{client?.name} · {j.type}</div>
                        <ProgressBar value={j.progress} status={j.status} />
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
                          <PriorityBadge priority={j.priority} />
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            {jnotes.length > 0 && <span style={{ fontSize:11, color:'#6366f1' }}>📝{jnotes.length}</span>}
                            {member && <Avatar name={member.name} color={member.color} size={24} />}
                          </div>
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
          <Modal title={modal==='add'?'New Case':'Edit Case'} onClose={closeModal} wide>
                <>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <FormField label="Case Title" required>
          <input style={inputStyle} value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Visa Application" />
        </FormField>
        <FormField label="Case Type">
          <select style={selectStyle} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
            {JOB_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Client" required>
          <div style={{ position:'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight:28 }}
              placeholder="Search client name..."
              value={clientSearch}
              onChange={e => {
                setClientSearch(e.target.value);
                const match = sortedClients.find(c => c.name.toLowerCase().startsWith(e.target.value.toLowerCase()));
                if (match) setForm(f => ({...f, clientId: match.id}));
              }}
              onFocus={() => setClientDropOpen(true)}
              onBlur={() => setTimeout(() => setClientDropOpen(false), 150)}
            />
            {clientDropOpen && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1.5px solid #cbd5e1', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:50, maxHeight:200, overflowY:'auto', marginTop:2 }}>
                {sortedClients
                  .filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                  .map(c => (
                    <div key={c.id}
                      onMouseDown={() => { setForm(f=>({...f,clientId:c.id})); setClientSearch(c.name); setClientDropOpen(false); }}
                      style={{ padding:'8px 13px', fontSize:13, color:'#111827', cursor:'pointer', background: form.clientId===c.id ? '#eef2ff' : 'transparent', fontWeight: form.clientId===c.id ? 600 : 400 }}
                      onMouseEnter={e => e.currentTarget.style.background='#f5f7ff'}
                      onMouseLeave={e => e.currentTarget.style.background = form.clientId===c.id ? '#eef2ff' : 'transparent'}
                    >
                      {c.name}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </FormField>
        <FormField label="Assign To">
          <select style={selectStyle} value={form.assignedTo} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))}>
            {team.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select style={selectStyle} value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value, progress: STATUS_PROGRESS[e.target.value] ?? f.progress ?? 0}))}>
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
        <FormField label={`Progress: ${form.progress ?? 0}%`}>
          <input type="range" min={0} max={100} step={5} value={form.progress ?? 0} onChange={e=>setForm(f=>({...f,progress:parseInt(e.target.value)}))} style={{ width:'100%', accentColor:'#6366f1', marginTop:8 }} />
        </FormField>
      </div>
      <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:8, paddingTop:16 }}>
        <NotesPanel notes={normalizeNotes(form.notes)} onAddNote={addNote} onDeleteNote={deleteNote} />
      </div>
      {(DOC_CHECKLISTS[form.type]||[]).length > 0 && (
        <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:8, paddingTop:16 }}>
          <div style={{ fontSize:11, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Document Checklist – {form.type}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {(DOC_CHECKLISTS[form.type]||[]).map(doc => {
              const checked = (form.docs||{})[doc] || false;
              return (
                <label key={doc} style={{ display:'flex', alignItems:'center', gap:8, background: checked?'#f0fdf4':'#f9fafb', borderRadius:7, padding:'7px 12px', cursor:'pointer', border:`1px solid ${checked?'#05966940':'#e5e7eb'}`, transition:'all 0.15s' }}>
                  <input type="checkbox" checked={checked} onChange={e=>setForm(f=>({...f, docs:{...(f.docs||{}), [doc]:e.target.checked}}))} style={{ accentColor:'#34d399', width:14, height:14 }} />
                  <span style={{ fontSize:12, color: checked?'#34d399':'#94a3b8' }}>{doc}</span>
                </label>
              );
            })}
          </div>
          <div style={{ fontSize:11, color:'#1f2937', marginTop:10 }}>
            {Object.values(form.docs||{}).filter(Boolean).length} / {(DOC_CHECKLISTS[form.type]||[]).length} documents received
          </div>
        </div>
      )}
    </>
  
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:18}}>
              <button onClick={closeModal} style={{background:'#e5e7eb',border:'none',borderRadius:8,padding:'9px 18px',color:'#1f2937',fontWeight:500}}>Cancel</button>
              <button onClick={save} style={{background:'linear-gradient(135deg,#ff158a,#ff5fae)',border:'none',borderRadius:8,padding:'9px 20px',color:'#ffffff',fontWeight:700}}>Save Case</button>
            </div>
          </Modal>
        )}
        {viewJob && (() => {
        const vc2 = getClient(viewJob.clientId);
        const checklist2 = DOC_CHECKLISTS[viewJob.type] || [];
        const docs2 = viewJob.docs || {};
        const pct2 = STATUS_PROGRESS[viewJob.status] ?? viewJob.progress ?? 0;
        const docsReceived2 = checklist2.filter(d=>docs2[d]).length;
        return (
        <Modal title={viewJob.title} onClose={()=>setViewJob(null)} wide>
        {/* ── PROGRESS BANNER ─────────────────────── */}
        <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius:12, padding:'14px 18px', marginBottom:16, color:'#fff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:3 }}>案件进度</div>
        <div style={{ fontSize:15, fontWeight:700 }}>{vc2?.name||'—'} · {viewJob.type}</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)', marginTop:2 }}>负责人: {getMember(viewJob.assignedTo)?.name||'—'} · Due {fmtDate(viewJob.dueDate)||'—'}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:28, fontWeight:800, color: pct2>=100?'#34d399':pct2>=70?'#a5b4fc':'#fbbf24', lineHeight:1 }}>{pct2}%</div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{viewJob.status}</div>
        </div>
        </div>
        <div style={{ height:5, borderRadius:5, background:'rgba(255,255,255,0.15)', overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct2}%`, background: pct2>=100?'#34d399':pct2>=70?'#818cf8':'#fbbf24', borderRadius:5, transition:'width 0.4s' }} />
        </div>
        </div>

        {/* ── QUICK UPDATE PANEL ──────────────────── */}
        <div style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
        <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>快速更新 <span style={{ color:'#9ca3af', fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 }}>Quick Update</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div>
            <div style={{ fontSize:11, color:'#374151', fontWeight:600, marginBottom:5 }}>状态 Status</div>
            <select value={viewJob.status} onChange={async e => {
              const updated = { ...viewJob, status: e.target.value };
              setViewJob(updated);
              setJobs(prev => prev.map(j => j.id===viewJob.id ? updated : j));
              try { await sbUpdate('jobs', updated.id, { data: updated }); } catch(er){ console.warn(er); }
            }} style={{ width:'100%', background:'#fff', border:'1.5px solid #d1d5db', borderRadius:7, padding:'7px 10px', fontSize:13, color:'#111827', outline:'none', cursor:'pointer' }}>
              {JOB_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#374151', fontWeight:600, marginBottom:5 }}>进度 Progress: <span style={{ color:'#6366f1', fontWeight:700 }}>{STATUS_PROGRESS[viewJob.status] ?? viewJob.progress ?? 0}%</span></div>
            <input type="range" min={0} max={100} step={5} value={STATUS_PROGRESS[viewJob.status] ?? viewJob.progress ?? 0} onChange={async e => {
              const updated = { ...viewJob, progress: parseInt(e.target.value) };
              setViewJob(updated);
              setJobs(prev => prev.map(j => j.id===viewJob.id ? updated : j));
              try { await sbUpdate('jobs', updated.id, { data: updated }); } catch(er){ console.warn(er); }
            }} style={{ width:'100%', accentColor:'#6366f1', marginTop:4 }} />
          </div>
        </div>
        </div>

        {/* ── EDITABLE SNAPSHOT ───────────────────── */}
        <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>最新进展 <span style={{ color:'#9ca3af', fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 }}>(失焦自动保存)</span></div>
          <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:6, color:'#374151', fontSize:11, fontWeight:600, cursor:'pointer' }}>
            📄 上传快照
            <input type="file" accept=".docx,.pdf,.txt" style={{display:'none'}} onChange={async e => {
              const file = e.target.files?.[0]; if (!file) return;
              try {
                let rawText = '';
                if (file.name.endsWith('.txt')) { rawText = await file.text(); }
                else { const buf = await file.arrayBuffer(); const { value } = await mammoth.extractRawText({ arrayBuffer: buf }); rawText = value; }
                const res = await fetch('/api/claude', { method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:2000,
                    messages:[{ role:'user', content:`Extract case timeline and current status from this immigration snapshot. Return ONLY valid JSON:
{"snapshot":"brief 1-2 sentence current status","caseTimeline":[{"date":"","event":"","status":"Completed"}]}
Status values: Completed/In Progress/Urgent/Pending
Document:
${rawText.slice(0,5000)}` }]
                  })
                });
                const d = await res.json();
                const txt = (d.content?.[0]?.text||'').replace(/```json|```/g,'').trim();
                const parsed = JSON.parse(txt);
                const updated = { ...viewJob, ...(parsed.snapshot?{snapshot:parsed.snapshot}:{}), ...(parsed.caseTimeline?.length?{caseTimeline:parsed.caseTimeline}:{}) };
                setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
                try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
              } catch(err) { window.alert('Import failed: '+err.message); }
              e.target.value='';
            }} />
          </label>
        </div>
        <textarea
        style={{ width:'100%', background:'#f8fafc', border:'2px solid #c7d2e0', borderRadius:9, padding:'9px 12px', fontSize:13, color:'#111827', resize:'vertical', minHeight:72, fontFamily:'inherit', lineHeight:1.55, outline:'none', boxSizing:'border-box' }}
        placeholder="记录最新案件进展..."
        defaultValue={viewJob.snapshot||''}
        onBlur={async e => {
        if (e.target.value === (viewJob.snapshot||'')) return;
        const updated = { ...viewJob, snapshot: e.target.value };
        setViewJob(updated);
        setJobs(prev => prev.map(j => j.id===viewJob.id ? updated : j));
        try { await sbUpdate('jobs', updated.id, { data: updated }); } catch(er){ console.warn(er); }
        }}
        />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        {/* Case info */}
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:2 }}>案件信息</div>
        {[['客户', vc2?.name||'—'], ['类型', viewJob.type], ['截止日期', fmtDate(viewJob.dueDate)], ['创建', fmtDate(viewJob.createdAt)]].map(([l,v]) => (
        <div key={l} style={{ display:'flex', justifyContent:'space-between', background:'#f8fafc', borderRadius:8, padding:'7px 11px', border:'1.5px solid #e2e8f0' }}>
        <span style={{ fontSize:11, color:'#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{l}</span>
        <span style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{v}</span>
        </div>
        ))}
        {(() => { const vm = getMember(viewJob.assignedTo); return vm ? (
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:8, padding:'7px 11px', border:'1.5px solid #e2e8f0' }}>
        <span style={{ fontSize:11, color:'#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', flex:1 }}>负责人</span>
        <Avatar name={vm.name} color={vm.color} size={22} />
        <span style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{vm.name}</span>
        </div>
        ) : null; })()}
        </div>
        {/* Docs checklist */}
        <div>
        {checklist2.length > 0 ? (
        <>
        <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>材料清单 ({docsReceived2}/{checklist2.length})</div>
        <div style={{ background:'#f9fafb', borderRadius:8, padding:'8px 10px', maxHeight:180, overflowY:'auto', border:'1.5px solid #e2e8f0' }}>
        {checklist2.map(doc=>(
        <div key={doc} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', borderBottom:'1px solid #f1f5f9' }}>
        <span style={{ fontSize:14, color: docs2[doc]?'#34d399':'#cbd5e1' }}>{docs2[doc]?'✓':'○'}</span>
        <span style={{ fontSize:12, color: docs2[doc]?'#94a3b8':'#374151', textDecoration: docs2[doc]?'line-through':'none' }}>{doc}</span>
        </div>
        ))}
        </div>
        </>
        ) : (
        <div style={{ fontSize:12, color:'#94a3b8', paddingTop:8 }}>无材料清单</div>
        )}
        </div>
        </div>

        {/* ── CASE TIMELINE ───────────────────────── */}
        {(viewJob.caseTimeline||[]).length > 0 && (
        <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:14, marginBottom:14 }}>
        <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>大事记</div>
        <div style={{ position:'relative', paddingLeft:18, maxHeight:180, overflowY:'auto' }}>
        <div style={{ position:'absolute', left:5, top:6, bottom:6, width:2, background:'linear-gradient(to bottom,#6366f1,#e2e8f0)', borderRadius:2 }} />
        {(viewJob.caseTimeline||[]).map((ev,i) => {
        const col = ev.status==='Completed'?'#16a34a':ev.status==='Urgent'?'#d97706':ev.status==='Failed'?'#dc2626':'#6366f1';
        return (
        <div key={i} style={{ display:'flex', gap:12, marginBottom:8, alignItems:'flex-start' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:col, border:'2px solid #fff', boxShadow:`0 0 0 2px ${col}40`, flexShrink:0, marginTop:3 }} />
        <div style={{ flex:1, background:'#fff', borderRadius:7, padding:'7px 11px', border:'1px solid #e5e7eb' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{ev.event}</span>
        <span style={{ fontSize:10, fontWeight:700, color:col, background:col+'15', padding:'2px 7px', borderRadius:10 }}>{ev.status}</span>
        </div>
        <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{ev.date}</div>
        </div>
        </div>
        );
        })}
        </div>
        </div>
        )}

        {/* ── NOTES ──────────────────────────────── */}
        <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:14 }}>
        <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>备注 ({normalizeNotes(viewJob.notes).length})</div>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <input id="vj-note-inp" style={{ flex:1, background:'#fff', border:'2px solid #c7d2e0', borderRadius:9, padding:'8px 12px', fontSize:13, fontFamily:'inherit', outline:'none' }} placeholder="添加备注… (Enter 保存)"
        onKeyDown={async e => {
        if (e.key==='Enter' && e.target.value.trim()) {
        const updated = { ...viewJob, notes:[makeNote(e.target.value.trim()), ...normalizeNotes(viewJob.notes)] };
        setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
        try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
        e.target.value='';
        }
        }}
        />
        <button style={{ padding:'8px 14px', background:'#4f46e5', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}
        onClick={async () => {
        const inp = document.getElementById('vj-note-inp');
        if (!inp?.value.trim()) return;
        const updated = { ...viewJob, notes:[makeNote(inp.value.trim()), ...normalizeNotes(viewJob.notes)] };
        setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
        try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
        inp.value='';
        }}
        >添加</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto' }}>
        {normalizeNotes(viewJob.notes).length===0
        ? <div style={{ color:'#94a3b8', fontSize:13 }}>暂无备注</div>
        : [...normalizeNotes(viewJob.notes)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(n=>(
        <div key={n.id} style={{ background:'#f8fafc', borderRadius:8, padding:'9px 12px', border:'1.5px solid #e2e8f0' }}>
        <div style={{ fontSize:13, color:'#111827', whiteSpace:'pre-wrap', lineHeight:1.55 }}>{n.text}</div>
        <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{fmtDateTime(n.createdAt)}</div>
        </div>
        ))
        }
        </div>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:18, paddingTop:14, borderTop:'1.5px solid #e2e8f0' }}>
        <div style={{ display:'flex', gap:8 }}>
        <StatusBadge status={viewJob.status} />
        <PriorityBadge priority={viewJob.priority} />
        </div>
        <div style={{ display:'flex', gap:10 }}>
        <button onClick={()=>setViewJob(null)} style={{ padding:'8px 16px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:8, color:'#374151', fontSize:13 }}>关闭</button>
        <button onClick={()=>{ setViewJob(null); openEdit(viewJob); }} style={{ padding:'8px 18px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>✏️ 编辑案件</button>
        </div>
        </div>
        </Modal>
        );
        })()}
      </div>
    );
  }

  /* List view */
  return (
    <div className="animate-fade">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div><h1 style={{ fontSize:24, fontWeight:700, color:'#111827' }}>Cases</h1><p style={{ color:'#1f2937', fontSize:14, marginTop:2 }}>{jobs.length} total cases</p></div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ display:'flex', background:'#ffffff', borderRadius:8, border:'1.5px solid #cbd5e1', overflow:'hidden' }}>
            {['list','board'].map(v=><button key={v} onClick={()=>setView(v)} style={{ padding:'7px 14px', background: view===v?'#e5e7eb':'transparent', border:'none', color: view===v?'#e2e8f0':'#475569', fontSize:13, fontWeight:500, textTransform:'capitalize' }}>{v}</button>)}
          </div>
          <button onClick={openAdd} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:10, padding:'9px 16px', color:'#fff', fontWeight:700, fontSize:13 }}>+ New Case</button>
        </div>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search jobs..." style={{ ...inputStyle, width:240 }} />
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...selectStyle, width:160 }}>
          <option value="All">All Status</option>
          <option value="active_not_awaiting">Active (excl. Awaiting)</option>
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
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ ...selectStyle, width:180 }}>
          <option value="default">↕ Default (Newest)</option>
          <option value="urgency">🔥 By Urgency</option>
          <option value="progress">📊 By Progress ↓</option>
        </select>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.length === 0 && <Card><div style={{ textAlign:'center', color:'#1f2937', padding:30 }}>No cases found</div></Card>}
        {filtered.map(j => {
          const client = getClient(j.clientId);
          const member = getMember(j.assignedTo);
          const overdue = isOverdue(j.dueDate) && j.status !== 'Completed';
          const jnotes = normalizeNotes(j.notes);
          return (
            <Card key={j.id} onClick={()=>setViewJob(j)} style={{ padding:'14px 18px', cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span onClick={()=>setViewJob(j)} style={{ fontSize:14, fontWeight:600, color:'#ff158a', cursor:'pointer', textDecoration:'underline', textDecorationStyle:'dotted', textDecorationColor:'#38bdf840' }}>{j.title}</span>
                    <PriorityBadge priority={j.priority} />
                    {overdue && <span style={{ fontSize:11, color:'#f87171', background:'#7f1d1d30', borderRadius:10, padding:'2px 8px' }}>Overdue</span>}
                  </div>
                  <div style={{ fontSize:12, color:'#1f2937' }}>{client?.name} · <span style={{ color:'#1f2937' }}>{j.type}</span></div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                  <div style={{ width:120 }}>
                    <div style={{ fontSize:11, color:'#1f2937', marginBottom:4, textAlign:'right' }}>{STATUS_PROGRESS[j.status] ?? j.progress ?? 0}%</div>
                    <ProgressBar value={j.progress} status={j.status} />
                  </div>
                  <StatusBadge status={j.status} small />
                  {jnotes.length > 0 && <span style={{ fontSize:12, color:'#6366f1', background:'#eef2ff', borderRadius:10, padding:'2px 8px' }}>📝 {jnotes.length}</span>}
                  {member && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:110 }}>
                      <Avatar name={member.name} color={member.color} size={26} />
                      <span style={{ fontSize:12, color:'#1f2937' }}>{member.name.split(' ')[0]}</span>
                    </div>
                  )}
                  {j.dueDate && <div style={{ fontSize:12, color: overdue?'#f87171':'#475569', minWidth:80 }}>{fmtDate(j.dueDate)}</div>}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>openEdit(j)} style={{ background:'#e5e7eb', border:'none', borderRadius:7, padding:'5px 10px', color:'#1f2937', fontSize:12 }}>Edit</button>
                    <button onClick={()=>del(j.id)} style={{ background:'#7f1d1d20', border:'none', borderRadius:7, padding:'5px 10px', color:'#f87171', fontSize:12 }}>Del</button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {modal && (
        <Modal title={modal==='add'?'New Case':'Edit Case'} onClose={closeModal} wide>
              <>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <FormField label="Case Title" required>
          <input style={inputStyle} value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Visa Application" />
        </FormField>
        <FormField label="Case Type">
          <select style={selectStyle} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
            {JOB_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </FormField>
        <FormField label="Client" required>
          <div style={{ position:'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight:28 }}
              placeholder="Search client name..."
              value={clientSearch}
              onChange={e => {
                setClientSearch(e.target.value);
                const match = sortedClients.find(c => c.name.toLowerCase().startsWith(e.target.value.toLowerCase()));
                if (match) setForm(f => ({...f, clientId: match.id}));
              }}
              onFocus={() => setClientDropOpen(true)}
              onBlur={() => setTimeout(() => setClientDropOpen(false), 150)}
            />
            {clientDropOpen && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1.5px solid #cbd5e1', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:50, maxHeight:200, overflowY:'auto', marginTop:2 }}>
                {sortedClients
                  .filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                  .map(c => (
                    <div key={c.id}
                      onMouseDown={() => { setForm(f=>({...f,clientId:c.id})); setClientSearch(c.name); setClientDropOpen(false); }}
                      style={{ padding:'8px 13px', fontSize:13, color:'#111827', cursor:'pointer', background: form.clientId===c.id ? '#eef2ff' : 'transparent', fontWeight: form.clientId===c.id ? 600 : 400 }}
                      onMouseEnter={e => e.currentTarget.style.background='#f5f7ff'}
                      onMouseLeave={e => e.currentTarget.style.background = form.clientId===c.id ? '#eef2ff' : 'transparent'}
                    >
                      {c.name}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </FormField>
        <FormField label="Assign To">
          <select style={selectStyle} value={form.assignedTo} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))}>
            {team.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select style={selectStyle} value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value, progress: STATUS_PROGRESS[e.target.value] ?? f.progress ?? 0}))}>
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
        <FormField label={`Progress: ${form.progress ?? 0}%`}>
          <input type="range" min={0} max={100} step={5} value={form.progress ?? 0} onChange={e=>setForm(f=>({...f,progress:parseInt(e.target.value)}))} style={{ width:'100%', accentColor:'#6366f1', marginTop:8 }} />
        </FormField>
      </div>
      <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:8, paddingTop:16 }}>
        <NotesPanel notes={normalizeNotes(form.notes)} onAddNote={addNote} onDeleteNote={deleteNote} />
      </div>
      {(DOC_CHECKLISTS[form.type]||[]).length > 0 && (
        <div style={{ borderTop:'1.5px solid #e2e8f0', marginTop:8, paddingTop:16 }}>
          <div style={{ fontSize:11, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Document Checklist – {form.type}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {(DOC_CHECKLISTS[form.type]||[]).map(doc => {
              const checked = (form.docs||{})[doc] || false;
              return (
                <label key={doc} style={{ display:'flex', alignItems:'center', gap:8, background: checked?'#f0fdf4':'#f9fafb', borderRadius:7, padding:'7px 12px', cursor:'pointer', border:`1px solid ${checked?'#05966940':'#e5e7eb'}`, transition:'all 0.15s' }}>
                  <input type="checkbox" checked={checked} onChange={e=>setForm(f=>({...f, docs:{...(f.docs||{}), [doc]:e.target.checked}}))} style={{ accentColor:'#34d399', width:14, height:14 }} />
                  <span style={{ fontSize:12, color: checked?'#34d399':'#94a3b8' }}>{doc}</span>
                </label>
              );
            })}
          </div>
          <div style={{ fontSize:11, color:'#1f2937', marginTop:10 }}>
            {Object.values(form.docs||{}).filter(Boolean).length} / {(DOC_CHECKLISTS[form.type]||[]).length} documents received
          </div>
        </div>
      )}
    </>
  
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:18 }}>
            <button onClick={closeModal} style={{ background:'#e5e7eb', border:'none', borderRadius:8, padding:'9px 18px', color:'#1f2937', fontWeight:500 }}>Cancel</button>
            <button onClick={save} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, padding:'9px 20px', color:'#fff', fontWeight:700 }}>Save Case</button>
          </div>
        </Modal>
      )}
      {viewJob && (() => {
      const vc2 = getClient(viewJob.clientId);
      const checklist2 = DOC_CHECKLISTS[viewJob.type] || [];
      const docs2 = viewJob.docs || {};
      const pct2 = STATUS_PROGRESS[viewJob.status] ?? viewJob.progress ?? 0;
      const docsReceived2 = checklist2.filter(d=>docs2[d]).length;
      return (
      <Modal title={viewJob.title} onClose={()=>setViewJob(null)} wide>
      {/* ── PROGRESS BANNER ─────────────────────── */}
      <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius:12, padding:'14px 18px', marginBottom:16, color:'#fff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
      <div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:3 }}>案件进度</div>
      <div style={{ fontSize:15, fontWeight:700 }}>{vc2?.name||'—'} · {viewJob.type}</div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)', marginTop:2 }}>负责人: {getMember(viewJob.assignedTo)?.name||'—'} · Due {fmtDate(viewJob.dueDate)||'—'}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
      <div style={{ fontSize:28, fontWeight:800, color: pct2>=100?'#34d399':pct2>=70?'#a5b4fc':'#fbbf24', lineHeight:1 }}>{pct2}%</div>
      <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{viewJob.status}</div>
      </div>
      </div>
      <div style={{ height:5, borderRadius:5, background:'rgba(255,255,255,0.15)', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${pct2}%`, background: pct2>=100?'#34d399':pct2>=70?'#818cf8':'#fbbf24', borderRadius:5, transition:'width 0.4s' }} />
      </div>
      </div>

      {/* ── QUICK UPDATE PANEL ──────────────────── */}
      <div style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>快速更新 <span style={{ color:'#9ca3af', fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 }}>Quick Update</span></div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <div style={{ fontSize:11, color:'#374151', fontWeight:600, marginBottom:5 }}>状态 Status</div>
          <select value={viewJob.status} onChange={async e => {
            const updated = { ...viewJob, status: e.target.value };
            setViewJob(updated);
            setJobs(prev => prev.map(j => j.id===viewJob.id ? updated : j));
            try { await sbUpdate('jobs', updated.id, { data: updated }); } catch(er){ console.warn(er); }
          }} style={{ width:'100%', background:'#fff', border:'1.5px solid #d1d5db', borderRadius:7, padding:'7px 10px', fontSize:13, color:'#111827', outline:'none', cursor:'pointer' }}>
            {JOB_STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:11, color:'#374151', fontWeight:600, marginBottom:5 }}>进度 Progress: <span style={{ color:'#6366f1', fontWeight:700 }}>{STATUS_PROGRESS[viewJob.status] ?? viewJob.progress ?? 0}%</span></div>
          <input type="range" min={0} max={100} step={5} value={STATUS_PROGRESS[viewJob.status] ?? viewJob.progress ?? 0} onChange={async e => {
            const updated = { ...viewJob, progress: parseInt(e.target.value) };
            setViewJob(updated);
            setJobs(prev => prev.map(j => j.id===viewJob.id ? updated : j));
            try { await sbUpdate('jobs', updated.id, { data: updated }); } catch(er){ console.warn(er); }
          }} style={{ width:'100%', accentColor:'#6366f1', marginTop:4 }} />
        </div>
      </div>
      </div>

      {/* ── EDITABLE SNAPSHOT ───────────────────── */}
      <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em' }}>最新进展 <span style={{ color:'#9ca3af', fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 }}>(失焦自动保存)</span></div>
        <label style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:6, color:'#374151', fontSize:11, fontWeight:600, cursor:'pointer' }}>
          📄 上传快照
          <input type="file" accept=".docx,.pdf,.txt" style={{display:'none'}} onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return;
            try {
              let rawText = '';
              if (file.name.endsWith('.txt')) { rawText = await file.text(); }
              else { const buf = await file.arrayBuffer(); const { value } = await mammoth.extractRawText({ arrayBuffer: buf }); rawText = value; }
              const res = await fetch('/api/claude', { method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:2000,
                  messages:[{ role:'user', content:`Extract case timeline and current status from this immigration snapshot. Return ONLY valid JSON:\n{"snapshot":"brief 1-2 sentence current status","caseTimeline":[{"date":"","event":"","status":"Completed"}]}\nStatus values: Completed/In Progress/Urgent/Pending\nDocument:\n${rawText.slice(0,5000)}` }]
                })
              });
              const d = await res.json();
              const txt = (d.content?.[0]?.text||'').replace(/```json|```/g,'').trim();
              const parsed = JSON.parse(txt);
              const updated = { ...viewJob, ...(parsed.snapshot?{snapshot:parsed.snapshot}:{}), ...(parsed.caseTimeline?.length?{caseTimeline:parsed.caseTimeline}:{}) };
              setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
              try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
            } catch(err) { window.alert('Import failed: '+err.message); }
            e.target.value='';
          }} />
        </label>
      </div>
      <textarea
      style={{ width:'100%', background:'#f8fafc', border:'2px solid #c7d2e0', borderRadius:9, padding:'9px 12px', fontSize:13, color:'#111827', resize:'vertical', minHeight:72, fontFamily:'inherit', lineHeight:1.55, outline:'none', boxSizing:'border-box' }}
      placeholder="记录最新案件进展..."
      defaultValue={viewJob.snapshot||''}
      onBlur={async e => {
      if (e.target.value === (viewJob.snapshot||'')) return;
      const updated = { ...viewJob, snapshot: e.target.value };
      setViewJob(updated);
      setJobs(prev => prev.map(j => j.id===viewJob.id ? updated : j));
      try { await sbUpdate('jobs', updated.id, { data: updated }); } catch(er){ console.warn(er); }
      }}
      />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
      {/* Case info */}
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:2 }}>案件信息</div>
      {[['客户', vc2?.name||'—'], ['类型', viewJob.type], ['截止日期', fmtDate(viewJob.dueDate)], ['创建', fmtDate(viewJob.createdAt)]].map(([l,v]) => (
      <div key={l} style={{ display:'flex', justifyContent:'space-between', background:'#f8fafc', borderRadius:8, padding:'7px 11px', border:'1.5px solid #e2e8f0' }}>
      <span style={{ fontSize:11, color:'#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{l}</span>
      <span style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{v}</span>
      </div>
      ))}
      {(() => { const vm = getMember(viewJob.assignedTo); return vm ? (
      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:8, padding:'7px 11px', border:'1.5px solid #e2e8f0' }}>
      <span style={{ fontSize:11, color:'#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', flex:1 }}>负责人</span>
      <Avatar name={vm.name} color={vm.color} size={22} />
      <span style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{vm.name}</span>
      </div>
      ) : null; })()}
      </div>
      {/* Docs checklist */}
      <div>
      {checklist2.length > 0 ? (
      <>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>材料清单 ({docsReceived2}/{checklist2.length})</div>
      <div style={{ background:'#f9fafb', borderRadius:8, padding:'8px 10px', maxHeight:180, overflowY:'auto', border:'1.5px solid #e2e8f0' }}>
      {checklist2.map(doc=>(
      <div key={doc} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', borderBottom:'1px solid #f1f5f9' }}>
      <span style={{ fontSize:14, color: docs2[doc]?'#34d399':'#cbd5e1' }}>{docs2[doc]?'✓':'○'}</span>
      <span style={{ fontSize:12, color: docs2[doc]?'#94a3b8':'#374151', textDecoration: docs2[doc]?'line-through':'none' }}>{doc}</span>
      </div>
      ))}
      </div>
      </>
      ) : (
      <div style={{ fontSize:12, color:'#94a3b8', paddingTop:8 }}>无材料清单</div>
      )}
      </div>
      </div>

      {/* ── CASE TIMELINE ───────────────────────── */}
      {(viewJob.caseTimeline||[]).length > 0 && (
      <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:14, marginBottom:14 }}>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>大事记</div>
      <div style={{ position:'relative', paddingLeft:18, maxHeight:180, overflowY:'auto' }}>
      <div style={{ position:'absolute', left:5, top:6, bottom:6, width:2, background:'linear-gradient(to bottom,#6366f1,#e2e8f0)', borderRadius:2 }} />
      {(viewJob.caseTimeline||[]).map((ev,i) => {
      const col = ev.status==='Completed'?'#16a34a':ev.status==='Urgent'?'#d97706':ev.status==='Failed'?'#dc2626':'#6366f1';
      return (
      <div key={i} style={{ display:'flex', gap:12, marginBottom:8, alignItems:'flex-start' }}>
      <div style={{ width:10, height:10, borderRadius:'50%', background:col, border:'2px solid #fff', boxShadow:`0 0 0 2px ${col}40`, flexShrink:0, marginTop:3 }} />
      <div style={{ flex:1, background:'#fff', borderRadius:7, padding:'7px 11px', border:'1px solid #e5e7eb' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{ev.event}</span>
      <span style={{ fontSize:10, fontWeight:700, color:col, background:col+'15', padding:'2px 7px', borderRadius:10 }}>{ev.status}</span>
      </div>
      <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{ev.date}</div>
      </div>
      </div>
      );
      })}
      </div>
      </div>
      )}

      {/* ── NOTES ──────────────────────────────── */}
      <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:14 }}>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>备注 ({normalizeNotes(viewJob.notes).length})</div>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
      <input id="vj-note-inp" style={{ flex:1, background:'#fff', border:'2px solid #c7d2e0', borderRadius:9, padding:'8px 12px', fontSize:13, fontFamily:'inherit', outline:'none' }} placeholder="添加备注… (Enter 保存)"
      onKeyDown={async e => {
      if (e.key==='Enter' && e.target.value.trim()) {
      const updated = { ...viewJob, notes:[makeNote(e.target.value.trim()), ...normalizeNotes(viewJob.notes)] };
      setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
      try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
      e.target.value='';
      }
      }}
      />
      <button style={{ padding:'8px 14px', background:'#4f46e5', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}
      onClick={async () => {
      const inp = document.getElementById('vj-note-inp');
      if (!inp?.value.trim()) return;
      const updated = { ...viewJob, notes:[makeNote(inp.value.trim()), ...normalizeNotes(viewJob.notes)] };
      setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
      try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
      inp.value='';
      }}
      >添加</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto' }}>
      {normalizeNotes(viewJob.notes).length===0
      ? <div style={{ color:'#94a3b8', fontSize:13 }}>暂无备注</div>
      : [...normalizeNotes(viewJob.notes)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(n=>(
      <div key={n.id} style={{ background:'#f8fafc', borderRadius:8, padding:'9px 12px', border:'1.5px solid #e2e8f0' }}>
      <div style={{ fontSize:13, color:'#111827', whiteSpace:'pre-wrap', lineHeight:1.55 }}>{n.text}</div>
      <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{fmtDateTime(n.createdAt)}</div>
      </div>
      ))
      }
      </div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:18, paddingTop:14, borderTop:'1.5px solid #e2e8f0' }}>
      <div style={{ display:'flex', gap:8 }}>
      <StatusBadge status={viewJob.status} />
      <PriorityBadge priority={viewJob.priority} />
      </div>
      <div style={{ display:'flex', gap:10 }}>
      <button onClick={()=>setViewJob(null)} style={{ padding:'8px 16px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:8, color:'#374151', fontSize:13 }}>关闭</button>
      <button onClick={()=>{ setViewJob(null); openEdit(viewJob); }} style={{ padding:'8px 18px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>✏️ 编辑案件</button>
      </div>
      </div>
      </Modal>
      );
      })()}
    </div>
  );
}

/* ─── TEAM ─────────────────────────────────────────────────────────────────── */
function Team({ team, jobs, clients, setTeam, setJobs: setJobsOuter }) {
  const getMember = id => team.find(t => t.id === id);
  const setJobs = setJobsOuter || (() => {});
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState({});
  const [drillMember, setDrillMember] = useState(null);  // member whose full case list is shown
  const [viewJob, setViewJob]       = useState(null);     // job detail modal
  const [userRoles, setUserRoles]   = useState({});
  const currentUserEmail = sessionStorage.getItem('ozsky_email') || '';

  useEffect(() => {
    sbFetch('user_roles?select=email,role')
      .then(rows => {
        if (!rows) return;
        const map = {};
        rows.forEach(r => { map[r.email] = r.role; });
        setUserRoles(map);
      })
      .catch(() => {});
  }, []);

  const toggleRole = async (email) => {
    const current = userRoles[email] || ALLOWED_USERS[email] || 'staff';
    const next = current === 'manager' ? 'staff' : 'manager';
    setUserRoles(prev => ({ ...prev, [email]: next }));
    await sbUpsert('user_roles', { email, role: next });
  };

  const PRIORITY_ORDER = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };

  const getMemberJobs = id => jobs
    .filter(j => j.assignedTo === id && j.status !== 'Completed')
    .sort((a, b) => {
      const pdiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pdiff !== 0) return pdiff;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
      return 0;
    });
  const getCompletedCount = id => jobs.filter(j => j.assignedTo === id && j.status === 'Completed').length;
  const getClient = id => clients.find(c => c.id === id);

  const caseLabel = (type) => {
    if (!type) return '—';
    return type.replace('Subclass ', 'SC ').replace('Skills Assessment – ', 'SA – ');
  };

  const openEdit = m => { setForm({...m}); setEditing(m.id); };
  const save = async () => {
    setTeam(prev => prev.map(m => m.id === form.id ? form : m));
    try { await sbUpdate('team', form.id, { data: form }); } catch(e) { console.warn('Save error:', e); }
    setEditing(null);
  };

  /* Shared job-row renderer used both in cards and drill-down modal */
  const CaseRow = ({ j, idx, compact }) => {
    const client = getClient(j.clientId);
    const overdue = isOverdue(j.dueDate);
    const pStyle = PRIORITY_STYLES[j.priority] || {};
    const isUrgentTop = idx === 0 && j.priority === 'Urgent';
    return (
      <div
        onClick={() => setViewJob(j)}
        style={{
          background: isUrgentTop ? '#7f1d1d18' : '#ffffff',
          border: `1px solid ${isUrgentTop ? '#7f1d1d50' : '#1e2d4060'}`,
          borderRadius:8, padding: compact ? '7px 10px' : '10px 14px',
          cursor:'pointer', transition:'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = isUrgentTop ? '#7f1d1d28' : '#0f1f33'}
        onMouseLeave={e => e.currentTarget.style.background = isUrgentTop ? '#7f1d1d18' : '#ffffff'}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#111827', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginRight:8 }}>
            {client?.name || '—'}
          </span>
          <span style={{ fontSize:10, fontWeight:700, color:pStyle.text||'#94a3b8', background:pStyle.bg||'#e5e7eb', borderRadius:10, padding:'2px 8px', flexShrink:0, textTransform:'uppercase', letterSpacing:'0.04em' }}>
            {j.priority}
          </span>
        </div>
        <div style={{ fontSize:11, color:'#60a5fa', marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {caseLabel(j.type)}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <StatusBadge status={j.status} small />
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {j.dueDate && (
              <span style={{ fontSize:10, color: overdue ? '#f87171' : '#475569' }}>
                {overdue ? '⚠ ' : ''}{fmtDate(j.dueDate)}
              </span>
            )}
            <span style={{ fontSize:10, color:'#1f2937' }}>→</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:700, color:'#111827' }}>Team</h1>
        <p style={{ color:'#1f2937', fontSize:14, marginTop:2 }}>{team.length} members · Click any case to open details</p>
      </div>

      {/* ── Member cards grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(360px,1fr))', gap:16 }}>
        {team.map(m => {
          const activeJobs = getMemberJobs(m.id);
          const completedCount = getCompletedCount(m.id);
          const urgentCount = activeJobs.filter(j => j.priority === 'Urgent').length;
          const preview = activeJobs.slice(0, 3);
          const remaining = activeJobs.length - 3;

          return (
            <Card key={m.id} style={{ position:'relative' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:4, borderRadius:'12px 12px 0 0', background:`linear-gradient(90deg, ${m.color}80, ${m.color}20)` }} />

              {/* Member header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, marginTop:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Avatar name={m.name} color={m.color} size={44} />
                  <div>
                    <div style={{ fontWeight:600, color:'#111827', fontSize:15 }}>{m.name}</div>
                    <div style={{ fontSize:12, color:'#1f2937', marginTop:2 }}>{m.role}</div>
                    <div style={{ fontSize:11, color:'#1f2937', marginTop:2 }}>✉ {m.email}</div>
                  </div>
                </div>
                <button onClick={() => openEdit(m)} style={{ background:'#e5e7eb', border:'none', borderRadius:7, padding:'4px 10px', color:'#1f2937', fontSize:12 }}>Edit</button>
              </div>

              {/* Stats row */}
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                <div style={{ flex:1, background:'#ffffff', borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:m.color, fontFamily:"'JetBrains Mono',monospace" }}>{activeJobs.length}</div>
                  <div style={{ fontSize:11, color:'#1f2937' }}>Active</div>
                </div>
                {urgentCount > 0 && (
                  <div style={{ flex:1, background:'#7f1d1d20', borderRadius:8, padding:'7px 10px', textAlign:'center', border:'1px solid #7f1d1d40' }}>
                    <div style={{ fontSize:20, fontWeight:700, color:'#f87171', fontFamily:"'JetBrains Mono',monospace" }}>{urgentCount}</div>
                    <div style={{ fontSize:11, color:'#f87171' }}>Urgent</div>
                  </div>
                )}
                <div style={{ flex:1, background:'#ffffff', borderRadius:8, padding:'7px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:'#34d399', fontFamily:"'JetBrains Mono',monospace" }}>{completedCount}</div>
                  <div style={{ fontSize:11, color:'#1f2937' }}>Done</div>
                </div>
              </div>

              {/* Top-3 case list */}
              {activeJobs.length > 0 ? (
                <div>
                  <div style={{ fontSize:11, color:'#1f2937', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                    Top Cases — ranked by urgency
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {preview.map((j, idx) => <CaseRow key={j.id} j={j} idx={idx} compact />)}
                  </div>

                  {/* View All button */}
                  {remaining > 0 ? (
                    <button
                      onClick={() => setDrillMember(m)}
                      style={{ marginTop:10, width:'100%', background:'#e5e7eb', border:'1.5px solid #cbd5e1', borderRadius:8, padding:'8px 0', color:'#1f2937', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#253650'; e.currentTarget.style.color='#e2e8f0'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#e5e7eb'; e.currentTarget.style.color='#94a3b8'; }}
                    >
                      View all {activeJobs.length} cases →
                    </button>
                  ) : (
                    <button
                      onClick={() => setDrillMember(m)}
                      style={{ marginTop:10, width:'100%', background:'transparent', border:'1.5px solid #cbd5e1', borderRadius:8, padding:'6px 0', color:'#1f2937', fontSize:11, cursor:'pointer' }}
                    >
                      View details
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ fontSize:13, color:'#1f2937', textAlign:'center', padding:'10px 0' }}>No active jobs 🎉</div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Drill-down modal: all cases for one member ── */}
      {drillMember && (() => {
        const allJobs = getMemberJobs(drillMember.id);
        const completedJobs = jobs.filter(j => j.assignedTo === drillMember.id && j.status === 'Completed');
        return (
          <Modal title={`${drillMember.name} — All Cases`} onClose={() => setDrillMember(null)} wide>
            {/* Member summary bar */}
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20, padding:'12px 16px', background:'#ffffff', borderRadius:10, border:'1px solid #e5e7eb' }}>
              <Avatar name={drillMember.name} color={drillMember.color} size={40} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, color:'#111827', fontSize:15 }}>{drillMember.name}</div>
                <div style={{ fontSize:12, color:'#1f2937' }}>{drillMember.role} · {drillMember.email}</div>
              </div>
              <div style={{ display:'flex', gap:12 }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:drillMember.color, fontFamily:"'JetBrains Mono',monospace" }}>{allJobs.length}</div>
                  <div style={{ fontSize:10, color:'#1f2937' }}>Active</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#34d399', fontFamily:"'JetBrains Mono',monospace" }}>{completedJobs.length}</div>
                  <div style={{ fontSize:10, color:'#1f2937' }}>Done</div>
                </div>
              </div>
            </div>

            {/* Active cases */}
            {allJobs.length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:'#1f2937', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                  Active Cases ({allJobs.length}) — click to open
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {allJobs.map((j, idx) => <CaseRow key={j.id} j={j} idx={idx} />)}
                </div>
              </div>
            )}

            {/* Completed cases */}
            {completedJobs.length > 0 && (
              <div>
                <div style={{ fontSize:11, color:'#1f2937', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
                  Completed ({completedJobs.length})
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {completedJobs.map(j => {
                    const client = getClient(j.clientId);
                    return (
                      <div key={j.id} onClick={() => setViewJob(j)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#ffffff', borderRadius:8, cursor:'pointer', opacity:0.6 }}
                        onMouseEnter={e => e.currentTarget.style.opacity='1'}
                        onMouseLeave={e => e.currentTarget.style.opacity='0.6'}>
                        <span style={{ fontSize:12, color:'#1f2937' }}>{client?.name || '—'}</span>
                        <span style={{ fontSize:11, color:'#60a5fa' }}>{caseLabel(j.type)}</span>
                        <StatusBadge status={j.status} small />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {allJobs.length === 0 && completedJobs.length === 0 && (
              <div style={{ textAlign:'center', color:'#1f2937', padding:'20px 0' }}>No cases assigned yet.</div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20 }}>
              <button onClick={() => setDrillMember(null)} style={{ background:'#e5e7eb', border:'none', borderRadius:8, padding:'9px 20px', color:'#1f2937', fontWeight:500 }}>Close</button>
            </div>
          </Modal>
        );
      })()}

      {/* ── Job detail modal (opened by clicking a case row) ── */}
      {viewJob && (() => {
      const vc2 = getClient(viewJob.clientId);
      const checklist2 = DOC_CHECKLISTS[viewJob.type] || [];
      const docs2 = viewJob.docs || {};
      const pct2 = STATUS_PROGRESS[viewJob.status] ?? viewJob.progress ?? 0;
      const docsReceived2 = checklist2.filter(d=>docs2[d]).length;
      return (
      <Modal title={viewJob.title} onClose={()=>setViewJob(null)} wide>
      {/* ── PROGRESS BANNER ─────────────────────── */}
      <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius:12, padding:'14px 18px', marginBottom:16, color:'#fff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
      <div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:3 }}>案件进度</div>
      <div style={{ fontSize:15, fontWeight:700 }}>{vc2?.name||'—'} · {viewJob.type}</div>
      <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)', marginTop:2 }}>负责人: {getMember(viewJob.assignedTo)?.name||'—'} · Due {fmtDate(viewJob.dueDate)||'—'}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
      <div style={{ fontSize:28, fontWeight:800, color: pct2>=100?'#34d399':pct2>=70?'#a5b4fc':'#fbbf24', lineHeight:1 }}>{pct2}%</div>
      <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{viewJob.status}</div>
      </div>
      </div>
      <div style={{ height:5, borderRadius:5, background:'rgba(255,255,255,0.15)', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${pct2}%`, background: pct2>=100?'#34d399':pct2>=70?'#818cf8':'#fbbf24', borderRadius:5, transition:'width 0.4s' }} />
      </div>
      </div>

      {/* ── EDITABLE SNAPSHOT ───────────────────── */}
      <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>最新进展 <span style={{ color:'#9ca3af', fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11 }}>(失焦自动保存)</span></div>
      <textarea
      style={{ width:'100%', background:'#f8fafc', border:'2px solid #c7d2e0', borderRadius:9, padding:'9px 12px', fontSize:13, color:'#111827', resize:'vertical', minHeight:72, fontFamily:'inherit', lineHeight:1.55, outline:'none', boxSizing:'border-box' }}
      placeholder="记录最新案件进展..."
      defaultValue={viewJob.snapshot||''}
      onBlur={async e => {
      if (e.target.value === (viewJob.snapshot||'')) return;
      const updated = { ...viewJob, snapshot: e.target.value };
      setViewJob(updated);
      setJobs(prev => prev.map(j => j.id===viewJob.id ? updated : j));
      try { await sbUpdate('jobs', updated.id, { data: updated }); } catch(er){ console.warn(er); }
      }}
      />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
      {/* Case info */}
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:2 }}>案件信息</div>
      {[['客户', vc2?.name||'—'], ['类型', viewJob.type], ['截止日期', fmtDate(viewJob.dueDate)], ['创建', fmtDate(viewJob.createdAt)]].map(([l,v]) => (
      <div key={l} style={{ display:'flex', justifyContent:'space-between', background:'#f8fafc', borderRadius:8, padding:'7px 11px', border:'1.5px solid #e2e8f0' }}>
      <span style={{ fontSize:11, color:'#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{l}</span>
      <span style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{v}</span>
      </div>
      ))}
      {(() => { const vm = getMember(viewJob.assignedTo); return vm ? (
      <div style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:8, padding:'7px 11px', border:'1.5px solid #e2e8f0' }}>
      <span style={{ fontSize:11, color:'#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', flex:1 }}>负责人</span>
      <Avatar name={vm.name} color={vm.color} size={22} />
      <span style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{vm.name}</span>
      </div>
      ) : null; })()}
      </div>
      {/* Docs checklist */}
      <div>
      {checklist2.length > 0 ? (
      <>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:6 }}>材料清单 ({docsReceived2}/{checklist2.length})</div>
      <div style={{ background:'#f9fafb', borderRadius:8, padding:'8px 10px', maxHeight:180, overflowY:'auto', border:'1.5px solid #e2e8f0' }}>
      {checklist2.map(doc=>(
      <div key={doc} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 4px', borderBottom:'1px solid #f1f5f9' }}>
      <span style={{ fontSize:14, color: docs2[doc]?'#34d399':'#cbd5e1' }}>{docs2[doc]?'✓':'○'}</span>
      <span style={{ fontSize:12, color: docs2[doc]?'#94a3b8':'#374151', textDecoration: docs2[doc]?'line-through':'none' }}>{doc}</span>
      </div>
      ))}
      </div>
      </>
      ) : (
      <div style={{ fontSize:12, color:'#94a3b8', paddingTop:8 }}>无材料清单</div>
      )}
      </div>
      </div>

      {/* ── CASE TIMELINE ───────────────────────── */}
      {(viewJob.caseTimeline||[]).length > 0 && (
      <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:14, marginBottom:14 }}>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>大事记</div>
      <div style={{ position:'relative', paddingLeft:18, maxHeight:180, overflowY:'auto' }}>
      <div style={{ position:'absolute', left:5, top:6, bottom:6, width:2, background:'linear-gradient(to bottom,#6366f1,#e2e8f0)', borderRadius:2 }} />
      {(viewJob.caseTimeline||[]).map((ev,i) => {
      const col = ev.status==='Completed'?'#16a34a':ev.status==='Urgent'?'#d97706':ev.status==='Failed'?'#dc2626':'#6366f1';
      return (
      <div key={i} style={{ display:'flex', gap:12, marginBottom:8, alignItems:'flex-start' }}>
      <div style={{ width:10, height:10, borderRadius:'50%', background:col, border:'2px solid #fff', boxShadow:`0 0 0 2px ${col}40`, flexShrink:0, marginTop:3 }} />
      <div style={{ flex:1, background:'#fff', borderRadius:7, padding:'7px 11px', border:'1px solid #e5e7eb' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontSize:12, fontWeight:600, color:'#111827' }}>{ev.event}</span>
      <span style={{ fontSize:10, fontWeight:700, color:col, background:col+'15', padding:'2px 7px', borderRadius:10 }}>{ev.status}</span>
      </div>
      <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{ev.date}</div>
      </div>
      </div>
      );
      })}
      </div>
      </div>
      )}

      {/* ── NOTES ──────────────────────────────── */}
      <div style={{ borderTop:'1.5px solid #e2e8f0', paddingTop:14 }}>
      <div style={{ fontSize:11, color:'#374151', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>备注 ({normalizeNotes(viewJob.notes).length})</div>
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
      <input id="vj-note-inp" style={{ flex:1, background:'#fff', border:'2px solid #c7d2e0', borderRadius:9, padding:'8px 12px', fontSize:13, fontFamily:'inherit', outline:'none' }} placeholder="添加备注… (Enter 保存)"
      onKeyDown={async e => {
      if (e.key==='Enter' && e.target.value.trim()) {
      const updated = { ...viewJob, notes:[makeNote(e.target.value.trim()), ...normalizeNotes(viewJob.notes)] };
      setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
      try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
      e.target.value='';
      }
      }}
      />
      <button style={{ padding:'8px 14px', background:'#4f46e5', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}
      onClick={async () => {
      const inp = document.getElementById('vj-note-inp');
      if (!inp?.value.trim()) return;
      const updated = { ...viewJob, notes:[makeNote(inp.value.trim()), ...normalizeNotes(viewJob.notes)] };
      setViewJob(updated); setJobs(prev=>prev.map(j=>j.id===viewJob.id?updated:j));
      try { await sbUpdate('jobs', updated.id, {data:updated}); } catch(er){ console.warn(er); }
      inp.value='';
      }}
      >添加</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto' }}>
      {normalizeNotes(viewJob.notes).length===0
      ? <div style={{ color:'#94a3b8', fontSize:13 }}>暂无备注</div>
      : [...normalizeNotes(viewJob.notes)].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(n=>(
      <div key={n.id} style={{ background:'#f8fafc', borderRadius:8, padding:'9px 12px', border:'1.5px solid #e2e8f0' }}>
      <div style={{ fontSize:13, color:'#111827', whiteSpace:'pre-wrap', lineHeight:1.55 }}>{n.text}</div>
      <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{fmtDateTime(n.createdAt)}</div>
      </div>
      ))
      }
      </div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:18, paddingTop:14, borderTop:'1.5px solid #e2e8f0' }}>
      <div style={{ display:'flex', gap:8 }}>
      <StatusBadge status={viewJob.status} />
      <PriorityBadge priority={viewJob.priority} />
      </div>
      <div style={{ display:'flex', gap:10 }}>
      <button onClick={()=>setViewJob(null)} style={{ padding:'8px 16px', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:8, color:'#374151', fontSize:13 }}>关闭</button>
      <button onClick={()=>{ setViewJob(null); }} style={{ padding:'8px 18px', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>✏️ 编辑案件</button>
      </div>
      </div>
      </Modal>
      );
      })()}

      {/* ── Edit member modal ── */}
      {editing && (
        <Modal title="Edit Team Member" onClose={() => setEditing(null)}>
          <FormField label="Name"><input style={inputStyle} value={form.name||''} onChange={e => setForm(f => ({...f, name:e.target.value}))} /></FormField>
          <FormField label="Role"><input style={inputStyle} value={form.role||''} onChange={e => setForm(f => ({...f, role:e.target.value}))} /></FormField>
          <FormField label="Email"><input style={inputStyle} value={form.email||''} onChange={e => setForm(f => ({...f, email:e.target.value}))} /></FormField>
          <FormField label="Color">
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
              {TEAM_COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({...f, color:c}))} style={{ width:28, height:28, borderRadius:'50%', background:c, border: form.color===c?'3px solid white':'3px solid transparent', cursor:'pointer' }} />
              ))}
            </div>
          </FormField>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
            <button onClick={() => setEditing(null)} style={{ background:'#e5e7eb', border:'none', borderRadius:8, padding:'9px 18px', color:'#1f2937', fontWeight:500 }}>Cancel</button>
            <button onClick={save} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, padding:'9px 20px', color:'#fff', fontWeight:700 }}>Save</button>
          </div>
        </Modal>
      )}

      {/* ── Access Management ── */}
      <div style={{ marginTop:32 }}>
        <div style={{ marginBottom:16 }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:'#323338', marginBottom:4 }}>System Access</h2>
          <p style={{ fontSize:13, color:'#676879' }}>Manage CRM login roles. Changes take effect on next login.</p>
        </div>
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e9eaf3', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e9eaf3' }}>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#676879' }}>Email</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#676879' }}>Role</th>
                <th style={{ padding:'10px 16px', textAlign:'right', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#676879' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(ALLOWED_USERS).map((email, i) => {
                const role = userRoles[email] || ALLOWED_USERS[email];
                const isSelf = email === currentUserEmail;
                return (
                  <tr key={email} style={{ borderBottom: i < Object.keys(ALLOWED_USERS).length - 1 ? '1px solid #f3f4f8' : 'none' }}>
                    <td style={{ padding:'12px 16px', fontSize:13, color:'#323338' }}>{email}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:99,
                        fontSize:11.5, fontWeight:600,
                        background: role === 'manager' ? '#ffd6ee' : '#f3f4f6',
                        color: role === 'manager' ? '#c11569' : '#676879',
                      }}>
                        {role === 'manager' ? '★ Manager' : 'Staff'}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'right' }}>
                      <button
                        onClick={() => toggleRole(email)}
                        disabled={isSelf}
                        title={isSelf ? "Can't change your own role" : `Make ${role === 'manager' ? 'staff' : 'manager'}`}
                        style={{
                          padding:'5px 12px', borderRadius:7, fontSize:12, fontWeight:600, cursor: isSelf ? 'not-allowed' : 'pointer',
                          background: isSelf ? '#f3f4f6' : role === 'manager' ? '#fef2f2' : '#f0fdf4',
                          border: isSelf ? '1px solid #e5e7eb' : role === 'manager' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                          color: isSelf ? '#9ca3af' : role === 'manager' ? '#dc2626' : '#166534',
                          opacity: isSelf ? 0.5 : 1,
                        }}
                      >
                        {role === 'manager' ? 'Demote' : 'Promote'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize:11, color:'#9ca3af', marginTop:8 }}>You cannot change your own role.</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════════════════════ */
// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────

/* ─── NEW CONSTANTS ──────────────────────────────────────────────────────────── */
const LEAD_STAGES = ['New Enquiry','Consultation Booked','Proposal Sent','Converted','Lost'];
const LEAD_STAGE_COLORS = { 
  'New Enquiry':        '#6366f1',
  'Consultation Booked':'#a78bfa',
  'Proposal Sent':      '#f59e0b',
  'Converted':          '#34d399',
  'Lost':               '#ef4444'
};
const INVOICE_STATUSES = ['Draft','Sent','Paid','Overdue'];
const INVOICE_STATUS_STYLES = {
  'Draft':   { bg:'#1e2d4040', text:'#94a3b8' },
  'Sent':    { bg:'#0ea5e920', text:'#6366f1' },
  'Paid':    { bg:'#10b98120', text:'#34d399' },
  'Overdue': { bg:'#ef444420', text:'#f87171' },
};
const APPT_TYPES = ['Consultation','Follow-up','Document Review','Deadline Reminder','Other'];
const LEAD_SOURCES = ['Website','Referral','Agent','Walk-in','Social Media','Other'];

const INIT_LEADS = [];
const INIT_INVOICES = [];
const INIT_APPOINTMENTS = [];
const INIT_AGENTS = [];

const fmtCurrency = v => `$${Number(v||0).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const addDays = (d,n) => { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10); };
const daysUntil = d => Math.ceil((new Date(d) - new Date(today())) / 86400000);

/* ─── DEADLINE ALERTS BANNER ──────────────────────────────────────────────────── */
function DeadlineAlerts({ jobs, appointments, onGoTo, setOpenJobId }) {
  const soon = [];
  const todayStr = today();
  const sevenDays = addDays(todayStr, 7);

  jobs.forEach(j => {
    if (['Completed', 'Awaiting Decision', 'On Hold'].includes(j.status)) return;
    if (j.dueDate && j.dueDate <= sevenDays) {
      const d = daysUntil(j.dueDate);
      soon.push({ type:'job', label: j.type || 'Case', id: j.id, days: d, overdue: d < 0, urgent: d <= 2 });
    }
  });
  appointments.forEach(a => {
    if (a.date && a.date <= sevenDays && a.date >= todayStr) {
      soon.push({ type:'appt', label: a.title, id: a.id, days: daysUntil(a.date), overdue: false, urgent: daysUntil(a.date) <= 1 });
    }
  });

  if (!soon.length) return null;
  soon.sort((a,b) => a.days - b.days);

  const handleClick = (s) => {
    if (s.type === 'job' && onGoTo && setOpenJobId) {
      setOpenJobId(s.id);
      onGoTo('jobs');
    }
  };

  return (
    <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', border:'1.5px solid #6366f140', borderRadius:14, padding:'16px 20px', marginBottom:20, boxShadow:'0 4px 20px #6366f120' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <div style={{ background:'#f59e0b', borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:800, color:'#1c1917', letterSpacing:'0.05em', flexShrink:0 }}>
          ⏰ {soon.length} UPCOMING
        </div>
        <span style={{ fontSize:13, color:'#c7d2fe', fontWeight:500 }}>deadline{soon.length>1?'s':''} in the next 7 days</span>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {soon.slice(0,6).map((s,i) => (
          <div key={i} onClick={() => handleClick(s)} style={{ display:'flex', alignItems:'center', gap:6, background: s.overdue?'#ef444425':s.urgent?'#f9731625':'#ffffff12', border:`1px solid ${s.overdue?'#ef4444':s.urgent?'#f97316':'#6366f145'}`, borderRadius:8, padding:'6px 12px', cursor: s.type==='job' ? 'pointer' : 'default', transition:'filter 0.15s, transform 0.15s' }}
            onMouseEnter={e => { if (s.type==='job') { e.currentTarget.style.filter='brightness(1.25)'; e.currentTarget.style.transform='translateY(-1px)'; }}}
            onMouseLeave={e => { e.currentTarget.style.filter='none'; e.currentTarget.style.transform='translateY(0)'; }}>
            <span style={{ fontSize:11 }}>{s.overdue?'🔴':s.urgent?'⚠️':'📅'}</span>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color: s.overdue?'#fca5a5':s.urgent?'#fdba74':'#e0e7ff', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</div>
              <div style={{ fontSize:10, color: s.overdue?'#f87171':s.urgent?'#fb923c':'#a5b4fc', marginTop:1 }}>
                {s.overdue ? `${Math.abs(s.days)}d overdue` : s.days===0 ? 'Today' : `${s.days}d left`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── LEADS PAGE ──────────────────────────────────────────────────────────────── */
function Leads({ leads, setLeads, clients, setClients, jobs, setJobs, team, agents }) {
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [filter, setFilter] = useState('');

  const empty = { name:'', email:'', phone:'', nationality:'', visaInterest:'', stage:'New Enquiry', source:'Website', referralId:'', notes:'', assignedTo:'' };
  const [form, setForm] = useState(empty);

  const openAdd = () => { setForm(empty); setEditLead(null); setShowForm(true); };
  const openEdit = l => { setForm({...l}); setEditLead(l.id); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    if (editLead) {
      const updated = { ...form, updatedAt: new Date().toISOString() };
      setLeads(ls => ls.map(l => l.id === editLead ? updated : l));
      try { await sbUpdate('leads', editLead, { data: updated }); } catch(e) {}
    } else {
      const nl = { ...form, id:'ld'+Date.now(), createdAt: new Date().toISOString() };
      setLeads(ls => [...ls, nl]);
      try { await sbInsert('leads', { id: nl.id, data: nl }); } catch(e) {}
    }
    setShowForm(false);
  };

  const deleteLead = async id => {
    if (!window.confirm('Delete this lead?')) return;
    setLeads(ls => ls.filter(l => l.id !== id));
    try { await sbDelete('leads', id); } catch(e) {}
  };

  const convertLead = async lead => {
    const nc = { id:'c'+Date.now(), name:lead.name, email:lead.email, phone:lead.phone, nationality:lead.nationality, type:'Migration', status:'Active', notes:[], createdAt:new Date().toISOString() };
    setClients(cs => [...cs, nc]);
    try { await sbInsert('clients', { id:nc.id, data:nc }); } catch(e) {}
    const updated = { ...lead, stage:'Converted', convertedToClientId: nc.id };
    setLeads(ls => ls.map(l => l.id===lead.id ? updated : l));
    try { await sbUpdate('leads', lead.id, { data: updated }); } catch(e) {}
    window.alert(`✅ ${lead.name} converted to client!`);
  };

  const filtered = leads.filter(l => !filter || l.name.toLowerCase().includes(filter.toLowerCase()) || (l.email||'').toLowerCase().includes(filter.toLowerCase()));

  const byStage = LEAD_STAGES.reduce((acc,s) => { acc[s] = filtered.filter(l=>l.stage===s); return acc; }, {});

  return (
    <div style={{ animation:'fadeIn 0.3s ease' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#111827' }}>Leads Pipeline</h1>
          <div style={{ fontSize:13, color:'#1f2937', marginTop:3 }}>{leads.length} total leads · {leads.filter(l=>l.stage==='Converted').length} converted</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search leads…" style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:8, padding:'8px 12px', color:'#111827', fontSize:13, width:200, outline:'none' }}/>
          <button onClick={openAdd} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', color:'#ffffff', border:'none', borderRadius:8, padding:'9px 18px', fontWeight:700, fontSize:13 }}>+ Add Lead</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:24 }}>
        {LEAD_STAGES.map(s => (
          <div key={s} style={{ background:'#ffffff', border:`1px solid ${LEAD_STAGE_COLORS[s]}30`, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:11, color: LEAD_STAGE_COLORS[s], fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{s}</div>
            <div style={{ fontSize:24, fontWeight:700, color:'#111827' }}>{byStage[s].length}</div>
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, alignItems:'start' }}>
        {LEAD_STAGES.map(stage => (
          <div key={stage}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: LEAD_STAGE_COLORS[stage] }}/>
              <span style={{ fontSize:12, fontWeight:600, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em' }}>{stage}</span>
              <span style={{ fontSize:11, background:'#e5e7eb', color:'#1f2937', borderRadius:8, padding:'1px 6px', marginLeft:'auto' }}>{byStage[stage].length}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {byStage[stage].map(lead => (
                <div key={lead.id} style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:10, padding:'12px 14px', cursor:'pointer' }}
                  onClick={() => openEdit(lead)}>
                  <div style={{ fontWeight:600, color:'#111827', fontSize:13, marginBottom:4 }}>{lead.name}</div>
                  {lead.visaInterest && <div style={{ fontSize:11, color:'#6366f1', marginBottom:4 }}>{lead.visaInterest}</div>}
                  {lead.email && <div style={{ fontSize:11, color:'#1f2937', marginBottom:2 }}>✉ {lead.email}</div>}
                  {lead.source && <div style={{ fontSize:11, color:'#1f2937' }}>src: {lead.source}</div>}
                  <div style={{ display:'flex', gap:6, marginTop:8 }}>
                    {stage !== 'Converted' && stage !== 'Lost' && (
                      <button onClick={e=>{e.stopPropagation();convertLead(lead);}} style={{ fontSize:10, background:'#f0fdf4', color:'#16a34a', border:'none', borderRadius:5, padding:'2px 8px' }}>Convert →</button>
                    )}
                    <button onClick={e=>{e.stopPropagation();deleteLead(lead.id);}} style={{ fontSize:10, background:'#ef444420', color:'#f87171', border:'none', borderRadius:5, padding:'2px 8px', marginLeft:'auto' }}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <Modal title={editLead ? 'Edit Lead' : 'New Lead'} onClose={()=>setShowForm(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {[['name','Full Name',true],['email','Email'],['phone','Phone'],['nationality','Nationality'],['visaInterest','Visa Interest']].map(([k,l,req])=>(
              <FormField key={k} label={l} required={req}>
                <input value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{ ...inputStyle }} />
              </FormField>
            ))}
            <FormField label="Stage">
              <select value={form.stage||'New Enquiry'} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} style={{ ...inputStyle }}>
                {LEAD_STAGES.map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Source">
              <select value={form.source||'Website'} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={{ ...inputStyle }}>
                {LEAD_SOURCES.map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Assigned To">
              <select value={form.assignedTo||''} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))} style={{ ...inputStyle }}>
                <option value="">— Unassigned —</option>
                {team.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </FormField>
            <FormField label="Referral Agent">
              <select value={form.referralId||''} onChange={e=>setForm(f=>({...f,referralId:e.target.value}))} style={{ ...inputStyle }}>
                <option value="">— None —</option>
                {agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} style={{ ...inputStyle, resize:'vertical' }}/>
          </FormField>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16 }}>
            <button onClick={()=>setShowForm(false)} style={{ background:'#e5e7eb', border:'none', borderRadius:8, padding:'9px 18px', color:'#1f2937', fontSize:13 }}>Cancel</button>
            <button onClick={save} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, padding:'9px 18px', color:'#fff', fontWeight:700, fontSize:13 }}>Save Lead</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── CALENDAR PAGE ──────────────────────────────────────────────────────────── */
function CalendarPage({ appointments, setAppointments, jobs, clients, team, onGoTo, onViewJob }) {
  const [showForm, setShowForm] = useState(false);
  const [editAppt, setEditAppt] = useState(null);
  const [curMonth, setCurMonth] = useState(() => { const d=new Date(); return {y:d.getFullYear(),m:d.getMonth()}; });
  const emptyAppt = { title:'', date:today(), time:'09:00', duration:60, type:'Consultation', clientId:'', jobId:'', notes:'', assignedTo:'' };
  const [form, setForm] = useState(emptyAppt);

  const save = async () => {
    if (!form.title.trim()) return;
    if (editAppt) {
      const updated = {...form};
      setAppointments(as => as.map(a => a.id===editAppt ? updated : a));
      try { await sbUpdate('appointments', editAppt, { data: updated }); } catch(e) {}
    } else {
      const na = { ...form, id:'ap'+Date.now(), createdAt: new Date().toISOString() };
      setAppointments(as => [...as, na]);
      try { await sbInsert('appointments', { id:na.id, data:na }); } catch(e) {}
    }
    setShowForm(false);
  };

  const deleteAppt = async id => {
    setAppointments(as => as.filter(a => a.id !== id));
    try { await sbDelete('appointments', id); } catch(e) {}
  };

  // Build calendar grid
  const firstDay = new Date(curMonth.y, curMonth.m, 1);
  const lastDay = new Date(curMonth.y, curMonth.m+1, 0);
  const startPad = firstDay.getDay(); // 0=Sun
  const days = [];
  for (let i=0; i<startPad; i++) days.push(null);
  for (let d=1; d<=lastDay.getDate(); d++) days.push(d);

  const apptsByDay = {};
  appointments.forEach(a => {
    const [,, dd] = (a.date||'').split('-');
    if (!dd) return;
    const key = parseInt(dd);
    if (!apptsByDay[key]) apptsByDay[key] = [];
    apptsByDay[key].push(a);
  });
  // Also add job deadlines as events with client name + priority colour
  jobs.forEach(j => {
    if (!j.dueDate || j.status==='Completed') return;
    const [y,mo,dd] = j.dueDate.split('-');
    if (parseInt(y)===curMonth.y && parseInt(mo)-1===curMonth.m && dd) {
      const key = parseInt(dd);
      if (!apptsByDay[key]) apptsByDay[key] = [];
      const cl = clients.find(c => c.id === j.clientId);
      const lastName = cl ? (cl.name||'').split(',')[0].trim() : '';
      const visaCode = (j.type||'').replace('Subclass ','').split('–')[0].trim().split(' ')[0];
      const PCOLORS = { Urgent:'#ef4444', High:'#f97316', Medium:'#f59e0b', Low:'#6366f1' };
      const isAwaiting = j.status === 'Awaiting Decision';
      const pColor = isAwaiting ? '#64748b' : (PCOLORS[j.priority] || '#f59e0b');
      const label = (isAwaiting ? '⏳ ' : '') + (lastName ? `${lastName} · ${visaCode}` : (visaCode || 'Case'));
      apptsByDay[key].push({ id:'jd_'+j.id, jobId:j.id, title:label, type:'Deadline', isDeadline:true, priorityColor:pColor });
    }
  });

  const upcoming = [...appointments]
    .filter(a => a.date >= today())
    .sort((a,b) => (a.date+a.time) > (b.date+b.time) ? 1 : -1)
    .slice(0,10);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div style={{ animation:'fadeIn 0.3s ease' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#111827' }}>Calendar</h1>
          <div style={{ fontSize:13, color:'#1f2937', marginTop:3 }}>{upcoming.length} upcoming appointments</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={()=>setCurMonth(p=>{const d=new Date(p.y,p.m-1);return{y:d.getFullYear(),m:d.getMonth()};})} style={{ background:'#e5e7eb', border:'none', borderRadius:7, padding:'7px 12px', color:'#1f2937', fontSize:16 }}>‹</button>
          <span style={{ fontSize:15, fontWeight:600, color:'#111827', minWidth:140, textAlign:'center' }}>{monthNames[curMonth.m]} {curMonth.y}</span>
          <button onClick={()=>setCurMonth(p=>{const d=new Date(p.y,p.m+1);return{y:d.getFullYear(),m:d.getMonth()};})} style={{ background:'#e5e7eb', border:'none', borderRadius:7, padding:'7px 12px', color:'#1f2937', fontSize:16 }}>›</button>
          <button onClick={()=>{setForm(emptyAppt);setEditAppt(null);setShowForm(true);}} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', color:'#ffffff', border:'none', borderRadius:8, padding:'9px 18px', fontWeight:700, fontSize:13 }}>+ Add Appointment</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
        {/* Calendar grid */}
        <div style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'#e9eaf3' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
              <div key={d} style={{ padding:'10px 0', textAlign:'center', fontSize:11, fontWeight:600, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.06em' }}>{d}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {days.map((d,i) => {
              const isToday = d && `${curMonth.y}-${String(curMonth.m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` === today();
              const events = d ? (apptsByDay[d]||[]) : [];
              return (
                <div key={i} style={{ minHeight:90, padding:'8px 6px', borderRight:'1px solid #e9eaf3', borderBottom:'1px solid #e9eaf3', background: isToday?'#38bdf808':'transparent', opacity: d?1:0.3 }}>
                  {d && (
                    <>
                      <div style={{ fontSize:13, fontWeight: isToday?700:400, color: isToday?'#6366f1':'#94a3b8', marginBottom:4 }}>{d}</div>
                      {events.slice(0,3).map((ev,ei) => (
                        <div key={ei}
                          onClick={()=>{
                            if (ev.isDeadline) { if(onViewJob) onViewJob(ev.jobId); }
                            else { setForm({...ev}); setEditAppt(ev.id); setShowForm(true); }
                          }}
                          title={ev.isDeadline ? 'Click to view case' : ev.title}
                          style={{
                            fontSize:10,
                            background: ev.isDeadline ? (ev.priorityColor||'#f97316')+'22' : '#38bdf815',
                            color: ev.isDeadline ? (ev.priorityColor||'#f97316') : '#6366f1',
                            borderLeft: ev.isDeadline ? `3px solid ${ev.priorityColor||'#f97316'}` : 'none',
                            borderRadius:4, padding:'2px 5px', marginBottom:2,
                            cursor:'pointer',
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            fontWeight: ev.isDeadline ? 600 : 400,
                          }}>
                          {ev.time && !ev.isDeadline ? ev.time.slice(0,5)+' ' : ''}{ev.title}
                        </div>
                      ))}
                      {events.length > 3 && <div style={{ fontSize:10, color:'#1f2937' }}>+{events.length-3} more</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming list */}
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:'#1f2937', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Upcoming</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {upcoming.length === 0 && <div style={{ fontSize:13, color:'#1f2937', textAlign:'center', padding:'20px 0' }}>No upcoming appointments</div>}
            {upcoming.map(a => {
              const cl = clients.find(c=>c.id===a.clientId);
              const d = daysUntil(a.date);
              return (
                <div key={a.id} style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:10, padding:'12px 14px', cursor:'pointer' }}
                  onClick={()=>{setForm({...a});setEditAppt(a.id);setShowForm(true);}}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ fontWeight:600, color:'#111827', fontSize:13 }}>{a.title}</div>
                    <span style={{ fontSize:11, background: d===0?'#f59e0b20': d<=2?'#ef444420':'#e5e7eb', color: d===0?'#fbbf24': d<=2?'#f87171':'#475569', borderRadius:6, padding:'2px 7px' }}>
                      {d===0?'Today': d===1?'Tomorrow':`${d}d`}
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:'#6366f1', marginTop:3 }}>{a.type}</div>
                  {cl && <div style={{ fontSize:11, color:'#1f2937', marginTop:2 }}>👤 {cl.name}</div>}
                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                    <span style={{ fontSize:11, color:'#1f2937' }}>{fmtDate(a.date)} {a.time}</span>
                    <button onClick={e=>{e.stopPropagation();deleteAppt(a.id);}} style={{ fontSize:10, background:'none', border:'none', color:'#ef4444', padding:0 }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showForm && (
        <Modal title={editAppt ? 'Edit Appointment' : 'New Appointment'} onClose={()=>setShowForm(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <FormField label="Title" required style={{ gridColumn:'1/-1' }}>
              <input value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{ ...inputStyle }} />
            </FormField>
            <FormField label="Date">
              <input type="date" value={form.date||''} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{ ...inputStyle }} />
            </FormField>
            <FormField label="Time">
              <input type="time" value={form.time||''} onChange={e=>setForm(f=>({...f,time:e.target.value}))} style={{ ...inputStyle }} />
            </FormField>
            <FormField label="Type">
              <select value={form.type||''} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{ ...inputStyle }}>
                {APPT_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Duration (min)">
              <input type="number" value={form.duration||60} onChange={e=>setForm(f=>({...f,duration:parseInt(e.target.value)||60}))} style={{ ...inputStyle }} />
            </FormField>
            <FormField label="Client">
              <select value={form.clientId||''} onChange={e=>setForm(f=>({...f,clientId:e.target.value}))} style={{ ...inputStyle }}>
                <option value="">— None —</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Assigned To">
              <select value={form.assignedTo||''} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))} style={{ ...inputStyle }}>
                <option value="">— Unassigned —</option>
                {team.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inputStyle, resize:'vertical' }}/>
          </FormField>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
            {editAppt && <button onClick={()=>{deleteAppt(editAppt);setShowForm(false);}} style={{ background:'#ef444420', border:'none', borderRadius:8, padding:'9px 16px', color:'#f87171', fontSize:13 }}>Delete</button>}
            <div style={{ display:'flex', gap:10, marginLeft:'auto' }}>
              <button onClick={()=>setShowForm(false)} style={{ background:'#e5e7eb', border:'none', borderRadius:8, padding:'9px 18px', color:'#1f2937', fontSize:13 }}>Cancel</button>
              <button onClick={save} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, padding:'9px 18px', color:'#fff', fontWeight:700, fontSize:13 }}>Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── INVOICES PAGE ──────────────────────────────────────────────────────────── */
function Invoices({ invoices, setInvoices, clients, jobs }) {
  const [showForm, setShowForm] = useState(false);
  const [editInv, setEditInv] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const emptyInv = { clientId:'', jobId:'', description:'', amount:'', status:'Draft', dueDate: addDays(today(),14), notes:'' };
  const [form, setForm] = useState(emptyInv);

  const invNo = (id) => 'INV-' + (id||'').slice(-6).toUpperCase();

  const save = async () => {
    if (!form.clientId || !form.amount) return;
    if (editInv) {
      const updated = {...form};
      setInvoices(iv => iv.map(i => i.id===editInv ? updated : i));
      try { await sbUpdate('invoices', editInv, { data: updated }); } catch(e) {}
    } else {
      const ni = { ...form, id:'inv'+Date.now(), createdAt: new Date().toISOString(), issuedDate: today() };
      setInvoices(iv => [...iv, ni]);
      try { await sbInsert('invoices', { id:ni.id, data:ni }); } catch(e) {}
    }
    setShowForm(false);
  };

  const deleteInv = async id => {
    if (!window.confirm('Delete invoice?')) return;
    setInvoices(iv => iv.filter(i => i.id !== id));
    try { await sbDelete('invoices', id); } catch(e) {}
  };

  // Auto-mark overdue
  const enriched = invoices.map(inv => ({
    ...inv,
    status: inv.status !== 'Paid' && inv.dueDate && inv.dueDate < today() ? 'Overdue' : inv.status
  }));

  const filtered = enriched.filter(i => filterStatus==='All' || i.status===filterStatus);
  const totalPaid = enriched.filter(i=>i.status==='Paid').reduce((s,i)=>s+Number(i.amount||0),0);
  const totalDue = enriched.filter(i=>i.status==='Sent'||i.status==='Overdue').reduce((s,i)=>s+Number(i.amount||0),0);
  const totalOverdue = enriched.filter(i=>i.status==='Overdue').reduce((s,i)=>s+Number(i.amount||0),0);

  return (
    <div style={{ animation:'fadeIn 0.3s ease' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#111827' }}>Invoices</h1>
          <div style={{ fontSize:13, color:'#1f2937', marginTop:3 }}>{invoices.length} invoices total</div>
        </div>
        <button onClick={()=>{setForm(emptyInv);setEditInv(null);setShowForm(true);}} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', color:'#ffffff', border:'none', borderRadius:8, padding:'9px 18px', fontWeight:700, fontSize:13 }}>+ New Invoice</button>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Invoiced', value: fmtCurrency(invoices.reduce((s,i)=>s+Number(i.amount||0),0)), color:'#6366f1' },
          { label:'Paid', value: fmtCurrency(totalPaid), color:'#34d399' },
          { label:'Outstanding', value: fmtCurrency(totalDue), color:'#f59e0b' },
          { label:'Overdue', value: fmtCurrency(totalOverdue), color:'#ef4444' },
        ].map(c => (
          <div key={c.label} style={{ background:'#ffffff', border:`1px solid ${c.color}25`, borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:11, color:c.color, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{c.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#111827' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:18 }}>
        {['All',...INVOICE_STATUSES].map(s => (
          <button key={s} onClick={()=>setFilterStatus(s)} style={{ background: filterStatus===s?'#38bdf820':'#f9fafb', border: `1px solid ${filterStatus===s?'#38bdf840':'#e9eaf3'}`, borderRadius:7, padding:'6px 14px', color: filterStatus===s?'#6366f1':'#475569', fontSize:12, fontWeight: filterStatus===s?600:400 }}>
            {s} {s!=='All' && `(${enriched.filter(i=>i.status===s).length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#e9eaf3' }}>
              {['Invoice #','Client','Case','Amount','Status','Due Date',''].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'#1f2937', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding:'32px', textAlign:'center', color:'#1f2937', fontSize:13 }}>No invoices found</td></tr>
            )}
            {filtered.map(inv => {
              const cl = clients.find(c=>c.id===inv.clientId);
              const jb = jobs.find(j=>j.id===inv.jobId);
              const st = INVOICE_STATUS_STYLES[inv.status] || INVOICE_STATUS_STYLES['Draft'];
              return (
                <tr key={inv.id} style={{ borderTop:'1px solid #e9eaf3' }} onMouseEnter={e=>e.currentTarget.style.background='#ffffff05'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'12px 14px', fontSize:13, color:'#6366f1', fontFamily:"'JetBrains Mono',monospace" }}>{invNo(inv.id)}</td>
                  <td style={{ padding:'12px 14px', fontSize:13, color:'#111827' }}>{cl?.name || '—'}</td>
                  <td style={{ padding:'12px 14px', fontSize:12, color:'#1f2937' }}>{jb?.type?.slice(0,30) || inv.description?.slice(0,30) || '—'}</td>
                  <td style={{ padding:'12px 14px', fontSize:13, fontWeight:600, color:'#111827', fontFamily:"'JetBrains Mono',monospace" }}>{fmtCurrency(inv.amount)}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <span style={{ fontSize:11, background:st.bg, color:st.text, borderRadius:6, padding:'3px 9px', fontWeight:600 }}>{inv.status}</span>
                  </td>
                  <td style={{ padding:'12px 14px', fontSize:12, color: inv.status==='Overdue'?'#f87171':'#64748b' }}>{fmtDate(inv.dueDate)}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>{setForm({...inv});setEditInv(inv.id);setShowForm(true);}} style={{ background:'#e5e7eb', border:'none', borderRadius:6, padding:'4px 10px', color:'#1f2937', fontSize:11 }}>Edit</button>
                      {inv.status !== 'Paid' && (
                        <button onClick={async()=>{ const u={...inv,status:'Paid'}; setInvoices(iv=>iv.map(i=>i.id===inv.id?u:i)); try{await sbUpdate('invoices',inv.id,{data:u});}catch(e){} }} style={{ background:'#10b98120', border:'none', borderRadius:6, padding:'4px 10px', color:'#34d399', fontSize:11 }}>Mark Paid</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editInv ? 'Edit Invoice' : 'New Invoice'} onClose={()=>setShowForm(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <FormField label="Client" required>
              <select value={form.clientId||''} onChange={e=>setForm(f=>({...f,clientId:e.target.value}))} style={{ ...inputStyle }}>
                <option value="">Select client…</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Related Case">
              <select value={form.jobId||''} onChange={e=>setForm(f=>({...f,jobId:e.target.value}))} style={{ ...inputStyle }}>
                <option value="">— None —</option>
                {jobs.filter(j=>!form.clientId||j.clientId===form.clientId).map(j=><option key={j.id} value={j.id}>{j.type?.slice(0,40)}</option>)}
              </select>
            </FormField>
            <FormField label="Amount (AUD)" required>
              <input type="number" value={form.amount||''} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={{ ...inputStyle }} placeholder="0.00"/>
            </FormField>
            <FormField label="Status">
              <select value={form.status||'Draft'} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{ ...inputStyle }}>
                {INVOICE_STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label="Due Date">
              <input type="date" value={form.dueDate||''} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} style={{ ...inputStyle }}/>
            </FormField>
          </div>
          <FormField label="Description / Notes">
            <textarea value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} style={{ ...inputStyle, resize:'vertical' }}/>
          </FormField>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:16 }}>
            {editInv && <button onClick={()=>{deleteInv(editInv);setShowForm(false);}} style={{ background:'#ef444420', border:'none', borderRadius:8, padding:'9px 16px', color:'#f87171', fontSize:13 }}>Delete</button>}
            <div style={{ display:'flex', gap:10, marginLeft:'auto' }}>
              <button onClick={()=>setShowForm(false)} style={{ background:'#e5e7eb', border:'none', borderRadius:8, padding:'9px 18px', color:'#1f2937', fontSize:13 }}>Cancel</button>
              <button onClick={save} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, padding:'9px 18px', color:'#fff', fontWeight:700, fontSize:13 }}>Save Invoice</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── REPORTS PAGE ──────────────────────────────────────────────────────────── */
function Reports({ clients, jobs, leads, invoices, team }) {
  // Revenue by month (last 6 months)
  const now = new Date();
  const months = [];
  for (let i=5; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    months.push({ label: d.toLocaleString('default',{month:'short'})+' '+d.getFullYear().toString().slice(2), y: d.getFullYear(), m: d.getMonth() });
  }
  const revenueByMonth = months.map(mo => {
    const total = invoices.filter(inv => {
      if (inv.status !== 'Paid') return false;
      const [y,m] = (inv.issuedDate||inv.createdAt||'').split('-');
      return parseInt(y)===mo.y && parseInt(m)-1===mo.m;
    }).reduce((s,i)=>s+Number(i.amount||0),0);
    return { ...mo, total };
  });

  const maxRev = Math.max(...revenueByMonth.map(m=>m.total), 1);

  // Cases by type (top 8)
  const byType = {};
  jobs.forEach(j => { byType[j.type] = (byType[j.type]||0)+1; });
  const topTypes = Object.entries(byType).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxCount = Math.max(...topTypes.map(t=>t[1]),1);

  // Team performance
  const teamPerf = team.map(m => {
    const myJobs = jobs.filter(j => j.assignedTo===m.id || j.teamMember===m.id);
    const completed = myJobs.filter(j=>j.status==='Completed').length;
    const active = myJobs.filter(j=>j.status!=='Completed').length;
    const revenue = invoices.filter(inv => {
      const j = jobs.find(jb=>jb.id===inv.jobId);
      return inv.status==='Paid' && j && (j.assignedTo===m.id || j.teamMember===m.id);
    }).reduce((s,i)=>s+Number(i.amount||0),0);
    return { ...m, totalJobs:myJobs.length, completed, active, revenue };
  }).sort((a,b)=>b.totalJobs-a.totalJobs);

  // Lead conversion
  const totalLeads = leads.length;
  const converted = leads.filter(l=>l.stage==='Converted').length;
  const convRate = totalLeads ? Math.round(converted/totalLeads*100) : 0;

  return (
    <div style={{ animation:'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:'#111827' }}>Reports & Analytics</h1>
        <div style={{ fontSize:13, color:'#1f2937', marginTop:3 }}>Business performance overview</div>
      </div>

      {/* Top KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28 }}>
        {[
          { label:'Total Clients', value: clients.length, sub: `${clients.filter(c=>c.status==='Active').length} active`, icon:'👤', color:'#6366f1' },
          { label:'Active Cases', value: jobs.filter(j=>j.status!=='Completed').length, sub: `${jobs.filter(j=>j.status==='Completed').length} completed`, icon:'📋', color:'#a78bfa' },
          { label:'Lead Conversion', value: convRate+'%', sub: `${converted}/${totalLeads} leads`, icon:'🎯', color:'#34d399' },
          { label:'Total Revenue', value: fmtCurrency(invoices.filter(i=>i.status==='Paid').reduce((s,i)=>s+Number(i.amount||0),0)), sub: `${invoices.filter(i=>i.status==='Paid').length} paid invoices`, icon:'💰', color:'#f59e0b' },
        ].map(k => (
          <div key={k.label} style={{ background:'#ffffff', border:`1px solid ${k.color}25`, borderRadius:12, padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <span style={{ fontSize:20 }}>{k.icon}</span>
              <span style={{ fontSize:11, color:k.color, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</span>
            </div>
            <div style={{ fontSize:26, fontWeight:700, color:'#111827', marginBottom:4 }}>{k.value}</div>
            <div style={{ fontSize:11, color:'#1f2937' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24 }}>
        {/* Revenue chart */}
        <div style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:12, padding:'20px' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:16 }}>Revenue (Last 6 Months)</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120 }}>
            {revenueByMonth.map(mo => (
              <div key={mo.label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontSize:9, color:'#1f2937', fontFamily:"'JetBrains Mono',monospace" }}>{mo.total>0?'$'+Math.round(mo.total/1000)+'k':''}</div>
                <div style={{ width:'100%', background: mo.total>0?'#6366f1':'#e5e7eb', borderRadius:'4px 4px 0 0', height: Math.max(4, (mo.total/maxRev)*90)+'px', transition:'height 0.3s' }}/>
                <div style={{ fontSize:9, color:'#1f2937' }}>{mo.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cases by type */}
        <div style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:12, padding:'20px' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:16 }}>Top Case Types</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {topTypes.map(([type, count]) => (
              <div key={type} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ fontSize:11, color:'#1f2937', width:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>{type}</div>
                <div style={{ flex:1, background:'#e5e7eb', borderRadius:4, height:6 }}>
                  <div style={{ height:'100%', background:'#a78bfa', borderRadius:4, width:(count/maxCount*100)+'%' }}/>
                </div>
                <div style={{ fontSize:11, color:'#a78bfa', fontFamily:"'JetBrains Mono',monospace", width:20, textAlign:'right' }}>{count}</div>
              </div>
            ))}
            {topTypes.length===0 && <div style={{ color:'#1f2937', fontSize:13 }}>No cases yet</div>}
          </div>
        </div>
      </div>

      {/* Team performance table */}
      <div style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #e9eaf3' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>Team Performance</div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#e9eaf3' }}>
              {['Team Member','Role','Total Cases','Active','Completed','Revenue Generated'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, color:'#1f2937', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamPerf.map(m => (
              <tr key={m.id} style={{ borderTop:'1px solid #e9eaf3' }}>
                <td style={{ padding:'12px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:m.color+'25', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:m.color }}>
                      {(m.name||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <span style={{ fontSize:13, color:'#111827' }}>{m.name}</span>
                  </div>
                </td>
                <td style={{ padding:'12px 14px', fontSize:12, color:'#1f2937' }}>{m.role}</td>
                <td style={{ padding:'12px 14px', fontSize:13, color:'#1f2937', fontFamily:"'JetBrains Mono',monospace" }}>{m.totalJobs}</td>
                <td style={{ padding:'12px 14px', fontSize:13, color:'#fbbf24', fontFamily:"'JetBrains Mono',monospace" }}>{m.active}</td>
                <td style={{ padding:'12px 14px', fontSize:13, color:'#34d399', fontFamily:"'JetBrains Mono',monospace" }}>{m.completed}</td>
                <td style={{ padding:'12px 14px', fontSize:13, color:'#f59e0b', fontFamily:"'JetBrains Mono',monospace" }}>{fmtCurrency(m.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── AGENTS (REFERRAL PARTNERS) PAGE ────────────────────────────────────────── */
function AgentsPage({ agents, setAgents, leads, jobs, invoices }) {
  const [showForm, setShowForm] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const empty = { name:'', email:'', phone:'', company:'', commissionRate:10, notes:'' };
  const [form, setForm] = useState(empty);

  const save = async () => {
    if (!form.name.trim()) return;
    if (editAgent) {
      const updated = {...form};
      setAgents(as => as.map(a => a.id===editAgent ? updated : a));
      try { await sbUpdate('agents', editAgent, { data: updated }); } catch(e) {}
    } else {
      const na = { ...form, id:'ag'+Date.now(), createdAt: new Date().toISOString() };
      setAgents(as => [...as, na]);
      try { await sbInsert('agents', { id:na.id, data:na }); } catch(e) {}
    }
    setShowForm(false);
  };

  const deleteAgent = async id => {
    if (!window.confirm('Delete this agent?')) return;
    setAgents(as => as.filter(a => a.id !== id));
    try { await sbDelete('agents', id); } catch(e) {}
  };

  return (
    <div style={{ animation:'fadeIn 0.3s ease' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'#111827' }}>Referral Agents</h1>
          <div style={{ fontSize:13, color:'#1f2937', marginTop:3 }}>{agents.length} agents registered</div>
        </div>
        <button onClick={()=>{setForm(empty);setEditAgent(null);setShowForm(true);}} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', color:'#ffffff', border:'none', borderRadius:8, padding:'9px 18px', fontWeight:700, fontSize:13 }}>+ Add Agent</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
        {agents.length===0 && <div style={{ color:'#1f2937', fontSize:13, gridColumn:'1/-1', textAlign:'center', padding:'40px 0' }}>No referral agents yet. Add your first agent to start tracking referrals.</div>}
        {agents.map(agent => {
          const agentLeads = leads.filter(l=>l.referralId===agent.id);
          const converted = agentLeads.filter(l=>l.stage==='Converted').length;
          const agentRevenue = invoices.filter(inv => {
            const j = jobs.find(jb=>jb.id===inv.jobId);
            if (!j || inv.status!=='Paid') return false;
            const relLead = leads.find(l=>l.convertedToClientId===j.clientId && l.referralId===agent.id);
            return !!relLead;
          }).reduce((s,i)=>s+Number(i.amount||0),0);
          const commission = agentRevenue * (agent.commissionRate||10)/100;

          return (
            <div key={agent.id} style={{ background:'#ffffff', border:'1.5px solid #d1d5db', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div>
                  <div style={{ fontWeight:700, color:'#111827', fontSize:15 }}>{agent.name}</div>
                  {agent.company && <div style={{ fontSize:12, color:'#1f2937', marginTop:2 }}>{agent.company}</div>}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>{setForm({...agent});setEditAgent(agent.id);setShowForm(true);}} style={{ background:'#e5e7eb', border:'none', borderRadius:6, padding:'4px 10px', color:'#1f2937', fontSize:11 }}>Edit</button>
                  <button onClick={()=>deleteAgent(agent.id)} style={{ background:'#ef444420', border:'none', borderRadius:6, padding:'4px 10px', color:'#f87171', fontSize:11 }}>Del</button>
                </div>
              </div>
              {agent.email && <div style={{ fontSize:12, color:'#1f2937', marginBottom:4 }}>✉ {agent.email}</div>}
              {agent.phone && <div style={{ fontSize:12, color:'#1f2937', marginBottom:10 }}>📞 {agent.phone}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, background:'#ffffff', borderRadius:8, padding:'10px' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#6366f1' }}>{agentLeads.length}</div>
                  <div style={{ fontSize:10, color:'#1f2937' }}>Leads</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:18, fontWeight:700, color:'#34d399' }}>{converted}</div>
                  <div style={{ fontSize:10, color:'#1f2937' }}>Converted</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#f59e0b' }}>{agent.commissionRate||10}%</div>
                  <div style={{ fontSize:10, color:'#1f2937' }}>Commission</div>
                </div>
              </div>
              {agentRevenue > 0 && (
                <div style={{ marginTop:10, background:'#f59e0b10', border:'1px solid #f59e0b20', borderRadius:8, padding:'8px 12px', display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:11, color:'#1f2937' }}>Commission Due</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'#f59e0b', fontFamily:"'JetBrains Mono',monospace" }}>{fmtCurrency(commission)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <Modal title={editAgent ? 'Edit Agent' : 'New Referral Agent'} onClose={()=>setShowForm(false)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {[['name','Full Name',true],['email','Email'],['phone','Phone'],['company','Company / Agency']].map(([k,l,req])=>(
              <FormField key={k} label={l} required={req}>
                <input value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{ ...inputStyle }}/>
              </FormField>
            ))}
            <FormField label="Commission Rate (%)">
              <input type="number" min="0" max="100" value={form.commissionRate||10} onChange={e=>setForm(f=>({...f,commissionRate:parseFloat(e.target.value)||0}))} style={{ ...inputStyle }}/>
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} style={{ ...inputStyle, resize:'vertical' }}/>
          </FormField>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16 }}>
            <button onClick={()=>setShowForm(false)} style={{ background:'#e5e7eb', border:'none', borderRadius:8, padding:'9px 18px', color:'#1f2937', fontSize:13 }}>Cancel</button>
            <button onClick={save} style={{ background:'linear-gradient(135deg,#ff158a,#ff5fae)', border:'none', borderRadius:8, padding:'9px 18px', color:'#fff', fontWeight:700, fontSize:13 }}>Save Agent</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const SB_URL = process.env.REACT_APP_SB_URL;   // set in .env or Vercel environment variables
const SB_KEY = process.env.REACT_APP_SB_KEY;   // set in .env or Vercel environment variables
// ─────────────────────────────────────────────────────────────────────────────

/* ─── TOAST NOTIFICATION ─────────────────────────────────────────────────────── */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  const colors = {
    error:   { bg:'#fef2f2', border:'#fecaca', color:'#dc2626', icon:'❌' },
    success: { bg:'#f0fdf4', border:'#86efac', color:'#16a34a', icon:'✅' },
    warning: { bg:'#fffbeb', border:'#fde68a', color:'#d97706', icon:'⚠️' },
  };
  const c = colors[type] || colors.warning;
  return createPortal(
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:c.bg, border:`1px solid ${c.border}`, borderRadius:12, padding:'12px 16px', maxWidth:380, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', display:'flex', alignItems:'flex-start', gap:10, animation:'fadeIn 0.25s ease both' }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{c.icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13.5, fontWeight:600, color:c.color }}>{message}</div>
      </div>
      <button onClick={onClose} style={{ background:'none', border:'none', color:'#1f2937', fontSize:18, cursor:'pointer', padding:0, lineHeight:1, flexShrink:0 }}>×</button>
    </div>,
    document.body
  );
}

// Dispatch DB errors as custom events so App can show toasts
const dbError = (msg) => window.dispatchEvent(new CustomEvent('ozsky-db-error', { detail: msg }));

const sbFetch = async (path, method = 'GET', body = null) => {
  const headers = {
    'apikey':        SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type':  'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, opts);
  if (!res.ok) {
    const errText = await res.text().catch(()=>'');
    const msg = `DB error on ${method} /${path.split('?')[0]}: ${res.status}${errText ? ' – ' + errText.slice(0,120) : ''}`;
    dbError(msg);
    throw new Error(msg);
  }
  if (method === 'DELETE' || res.status === 204) return null;
  return res.json();
};

const sbSelect = (table)          => sbFetch(`${table}?select=*`);
const sbInsert = (table, data)    => sbFetch(table, 'POST', data);
const sbUpdate = (table, id, obj) => sbFetch(`${table}?id=eq.${id}`, 'PATCH', obj);
const sbDelete = (table, id)      => sbFetch(`${table}?id=eq.${id}`, 'DELETE');

// ─── ALLOWED USERS & ROLES ────────────────────────────────────────────────────
const ALLOWED_USERS = {
  'l.jiang@ozs.com.au':         'manager',
  'm.mao@ozs.com.au':           'manager',
  'perthcq@ozs.com.au':         'staff',
  'perth_assistant@ozs.com.au': 'staff',
  'admin2.perth@ozs.com.au':    'staff',
  'perthozsky@gmail.com':       'staff',
  'ozskyperth@gmail.com':       'staff',
  'perth@ozs.com.au':           'staff',
};

// Upsert helper for tables with non-id primary keys (e.g. user_roles.email)
const sbUpsert = async (table, data) => {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  });
  return res.ok ? res.json().catch(() => null) : null;
};

function LoginScreen({ errorMessage }) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const e = p.get('gmail_error');
    if (e) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return e ? decodeURIComponent(e) : null;
  });

  const handleGmailAuth = async () => {
    setLoading(true);
    setLocalError(null);
    try {
      const res = await fetch('/api/gmail-auth?action=url');
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Server error ${res.status}${text ? ': ' + text.slice(0, 200) : ''}`);
      }
      const data = await res.json();
      if (!data.url) throw new Error('No OAuth URL in response: ' + JSON.stringify(data));
      window.location.href = data.url;
    } catch (err) {
      setLoading(false);
      setLocalError(err.message || 'Failed to connect. Please try again.');
    }
  };

  const displayError = errorMessage || localError;

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#1f1f3d 0%,#2d2d5e 50%,#1f1f3d 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes loginFade { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .login-card { animation: loginFade 0.4s cubic-bezier(.16,1,.3,1) both; }
        .google-btn:hover:not(:disabled) { border-color: #c0c0c0 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important; }
      `}</style>
      <div className="login-card" style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:20, padding:'40px 36px', boxShadow:'0 32px 80px rgba(0,0,0,0.35)', fontFamily:"'Inter',sans-serif" }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <img src={LOGO_B64} alt="Ozsky International" style={{ width:140, height:'auto', borderRadius:8 }} />
        </div>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#111827', marginBottom:5 }}>Welcome</div>
          <div style={{ fontSize:13.5, color:'#6b7280' }}>Sign in with your Ozsky Google account</div>
        </div>
        <button
          className="google-btn"
          onClick={handleGmailAuth}
          disabled={loading}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'12px 16px', background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:10, cursor: loading ? 'wait' : 'pointer', fontSize:14, fontWeight:600, color:'#374151', transition:'all 0.15s', marginBottom:16, boxSizing:'border-box' }}
        >
          {!loading && (
            <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink:0 }}>
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
              <path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 6.4 6.3 14.7z"/>
              <path fill="#FBBC05" d="M24 46c5.9 0 10.9-2 14.5-5.4l-6.7-5.5C29.9 36.9 27.1 38 24 38c-6 0-11.1-4-12.9-9.5l-7 5.4C7.6 41.6 15.2 46 24 46z"/>
              <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.8-2.8 5.1-5.3 6.6l6.7 5.5C41.4 37.3 45 31.2 45 24c0-1.3-.2-2.7-.5-4z"/>
            </svg>
          )}
          <span>{loading ? 'Redirecting…' : 'Continue with Google'}</span>
        </button>
        {displayError && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'9px 12px', fontSize:12, color:'#dc2626', display:'flex', alignItems:'flex-start', gap:6, marginBottom:8 }}>
            <span style={{ flexShrink:0 }}>⛔</span> {displayError}
          </div>
        )}
        <div style={{ textAlign:'center', marginTop:20, fontSize:11.5, color:'#d1d5db' }}>
          Ozsky International · Internal CRM
        </div>
      </div>
    </div>
  );
}

/* ─── LANGUAGE TOGGLE ───────────────────────────────────────────────────────── */
function LangToggle() {
  const { lang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      title={lang === 'en' ? '切换中文' : 'Switch to English'}
      style={{
        display:'flex', alignItems:'center', gap:5, padding:'5px 12px',
        background: lang === 'zh' ? 'linear-gradient(135deg,#e0e7ff,#ede9fe)' : '#f3f4f6',
        border: lang === 'zh' ? '1px solid #c7d2fe' : '1px solid #e5e7eb',
        borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:700,
        color: lang === 'zh' ? '#4338ca' : '#374151', transition:'all 0.2s',
      }}
    >
      <span style={{ fontSize:14 }}>{lang === 'zh' ? '🇨🇳' : '🇦🇺'}</span>
      {lang === 'zh' ? '中文' : 'EN'}
    </button>
  );
}

function App() {
  const { t } = useLang();
  const [clients, setClients]           = useState(INIT_CLIENTS);
  const [jobs, setJobs]                 = useState(INIT_JOBS);
  const [team, setTeam]                 = useState(INIT_TEAM);
  const [leads, setLeads]               = useState(INIT_LEADS);
  const [invoices, setInvoices]         = useState(INIT_INVOICES);
  const [appointments, setAppointments] = useState(INIT_APPOINTMENTS);
  const [agents, setAgents]             = useState(INIT_AGENTS);
  const [view, setView]                 = useState('dashboard');
  const [openJobId, setOpenJobId]       = useState(null);
  const [jobsMemberFilter, setJobsMemberFilter] = useState(null);
  const [jobsStatusFilter, setJobsStatusFilter] = useState(null);
  const [, setLoaded]               = useState(false);
  const [authed, setAuthed]             = useState(() => sessionStorage.getItem('ozsky_auth') === '1');
  const [isManager, setIsManager]       = useState(() => sessionStorage.getItem('ozsky_role') === 'manager');
  const [authError, setAuthError]       = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [toast, setToast]               = useState(null);

  // Listen for DB errors from sbFetch
  useEffect(() => {
    const handler = (e) => setToast({ message: e.detail, type:'error' });
    window.addEventListener('ozsky-db-error', handler);
    return () => window.removeEventListener('ozsky-db-error', handler);
  }, []);

  useEffect(() => {
    if (!window.location.hash) return;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const token = p.get('gmail_access_token');
    if (!token) return;

    // Clear fragment immediately
    window.history.replaceState(null, '', window.location.pathname);

    const email = p.get('gmail_user_email') || '';
    const hardcodedRole = ALLOWED_USERS[email];

    if (!hardcodedRole) {
      setAuthError('Your account is not authorised. Contact your manager.');
      return;
    }

    // Store Gmail tokens so SmartAI works immediately after login
    writeGmailSession(
      token,
      p.get('gmail_refresh_token') || '',
      parseInt(p.get('gmail_expires_in') || '3600', 10),
      email,
    );

    // Resolve role: Supabase override takes priority over hardcoded default
    (async () => {
      let role = hardcodedRole;
      try {
        const rows = await sbFetch('user_roles?select=role&email=eq.' + encodeURIComponent(email));
        role = rows?.[0]?.role || hardcodedRole;
      } catch { /* use hardcoded default */ }

      sessionStorage.setItem('ozsky_auth', '1');
      sessionStorage.setItem('ozsky_role', role);
      sessionStorage.setItem('ozsky_email', email);
      setAuthed(true);
      setIsManager(role === 'manager');
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [cr, jr, tr, lr, ir, ar, agr] = await Promise.all([
          sbSelect('clients'),
          sbSelect('jobs'),
          sbSelect('team'),
          sbSelect('leads').catch(()=>null),
          sbSelect('invoices').catch(()=>null),
          sbSelect('appointments').catch(()=>null),
          sbSelect('agents').catch(()=>null),
        ]);
        const c = cr?.map(r => r.data);
        const j = jr?.map(r => r.data);
        const t = tr?.map(r => r.data);
        const l = lr?.map(r => r.data);
        const iv = ir?.map(r => r.data);
        const ap = ar?.map(r => r.data);
        const ag = agr?.map(r => r.data);

        if (c?.length) setClients(c.map(r => ({ ...r, notes: r.notes || [] })));
        if (j?.length) setJobs(j.map(r => ({ ...r, notes: r.notes || [] })));
        if (l?.length) setLeads(l);
        if (iv?.length) setInvoices(iv);
        if (ap?.length) setAppointments(ap);
        if (ag?.length) setAgents(ag);
        if (t?.length) {
          setTeam(t);
        } else {
          // Auto-seed team on first run if table is empty
          try {
            await Promise.all(INIT_TEAM.map(m => sbInsert('team', { id: m.id, data: m })));
            setTeam(INIT_TEAM);
            console.log('Team seeded to Supabase successfully');
          } catch (seedErr) {
            console.warn('Team seed failed, using local data:', seedErr.message);
            setTeam(INIT_TEAM);
          }
        }
      } catch (e) {
        console.warn('Supabase not configured — using local data:', e.message);
      }
      setLoaded(true);
    })();
  }, []);

  // Auth gate
  if (!authed) {
    return <LoginScreen errorMessage={authError} />;
  }

  const allNav = [
    { id:'dashboard', icon:'🏠', label: t('Dashboard') },
    { id:'clients',   icon:'👤', label: t('Clients'),  count: clients.filter(c=>c.status==='Active').length },
    { id:'jobs',      icon:'📋', label: t('Cases'),     count: jobs.filter(j=>j.status!=='Completed').length },
    { id:'leads',     icon:'🎯', label: t('Leads'),    count: leads.filter(l=>l.stage!=='Converted'&&l.stage!=='Lost').length },
    { id:'calendar',  icon:'📅', label: t('Calendar'), count: appointments.filter(a=>a.date===today()).length || undefined },
    { id:'invoices',  icon:'💰', label: t('Invoices'), count: invoices.filter(i=>i.status==='Overdue'||i.status==='Sent').length || undefined },
    { id:'agents',    icon:'🤝', label: t('Agents') },
    ...(isManager ? [
      { id:'team',    icon:'👥', label: t('Team'), managerOnly:true },
      { id:'reports', icon:'📊', label: t('Reports'), managerOnly:true },
    ] : []),
  ];
  // Bottom-nav shows first 5 items on mobile
  const mobileNav = allNav.slice(0,5);

  const PAGE_TITLES = {
    dashboard:'Dashboard', clients:'Clients', jobs:'Cases',
    leads:'Leads Pipeline', calendar:'Calendar', invoices:'Invoices',
    agents:'Referral Agents', team:'Team', reports:'Reports & Analytics'
  };

  const logout = () => {
    sessionStorage.removeItem('ozsky_auth');
    sessionStorage.removeItem('ozsky_role');
    setAuthed(false); setIsManager(false);
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* ── SIDEBAR MOBILE OVERLAY ── */}
      <div className={`oz-mob-overlay${sidebarOpen?' open':''}`} onClick={()=>setSidebarOpen(false)} />

      <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>

        {/* ── SIDEBAR ── */}
        <aside className={`oz-sidebar${sidebarOpen?' open':''}`}>
          {/* Logo */}
          <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
            <img src={LOGO_B64} alt="Ozsky" style={{ width:148, height:'auto', borderRadius:6 }} />
            <div style={{ fontSize:9.5, color:'#4b5280', letterSpacing:'0.07em', textTransform:'uppercase' }}>CRM · Migration & Student Services</div>
          </div>

          {/* Role badge */}
          <div style={{ padding:'10px 14px 6px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:99, fontSize:10.5, fontWeight:700, background: isManager?'rgba(168,85,247,0.18)':'rgba(99,102,241,0.15)', color: isManager?'#d8b4fe':'#a5b4fc', letterSpacing:'0.05em', textTransform:'uppercase' }}>
              <span>{isManager?'👑':'👤'}</span> {isManager?'Manager':'Staff'}
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ padding:'6px 10px', flex:1, overflowY:'auto' }}>
            {allNav.map(n => (
              <button key={n.id} className={`oz-nav-item${view===n.id?' active':''}`}
                onClick={()=>{ setView(n.id); setSidebarOpen(false); }}>
                <span style={{ fontSize:15, width:20, textAlign:'center', flexShrink:0 }}>{n.icon}</span>
                <span style={{ flex:1 }}>{n.label}</span>
                {n.managerOnly && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:5, background:'rgba(168,85,247,0.25)', color:'#d8b4fe', fontWeight:700, letterSpacing:'0.04em' }}>MGR</span>}
                {n.count !== undefined && n.count > 0 && <span className="oz-nav-badge">{n.count}</span>}
              </button>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div style={{ padding:'12px 14px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize:11, color:'#3d4468', marginBottom:8, textAlign:'center' }}>
              {clients.length} clients · {jobs.length} jobs
            </div>
            <button onClick={logout} style={{ width:'100%', padding:'7px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, color:'#f87171', fontSize:12, fontWeight:600, transition:'all 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.18)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,0.1)'}>
              Sign out
            </button>
          </div>
        </aside>

        {/* ── MAIN COLUMN ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

          {/* ── TOP BAR ── */}
          <header className="oz-topbar">
            <button className="oz-hamburger" onClick={()=>setSidebarOpen(s=>!s)}>☰</button>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:16, fontWeight:800, color:'#111827' }}>{PAGE_TITLES[view]||view}</span>
            </div>
            {/* User chip */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <LangToggle />
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 12px', background: isManager?'#f5f3ff':'#eef2ff', borderRadius:99, border:`1px solid ${isManager?'#ddd6fe':'#c7d2fe'}` }}>
                <span style={{ fontSize:13 }}>{isManager?'👑':'👤'}</span>
                <span style={{ fontSize:12.5, fontWeight:600, color: isManager?'#7c3aed':'#4338ca' }}>{isManager ? t('Manager') : t('Staff')}</span>
              </div>
              <button onClick={logout} style={{ background:'none', border:'1.5px solid #cbd5e1', borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:600, color:'#1f2937', transition:'all 0.15s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='#f87171';e.currentTarget.style.color='#ef4444';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.color='#9ca3af';}}>
                {t('Sign out')}
              </button>
            </div>
          </header>

          {/* ── PAGE CONTENT ── */}
          <main className="oz-main-content" style={{ flex:1, overflowY:'auto', padding:'28px 32px' }}>
            {view === 'dashboard' && (
              <>
                <DeadlineAlerts jobs={jobs} appointments={appointments} onGoTo={setView} setOpenJobId={setOpenJobId} />
                <Dashboard clients={clients} jobs={jobs} team={team} onGoTo={setView} setJobsMemberFilter={setJobsMemberFilter} setJobsStatusFilter={setJobsStatusFilter} />
              </>
            )}
            {view === 'clients'   && <Clients   clients={clients} jobs={jobs} setClients={setClients} setJobs={setJobs} team={team} />}
            {view === 'jobs'      && <Jobs       jobs={jobs} clients={clients} team={team} setJobs={setJobs} openJobId={openJobId} setOpenJobId={setOpenJobId} jobsMemberFilter={jobsMemberFilter} setJobsMemberFilter={setJobsMemberFilter} jobsStatusFilter={jobsStatusFilter} setJobsStatusFilter={setJobsStatusFilter} />}
            {view === 'team'      && isManager && <Team       team={team} jobs={jobs} clients={clients} setTeam={setTeam} setJobs={setJobs} />}
            {view === 'leads'     && <Leads      leads={leads} setLeads={setLeads} clients={clients} setClients={setClients} jobs={jobs} setJobs={setJobs} team={team} agents={agents} />}
            {view === 'calendar'  && <CalendarPage appointments={appointments} setAppointments={setAppointments} jobs={jobs} clients={clients} team={team} onGoTo={setView} onViewJob={(jid)=>{setOpenJobId(jid);setView('jobs');}} />}
            {view === 'invoices'  && <Invoices   invoices={invoices} setInvoices={setInvoices} clients={clients} jobs={jobs} />}
            {view === 'agents'    && <AgentsPage agents={agents} setAgents={setAgents} leads={leads} jobs={jobs} invoices={invoices} />}
            {view === 'reports'   && isManager && <Reports clients={clients} jobs={jobs} leads={leads} invoices={invoices} team={team} />}
            {view === 'reports'   && !isManager && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400, gap:14 }}>
                <div style={{ fontSize:52 }}>🔒</div>
                <div style={{ fontSize:20, fontWeight:800, color:'#111827' }}>Manager Access Only</div>
                <div style={{ fontSize:14, color:'#1f2937', textAlign:'center', maxWidth:320 }}>Reports & Analytics are restricted to manager accounts. Please sign in with manager credentials.</div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="oz-mob-nav">
        {mobileNav.map(n => (
          <button key={n.id} className={`oz-mob-btn${view===n.id?' active':''}`} onClick={()=>setView(n.id)}>
            <span className="micon">{n.icon}</span>
            {n.label}
            {n.count > 0 && <span style={{ position:'absolute', top:2, right:6, background:'#ef4444', color:'#fff', borderRadius:99, fontSize:8, padding:'0 4px', fontWeight:700 }}>{n.count}</span>}
          </button>
        ))}
        <button className={`oz-mob-btn${view==='team'?' active':''}`} onClick={()=>setView('team')} style={{display: isManager?'flex':'none'}}>
          <span className="micon">👥</span>Team
        </button>
        <button className="oz-mob-btn" onClick={()=>setSidebarOpen(true)}>
          <span className="micon">☰</span>More
        </button>
      </nav>
    </>
  );
}

export default App;