/**
 * transcribe.js — Whisper API 音频转录
 * 支持自动语言检测（中文/英文混合没问题）
 */

import fs from "fs";
import path from "path";
import FormData from "form-data";
import fetch from "node-fetch";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_FILE_SIZE  = 25 * 1024 * 1024; // Whisper 限制 25MB

/**
 * 转录音频文件，返回文字稿字符串
 */
export async function transcribeAudio(filePath) {
  if (!OPENAI_API_KEY) {
    throw new Error("缺少 OPENAI_API_KEY，请在 .env 里配置");
  }

  const fileSize = fs.statSync(filePath).size;
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`文件太大 (${(fileSize / 1024 / 1024).toFixed(1)}MB)，Whisper 限制 25MB。请压缩录音后重试。`);
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: getContentType(filePath),
  });
  form.append("model",    "whisper-1");
  form.append("language", "zh");       // 指定中文，提高准确率（英文词汇也能识别）
  form.append("response_format", "verbose_json"); // 带时间戳，方便调试
  form.append("prompt",
    // 给 Whisper 的提示，帮助识别移民领域词汇
    "这是一段澳大利亚移民代理的通话记录，可能包含：签证申请、技能评估、英语考试、" +
    "EOI、州提名、ANZSCO、技术移民、雇主担保、学生签证等专业词汇。" +
    "人名可能是中文或英文。"
  );

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() },
    body:    form,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API 错误 ${response.status}: ${err}`);
  }

  const data = await response.json();

  // 返回纯文字（verbose_json 的 text 字段）
  return data.text?.trim() || "";
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".m4a":  "audio/m4a",
    ".mp3":  "audio/mpeg",
    ".wav":  "audio/wav",
    ".ogg":  "audio/ogg",
    ".webm": "audio/webm",
    ".mp4":  "video/mp4",
  };
  return map[ext] || "audio/mpeg";
}
