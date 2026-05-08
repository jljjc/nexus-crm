// api/drive-rename.js
// Rename files in Google Drive using the Drive API v3 PATCH endpoint.
// Expects: { accessToken, renames: [{ id, newName }] }
export const config = {
  api: { bodyParser: { sizeLimit: '256kb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { accessToken, renames } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: 'Missing accessToken' });
  if (!Array.isArray(renames) || renames.length === 0)
    return res.status(400).json({ error: 'Missing renames array' });

  const results = [];
  for (const { id, newName } of renames) {
    if (!id || !newName) { results.push({ id, success: false, error: 'Missing id or newName' }); continue; }
    try {
      const r = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: newName }),
        }
      );
      if (r.ok) {
        const data = await r.json();
        results.push({ id, success: true, newName: data.name });
      } else {
        const errText = await r.text().catch(() => '');
        results.push({ id, success: false, error: `Drive ${r.status}: ${errText.slice(0, 200)}` });
      }
    } catch (e) {
      results.push({ id, success: false, error: e.message });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  return res.json({ succeeded, failed: results.length - succeeded, results });
}
