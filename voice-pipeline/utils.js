/**
 * utils.js — 日志和通知工具
 */

import { execSync } from "child_process";

export function log(msg) {
  const time = new Date().toTimeString().slice(0, 8);
  console.log(`[${time}] ${msg}`);
}

export function logError(msg, err) {
  const time = new Date().toTimeString().slice(0, 8);
  console.error(`[${time}] ❌ ${msg}`, err?.message || err);
}

/** macOS 系统通知 */
export function playNotification(type) {
  try {
    if (type === "success") {
      execSync(`osascript -e 'display notification "录音处理完成！笔记已同步到 Obsidian 和 CRM" with title "Ozsky 语音管道" sound name "Glass"'`);
    } else {
      execSync(`osascript -e 'display notification "处理失败，请检查日志" with title "Ozsky 语音管道" sound name "Sosumi"'`);
    }
  } catch {}  // 非 macOS 环境忽略
}
