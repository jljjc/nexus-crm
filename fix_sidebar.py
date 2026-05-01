#!/usr/bin/env python3
"""Replace sidebar JSX using line-based approach."""

with open('src/App.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the Logo comment line
logo_line = None
for i, line in enumerate(lines):
    if '{/* Logo */}' in line and i > 5000:
        logo_line = i
        break

if logo_line is None:
    print("ERROR: Logo comment not found")
    exit(1)

print(f"Found Logo at line {logo_line+1}")

# Find the end of the sidebar footer div (the </div> after Sign out button)
# Look for the closing </div> of the sidebar footer
end_line = None
for i in range(logo_line, logo_line + 60):
    if '</div>' in lines[i] and i > logo_line + 30:
        end_line = i
        break

if end_line is None:
    print("ERROR: End of sidebar not found")
    # Print context
    for i in range(logo_line, logo_line + 50):
        print(f"{i+1}: {lines[i]}", end='')
    exit(1)

print(f"Found sidebar end at line {end_line+1}")
print("Lines to replace:")
for i in range(logo_line, end_line+1):
    print(f"  {i+1}: {lines[i]}", end='')

new_sidebar = '''          {/* Logo */}
          <div className="oz-nav-logo">
            <div className="oz-nav-logo-icon">N</div>
            <div>
              <div className="oz-nav-logo-text">NexusCRM</div>
              <div className="oz-nav-logo-sub">Ozsky International</div>
            </div>
          </div>
          {/* Role badge */}
          <div style={{ padding:'10px 12px 4px' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:'var(--r-full)', fontSize:10.5, fontWeight:700, background: isManager?'rgba(168,85,247,0.15)':'rgba(99,102,241,0.12)', color: isManager?'#c084fc':'#818cf8', letterSpacing:'0.05em', textTransform:'uppercase' }}>
              <span>{isManager?'👑':'👤'}</span> {isManager?'Manager':'Staff'}
            </div>
          </div>
          {/* Nav items */}
          <div className="oz-nav-items">
            <div className="oz-nav-section">Menu</div>
            {allNav.map(n => (
              <button key={n.id} className={`oz-nav-item${view===n.id?' active':''}`}
                onClick={()=>{ setView(n.id); setSidebarOpen(false); }}>
                <span className="oz-nav-icon">{n.icon}</span>
                <span style={{ flex:1 }}>{n.label}</span>
                {n.managerOnly && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(168,85,247,0.2)', color:'#c084fc', fontWeight:700, letterSpacing:'0.04em' }}>MGR</span>}
                {n.count !== undefined && n.count > 0 && <span className="oz-nav-badge">{n.count}</span>}
              </button>
            ))}
          </div>
          {/* Sidebar footer */}
          <div className="oz-nav-footer">
            <div style={{ fontSize:11, color:'#475569', marginBottom:8, textAlign:'center' }}>
              {clients.length} clients · {jobs.length} jobs
            </div>
            <button onClick={logout} style={{ width:'100%', padding:'8px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.18)', borderRadius:'var(--r-md)', color:'#f87171', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s', fontFamily:'inherit' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.16)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,0.08)'}>
              Sign out
            </button>
          </div>
'''

new_lines = lines[:logo_line] + [new_sidebar] + lines[end_line+1:]

with open('src/App.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"\nReplaced {end_line - logo_line + 1} lines with {len(new_sidebar.splitlines())} lines")
print("Done")
