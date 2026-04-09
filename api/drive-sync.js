// api/drive-sync.js
// Read client documents from Google Drive: ozsky-clients/<clientName>/
// Returns file metadata + text content (for text/gdocs) or base64 (for PDF/images).
//
// Requires the access token to have scope: https://www.googleapis.com/auth/drive.readonly
// (Add this scope to gmail-auth.js and have users re-authorise.)

export const config = {
  api: {
    bodyParser: { sizeLimit: '2mb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accessToken, clientName, confirmedFolderId, confirmedFolderName } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: 'Missing accessToken' });
  if (!clientName)  return res.status(400).json({ error: 'Missing clientName' });

  // Helper: call Drive API v3 with shared-drive support
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

  // Helper: download file bytes
  const driveDownload = async (fileId) => {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!r.ok) throw new Error(`Download failed: ${r.status}`);
    return r;
  };

  try {
    // ── 1. Find the ozsky-clients root folder ───────────────────────────────
    const rootSearch = await driveApi('files', {
      q: "name = 'ozsky-clients' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id,name)',
      pageSize: '5',
    });

    if (!rootSearch.files?.length) {
      return res.json({ folderFound: false, files: [], message: 'ozsky-clients 文件夹未找到。请确认 Google Drive 中存在该文件夹。' });
    }

    const rootId = rootSearch.files[0].id;

    // ── 2. Find the client subfolder ────────────────────────────────────────
    const escape  = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const normalize = (s) => s.trim().toLowerCase();

    // Splits a name into tokens, stripping punctuation/separators.
    // E.g. "CHEN, Fengmei" → ["chen", "fengmei"]
    const tokens = (s) => normalize(s).split(/[\s,.\-_]+/).filter(w => w.length > 0);

    // A folder name is a VALID match for a client when:
    //   • The folder contains the client's FIRST word (first name) as a whole token, AND
    //   • The folder contains the client's LAST word (last name / surname) as a whole token.
    // Middle names in either direction are ignored.
    // This prevents "chen" from matching "Chencho" because token equality is used, not substring.
    const clientParts = tokens(clientName);
    const firstName   = clientParts[0];
    const lastName    = clientParts[clientParts.length - 1];

    const isValidMatch = (folderName) => {
      const ft = tokens(folderName);
      const hasFirst = ft.includes(firstName);
      const hasLast  = clientParts.length === 1
        ? hasFirst
        : ft.includes(lastName);
      return hasFirst && hasLast;
    };

    let clientFolder = null;

    // If user already confirmed a specific folder, skip searching.
    if (confirmedFolderId) {
      clientFolder = { id: confirmedFolderId, name: confirmedFolderName || clientName };
    } else {
      // Search: exact match first, then first-name-contains (broader net),
      // then last-name-contains — collect ALL results and validate strictly.
      const seen   = new Set();
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
        // Exactly one match — use it directly.
        clientFolder = candidates[0];
      } else {
        // Multiple matches — ask the user to confirm before reading any files.
        return res.json({
          folderFound: false,
          needsConfirmation: true,
          candidates: candidates.map(f => ({ id: f.id, name: f.name })),
          message: `找到多个可能匹配的文件夹，请确认使用哪一个。`,
        });
      }
    }

    // ── 3. List all files in the client folder (recurse into subfolders) ───────
    const listing = await driveApi('files', {
      q: `'${clientFolder.id}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: '50',
    });

    const topLevel = listing.files || [];
    const subfolders = topLevel.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const directFiles = topLevel.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

    // Recurse one level into each subfolder (limit 6 subfolders)
    const subFiles = [];
    for (const folder of subfolders.slice(0, 6)) {
      try {
        const sub = await driveApi('files', {
          q: `'${folder.id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
          fields: 'files(id,name,mimeType,size,modifiedTime)',
          orderBy: 'modifiedTime desc',
          pageSize: '20',
        });
        // Prefix name with folder so context is clear
        (sub.files || []).forEach(f => subFiles.push({ ...f, name: `${folder.name}/${f.name}` }));
      } catch { /* skip inaccessible subfolder */ }
    }

    // ── Immigration document relevance scorer ───────────────────────────────
    // Scores a file by how important it is for an Australian immigration case.
    // Higher = read first. Returns -1 to skip the file entirely.
    const scoreFile = (name) => {
      const n = (name || '').toLowerCase().replace(/[_\-\.]/g, ' ');

      // ── Skip entirely: design/marketing/internal work files ──────────────
      if (/\.(psd|ai|sketch|fig|xd)$/.test(name.toLowerCase())) return -1;
      if (/canva|brochure|flyer|poster|price.?list|template\b/.test(n) &&
          !/application|visa|immi/.test(n)) return -1;

      // ── Tier 1 (100-90): Identity & visa status — must-read ──────────────
      if (/passport|travel.?doc/.test(n))                               return 100;
      if (/visa.?grant|grant.?letter|approval.?letter|vevo|immicard/.test(n)) return 98;
      if (/refusal|cancellation|decision.?record/.test(n))              return 95; // critical to understand
      if (/bridging.?visa|bva|bvb|bvc/.test(n))                        return 92;
      if (/birth.?cert|national.?id|china.?id|chinese.?id|id.?card/.test(n)) return 90;

      // ── Tier 2 (89-75): English & skills — core assessment docs ──────────
      if (/ielts|pte\b|toefl|oet\b|cambridge.?english|english.?(test|result|score|certificate)/.test(n)) return 88;
      if (/skills?.?assessment/.test(n))                                return 87;
      if (/\b(acs|vetassess|engineers?.?australia|aitsl|ahpra|anmac|naati)\b/.test(n)) return 86;
      if (/\btra\b|trades.?recognition|cpa.?australia|caanz|cfa\b|icaa/.test(n)) return 85;

      // ── Tier 3 (74-60): Qualifications & employment ──────────────────────
      if (/degree|bachelor|master|phd|doctorate/.test(n))              return 74;
      if (/transcript|academic.?record|graduation|diploma|qualification/.test(n)) return 72;
      if (/employment.?(letter|contract|reference)|work.?(letter|reference)/.test(n)) return 70;
      if (/payslip|pay.?slip|salary|remuneration/.test(n))             return 68;
      if (/tax.?return|notice.?of.?assessment|noa\b|group.?cert/.test(n)) return 67;
      if (/reference.?letter|employer.?letter/.test(n))                return 65;
      if (/work.?contract|contract.?of.?employment/.test(n))           return 63;
      if (/resume|curriculum.?vitae|\bcv\b/.test(n))                   return 60;

      // ── Tier 4 (59-45): Relationship & sponsor ───────────────────────────
      if (/marriage.?cert|wedding.?cert/.test(n))                      return 58;
      if (/de.?facto|defacto|relationship.?(statement|evidence|declaration)/.test(n)) return 56;
      if (/sponsor(ship)?|nomination|labour.?market|lmt\b/.test(n))    return 54;
      if (/state.?nomination|regional.?cert|skillselect|\beoi\b|invitation.?to.?apply/.test(n)) return 52;
      if (/family.?evidence|partner.?evidence|joint.?asset/.test(n))   return 50;
      if (/police.?clear|character.?clear|criminal.?record/.test(n))   return 48;
      if (/health.?assess|medical.?exam|\bhap\b|chest.?x.?ray/.test(n)) return 47;
      if (/service.?agreement|agent.?nom|form.?956|pow?er.?of.?attorney/.test(n)) return 45;

      // ── Tier 5 (44-30): Financial & supporting ───────────────────────────
      if (/bank.?statement|financial.?evidence|savings|funds/.test(n)) return 44;
      if (/lease|rental.?agreement|utility.?bill|address.?evidence/.test(n)) return 38;
      if (/insurance|ovhc|oshc/.test(n))                               return 35;
      if (/enrol(l?ment)?|coe\b|confirmation.?of.?enrol/.test(n))      return 33;

      // ── Tier 6 (29-15): Communication & notes — future WeChat / meeting notes
      if (/\bnote[s]?\b|meeting.?note|consult(ation)?|summary/.test(n)) return 29;
      if (/wechat|chat.?log|message|communication/.test(n))            return 28;
      if (/email.?log|email.?summary/.test(n))                         return 26;

      // ── Everything else (low relevance) ──────────────────────────────────
      return 10;
    };

    // Score, filter, then sort: highest-score files first.
    // Files scoring -1 are excluded from both reading AND the filename list.
    const allFiles = [...directFiles, ...subFiles]
      .map(f => ({ ...f, _score: scoreFile(f.name) }))
      .filter(f => f._score >= 0)
      .sort((a, b) => b._score - a._score);   // highest immigration relevance first

    const processed = [];

    // ── 4. Read text-readable files (up to 12); list all others by filename ──
    // Only Google Docs and plain-text files are downloaded (fast, no binary).
    // DOCX / PDF / images → filename only — Claude infers content from the name.
    // Timeout budget: each Google Doc export ≈ 0.3-0.5 s → 12 reads ≈ 4-6 s safe.
    const TEXT_READ_LIMIT = 12;
    let textReadCount = 0;

    for (const file of allFiles) {
      const mime = file.mimeType || '';
      const isTextReadable = (
        mime === 'application/vnd.google-apps.document' ||
        mime === 'text/plain'
      );

      const entry = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        relevanceScore: file._score,
        textContent: null,
        base64Content: null,
        skipped: false,
      };

      try {
        if (isTextReadable && textReadCount < TEXT_READ_LIMIT) {
          if (mime === 'application/vnd.google-apps.document') {
            // Google Doc → export as plain text (no binary download, very fast)
            const r = await fetch(
              `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text%2Fplain&supportsAllDrives=true`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (r.ok) {
              entry.textContent = (await r.text()).slice(0, 8000);
              textReadCount++;
            } else {
              entry.skipped = true;
            }
          } else {
            // Plain text file — small, fast download
            const r = await driveDownload(file.id);
            entry.textContent = (await r.text()).slice(0, 8000);
            textReadCount++;
          }
        } else {
          // Binary (PDF/DOCX/image) or text-read budget exhausted →
          // filename-only context. Claude uses the name to infer the document.
          entry.skipped = true;
        }
      } catch (e) {
        entry.skipped = true;
        entry.error = e.message;
      }

      processed.push(entry);
    }

    return res.json({
      folderFound: true,
      folderName: clientFolder.name,
      folderId: clientFolder.id,
      totalFiles: allFiles.length,
      processed,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
