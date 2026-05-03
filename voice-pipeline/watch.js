#!/usr/bin/env node
/**
 * Ozsky Voice Pipeline — 主监听器
 * 监听录音文件夹 → 转录 → AI提取 → 写入Obsidian → 推送NexusCRM
 *
 * 用法: node watch.js
 */

import chokidar from "chokidar";
import path from "path";
import fs from "fs";
import { transcribeAudio } from "./transcribe.js";
import { extractMeetingData } from "./extract.js";
import { writeObsidianNote } from "./obsidian.js";
import { pushToCRM } from "./crm.js";
import { log, logError, playNotification } from "./utils.js";

// ── 配置 ─────────────────────────────────────────────────────────────────────
const WATCH_DIR  = process.env.WATCH_DIR  || path.join(process.env.HOME, "Dropbox/OzskyVoice");
const DONE_DIR   = process.env.DONE_DIR   || path.join(WATCH_DIR, "_processed");
const FAILED_DIR = process.env.FAILED_DIR || path.join(WATCH_DIR, "_failed");
const AUDIO_EXTS = new Set([".m4a", ".mp3", ".wav", ".ogg", ".webm", ".mp4"]);

// 确保目录存在
[WATCH_DIR, DONE_DIR, FAILED_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ── 处理单个文件 ──────────────────────────────────────────────────────────────
async function processFile(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (!AUDIO_EXTS.has(ext)) return;

  // 等待文件写入完成（iCloud/Dropbox 同步时文件可能还在写）
  await waitForFileReady(filePath);

  log(`\n🎙  检测到新录音: ${filename}`);

  try {
    // ── 步骤 1: Whisper 转录 ──────────────────────────────
    log("  1/4 · 转录音频...");
    const transcript = await transcribeAudio(filePath);
    log(`      ✓ 转录完成 (${transcript.length} 字)`);

    // ── 步骤 2: Claude 提取结构化信息 ────────────────────
    log("  2/4 · AI 提取信息...");
    const meetingData = await extractMeetingData(transcript, filename);
    log(`      ✓ 提取完成 · 客户: ${meetingData.client_name || "未识别"}`);
    log(`      ✓ Action Items: ${meetingData.action_items.length} 条`);

    // ── 步骤 3: 写入 Obsidian ────────────────────────────
    log("  3/4 · 写入 Obsidian...");
    const notePath = await writeObsidianNote(meetingData, transcript);
    log(`      ✓ 笔记已创建: ${path.basename(notePath)}`);

    // ── 步骤 4: 推送到 NexusCRM ─────────────────────────
    log("  4/4 · 推送到 NexusCRM...");
    const crmResult = await pushToCRM(meetingData);
    if (crmResult.success) {
      log(`      ✓ CRM 已更新 · 创建了 ${crmResult.tasks_created} 个任务`);
    } else {
      log(`      ⚠ CRM 推送失败: ${crmResult.error} (笔记已保存)`);
    }

    // ── 完成：移动到已处理目录 ───────────────────────────
    const donePath = path.join(DONE_DIR, filename);
    fs.renameSync(filePath, donePath);
    playNotification("success");
    log(`\n  ✅ 完成! 笔记已保存，录音已归档。`);

  } catch (err) {
    logError(`处理 ${filename} 时出错:`, err);
    const failedPath = path.join(FAILED_DIR, filename);
    try { fs.renameSync(filePath, failedPath); } catch {}
    playNotification("error");
  }
}

// ── 等待文件稳定（同步完成） ───────────────────────────────────────────────────
async function waitForFileReady(filePath, maxWait = 30000) {
  const start = Date.now();
  let lastSize = -1;

  while (Date.now() - start < maxWait) {
    await sleep(1500);
    try {
      const { size } = fs.statSync(filePath);
      if (size > 0 && size === lastSize) return; // 文件大小稳定
      lastSize = size;
    } catch {
      // 文件可能还未出现（iCloud 下载中）
    }
  }
}

// ── 启动监听 ─────────────────────────────────────────────────────────────────
const watcher = chokidar.watch(WATCH_DIR, {
  ignored:    /(^|[/\\])\..|(\/(_processed|_failed)\/)/,
  persistent: true,
  awaitWriteFinish: { stabilityThreshold: 3000, pollInterval: 500 },
  depth: 0,  // 只监听根目录，不递归
});

const processingQueue = new Set();

watcher.on("add", async (filePath) => {
  if (processingQueue.has(filePath)) return;
  processingQueue.add(filePath);
  try {
    await processFile(filePath);
  } finally {
    processingQueue.delete(filePath);
  }
});

watcher.on("error", (err) => logError("监听器错误:", err));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

log(`\n🟢 Ozsky 语音管道已启动`);
log(`   监听目录: ${WATCH_DIR}`);
log(`   把录音文件丢进这个文件夹，剩下的自动完成。\n`);
