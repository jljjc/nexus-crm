/**
 * nexus-crm-api-additions.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 把这段代码加到你的 NexusCRM 后端（server.js 或 api.js）
 *
 * 需要安装: npm install express cors
 * 在你的 main server 文件里: import './api-voice.js'
 */

import express from "express";
import cors    from "cors";

const router = express.Router();

// ── 中间件 ────────────────────────────────────────────────────────────────────
router.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"] }));
router.use(express.json());

// 简单 API Key 验证（可选，先留空也行）
router.use((req, res, next) => {
  const key = process.env.CRM_API_KEY;
  if (key && req.headers["x-api-key"] !== key) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// ── 数据存储（临时：用文件，后续可换数据库） ────────────────────────────────────
// 你的 NexusCRM 已有 localStorage/state，这里示范用 JSON 文件持久化
import fs from "fs";
import path from "path";

const DATA_DIR      = "./data";
const MEETINGS_FILE = path.join(DATA_DIR, "meetings.json");
const TASKS_FILE    = path.join(DATA_DIR, "tasks.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}
function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── API 端点 ─────────────────────────────────────────────────────────────────

/**
 * POST /api/meetings
 * 创建一条沟通记录（来自语音管道）
 */
router.post("/meetings", (req, res) => {
  const meetings = readJSON(MEETINGS_FILE);
  const record = {
    id:            uuid(),
    created_at:    new Date().toISOString(),
    ...req.body,
  };
  meetings.unshift(record);           // 最新的放最前面
  writeJSON(MEETINGS_FILE, meetings);

  // 同时触发前端刷新（如果你用了 SSE/WebSocket 可以在这里 emit）
  console.log(`[CRM API] 新沟通记录: ${record.client_name} - ${record.meeting_type}`);
  res.status(201).json({ success: true, id: record.id });
});

/**
 * GET /api/meetings
 * 获取沟通记录列表（供前端展示）
 */
router.get("/meetings", (req, res) => {
  const meetings = readJSON(MEETINGS_FILE);
  const { case_id, client_name, limit = 50 } = req.query;

  let filtered = meetings;
  if (case_id)     filtered = filtered.filter(m => m.case_id === case_id);
  if (client_name) filtered = filtered.filter(m => m.client_name?.includes(client_name));

  res.json(filtered.slice(0, parseInt(limit)));
});

/**
 * POST /api/tasks
 * 创建任务（Action Item）
 */
router.post("/tasks", (req, res) => {
  const tasks = readJSON(TASKS_FILE);
  const task = {
    id:         uuid(),
    created_at: new Date().toISOString(),
    status:     "todo",
    ...req.body,
  };
  tasks.unshift(task);
  writeJSON(TASKS_FILE, tasks);

  console.log(`[CRM API] 新任务: [${task.priority}] ${task.title} → @${task.assignee} 📅${task.due_date || "无截止"}`);
  res.status(201).json({ success: true, id: task.id });
});

/**
 * GET /api/tasks
 * 获取任务列表
 */
router.get("/tasks", (req, res) => {
  const tasks = readJSON(TASKS_FILE);
  const { case_id, assignee, status, limit = 100 } = req.query;

  let filtered = tasks;
  if (case_id)  filtered = filtered.filter(t => t.case_id === case_id);
  if (assignee) filtered = filtered.filter(t => t.assignee === assignee);
  if (status)   filtered = filtered.filter(t => t.status === status);

  res.json(filtered.slice(0, parseInt(limit)));
});

/**
 * PATCH /api/tasks/:id
 * 更新任务状态（完成、取消等）
 */
router.patch("/tasks/:id", (req, res) => {
  const tasks = readJSON(TASKS_FILE);
  const idx   = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Task not found" });

  tasks[idx] = { ...tasks[idx], ...req.body, updated_at: new Date().toISOString() };
  writeJSON(TASKS_FILE, tasks);
  res.json({ success: true, task: tasks[idx] });
});

/**
 * PATCH /api/cases/:id
 * 更新案件字段（最后联系时间等）
 */
router.patch("/cases/:id", (req, res) => {
  // 这里接入你已有的 cases 数据存储
  // 示例：如果你的 cases 也存在 JSON 文件里
  const CASES_FILE = path.join(DATA_DIR, "cases.json");
  const cases = readJSON(CASES_FILE);
  const idx = cases.findIndex(c => c.id === req.params.id || c.case_id === req.params.id);

  if (idx !== -1) {
    cases[idx] = { ...cases[idx], ...req.body, updated_at: new Date().toISOString() };
    writeJSON(CASES_FILE, cases);
  }

  res.json({ success: true });
});

/**
 * GET /api/health
 * 健康检查（管道用来测试连接）
 */
router.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), service: "NexusCRM API" });
});

export default router;

// ─────────────────────────────────────────────────────────────────────────────
// 在你的 server.js 里这样挂载：
//
//   import apiRouter from './nexus-crm-api-additions.js'
//   app.use('/api', apiRouter)
//
// 然后在 vite.config.js 的 server.proxy 里加：
//   '/api': { target: 'http://localhost:3001', changeOrigin: true }
// ─────────────────────────────────────────────────────────────────────────────
