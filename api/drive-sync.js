// api/drive-sync.js
// Read client documents from Google Drive: ozsky-clients/<clientName>/
//
// Strategy (v2 — server-side text extraction):
//   • Google Docs/Sheets/Slides → Drive Export API → plain text (fast, no binary)
//   • PDF files                 → Drive Export API → plain text (Google OCR)
//   • DOCX / XLSX files         → Drive Export API → plain text
//   • Plain text / CSV          → direct download
//   • Images                    → filename only (OCR unreliable for scanned docs)
//
// This avoids sending large base64 blobs to Claude and removes the 3-PDF cap.
// Up to 15 files are read; highest-scoring immigration docs are read first.
// Files are read in parallel batches of 5 for speed.
//
// Requires scope: https://www.googleapis.com/auth/drive.readonly
export const config = {
  api: {
    bodyParser: { sizeLimit: '2mb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { accessToken, clientName, confirmedFolderId, confirmedFolderName, ignoreScore, listOnly } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: 'Missing accessToken' });
  if (!clientName)  return res.status(400).json({ error: 'Missing clientName' });

  // ── Helper: call Drive API v3 ──────────────────────────────────────────────
  const driveApi = async (path, params = {}) => {
    const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => '');
      throw new Error(`Drive API ${r.status}: ${msg.slice(0, 300)}`);
    }
    return r.json();
  };

  // ── Helper: export file as plain text via Drive Export API ────────────────
  // Works for: Google Docs, PDF (with OCR), DOCX, XLSX, PPTX, etc.
  const exportAsText = async (fileId) => {
    const exportUrl = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}/export`);
    exportUrl.searchParams.set('mimeType', 'text/plain');
    exportUrl.searchParams.set('supportsAllDrives', 'true');
    const r = await fetch(exportUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      throw new Error(`Export failed ${r.status}: ${errText.slice(0, 200)}`);
    }
    return await r.text();
  };

  // ── Helper: download raw file bytes (for plain text files) ────────────────
  const driveDownload = async (fileId) => {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!r.ok) throw new Error(`Download failed: ${r.status}`);
    return r;
  };

  try {
    // ── 1. Find the ozsky-clients root folder ──────────────────────────────
    const rootSearch = await driveApi('files', {
      q: "name = 'ozsky-clients' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id,name)',
      pageSize: '5',
    });
    if (!rootSearch.files?.length) {
      return res.json({
        folderFound: false, files: [],
        message: 'ozsky-clients 文件夹未找到。请确认 Google Drive 中存在该文件夹。',
      });
    }
    const rootId = rootSearch.files[0].id;

    // ── 2. Find the client subfolder ──────────────────────────────────────
    const escape   = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const normalize = (s) => s.trim().toLowerCase();
    const tokens   = (s) => normalize(s).split(/[\s,.\-_]+/).filter(w => w.length > 0);

    const clientParts = tokens(clientName);
    const firstName   = clientParts[0];
    const lastName    = clientParts[clientParts.length - 1];

    const isValidMatch = (folderName) => {
      const ft = tokens(folderName);
      const hasFirst = ft.includes(firstName);
      const hasLast  = clientParts.length === 1 ? hasFirst : ft.includes(lastName);
      return hasFirst && hasLast;
    };

    let clientFolder = null;

    if (confirmedFolderId) {
      clientFolder = { id: confirmedFolderId, name: confirmedFolderName || clientName };
    } else {
      const seen = new Set();
      const candidates = [];
      const searchAndCollect = async (q) => {
        const r = await driveApi('files', {
          q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and ${q} and trashed = false`,
          fields: 'files(id,name)',
          pageSize: '20',
        });
        for (const f of (r.files || [])) {
          if (!seen.has(f.id) && isValidMatch(f.name)) {
            seen.add(f.id);
            candidates.push(f);
          }
        }
      };

      await searchAndCollect(`name = '${escape(clientName)}'`);
      if (candidates.length === 0)
        await searchAndCollect(`name contains '${escape(firstName)}'`);
      if (candidates.length === 0 && clientParts.length > 1)
        await searchAndCollect(`name contains '${escape(lastName)}'`);

      if (candidates.length === 0) {
        return res.json({
          folderFound: false, files: [],
          message: `未找到客户文件夹 "${clientName}"。请检查 ozsky-clients 下是否存在对应文件夹。`,
        });
      }
      if (candidates.length === 1) {
        clientFolder = candidates[0];
      } else {
        return res.json({
          folderFound: false,
          needsConfirmation: true,
          candidates: candidates.map(f => ({ id: f.id, name: f.name })),
          message: `找到多个可能匹配的文件夹，请确认使用哪一个。`,
        });
      }
    }

    // ── 3. List all files (recurse into subfolders) ────────────────────────
    const listing = await driveApi('files', {
      q: `'${clientFolder.id}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: '50',
    });
    const topLevel = listing.files || [];
    const subfolders = topLevel.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const directFiles = topLevel.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    // Recurse one level into each subfolder (limit 6 subfolders) — parallel
    const subFiles = [];
    const subFolderResults = await Promise.allSettled(
      subfolders.slice(0, 6).map(async (folder) => {
        const sub = await driveApi('files', {
          q: `'${folder.id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
          fields: 'files(id,name,mimeType,size,modifiedTime)',
          orderBy: 'modifiedTime desc',
          pageSize: '20',
        });
        return (sub.files || []).map(f => ({ ...f, name: `${folder.name}/${f.name}` }));
      })
    );
    for (const r of subFolderResults) {
      if (r.status === 'fulfilled') subFiles.push(...r.value);
      // silently skip inaccessible subfolders
    }

    // ── Immigration document relevance scorer ─────────────────────────────
    const scoreFile = (name) => {
      const n = (name || '').toLowerCase().replace(/[_\-\.]/g, ' ');
      // Skip design/marketing files
      if (/\.(psd|ai|sketch|fig|xd)$/.test(name.toLowerCase())) return -1;
      if (/canva|brochure|flyer|poster|price.?list|template\b/.test(n) &&
          !/application|visa|immi/.test(n)) return -1;
      // Tier 1 (100-90): Identity & visa status
      if (/passport|travel.?doc/.test(n))                               return 100;
      if (/visa.?grant|grant.?letter|approval.?letter|vevo|immicard/.test(n)) return 98;
      if (/refusal|cancellation|decision.?record/.test(n))              return 95;
      if (/bridging.?visa|bva|bvb|bvc/.test(n))                        return 92;
      if (/birth.?cert|national.?id|china.?id|chinese.?id|id.?card/.test(n)) return 90;
      // Tier 2 (89-75): English & skills
      if (/ielts|pte\b|toefl|oet\b|cambridge.?english|english.?(test|result|score|certificate)/.test(n)) return 88;
      if (/skills?.?assessment/.test(n))                                return 87;
      // Outcome/decision letters from assessment bodies are skills assessment results
      if (/outcome.?letter|outcome.?report|decision.?letter|assessment.?result|assessment.?outcome/.test(n)) return 87;
      if (/\b(acs|vetassess|engineers?.?australia|aitsl|ahpra|anmac|naati)\b/.test(n)) return 86;
      if (/\btra\b|trades.?recognition|cpa.?australia|caanz|cfa\b|icaa/.test(n)) return 85;
      // Tier 3 (74-60): Qualifications & employment
      if (/degree|bachelor|master|phd|doctorate/.test(n))              return 74;
      if (/transcript|academic.?record|graduation|diploma|qualification/.test(n)) return 72;
      if (/employment.?(letter|contract|reference)|work.?(letter|reference)/.test(n)) return 70;
      if (/payslip|pay.?slip|salary|remuneration/.test(n))             return 68;
      if (/tax.?return|notice.?of.?assessment|noa\b|group.?cert/.test(n)) return 67;
      if (/reference.?letter|employer.?letter/.test(n))                return 65;
      if (/work.?contract|contract.?of.?employment/.test(n))           return 63;
      if (/resume|curriculum.?vitae|\bcv\b/.test(n))                   return 60;
      // Tier 4 (59-45): Relationship & sponsor
      if (/marriage.?cert|wedding.?cert/.test(n))                      return 58;
      if (/de.?facto|defacto|relationship.?(statement|evidence|declaration)/.test(n)) return 56;
      if (/sponsor(ship)?|nomination|labour.?market|lmt\b/.test(n))    return 54;
      if (/state.?nomination|regional.?cert|skillselect|\beoi\b|invitation.?to.?apply|eoi.?submission/.test(n)) return 55;
      if (/family.?evidence|partner.?evidence|joint.?asset/.test(n))   return 50;
      if (/police.?clear|character.?clear|criminal.?record/.test(n))   return 48;
      if (/health.?assess|medical.?exam|\bhap\b|chest.?x.?ray/.test(n)) return 47;
      if (/service.?agreement|agent.?nom|form.?956|pow?er.?of.?attorney/.test(n)) return 45;
      // Tier 5 (44-30): Financial & supporting
      if (/bank.?statement|financial.?evidence|savings|funds/.test(n)) return 44;
      if (/lease|rental.?agreement|utility.?bill|address.?evidence/.test(n)) return 38;
      if (/insurance|ovhc|oshc/.test(n))                               return 35;
      if (/enrol(l?ment)?|coe\b|confirmation.?of.?enrol/.test(n))      return 33;
      // Tier 6 (29-15): Communication & notes
      if (/\bnote[s]?\b|meeting.?note|consult(ation)?|summary/.test(n)) return 29;
      if (/wechat|chat.?log|message|communication/.test(n))            return 28;
      if (/email.?log|email.?summary/.test(n))                         return 26;
      return 10;
    };

    const allFiles = [...directFiles, ...subFiles]
      .map(f => ({ ...f, _score: scoreFile(f.name) }))
      .filter(f => f._score >= 0)
      .sort((a, b) => b._score - a._score);

    // ── 4. Classify files by read method ──────────────────────────────────
    //
    // gdrive-export: Drive Export API → plain text
    //   Works for: Google Docs/Sheets/Slides, PDF (OCR), DOCX, XLSX, PPTX
    // direct-download: raw bytes → text
    //   Works for: .txt, .csv
    // filename-only: no content read, just list the name
    //   For: images, unknown binary formats
    //
    // listOnly mode: just return file list with scores, no content reading
    if (listOnly) {
      return res.json({
        folderFound: true,
        folderName: clientFolder.name,
        folderId: clientFolder.id,
        totalFiles: allFiles.length,
        fingerprint: allFiles.map(f => `${f.id}:${f.modifiedTime || ''}`).sort().join('|'),
        processed: allFiles.map(f => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modifiedTime: f.modifiedTime,
          relevanceScore: f._score,
          textContent: null,
          skipped: true,
          extractMethod: 'filename-only',
        })),
      });
    }

    const READ_LIMIT = ignoreScore ? 30 : 20;       // ignoreScore mode reads up to 30 files
    const MIN_SCORE_TO_READ = ignoreScore ? 0 : 45; // ignoreScore: read everything
    const CHARS_PER_FILE = ignoreScore ? 1500 : 2000; // smaller per-file budget when reading all
    const CONCURRENCY = 8;       // Parallel requests per batch (increased from 5)
    const FILE_TIMEOUT_MS = 8000; // Per-file read timeout (8s)

    const classified = allFiles.map(file => {
      const mime = file.mimeType || '';
      const name = (file.name || '').toLowerCase();
      // Skip content read for low-relevance files (payslips, bills, design files, generic docs)
      let method = 'filename-only';

      // For files with sufficient score, determine read method by mime type
      if (file._score >= MIN_SCORE_TO_READ) {
        if (
          mime === 'application/vnd.google-apps.document' ||
          mime === 'application/vnd.google-apps.spreadsheet' ||
          mime === 'application/vnd.google-apps.presentation'
        ) {
          method = 'gdrive-export';
        } else if (mime === 'application/pdf') {
          method = 'gdrive-export'; // Drive OCR for PDFs
        } else if (
          mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          mime === 'application/msword'
        ) {
          method = 'gdrive-export';
        } else if (
          mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          mime === 'application/vnd.ms-excel'
        ) {
          method = 'gdrive-export';
        } else if (mime === 'text/plain' || name.endsWith('.txt') || name.endsWith('.csv')) {
          method = 'direct-download';
        } else {
          method = 'filename-only'; // images and other binary
        }
      }

      return { ...file, _method: method };
    });

    const toRead = classified.filter(f => f._method !== 'filename-only').slice(0, READ_LIMIT);
    const filenameOnly = classified.filter(f => f._method === 'filename-only');
    const overflow = classified.filter(f => f._method !== 'filename-only').slice(READ_LIMIT);

    // ── 5. Read files in parallel batches ────────────────────────────────
    const readFile = async (file) => {
      const entry = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        relevanceScore: file._score,
        textContent: null,
        base64Content: null,
        skipped: false,
        extractMethod: file._method,
      };
      // Wrap the actual read in a per-file timeout
      const doRead = async () => {
        if (file._method === 'gdrive-export') {
          const text = await exportAsText(file.id);
          const trimmed = text.replace(/\s+/g, ' ').trim();
          entry.textContent = trimmed.slice(0, CHARS_PER_FILE);
          if (!entry.textContent) {
            entry.skipped = true;
            entry.error = 'export-empty';
          }
        } else if (file._method === 'direct-download') {
          const r = await driveDownload(file.id);
          const text = await r.text();
          entry.textContent = text.slice(0, CHARS_PER_FILE);
        }
      };
      try {
        await Promise.race([
          doRead(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`读取超时 (${FILE_TIMEOUT_MS / 1000}s)`)), FILE_TIMEOUT_MS)
          ),
        ]);
      } catch (e) {
        entry.skipped = true;
        entry.error = e.message.slice(0, 200);
      }
      return entry;
    };

    const processed = [];

    // Process all files in parallel with concurrency limit (semaphore pattern)
    let active = 0;
    let idx = 0;
    const results = new Array(toRead.length);

    await new Promise((resolve) => {
      const next = () => {
        while (active < CONCURRENCY && idx < toRead.length) {
          const i = idx++;
          active++;
          readFile(toRead[i]).then(r => {
            results[i] = { status: 'fulfilled', value: r };
          }).catch(e => {
            results[i] = { status: 'rejected', reason: e };
          }).finally(() => {
            active--;
            if (idx < toRead.length) next();
            else if (active === 0) resolve();
          });
        }
        if (toRead.length === 0) resolve();
      };
      next();
    });

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r) continue;
      if (r.status === 'fulfilled') {
        processed.push(r.value);
      } else {
        const file = toRead[i];
        processed.push({
          id: file.id, name: file.name, mimeType: file.mimeType,
          modifiedTime: file.modifiedTime, relevanceScore: file._score,
          textContent: null, base64Content: null, skipped: true,
          error: r.reason?.message?.slice(0, 200) || 'unknown',
        });
      }
    }

    // Add filename-only entries (images, overflow, unreadable)
    for (const file of [...filenameOnly, ...overflow]) {
      processed.push({
        id: file.id, name: file.name, mimeType: file.mimeType,
        modifiedTime: file.modifiedTime, relevanceScore: file._score,
        textContent: null, base64Content: null, skipped: true,
        extractMethod: file._method,
      });
    }

    // Sort final list by relevance score (highest first)
    processed.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Build a lightweight fingerprint: sorted "id:modifiedTime" pairs for all files
    // This lets the client detect if anything in the folder has changed since last cache
    const fingerprint = allFiles
      .map(f => `${f.id}:${f.modifiedTime || ''}`)
      .sort()
      .join('|');

    return res.json({
      folderFound: true,
      folderName: clientFolder.name,
      folderId: clientFolder.id,
      totalFiles: allFiles.length,
      fingerprint,
      processed,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
