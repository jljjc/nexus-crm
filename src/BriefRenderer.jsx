/**
 * BriefRenderer — renders AI-generated case brief / client snapshot text
 * as structured, readable cards instead of raw monospace textarea.
 *
 * Supports:
 *  - ━━━ N. SECTION TITLE ━━━  → coloured section cards
 *  - ================...  → header/footer banners
 *  - [✓]/[✗]/[?] lines  → doc checklist table
 *  - 🔴/🟡/🟢 lines      → risk badge rows
 *  - YYYY-MM-DD | Event  → compact timeline rows
 *  - Numbered lists       → styled list
 *  - Plain paragraphs     → readable text
 */

import React, { useState } from 'react';

/* ── Colour palette ─────────────────────────────────────────────────── */
const C = {
  blue:   '#6366f1',
  green:  '#16a34a',
  red:    '#dc2626',
  orange: '#d97706',
  gray:   '#6b7280',
  border: '#e5e7eb',
  bg:     '#f9fafb',
  white:  '#ffffff',
};

/* ── Section colour map ─────────────────────────────────────────────── */
const SECTION_COLORS = {
  '1': { bg: '#EEF2FF', border: '#6366f1', text: '#4338ca' },
  '2': { bg: '#F0FDF4', border: '#16a34a', text: '#15803d' },
  '3': { bg: '#FFF7ED', border: '#d97706', text: '#b45309' },
  '4': { bg: '#FEF2F2', border: '#dc2626', text: '#b91c1c' },
  '5': { bg: '#F0F9FF', border: '#0284c7', text: '#0369a1' },
  '6': { bg: '#F5F3FF', border: '#7c3aed', text: '#6d28d9' },
  '7': { bg: '#FFF1F2', border: '#e11d48', text: '#be123c' },
  '8': { bg: '#ECFDF5', border: '#059669', text: '#047857' },
  default: { bg: '#F8FAFC', border: '#cbd5e1', text: '#374151' },
};

/* ── Helpers ────────────────────────────────────────────────────────── */
function getSectionColor(num) {
  return SECTION_COLORS[String(num)] || SECTION_COLORS.default;
}

function parseDocLine(line) {
  // [✓] filename or [✗] filename or [?] filename or [ ] filename
  const m = line.match(/^\s*\[([✓✗? ])\]\s*(.+)$/);
  if (!m) return null;
  const status = m[1];
  const name = m[2].trim();
  return { status, name };
}

function parseRiskLine(line) {
  if (line.includes('🔴')) return { priority: 'HIGH', color: C.red, bg: '#FEF2F2', text: line.replace(/🔴\s*(HIGH\s*[—-]?\s*)?/i, '').trim() };
  if (line.includes('🟡')) return { priority: 'MED',  color: C.orange, bg: '#FFFBEB', text: line.replace(/🟡\s*(MEDIUM\s*[—-]?\s*)?/i, '').trim() };
  if (line.includes('🟢')) return { priority: 'LOW',  color: C.green, bg: '#F0FDF4', text: line.replace(/🟢\s*(LOW\s*[—-]?\s*)?/i, '').trim() };
  return null;
}

function parseTimelineLine(line) {
  // YYYY-MM-DD | Event — Status  or  YYYY-MM-DD | Event
  const m = line.match(/^(\d{4}-\d{2}-\d{2})\s*[|｜]\s*(.+?)(?:\s*[—-]\s*(Completed|In Progress|Pending|Urgent))?$/);
  if (!m) return null;
  return { date: m[1], event: m[2].trim(), status: m[3] || '' };
}

function parseNumberedItem(line) {
  const m = line.match(/^\s*(\d+)\.\s+(.+)$/);
  if (!m) return null;
  return { num: m[1], text: m[2] };
}

