#!/usr/bin/env python3
"""Replace the GLOBAL_CSS block in App.js with a new professional design system."""

NEW_CSS = '''const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;1,14..32,400&family=JetBrains+Mono:wght@400;500;600&display=swap');

  /* ── DESIGN TOKENS ─────────────────────────────────────────────────────── */
  :root {
    /* Brand */
    --brand:        #E91E8C;
    --brand-light:  #FDF0F8;
    --brand-mid:    rgba(233,30,140,0.12);
    --brand-glow:   rgba(233,30,140,0.28);

    /* Neutrals */
    --ink-900:  #0B0F1A;
    --ink-800:  #1A2035;
    --ink-700:  #2D3650;
    --ink-600:  #4A5568;
    --ink-500:  #718096;
    --ink-400:  #A0AEC0;
    --ink-300:  #CBD5E0;
    --ink-200:  #E2E8F0;
    --ink-100:  #F1F5F9;
    --ink-50:   #F8FAFC;

    /* Semantic */
    --success:  #10B981;
    --warning:  #F59E0B;
    --danger:   #EF4444;
    --info:     #3B82F6;

    /* Surface */
    --surface-0: #FFFFFF;
    --surface-1: #F8FAFC;
    --surface-2: #F1F5F9;

    /* Nav */
    --nav-bg:       #0B1120;
    --nav-border:   rgba(255,255,255,0.06);
    --nav-text:     #94A3B8;
    --nav-active-bg: rgba(233,30,140,0.14);
    --nav-active-text: #F472B6;
    --nav-hover-bg: rgba(255,255,255,0.06);

    /* Shadows */
    --shadow-xs:  0 1px 2px rgba(0,0,0,0.05);
    --shadow-sm:  0 1px 6px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md:  0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
    --shadow-lg:  0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    --shadow-xl:  0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);

    /* Radius */
    --r-sm:  6px;
    --r-md:  10px;
    --r-lg:  14px;
    --r-xl:  20px;
    --r-full: 9999px;

    /* Transitions */
    --t-fast:   0.12s ease;
    --t-base:   0.2s ease;
    --t-slow:   0.3s cubic-bezier(.16,1,.3,1);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--surface-1);
    color: var(--ink-800);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--ink-300); border-radius: var(--r-full); }
  ::-webkit-scrollbar-thumb:hover { background: var(--ink-400); }

  @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
  @keyframes slideUp { from { opacity:0; transform:translateY(20px) scale(0.98) } to { opacity:1; transform:translateY(0) scale(1) } }
  @keyframes drawIn  { from { transform:translateX(-100%) } to { transform:translateX(0) } }
  @keyframes pulse   { 0%,100% { opacity:1 } 50% { opacity:0.5 } }

  /* ── LAYOUT ─────────────────────────────────────────────────────────────── */
  .oz-layout {
    display: flex; min-height: 100vh;
  }

  /* ── SIDEBAR / NAV ──────────────────────────────────────────────────────── */
  .oz-sidebar {
    width: 240px; min-height: 100vh;
    background: var(--nav-bg);
    display: flex; flex-direction: column;
    border-right: 1px solid var(--nav-border);
    flex-shrink: 0;
    transition: transform var(--t-slow);
  }

  .oz-nav-logo {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--nav-border);
    display: flex; align-items: center; gap: 10px;
  }
  .oz-nav-logo-icon {
    width: 34px; height: 34px; border-radius: var(--r-md);
    background: linear-gradient(135deg, var(--brand), #FF6EC7);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 800; color: #fff;
    box-shadow: 0 2px 12px var(--brand-glow);
    flex-shrink: 0;
  }
  .oz-nav-logo-text {
    font-size: 15px; font-weight: 700; color: #F8FAFC; letter-spacing: -0.01em;
  }
  .oz-nav-logo-sub {
    font-size: 10px; color: var(--nav-text); font-weight: 500; letter-spacing: 0.04em;
  }

  .oz-nav-section {
    padding: 12px 10px 4px;
    font-size: 9.5px; font-weight: 700; color: #475569;
    text-transform: uppercase; letter-spacing: 0.1em;
  }

  .oz-nav-items { padding: 8px 10px; flex: 1; overflow-y: auto; }

  .oz-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: var(--r-md); border: none;
    width: 100%; text-align: left; cursor: pointer;
    font-size: 13.5px; font-weight: 500; color: var(--nav-text);
    background: transparent;
    margin-bottom: 2px;
    transition: background var(--t-fast), color var(--t-fast);
    position: relative;
  }
  .oz-nav-item:hover {
    background: var(--nav-hover-bg);
    color: #E2E8F0;
  }
  .oz-nav-item.active {
    background: var(--nav-active-bg);
    color: var(--nav-active-text);
    font-weight: 600;
  }
  .oz-nav-item.active::before {
    content: ''; position: absolute; left: 0; top: 20%; bottom: 20%;
    width: 3px; border-radius: 0 3px 3px 0;
    background: var(--brand);
  }
  .oz-nav-icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
  .oz-nav-badge {
    margin-left: auto; font-size: 10px; font-weight: 700;
    padding: 1px 7px; border-radius: var(--r-full);
    background: rgba(255,255,255,0.08); color: #64748B;
  }
  .oz-nav-item.active .oz-nav-badge {
    background: rgba(233,30,140,0.2); color: #F472B6;
  }

  .oz-nav-footer {
    padding: 12px 10px;
    border-top: 1px solid var(--nav-border);
  }

  /* ── TOPBAR ─────────────────────────────────────────────────────────────── */
  .oz-topbar {
    height: 60px; padding: 0 28px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--ink-200);
    position: sticky; top: 0; z-index: 30;
  }

  /* ── MAIN CONTENT ───────────────────────────────────────────────────────── */
  .oz-main-content {
    background: var(--surface-1);
    flex: 1; min-width: 0;
  }

  /* ── CARD ───────────────────────────────────────────────────────────────── */
  .oz-card {
    background: var(--surface-0);
    border-radius: var(--r-lg);
    border: 1px solid var(--ink-200);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  /* ── KPI CARDS ──────────────────────────────────────────────────────────── */
  .oz-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .oz-kpi {
    background: var(--surface-0);
    border-radius: var(--r-lg);
    border: 1px solid var(--ink-200);
    padding: 20px 22px;
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--t-base), transform var(--t-base);
    position: relative; overflow: hidden;
  }
  .oz-kpi:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .oz-kpi-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--ink-500); margin-bottom: 10px;
  }
  .oz-kpi-val {
    font-size: 32px; font-weight: 800; color: var(--ink-900); line-height: 1;
    letter-spacing: -0.02em;
  }
  .oz-kpi-sub { font-size: 12px; color: var(--ink-500); margin-top: 6px; }
  .oz-kpi-accent {
    position: absolute; top: 0; right: 0;
    width: 80px; height: 80px; border-radius: 0 var(--r-lg) 0 80px;
    opacity: 0.06;
  }

  /* ── TABLE ──────────────────────────────────────────────────────────────── */
  .oz-table { width: 100%; border-collapse: collapse; }
  .oz-table th {
    padding: 11px 16px; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.07em; color: var(--ink-500);
    background: var(--surface-1); border-bottom: 1px solid var(--ink-200);
    white-space: nowrap; text-align: left;
  }
  .oz-table td {
    padding: 13px 16px; border-bottom: 1px solid var(--ink-100);
    font-size: 13.5px; color: var(--ink-700); vertical-align: middle;
  }
  .oz-table tbody tr { transition: background var(--t-fast); }
  .oz-table tbody tr:hover td { background: #F9F5FF; }
  .oz-table tbody tr:last-child td { border-bottom: none; }

  /* ── BUTTONS ────────────────────────────────────────────────────────────── */
  .oz-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: var(--r-md);
    font-size: 13px; font-weight: 600; font-family: inherit;
    border: none; transition: all var(--t-fast); cursor: pointer;
    white-space: nowrap; line-height: 1.2;
  }
  .oz-btn-primary {
    background: var(--brand);
    color: #fff;
    box-shadow: 0 2px 8px var(--brand-glow);
  }
  .oz-btn-primary:hover {
    background: #D01880;
    box-shadow: 0 4px 16px var(--brand-glow);
    transform: translateY(-1px);
  }
  .oz-btn-ghost {
    background: var(--surface-1); color: var(--ink-700);
    border: 1px solid var(--ink-200);
  }
  .oz-btn-ghost:hover { background: var(--ink-100); border-color: var(--ink-300); }
  .oz-btn-danger { background: #FEF2F2; color: var(--danger); border: 1px solid #FECACA; }
  .oz-btn-danger:hover { background: #FEE2E2; }

  /* ── INPUTS ─────────────────────────────────────────────────────────────── */
  .oz-input {
    width: 100%; background: var(--surface-0);
    border: 1.5px solid var(--ink-200);
    border-radius: var(--r-md); padding: 9px 13px;
    color: var(--ink-900); font-size: 14px; font-family: inherit;
    outline: none;
    transition: border-color var(--t-fast), box-shadow var(--t-fast);
  }
  .oz-input:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px var(--brand-mid);
  }
  .oz-input::placeholder { color: var(--ink-400); }

  /* ── MODAL ──────────────────────────────────────────────────────────────── */
  .oz-overlay {
    position: fixed; inset: 0;
    background: rgba(11,17,26,0.55);
    backdrop-filter: blur(6px); z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeIn 0.15s ease both;
  }
  .oz-modal {
    background: var(--surface-0); border-radius: var(--r-xl);
    width: 100%; max-width: 640px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--ink-200);
    animation: slideUp 0.28s cubic-bezier(.16,1,.3,1) both;
  }
  .oz-modal-wide { max-width: 920px; }
  .oz-modal-hd {
    padding: 22px 26px 18px; border-bottom: 1px solid var(--ink-100);
    display: flex; justify-content: space-between; align-items: center;
    position: sticky; top: 0; background: var(--surface-0); z-index: 2;
  }
  .oz-modal-title { font-size: 17px; font-weight: 700; color: var(--ink-900); }
  .oz-modal-body  { padding: 22px 26px 28px; }
  .oz-close-btn {
    background: var(--surface-1); border: 1px solid var(--ink-200);
    border-radius: var(--r-md); width: 32px; height: 32px;
    font-size: 15px; color: var(--ink-500);
    display: flex; align-items: center; justify-content: center;
    transition: all var(--t-fast); cursor: pointer;
  }
  .oz-close-btn:hover { background: #FEE2E2; border-color: #FECACA; color: var(--danger); }

  /* ── FORM ───────────────────────────────────────────────────────────────── */
  .oz-label {
    display: block; font-size: 11.5px; font-weight: 700; color: var(--ink-600);
    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;
  }
  .oz-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .oz-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .oz-full   { grid-column: 1/-1; }

  /* ── BADGES ─────────────────────────────────────────────────────────────── */
  .oz-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: var(--r-full);
    font-size: 11.5px; font-weight: 600;
  }
  .oz-tag {
    display: inline-flex; align-items: center;
    padding: 2px 9px; border-radius: var(--r-sm);
    font-size: 11px; font-weight: 600;
  }

  /* ── SECTION HEADER ─────────────────────────────────────────────────────── */
  .oz-page-hd {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
  }
  .oz-page-title {
    font-size: 22px; font-weight: 800; color: var(--ink-900);
    letter-spacing: -0.02em;
  }
  .oz-page-sub { font-size: 13px; color: var(--ink-500); margin-top: 3px; }

  /* ── MOBILE ─────────────────────────────────────────────────────────────── */
  .oz-hamburger {
    display: none; background: none; border: none; padding: 4px 6px;
    font-size: 22px; color: var(--ink-600); line-height: 1; cursor: pointer;
  }
  .oz-mob-overlay {
    display: none; position: fixed; inset: 0;
    background: rgba(0,0,0,0.5); z-index: 49; backdrop-filter: blur(2px);
  }
  .oz-mob-nav {
    display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
    background: var(--nav-bg); border-top: 1px solid var(--nav-border);
    padding: 4px 4px 8px; justify-content: space-around;
  }
  .oz-mob-btn {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    background: none; border: none; padding: 6px 8px; border-radius: 10px;
    color: var(--nav-text); font-size: 9.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.04em;
    min-width: 52px; transition: all var(--t-fast); cursor: pointer;
  }
  .oz-mob-btn:hover, .oz-mob-btn.active {
    color: #F472B6; background: rgba(233,30,140,0.15);
  }
  .oz-mob-btn .micon { font-size: 19px; }

  /* ── RESPONSIVE ─────────────────────────────────────────────────────────── */
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
    .oz-modal { border-radius: 20px 20px 0 0; margin: auto 0 0; max-height: 95vh; }
    .oz-overlay { align-items: flex-end; padding: 0; }
    .oz-table thead { display: none; }
    .oz-table tr { display: block; border: 1px solid var(--ink-200); border-radius: var(--r-lg); margin-bottom: 10px; background: var(--surface-0); }
    .oz-table td { display: flex; justify-content: space-between; align-items: center; border: none; padding: 9px 14px; }
    .oz-table td[data-label]::before { content: attr(data-label); font-weight: 700; color: var(--ink-400); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; }
  }
`;'''

with open('/home/ubuntu/nexus-crm/src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the start and end of GLOBAL_CSS
start_marker = 'const GLOBAL_CSS = `'
end_marker = '`;\n'

start_idx = content.find(start_marker)
if start_idx == -1:
    print("ERROR: GLOBAL_CSS start not found")
    exit(1)

# Find the end - look for backtick-semicolon on its own line after start
search_from = start_idx + len(start_marker)
end_idx = content.find('\n`;\n', search_from)
if end_idx == -1:
    print("ERROR: GLOBAL_CSS end not found")
    exit(1)

end_idx += len('\n`;\n')  # include the closing line

old_block = content[start_idx:end_idx]
print(f"Found GLOBAL_CSS block: lines {content[:start_idx].count(chr(10))+1} to {content[:end_idx].count(chr(10))}")
print(f"Old block length: {len(old_block)} chars")

new_block = NEW_CSS + '\n'
content = content[:start_idx] + new_block + content[end_idx:]

with open('/home/ubuntu/nexus-crm/src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"New block length: {len(new_block)} chars")
print("Done - GLOBAL_CSS replaced successfully")
