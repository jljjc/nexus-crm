/**
 * obsidian.js — 生成 Obsidian 笔记并写入 Vault
 */

import fs from "fs";
import path from "path";

const VAULT_DIR    = process.env.VAULT_DIR    || path.join(process.env.HOME, "Liang-Brain");
const MEETINGS_DIR = process.env.MEETINGS_DIR || path.join(VAULT_DIR, "03-Meetings");

export async function writeObsidianNote(data, transcript) {
  fs.mkdirSync(MEETINGS_DIR, { recursive: true });

  const dateStr    = data.date || today();
  const clientSlug = slugify(data.client_name || "unknown");
  const typeLabel  = MEETING_TYPE_LABELS[data.meeting_type] || data.meeting_type;
  const filename   = `${dateStr}_${clientSlug}_${typeLabel}.md`;
  const notePath   = path.join(MEETINGS_DIR, filename);

  const content = buildNote(data, transcript, filename);
  fs.writeFileSync(notePath, content, "utf8");

  return notePath;
}

// ── 构建笔记内容 ──────────────────────────────────────────────────────────────

function buildNote(d, transcript, filename) {
  const sentiment = SENTIMENT_EMOJI[d.sentiment] || "⚪";
  const channel   = CHANNEL_LABELS[d.channel]    || d.channel;

  return `---
type: meeting
date: ${d.date}
channel: ${d.channel}
meeting_type: ${d.meeting_type}
client: "${d.client_name || ""}"
client_en: "${d.client_name_en || ""}"
case_type: ${d.case_type || ""}
case_id: ${d.case_id || ""}
case_ref: "[[02-Cases/${d.case_id || ""}]]"
sentiment: ${d.sentiment}
follow_up_date: ${d.follow_up_date || ""}
duration: ${d.duration_estimate || ""}
conducted_by: Liang
auto_generated: true
tags: [meeting, ${(d.tags || []).join(", ")}]
---

# ${d.client_name || "通话记录"} · ${formatDateCN(d.date)} ${sentiment}

> **渠道：** ${channel}　**时长：** ${d.duration_estimate || "—"}　**案件类型：** ${d.case_type || "—"}
${d.case_id ? `> **案件编号：** [[02-Cases/${d.case_id}|${d.case_id}]]` : ""}
${d.client_name ? `> **客户：** [[01-Clients/${d.client_name}|${d.client_name}]]` : ""}

---

## 摘要

${d.summary}

---

## 关键要点

${renderList(d.key_points)}

${d.client_concerns.length > 0 ? `## 客户关切\n\n${renderList(d.client_concerns)}\n` : ""}
${d.risk_flags.length > 0 ? `## ⚠️ 风险标记\n\n${renderList(d.risk_flags)}\n` : ""}

---

## Action Items

${renderActionItems(d.action_items)}

${d.documents_requested.length > 0 ? `## 需要客户提供的材料\n\n${d.documents_requested.map(doc => `- [ ] ${doc}`).join("\n")}\n` : ""}

---

## 下次跟进

${d.follow_up_date
  ? `- **时间：** ${d.follow_up_date}\n- **议题：** ${d.follow_up_topic || "—"}`
  : "- 暂无计划的跟进"}

---

## 原始转录

<details>
<summary>展开查看完整转录</summary>

${transcript || "（无转录内容）"}

</details>

---
*自动生成 · Ozsky Voice Pipeline · ${filename}*
`;
}

// ── 渲染辅助 ──────────────────────────────────────────────────────────────────

function renderList(items) {
  if (!items?.length) return "- —";
  return items.map(i => `- ${i}`).join("\n");
}

function renderActionItems(items) {
  if (!items?.length) return "- [ ] （无 Action Items）";
  return items.map(item => {
    const priority  = PRIORITY_EMOJI[item.priority] || "🟡";
    const dueStr    = item.due_date ? ` 📅 ${item.due_date}` : "";
    const assignee  = item.assignee ? ` @${item.assignee}` : "";
    return `- [ ] ${priority} ${item.task}${assignee}${dueStr}`;
  }).join("\n");
}

function slugify(str) {
  return (str || "unknown")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, "")
    .slice(0, 30);
}

function formatDateCN(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${y}年${m}月${d}日`;
}

const today = () => new Date().toISOString().slice(0, 10);

const MEETING_TYPE_LABELS = {
  client_call:  "通话",
  team_meeting: "团队会议",
  enquiry:      "新询问",
  consultation: "咨询",
  followup:     "跟进",
};

const CHANNEL_LABELS = {
  phone:     "📞 电话",
  wechat:    "💬 微信",
  zoom:      "💻 Zoom",
  in_person: "🤝 面谈",
};

const SENTIMENT_EMOJI = {
  positive:  "🟢",
  neutral:   "⚪",
  concerned: "🟡",
  urgent:    "🔴",
};

const PRIORITY_EMOJI = {
  high:   "🔴",
  medium: "🟡",
  low:    "🟢",
};