/* ── Sub-renderers ──────────────────────────────────────────────────── */
function DocChecklist({ lines }) {
  const items = lines.map(parseDocLine).filter(Boolean);
  if (items.length === 0) return <PlainLines lines={lines} />;
  const received = items.filter(i => i.status === '✓').length;
  return (
    <div>
      <div style={{ fontSize: 11, color: C.gray, marginBottom: 6 }}>
        {received}/{items.length} 已收到
        <span style={{ display: 'inline-block', marginLeft: 8, width: 80, height: 5, borderRadius: 3, background: '#e5e7eb', verticalAlign: 'middle', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${(received/items.length)*100}%`, background: C.green, borderRadius: 3 }} />
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: C.bg }}>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: C.gray, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}` }}>文件 / Document</th>
            <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: C.gray, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.border}`, width: 70 }}>状态</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? C.white : C.bg }}>
              <td style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, color: item.status === '✓' ? C.gray : '#111827', textDecoration: item.status === '✓' ? 'none' : 'none' }}>
                {item.name}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'center', borderBottom: `1px solid ${C.border}` }}>
                {item.status === '✓' && <span style={{ color: C.green, fontWeight: 700, fontSize: 14 }}>✓</span>}
                {item.status === '✗' && <span style={{ color: C.red, fontWeight: 700, fontSize: 14 }}>✗</span>}
                {(item.status === '?' || item.status === ' ') && <span style={{ color: C.orange, fontWeight: 700, fontSize: 13 }}>?</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskList({ lines }) {
  const items = lines.map(l => parseRiskLine(l) || (l.trim() ? { priority: null, color: C.gray, bg: C.bg, text: l.trim() } : null)).filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: item.bg, borderRadius: 6, padding: '7px 10px', border: `1px solid ${item.color}30` }}>
          {item.priority && (
            <span style={{ fontSize: 10, fontWeight: 800, color: item.color, background: item.color + '20', padding: '2px 6px', borderRadius: 6, flexShrink: 0, marginTop: 1, letterSpacing: '0.04em' }}>
              {item.priority}
            </span>
          )}
          <span style={{ fontSize: 12.5, color: '#111827', lineHeight: 1.5 }}>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

function TimelineList({ lines }) {
  const items = lines.map(parseTimelineLine).filter(Boolean);
  if (items.length === 0) return <PlainLines lines={lines} />;
  const colFor = (s) => s === 'Completed' ? C.green : s === 'Urgent' ? C.red : s === 'In Progress' ? C.blue : C.gray;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 11, color: C.gray, minWidth: 88, flexShrink: 0, paddingTop: 1, fontFamily: 'monospace' }}>{item.date}</span>
          <span style={{ fontSize: 12.5, color: '#111827', flex: 1, lineHeight: 1.4 }}>{item.event}</span>
          {item.status && (
            <span style={{ fontSize: 10, fontWeight: 700, color: colFor(item.status), background: colFor(item.status) + '18', padding: '2px 7px', borderRadius: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {item.status}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function NumberedList({ lines }) {
  const items = lines.map(parseNumberedItem).filter(Boolean);
  if (items.length === 0) return <PlainLines lines={lines} />;
  return (
    <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.blue, background: '#EEF2FF', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.num}</span>
          <span style={{ fontSize: 12.5, color: '#111827', lineHeight: 1.5, paddingTop: 2 }}>{item.text}</span>
        </li>
      ))}
    </ol>
  );
}

function PlainLines({ lines }) {
  return (
    <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
      {lines.join('\n')}
    </div>
  );
}

/* ── Section classifier ─────────────────────────────────────────────── */
function classifyLines(lines) {
  const docLines = lines.filter(l => parseDocLine(l));
  const riskLines = lines.filter(l => parseRiskLine(l));
  const timeLines = lines.filter(l => parseTimelineLine(l));
  const numLines  = lines.filter(l => parseNumberedItem(l));

  if (docLines.length >= 2) return 'docs';
  if (riskLines.length >= 1) return 'risks';
  if (timeLines.length >= 2) return 'timeline';
  if (numLines.length >= 2) return 'numbered';
  return 'plain';
}

/* ── Parse full text into sections ─────────────────────────────────── */
function parseText(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    // ══ Header/footer banner ══
    if (/^={10,}/.test(line.trim())) {
      if (current) { sections.push(current); current = null; }
      sections.push({ type: 'banner', lines: [line] });
      continue;
    }
    // ━━━ N. SECTION TITLE ━━━
    const sectionMatch = line.match(/^━+\s*(\d+)\.\s*(.+?)\s*━+\s*$/);
    if (sectionMatch) {
      if (current) sections.push(current);
      current = { type: 'section', num: sectionMatch[1], title: sectionMatch[2].trim(), lines: [] };
      continue;
    }
    // Alternate section format: ━━━ TITLE ━━━ (no number)
    const altSectionMatch = line.match(/^━+\s*([^━]+?)\s*━+\s*$/);
    if (altSectionMatch && !current) {
      if (current) sections.push(current);
      current = { type: 'section', num: null, title: altSectionMatch[1].trim(), lines: [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else {
      // Preamble/header text before first section
      if (sections.length === 0 || sections[sections.length - 1].type !== 'preamble') {
        sections.push({ type: 'preamble', lines: [line] });
      } else {
        sections[sections.length - 1].lines.push(line);
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

/* ── Section card ───────────────────────────────────────────────────── */
function SectionCard({ section }) {
  const [collapsed, setCollapsed] = useState(false);
  const col = section.num ? getSectionColor(section.num) : SECTION_COLORS.default;
  const contentLines = section.lines.filter(l => l.trim());
  const kind = classifyLines(contentLines);

  return (
    <div style={{ border: `1.5px solid ${col.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      {/* Section header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', background: col.bg, cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {section.num && (
            <span style={{ fontSize: 11, fontWeight: 800, color: col.text, background: col.border + '25', padding: '2px 7px', borderRadius: 6 }}>
              {section.num}
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: col.text }}>{section.title}</span>
        </div>
        <span style={{ fontSize: 12, color: col.text, opacity: 0.6 }}>{collapsed ? '▶' : '▼'}</span>
      </div>
      {/* Section body */}
      {!collapsed && (
        <div style={{ padding: '10px 14px', background: C.white }}>
          {kind === 'docs'     && <DocChecklist lines={contentLines} />}
          {kind === 'risks'    && <RiskList lines={contentLines} />}
          {kind === 'timeline' && <TimelineList lines={contentLines} />}
          {kind === 'numbered' && <NumberedList lines={contentLines} />}
          {kind === 'plain'    && <PlainLines lines={contentLines} />}
        </div>
      )}
    </div>
  );
}

