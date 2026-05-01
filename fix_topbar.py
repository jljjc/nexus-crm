#!/usr/bin/env python3
"""Update topbar JSX to use new design tokens."""

with open('src/App.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''            {/* User chip */}
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
            </div>'''

new = '''            {/* User chip */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <LangToggle />
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 12px', background: isManager?'rgba(168,85,247,0.08)':'rgba(99,102,241,0.08)', borderRadius:'var(--r-full)', border:`1px solid ${isManager?'rgba(168,85,247,0.2)':'rgba(99,102,241,0.2)'}` }}>
                <span style={{ fontSize:13 }}>{isManager?'👑':'👤'}</span>
                <span style={{ fontSize:12.5, fontWeight:600, color: isManager?'#9333ea':'#4f46e5' }}>{isManager ? t('Manager') : t('Staff')}</span>
              </div>
              <button onClick={logout} style={{ background:'none', border:'1.5px solid var(--ink-200)', borderRadius:'var(--r-md)', padding:'5px 12px', fontSize:12, fontWeight:600, color:'var(--ink-600)', transition:'all 0.15s', cursor:'pointer', fontFamily:'inherit' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='#fca5a5';e.currentTarget.style.color='var(--danger)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--ink-200)';e.currentTarget.style.color='var(--ink-600)';}}>
                {t('Sign out')}
              </button>
            </div>'''

if old in content:
    content = content.replace(old, new, 1)
    print("Topbar user chip updated")
else:
    print("ERROR: topbar user chip not found")
    idx = content.find('User chip')
    print("Context:", repr(content[idx:idx+300]))

# Also update the page title in topbar
old2 = '''            <div style={{ flex:1 }}>
              <span style={{ fontSize:16, fontWeight:800, color:'#111827' }}>{PAGE_TITLES[view]||view}</span>
            </div>'''

new2 = '''            <div style={{ flex:1 }}>
              <span style={{ fontSize:16, fontWeight:700, color:'var(--ink-900)', letterSpacing:'-0.01em' }}>{PAGE_TITLES[view]||view}</span>
            </div>'''

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Topbar page title updated")
else:
    print("WARNING: topbar page title not found")

with open('src/App.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
