/**
 * crm.js — 推送数据到 NexusCRM
 * 创建沟通记录 + Action Items 任务
 */

import fetch from "node-fetch";

// Set CRM_BASE_URL in .env to your Netlify site URL for production,
// or http://localhost:8888 for local dev with `netlify dev`
const CRM_BASE_URL = process.env.CRM_BASE_URL || "http://localhost:8888";
const CRM_API_KEY  = process.env.CRM_API_KEY  || "";

/** 推送会议数据到 NexusCRM */
export async function pushToCRM(data) {
  try {
    let tasks_created = 0;

    // 1. 创建沟通记录 (Meeting/Note)
    const meetingRes = await crmFetch("POST", "/api/meetings", {
      date:          data.date,
      client_name:   data.client_name,
      case_id:       data.case_id,
      case_type:     data.case_type,
      channel:       data.channel,
      meeting_type:  data.meeting_type,
      summary:       data.summary,
      key_points:    data.key_points,
      client_concerns: data.client_concerns,
      risk_flags:    data.risk_flags,
      follow_up_date:  data.follow_up_date,
      follow_up_topic: data.follow_up_topic,
      sentiment:     data.sentiment,
      duration:      data.duration_estimate,
      conducted_by:  "Liang",
      auto_imported: true,
    });

    const meetingId = meetingRes?.id;

    // 2. 批量创建 Action Items 为任务
    for (const item of data.action_items || []) {
      await crmFetch("POST", "/api/tasks", {
        title:       item.task,
        assignee:    normalizeAssignee(item.assignee),
        due_date:    item.due_date,
        priority:    item.priority || "medium",
        case_id:     data.case_id,
        client_name: data.client_name,
        source:      "voice_pipeline",
        meeting_id:  meetingId,
        status:      "todo",
      });
      tasks_created++;
    }

    // 3. 如果有 case_id，更新案件的最后联系时间
    if (data.case_id) {
      await crmFetch("PATCH", `/api/cases/${data.case_id}`, {
        last_contact_date: data.date,
        last_contact_type: data.channel,
      });
    }

    // 4. 如果有跟进日期，创建跟进提醒任务
    if (data.follow_up_date) {
      await crmFetch("POST", "/api/tasks", {
        title:       `跟进 ${data.client_name || "客户"}: ${data.follow_up_topic || "续上次通话"}`,
        assignee:    "liang",
        due_date:    data.follow_up_date,
        priority:    "medium",
        case_id:     data.case_id,
        client_name: data.client_name,
        source:      "voice_pipeline_followup",
        meeting_id:  meetingId,
        status:      "todo",
      });
      tasks_created++;
    }

    return { success: true, tasks_created, meeting_id: meetingId };

  } catch (err) {
    // CRM 失败不应该阻断整个流程——笔记已经写好了
    return { success: false, error: err.message, tasks_created: 0 };
  }
}

// ── HTTP 辅助 ─────────────────────────────────────────────────────────────────

async function crmFetch(method, endpoint, body) {
  const url = `${CRM_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(CRM_API_KEY ? { "X-API-Key": CRM_API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CRM ${method} ${endpoint} → ${res.status}: ${text}`);
  }

  return res.json().catch(() => null);
}

function normalizeAssignee(assignee) {
  if (!assignee) return "liang";
  const lower = assignee.toLowerCase();
  if (lower.includes("liang") || lower === "我" || lower === "me") return "liang";
  if (lower.includes("团队") || lower.includes("team")) return "team";
  if (lower.includes("客户") || lower.includes("client")) return "client";
  return lower;
}