/* ── Banner (header/footer) ─────────────────────────────────────────── */
function Banner({ lines }) {
  const text = lines.join('\n').replace(/={10,}/g, '').trim();
  if (!text) return null;
  return (
    <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius: 10, padding: '10px 16px', marginBottom: 10, color: '#fff' }}>
      <pre style={{ margin: 0, fontSize: 11.5, fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif", whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
        {text}
      </pre>
    </div>
  );
}

/* ── Main export ────────────────────────────────────────────────────── */
export default function BriefRenderer({ text, onCopy, copyLabel = '📋 复制' }) {
  if (!text || !text.trim()) return null;
  const sections = parseText(text);

  // If no structured sections found, fall back to plain pre-wrap display
  const hasStructure = sections.some(s => s.type === 'section');

  if (!hasStructure) {
    return (
      <div style={{ position: 'relative' }}>
        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', fontSize: 12.5, color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-wrap', maxHeight: 480, overflowY: 'auto', fontFamily: "'PingFang SC','Microsoft YaHei',monospace" }}>
          {text}
        </div>
        {onCopy && (
          <button onClick={onCopy} style={{ position: 'absolute', top: 8, right: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#F1F5F9', border: '1px solid #CBD5E0', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
            {copyLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {onCopy && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={onCopy} style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, background: '#F1F5F9', border: '1px solid #CBD5E0', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
            {copyLabel}
          </button>
        </div>
      )}
      <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 2 }}>
        {sections.map((s, i) => {
          if (s.type === 'banner') return <Banner key={i} lines={s.lines} />;
          if (s.type === 'section') return <SectionCard key={i} section={s} />;
          if (s.type === 'preamble') {
            const txt = s.lines.join('\n').trim();
            if (!txt) return null;
            return <div key={i} style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 1.5 }}>{txt}</div>;
          }
          return null;
        })}
      </div>
    </div>
  );
}
