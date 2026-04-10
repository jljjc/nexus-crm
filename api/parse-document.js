// api/parse-document.js
// Holistic AI document comprehension — replaces fixed-field OCR extraction.
// Accepts: images (jpg/png/gif/webp), PDFs, or pre-extracted text (docx/txt).
//
// Request body: { fileBase64?, mimeType?, fileName, textContent? }
//   - textContent: plain text extracted by mammoth (docx) or FileReader (txt)
//   - fileBase64 + mimeType: for images and PDFs
//
// Response: { extracted: {...}, documentType: string, rawText?: string }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { fileBase64, mimeType, fileName = '', textContent } = req.body || {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  if (!fileBase64 && !textContent?.trim()) return res.status(400).json({ error: 'No file data provided' });

  // Build content blocks based on file type
  let contentBlocks;
  if (textContent) {
    contentBlocks = [{ type: 'text', text: `File: ${fileName}\n\n${textContent}` }];
  } else if (mimeType === 'application/pdf') {
    contentBlocks = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }];
  } else if (mimeType?.startsWith('image/')) {
    contentBlocks = [{ type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBase64 } }];
  } else {
    return res.status(400).json({ error: `Unsupported file type: ${mimeType}` });
  }

  const extractionPrompt = `You are an Australian immigration document expert. Read this document fully and extract ALL relevant information you can find. Identify the document type automatically.

Return a single JSON object. Include ONLY fields where you found actual values — omit fields with no data. Do not guess.

Possible fields (use only what's present):
{
  "documentType": "passport|visa|coe|bank|police_check|noa|invitation|identity|other",
  "fullName": "", "nameChinese": "", "sex": "", "dob": "YYYY-MM-DD",
  "birthplace": "", "nationality": "", "passportNo": "", "passportExpiry": "YYYY-MM-DD",
  "chinaId": "", "email": "", "phone": "", "auAddress": "", "maritalStatus": "",
  "visaType": "", "visaSubclass": "", "applicationId": "", "trnNumber": "",
  "grantDate": "YYYY-MM-DD", "expiryDate": "YYYY-MM-DD", "conditions": [],
  "visaAuthNo": "", "noOfEntries": "",
  "sponsorName": "", "sponsorDob": "YYYY-MM-DD", "sponsorNationality": "",
  "sponsorPassportNo": "", "sponsorRelationship": "", "sponsorAddress": "",
  "sponsorOccupation": "",
  "institution": "", "courseCode": "", "courseName": "", "coeNumber": "",
  "coeStart": "YYYY-MM-DD", "coeEnd": "YYYY-MM-DD", "tuitionFee": "", "studentId": "",
  "annualIncome": "", "bankBalance": "", "bankBsb": "", "bankAccount": "",
  "companyName": "", "companyAcn": "", "pensionIncome": "",
  "bccNumber": "", "applicationFee": "", "receiptNumber": "",
  "afpNumber": "", "policyNumber": "",
  "occupation": "", "anzscoCode": "", "assessingBody": "", "assessmentOutcome": "",
  "timeline": [{"date": "YYYY-MM-DD", "event": ""}]
}

Return only the JSON object, no markdown, no explanation.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(contentBlocks[0]?.type === 'document' ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {}),
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [...contentBlocks, { type: 'text', text: extractionPrompt }],
        }],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      return res.status(r.status).json({ error: errBody.slice(0, 300) || 'AI error' });
    }
    const data = await r.json();

    const rawText = data.content?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse AI response', rawText: rawText.slice(0,300) });

    try {
      const extracted = JSON.parse(jsonMatch[0]);
      return res.json({
        extracted,
        documentType: extracted.documentType || 'unknown',
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      });
    } catch {
      return res.status(500).json({ error: 'Invalid JSON from AI', rawText: rawText.slice(0,300) });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
