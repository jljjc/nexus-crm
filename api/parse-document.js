// api/parse-document.js
// Uses Claude Vision API to OCR and extract structured data from client documents
//
// Called from frontend with:
//   POST /api/parse-document
//   Body: { fileBase64, mimeType, documentType, fileName }
//
// documentType options:
//   'passport'    → name, dob, nationality, passportNo, expiry, placeOfBirth, issueDate, issuePlace
//   'visa'        → visaType, visaSubclass, holder, grantDate, expiry, conditions, caseRef
//   'education'   → institutionName, degree, major, graduationDate, studentId, gpa, country
//   'employment'  → employerName, position, startDate, endDate, salary, employerABN, location
//   'bank'        → bankName, accountHolder, accountNo, bsb, balance, statementPeriod, currency
//   'skillsAssess'→ assessingBody, outcome, nomCode, nomTitle, assessDate, refNo, expiryDate
//
// Returns: { success: true, documentType, extracted: {...}, confidence: 'high|medium|low', rawText }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fileBase64, mimeType, documentType, fileName } = req.body;

  if (!fileBase64)    return res.status(400).json({ error: 'No file data provided' });
  if (!documentType) return res.status(400).json({ error: 'documentType is required' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  // ── Validate mimeType is something Claude Vision can handle ──────────────
  const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  const resolvedMime   = mimeType || guessMime(fileName || '');
  if (!supportedTypes.includes(resolvedMime)) {
    return res.status(400).json({
      error: `Unsupported file type: ${resolvedMime}. Supported: JPEG, PNG, GIF, WEBP, PDF`,
    });
  }

  // ── Build extraction prompt based on document type ───────────────────────
  const promptMap = {
    passport: `请仔细阅读护照图像，提取以下信息并以纯JSON返回（不含markdown代码块）：
{
  "lastName": "姓",
  "firstName": "名",
  "fullName": "全名（按护照显示）",
  "dateOfBirth": "YYYY-MM-DD",
  "gender": "M/F",
  "nationality": "国籍（英文）",
  "nationalityZh": "国籍（中文，如能识别）",
  "passportNumber": "护照号码",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "placeOfBirth": "出生地",
  "issuingAuthority": "签发机关",
  "mrzLine1": "MRZ第一行（如可见）",
  "mrzLine2": "MRZ第二行（如可见）"
}
如某字段无法识别，返回 null。`,

    visa: `请分析此签证/签证标签/签证通知，提取以下信息并以纯JSON返回：
{
  "visaType": "签证类型描述",
  "visaSubclass": "签证子类别编号（如482/189/500等）",
  "holderName": "签证持有人姓名",
  "holderDob": "YYYY-MM-DD",
  "passportNumber": "护照号码（如显示）",
  "grantDate": "YYYY-MM-DD 批准日期",
  "expiryDate": "YYYY-MM-DD 到期日",
  "noOfEntries": "入境次数（Multiple/Single/具体次数）",
  "conditions": ["条件代码列表，如 8101, 8501"],
  "caseReference": "案件参考号",
  "countryOfGrant": "签发国",
  "workRights": "工作权限（如有）",
  "studyRights": "学习权限（如有）"
}
如某字段无法识别，返回 null。`,

    education: `请分析此学历证明/成绩单/毕业证书，提取以下信息并以纯JSON返回：
{
  "institutionName": "学校名称",
  "institutionNameZh": "学校中文名（如有）",
  "institutionCountry": "学校所在国家",
  "degree": "学位名称（如：Bachelor of Science）",
  "degreeZh": "学位中文名（如：理学学士）",
  "major": "专业",
  "majorZh": "专业中文名（如有）",
  "studentName": "学生姓名",
  "studentId": "学号",
  "enrollmentDate": "YYYY-MM-DD 入学日期",
  "graduationDate": "YYYY-MM-DD 毕业日期",
  "gpa": "GPA或成绩（如显示）",
  "honours": "荣誉/奖励（如有）",
  "verificationCode": "验证码（如有）"
}
如某字段无法识别，返回 null。`,

    employment: `请分析此雇用证明/工作合同/离职证明，提取以下信息并以纯JSON返回：
{
  "employerName": "雇主公司名称",
  "employerABN": "ABN/税号（如有）",
  "employerAddress": "雇主地址",
  "employeeName": "员工姓名",
  "position": "职位名称",
  "positionAnzsco": "ANZSCO职业代码（如显示）",
  "employmentType": "雇用类型（Full-time/Part-time/Casual/Contract）",
  "startDate": "YYYY-MM-DD 开始日期",
  "endDate": "YYYY-MM-DD 结束日期（如已离职）",
  "annualSalary": "年薪（数字，AUD）",
  "hourlyRate": "时薪（如适用）",
  "hoursPerWeek": "每周工时",
  "nominator": "担保人/签字人姓名职位",
  "documentDate": "YYYY-MM-DD 文件日期"
}
如某字段无法识别，返回 null。`,

    bank: `请分析此银行对账单，提取以下信息并以纯JSON返回：
{
  "bankName": "银行名称",
  "accountHolderName": "账户持有人姓名",
  "accountNumber": "账号（部分遮掩也可）",
  "bsb": "BSB号（澳洲银行专用，如适用）",
  "accountType": "账户类型（Savings/Cheque/Transaction等）",
  "currency": "货币（如AUD/CNY）",
  "statementStartDate": "YYYY-MM-DD 对账单开始日期",
  "statementEndDate": "YYYY-MM-DD 对账单结束日期",
  "openingBalance": "开户余额（数字）",
  "closingBalance": "结余（数字）",
  "averageBalance": "平均余额（如显示）",
  "branch": "支行名称（如显示）"
}
如某字段无法识别，返回 null。`,

    skillsAssess: `请分析此职业技能评估报告/通知，提取以下信息并以纯JSON返回：
{
  "assessingBody": "评估机构（如Vetassess/Engineers Australia/ACS等）",
  "applicantName": "申请人姓名",
  "outcome": "评估结果（Suitable/Not Suitable/Closely Related/等）",
  "nominatedOccupation": "提名职业",
  "anzscoCode": "ANZSCO代码",
  "assessmentDate": "YYYY-MM-DD 评估日期",
  "expiryDate": "YYYY-MM-DD 到期日（如有）",
  "referenceNumber": "参考编号",
  "qualificationLevel": "认定学历级别",
  "experienceYears": "认定工作年限（数字）",
  "conditions": "附加条件（如有）"
}
如某字段无法识别，返回 null。`,
  };

  const extractionPrompt = promptMap[documentType];
  if (!extractionPrompt) {
    return res.status(400).json({
      error: `Unknown documentType: ${documentType}. Valid: passport, visa, education, employment, bank, skillsAssess`,
    });
  }

  try {
    // ── Call Claude Vision API ────────────────────────────────────────────────
    const requestBody = {
      model: 'claude-sonnet-4-6',   // Use Sonnet for better OCR accuracy
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: resolvedMime === 'application/pdf' ? 'image/png' : resolvedMime,
                data: fileBase64,
              },
            },
            {
              type: 'text',
              text: extractionPrompt,
            },
          ],
        },
      ],
    };

    // Note: Claude API doesn't natively handle PDF as vision — frontend should
    // convert PDF first page to image before sending. If PDF is passed, we treat
    // it as an image (works for most scanned single-page PDFs via some clients).

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      console.error('Claude API error:', errBody);
      return res.status(502).json({ error: 'AI service error', detail: errBody.slice(0, 300) });
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content?.[0]?.text || '{}';

    // ── Parse the JSON response ───────────────────────────────────────────────
    let extracted = {};
    let parseOk = true;
    try {
      const clean = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extracted = JSON.parse(clean);
    } catch {
      parseOk = false;
      extracted = { _rawText: rawText.slice(0, 500) };
    }

    // ── Assess confidence based on null-field ratio ───────────────────────────
    const values       = Object.values(extracted);
    const nonNull      = values.filter(v => v !== null && v !== '' && v !== undefined);
    const fillRate     = values.length > 0 ? nonNull.length / values.length : 0;
    const confidence   = fillRate >= 0.7 ? 'high' : fillRate >= 0.4 ? 'medium' : 'low';

    return res.json({
      success: parseOk,
      documentType,
      extracted,
      confidence,
      fillRate: Math.round(fillRate * 100),
      rawText: parseOk ? undefined : rawText.slice(0, 500),
      inputTokens:  aiData.usage?.input_tokens,
      outputTokens: aiData.usage?.output_tokens,
    });

  } catch (err) {
    console.error('parse-document error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Helper: guess MIME type from file extension ───────────────────────────────
function guessMime(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
  };
  return map[ext] || 'image/jpeg';
}
