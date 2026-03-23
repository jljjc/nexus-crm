// api/gmail-sync.js
// Fetches emails from Gmail and uses Claude AI to extract client / case information
//
// Called from frontend with:
//   POST /api/gmail-sync
//   Body: { accessToken, maxResults, labelIds, q }
//
// Returns array of parsed email objects ready to create/update CRM records

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    accessToken,
    maxResults  = 15,
    q           = 'is:unread category:primary',   // Gmail search query
  } = req.body;

  if (!accessToken) return res.status(401).json({ error: 'No Gmail access token provided' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    // ── 1. List recent matching emails ──────────────────────────────────────
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('maxResults', maxResults);
    listUrl.searchParams.set('q', q);

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
      const err = await listRes.json();
      return res.status(listRes.status).json({ error: err.error?.message || 'Gmail API error' });
    }
    const listData = await listRes.json();
    const messages = listData.messages || [];

    if (messages.length === 0) return res.json({ emails: [] });

    // ── 2. Fetch full content for each email (parallel, max 10 at a time) ──
    const fetchEmail = async (msgId) => {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return r.json();
    };

    const rawEmails = await Promise.all(messages.map(m => fetchEmail(m.id)));

    // ── 3. Extract text from each email ──────────────────────────────────────
    const parsedTexts = rawEmails.map(email => {
      const headers = email.payload?.headers || [];
      const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      let body = '';
      const parts = email.payload?.parts || [email.payload];
      const extractBody = (part) => {
        if (!part) return;
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        if (part.parts) part.parts.forEach(extractBody);
      };
      parts.forEach(extractBody);

      // Truncate long bodies to keep Claude prompt size reasonable
      const bodyTrunc = body.slice(0, 3000);

      return {
        messageId: email.id,
        threadId:  email.threadId,
        from:      get('From'),
        to:        get('To'),
        subject:   get('Subject'),
        date:      get('Date'),
        body:      bodyTrunc,
        snippet:   email.snippet || '',
        labelIds:  email.labelIds || [],
      };
    });

    // ── 4. Ask Claude to analyse each email ──────────────────────────────────
    const analyseEmail = async (email) => {
      const prompt = `你是澳洲移民留学咨询公司 Ozsky Perth 的 AI 助理。
请分析以下邮件，判断是否与移民/留学业务相关，并提取结构化信息。

邮件信息：
发件人：${email.from}
主题：${email.subject}
日期：${email.date}
内容：
${email.body || email.snippet}

请返回**纯 JSON**（不含 markdown 代码块），格式如下：
{
  "isRelevant": true/false,
  "enquiryType": "新咨询|材料补充|进度查询|移民局通知|雇主联系|付款|投诉|其他",
  "urgency": "low|medium|high|urgent",
  "clientName": "客户姓名（如能识别）",
  "clientEmail": "客户邮箱",
  "clientPhone": "电话（如有）",
  "nationality": "国籍（如能识别）",
  "visaType": "签证类型（如：学生签证/技术移民189/雇主担保482/访客/配偶等）",
  "currentVisaStatus": "当前签证状态（如能识别）",
  "keyNeeds": "客户核心需求，1-2句话",
  "suggestedAction": "建议下一步行动",
  "suggestedAssignee": "建议分配给（Nicole/Cici/Momo/Sandy/Zoya/Mia，根据签证类型和难度）",
  "extractedDates": ["YYYY-MM-DD 格式的重要日期（如签证到期日、截止日等）"],
  "rawSummary": "邮件内容的1句话摘要（中文）"
}`;

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const aiData = await aiRes.json();
      const text = aiData.content?.[0]?.text || '{}';

      let parsed = {};
      try {
        // Strip possible markdown code fences
        const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = { isRelevant: false, rawSummary: text.slice(0, 200) };
      }

      return {
        ...email,
        ai: parsed,
      };
    };

    // Process in batches of 5 to avoid rate limits
    const results = [];
    for (let i = 0; i < parsedTexts.length; i += 5) {
      const batch = parsedTexts.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(analyseEmail));
      results.push(...batchResults);
    }

    // Return relevant emails first
    const sorted = results.sort((a, b) => {
      const urgencyOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      if (b.ai?.isRelevant !== a.ai?.isRelevant) return b.ai?.isRelevant ? 1 : -1;
      return (urgencyOrder[a.ai?.urgency] ?? 3) - (urgencyOrder[b.ai?.urgency] ?? 3);
    });

    return res.json({ emails: sorted, total: sorted.length });

  } catch (err) {
    console.error('gmail-sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
