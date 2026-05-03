/**
 * extract.js — Claude API 结构化信息提取
 * 从转录文字中提取：客户信息、案件要点、Action Items、跟进时间
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * 从转录文字提取结构化会议数据
 * @param {string} transcript - Whisper 转录的原始文字
 * @param {string} filename   - 原始文件名（可能含日期/客户名提示）
 * @returns {MeetingData}
 */
export async function extractMeetingData(transcript, filename) {
  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `你是 Ozsky International 移民代理公司的 AI 助手。
你的任务是从通话/会议转录文字中提取结构化信息。
必须返回合法的 JSON，不要有任何其他文字。

今天日期：${today}
主要代理人：Liang Jiang (MARN: 1800784)`;

  const userPrompt = `从以下通话记录中提取信息，严格按 JSON 格式返回。

文件名（可能含线索）：${filename}

转录内容：
---
${transcript}
---

返回 JSON 格式（所有字段必须存在，不确定的填 null）：
{
  "meeting_type": "client_call | team_meeting | enquiry | consultation | followup",
  "date": "${today}",
  "duration_estimate": "估计时长，如 '15分钟'",
  "channel": "phone | wechat | zoom | in_person",
  "language": "zh | en | mixed",

  "client_name": "客户中文名或英文名",
  "client_name_en": "英文名（如有）",
  "client_phone": "电话（如提到）",
  "client_wechat": "微信号（如提到）",

  "case_type": "189 | 190 | 491 | 482 | 186 | 500 | 870 | other | null",
  "case_id": "案件编号（如果提到）",
  "occupation": "职业名称",
  "anzsco_code": "ANZSCO代码（如提到）",

  "summary": "3-5句话总结通话的核心内容，用中文，客观描述",

  "key_points": [
    "要点1",
    "要点2"
  ],

  "client_concerns": [
    "客户提出的问题或顾虑1",
    "客户提出的问题或顾虑2"
  ],

  "action_items": [
    {
      "task": "具体任务描述",
      "assignee": "Liang | 团队 | 客户",
      "due_date": "YYYY-MM-DD 或 null",
      "priority": "high | medium | low"
    }
  ],

  "documents_requested": [
    "需要客户提供的文件1"
  ],

  "follow_up_date": "建议下次联系日期 YYYY-MM-DD 或 null",
  "follow_up_topic": "下次联系的主题",

  "risk_flags": [
    "需要注意的风险或复杂情况（如有）"
  ],

  "sentiment": "positive | neutral | concerned | urgent",
  "tags": ["tag1", "tag2"]
}`;

  const response = await client.messages.create({
    model:      "claude-opus-4-5",
    max_tokens: 2000,
    messages:   [{ role: "user", content: userPrompt }],
    system:     systemPrompt,
  });

  const raw = response.content[0]?.text?.trim() || "{}";

  // 清理可能的 markdown 代码块
  const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    const data = JSON.parse(cleaned);
    return sanitize(data, transcript);
  } catch {
    // JSON 解析失败时返回基础结构
    console.error("  ⚠ JSON 解析失败，使用基础结构");
    return fallback(transcript, filename);
  }
}

/** 确保所有必要字段存在 */
function sanitize(data, transcript) {
  return {
    meeting_type:         data.meeting_type         || "client_call",
    date:                 data.date                 || today(),
    duration_estimate:    data.duration_estimate    || null,
    channel:              data.channel              || "phone",
    language:             data.language             || "zh",
    client_name:          data.client_name          || null,
    client_name_en:       data.client_name_en       || null,
    client_phone:         data.client_phone         || null,
    client_wechat:        data.client_wechat        || null,
    case_type:            data.case_type            || null,
    case_id:              data.case_id              || null,
    occupation:           data.occupation           || null,
    anzsco_code:          data.anzsco_code          || null,
    summary:              data.summary              || "（AI 未能生成摘要）",
    key_points:           Array.isArray(data.key_points)          ? data.key_points          : [],
    client_concerns:      Array.isArray(data.client_concerns)     ? data.client_concerns     : [],
    action_items:         Array.isArray(data.action_items)        ? data.action_items        : [],
    documents_requested:  Array.isArray(data.documents_requested) ? data.documents_requested : [],
    follow_up_date:       data.follow_up_date       || null,
    follow_up_topic:      data.follow_up_topic      || null,
    risk_flags:           Array.isArray(data.risk_flags)          ? data.risk_flags          : [],
    sentiment:            data.sentiment            || "neutral",
    tags:                 Array.isArray(data.tags)                ? data.tags                : [],
    raw_transcript:       transcript,
  };
}

function fallback(transcript, filename) {
  return sanitize({ summary: `来自文件: ${filename}` }, transcript);
}

const today = () => new Date().toISOString().slice(0, 10);
