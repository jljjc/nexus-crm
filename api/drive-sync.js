// api/drive-sync.js
// Read client documents from Google Drive: ozsky-clients/<clientName>/
// Returns file metadata + text content (for text/gdocs) or base64 (for PDF/images).
//
// Requires the access token to have scope: https://www.googleapis.com/auth/drive.readonly
// (Add this scope to gmail-auth.js and have users re-authorise.)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accessToken, clientName } = req.body || {};
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
    // Try exact match first, then each name part
    const nameParts = clientName.trim().split(/\s+/).filter(Boolean);
    const escape = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const queries = [
      `name = '${escape(clientName)}'`,
      ...nameParts.map(p => `name contains '${escape(p)}'`),
    ];

    let clientFolder = null;
    for (const q of queries) {
      const r = await driveApi('files', {
        q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and ${q} and trashed = false`,
        fields: 'files(id,name)',
        pageSize: '10',
      });
      if (r.files?.length) { clientFolder = r.files[0]; break; }
    }

    if (!clientFolder) {
      return res.json({
        folderFound: false, files: [],
        message: `未找到客户文件夹 "${clientName}"。请检查 ozsky-clients 下是否存在对应文件夹。`,
      });
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

    const allFiles = [...directFiles, ...subFiles];
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
