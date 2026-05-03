# Ozsky 语音自动处理管道

> 说话 → 自动转录 → AI提取 → Obsidian笔记 + NexusCRM任务
> 你只需要：**录音，丢文件夹**

---

## 工作流程

```
iPhone/Mac 录音
     ↓  (iCloud/Dropbox 自动同步)
OzskyVoice/ 文件夹
     ↓  (chokidar 监听到新文件)
Whisper API 转录 (支持中英混合)
     ↓
Claude API 提取结构化信息
  · 客户姓名、案件类型
  · 摘要、关键要点
  · Action Items (含负责人、截止日期)
  · 风险标记、跟进计划
     ↓
同时输出到两个地方：
  ① Obsidian 03-Meetings/YYYY-MM-DD_客户名_通话.md
  ② NexusCRM API → 沟通记录 + 任务创建
     ↓
macOS 系统通知 "✅ 完成"
```

---

## 安装步骤（一次性，约 15 分钟）

### 1. 准备 API Keys

| Key | 获取地址 | 用途 |
|-----|---------|------|
| `OPENAI_API_KEY` | platform.openai.com | Whisper 转录 |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Claude 提取 |

### 2. 安装依赖

```bash
cd voice-pipeline
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 用文本编辑器打开 .env，填入你的 API Keys 和路径
```

重要路径配置：
```
WATCH_DIR  = ~/Dropbox/OzskyVoice    ← 录音文件丢这里
VAULT_DIR  = ~/Liang-Brain            ← 你的 Obsidian Vault
CRM_BASE_URL = https://your-nexus-crm.netlify.app  ← NexusCRM Netlify URL
               (本地开发用 http://localhost:8888)
```

### 4. 在 Supabase 创建数据表

在 Supabase SQL Editor 中运行以下 SQL（在 NexusCRM 的 Meetings 视图里也有内嵌的 SQL）：

```sql
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  client_id TEXT, client_name TEXT, client_name_en TEXT,
  meeting_type TEXT DEFAULT 'client_call',
  date DATE, channel TEXT DEFAULT 'phone', language TEXT DEFAULT 'zh',
  duration_estimate TEXT, case_type TEXT, case_id TEXT,
  summary TEXT, key_points JSONB DEFAULT '[]',
  client_concerns JSONB DEFAULT '[]', action_items JSONB DEFAULT '[]',
  documents_requested JSONB DEFAULT '[]',
  follow_up_date DATE, follow_up_topic TEXT,
  risk_flags JSONB DEFAULT '[]', sentiment TEXT DEFAULT 'neutral',
  tags JSONB DEFAULT '[]', raw_transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS voice_tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  assignee TEXT, due_date DATE, priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'todo', meeting_id TEXT, client_id TEXT,
  client_name TEXT, case_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meetings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON meetings    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON voice_tasks FOR ALL USING (true) WITH CHECK (true);
```

`nexus-crm-api-additions.js` 文件已不再需要 — NexusCRM 现在使用 Netlify Functions (`/api/meetings`) 直接对接 Supabase。

### 5. 测试运行

```bash
# 先手动跑，看输出是否正常
node watch.js

# 把一个录音文件丢进 WATCH_DIR，看它自动处理
```

### 6. 设置开机自启（macOS）

```bash
# 先编辑 plist 文件，把路径改成你的实际路径
nano com.ozsky.voice-pipeline.plist

# 安装为系统服务
cp com.ozsky.voice-pipeline.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.ozsky.voice-pipeline.plist

# 验证已启动
launchctl list | grep ozsky
```

之后电脑开机就自动在后台运行，无需手动操作。

### 7. iPhone 自动上传（最后一步）

**方案 A：iCloud Drive（推荐）**
- 把 `WATCH_DIR` 设为 iCloud Drive 里的一个文件夹
- iPhone 录音后，用"文件" app 存到这个文件夹
- 电脑上 iCloud 自动同步，触发管道

**方案 B：Dropbox**
- 安装 Dropbox，把 `WATCH_DIR` 设为 Dropbox 文件夹
- iPhone 上用 Dropbox app 上传录音

**方案 A 配合 iPhone 捷径（最顺畅）：**
1. iPhone → 捷径 app → 新建捷径
2. 添加动作：录音 → 存储到 iCloud Drive/OzskyVoice/
3. 把捷径放到主屏幕
4. 打完电话，点一下 → 录音 → 自动上传

---

## 日常使用

打完一个重要电话，做完一个会议：
1. 打开 iPhone 捷径 → 录音（哪怕只是说"刚才和张三通话，主要讨论了......"）
2. 存到 OzskyVoice 文件夹
3. 等 1-2 分钟，收到 Mac 通知
4. 打开 Obsidian → 03-Meetings → 笔记已自动生成
5. 打开 NexusCRM → 任务已自动创建

---

## 常见问题

**Q: 文件太大处理失败？**  
Whisper 限制 25MB。iPhone 录音一般 1分钟 ≈ 1MB，25分钟内没问题。更长的通话可以分段录。

**Q: 客户名没识别出来？**  
录音开头说一句"这是和[客户名]的通话"，AI 会优先识别。

**Q: CRM 推送失败但笔记有了？**  
这是设计如此——CRM 失败不影响 Obsidian。去 `_failed/` 目录看失败的文件，手动重试。

**Q: 查看处理日志？**  
```bash
tail -f /tmp/ozsky-voice-pipeline.log
```

---

## 文件结构

```
voice-pipeline/
├── watch.js          ← 主监听器（入口）
├── transcribe.js     ← Whisper 转录
├── extract.js        ← Claude 信息提取
├── obsidian.js       ← Obsidian 笔记生成
├── crm.js            ← NexusCRM API 推送
├── utils.js          ← 日志和通知
├── .env              ← 你的配置（不要提交到 git）
├── .env.example      ← 配置模板
├── package.json
├── nexus-crm-api-additions.js  ← 加到 CRM 后端的 API
└── com.ozsky.voice-pipeline.plist  ← macOS 自启动配置
```
