#!/usr/bin/env python3
"""Update SmartAI.jsx and CaseAI.jsx colour tokens to match new design system."""

# ── SmartAI.jsx ──────────────────────────────────────────────────────────────
with open('src/SmartAI.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Update the C colour palette to match new design system
old_c = '''const C = {
  blue:'#1E3A5F', gold:'#C9A84C', mid:'#2E6DA4',
  light:'#EBF3FB', border:'#D0E3F5',
  red:'#C0392B', green:'#27AE60', orange:'#E67E22',
  text:'#2C3E50', muted:'#7F8C8D', white:'#FFFFFF',
};'''

new_c = '''const C = {
  blue:'#1A2035', gold:'#D97706', mid:'#3B82F6',
  light:'#EFF6FF', border:'#DBEAFE',
  red:'#EF4444', green:'#10B981', orange:'#F59E0B',
  text:'#1A2035', muted:'#718096', white:'#FFFFFF',
  brand:'#E91E8C',
};'''

if old_c in content:
    content = content.replace(old_c, new_c, 1)
    print("SmartAI: C palette updated")
else:
    print("WARNING: SmartAI C palette not found")

# Update btnStyle
old_btn = '''const btnStyle = (bg, disabled=false) => ({
  background: disabled ? '#CCC' : bg, color: 'white', border: 'none',
  borderRadius: 6, padding: '8px 14px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13, fontWeight: 600, opacity: disabled ? 0.6 : 1,
});'''

new_btn = '''const btnStyle = (bg, disabled=false) => ({
  background: disabled ? '#CBD5E0' : bg, color: 'white', border: 'none',
  borderRadius: 8, padding: '8px 16px', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13, fontWeight: 600, opacity: disabled ? 0.6 : 1,
  transition: 'all 0.15s', fontFamily: 'inherit',
});'''

if old_btn in content:
    content = content.replace(old_btn, new_btn, 1)
    print("SmartAI: btnStyle updated")
else:
    print("WARNING: SmartAI btnStyle not found")

# Update inputStyle
old_input = '''const inputStyle = {
  width: '100%', padding: '6px 10px', border: `1px solid ${C.border}`,
  borderRadius: 6, fontSize: 13, color: C.text, boxSizing: 'border-box',
  outline: 'none', background: 'white',
};'''

new_input = '''const inputStyle = {
  width: '100%', padding: '8px 12px', border: '1.5px solid #E2E8F0',
  borderRadius: 8, fontSize: 13, color: '#1A2035', boxSizing: 'border-box',
  outline: 'none', background: '#fff', fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};'''

if old_input in content:
    content = content.replace(old_input, new_input, 1)
    print("SmartAI: inputStyle updated")
else:
    print("WARNING: SmartAI inputStyle not found")

# Update labelStyle
old_label = '''const labelStyle = { display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 };'''
new_label = '''const labelStyle = { display: 'block', fontSize: 11, color: '#718096', marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' };'''

if old_label in content:
    content = content.replace(old_label, new_label, 1)
    print("SmartAI: labelStyle updated")
else:
    print("WARNING: SmartAI labelStyle not found")

# Update the generate button in SnapshotSection (indigo gradient -> brand)
old_gen_btn = "style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', border:'none', borderRadius:8,"
new_gen_btn = "style={{ background:'linear-gradient(135deg,#E91E8C,#F472B6)', border:'none', borderRadius:10,"

if old_gen_btn in content:
    content = content.replace(old_gen_btn, new_gen_btn, 1)
    print("SmartAI: generate button updated")
else:
    print("WARNING: SmartAI generate button not found")

with open('src/SmartAI.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("SmartAI.jsx done")

# ── CaseAI.jsx ──────────────────────────────────────────────────────────────
with open('src/CaseAI.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Update CaseAI C palette
old_c2 = '''  border: '#e2e8f0','''
new_c2 = '''  border: '#E2E8F0','''

# The C object in CaseAI - find and update
old_caseai_c = "  border: '#e2e8f0',"
new_caseai_c = "  border: '#E2E8F0',"

# Update the accordion header background
old_acc = "width: '100%', background: '#f1f5f9', border: 'none', padding: '10px 16px',"
new_acc = "width: '100%', background: '#F8FAFC', border: 'none', borderBottom: '1px solid #E2E8F0', padding: '11px 16px',"

if old_acc in content:
    content = content.replace(old_acc, new_acc, 1)
    print("CaseAI: accordion header updated")
else:
    print("WARNING: CaseAI accordion header not found")

# Update the accordion header text color
old_acc_text = "cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151',"
new_acc_text = "cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#1A2035', fontFamily: 'inherit',"

if old_acc_text in content:
    content = content.replace(old_acc_text, new_acc_text, 1)
    print("CaseAI: accordion text updated")
else:
    print("WARNING: CaseAI accordion text not found")

# Update the warning box
old_warn = "background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 8, padding: '12px 14px'"
new_warn = "background: '#FFFBEB', border: '1.5px solid #F59E0B', borderRadius: 10, padding: '12px 14px'"

if old_warn in content:
    content = content.replace(old_warn, new_warn, 1)
    print("CaseAI: warning box updated")
else:
    print("WARNING: CaseAI warning box not found")

# Update the copy/download button area
old_copy_btn = "background: '#f1f5f9', border: '1px solid #cbd5e1',"
new_copy_btn = "background: '#F1F5F9', border: '1px solid #CBD5E0',"

content = content.replace(old_copy_btn, new_copy_btn)

with open('src/CaseAI.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("CaseAI.jsx done")
