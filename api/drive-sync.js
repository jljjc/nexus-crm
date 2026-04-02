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

    // Sort files so readable types come first, maximising useful content within the 10-file budget.
    // Priority: 1) Google Docs / plain text (always readable, no size limit)
    //           2) DOCX < 5 MB (client-side mammoth extraction)
    //           3) PDF / image < 4 MB (binary block)
    //           4) everything else (will be skipped anyway)
    const readabilityRank = (f) => {
      const mime = f.mimeType || '';
      const sizeMB = parseInt(f.size || '0') / (1024 * 1024);
      if (mime === 'application/vnd.google-apps.document' || mime === 'text/plain') return 0;
      if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && sizeMB < 5) return 1;
      if ((mime === 'application/pdf' || mime.startsWith('image/')) && sizeMB < 4) return 2;
      return 3;
    };
    const allFiles = [...directFiles, ...subFiles].sort((a, b) => readabilityRank(a) - readabilityRank(b));
    const processed = [];

    // ── 4. Download & read files (max 10) ───────────────────────────────────
    for (const file of allFiles.slice(0, 10)) {
      const entry = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        textContent: null,
        base64Content: null,
        skipped: false,
      };

      try {
        const mime = file.mimeType || '';

        if (mime === 'application/vnd.google-apps.document') {
          // Google Doc → export as plain text
          const r = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text%2Fplain&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (r.ok) entry.textContent = (await r.text()).slice(0, 10000);
          else entry.skipped = true;

        } else if (mime === 'text/plain') {
          const r = await driveDownload(file.id);
          entry.textContent = (await r.text()).slice(0, 10000);

        } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // DOCX — return as base64 for client-side mammoth extraction
          const sizeMB = parseInt(file.size || '0') / (1024 * 1024);
          if (sizeMB < 5) {
            const r = await driveDownload(file.id);
            const buf = await r.arrayBuffer();
            entry.base64Content = Buffer.from(buf).toString('base64');
          } else {
            entry.skipped = true;
          }

        } else if (mime === 'application/pdf' || mime.startsWith('image/')) {
          const sizeMB = parseInt(file.size || '0') / (1024 * 1024);
          if (sizeMB < 4) {
            const r = await driveDownload(file.id);
            const buf = await r.arrayBuffer();
            entry.base64Content = Buffer.from(buf).toString('base64');
          } else {
            entry.skipped = true; // too large to download
          }

        } else {
          entry.skipped = true; // unsupported type (Sheets, Slides, etc.)
        }
      } catch (e) {
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
