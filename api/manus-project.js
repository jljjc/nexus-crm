// api/manus-project.js — Per-case Manus Project management for NexusCRM
//
// Endpoints:
//   POST /api/manus-project
//     body: { action: 'create', caseId, caseName, clientName, visaSubclass, agentName }
//     → creates a Manus Project for the case, injects ozsky-migration-agent skill
//     → returns { project_id, project_url }
//
//   POST /api/manus-project
//     body: { action: 'get', project_id }
//     → returns project details (name, url, task count)
//
// The caller (CaseAI.jsx) stores the returned project_id in the case record
// via Supabase so it persists across sessions.
//
// Environment variables:
//   MANUS_API_KEY   — Manus API key
//   OZSKY_SKILL_ID  — ozsky-migration-agent skill ID (default: TL28qGY3nbvMVFyvNASG8u)

const MANUS_BASE = 'https://api.manus.ai';
const OZSKY_SKILL_ID = 'TL28qGY3nbvMVFyvNASG8u';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.MANUS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MANUS_API_KEY not configured' });
  }

  const body = req.body || {};
  const { action } = body;

  // ── GET project details ──────────────────────────────────────────────────
  if (action === 'get') {
    const { project_id } = body;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    try {
      const r = await fetch(`${MANUS_BASE}/v2/project.list`, {
        headers: { 'x-manus-api-key': apiKey },
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error?.message || 'Manus API error');

      const project = (data.projects || []).find(p => p.project_id === project_id);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      return res.status(200).json({
        project_id: project.project_id,
        name: project.name,
        project_url: `https://manus.im/app/projects/${project.project_id}`,
        task_count: project.task_count || 0,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── CREATE project for a case ────────────────────────────────────────────
  if (action === 'create') {
    const { caseId, caseName, clientName, visaSubclass, agentName } = body;
    if (!caseId || !clientName) {
      return res.status(400).json({ error: 'caseId and clientName are required' });
    }

    const projectName = `[NexusCRM] ${clientName} — ${visaSubclass || 'Visa'} Case`;
    const projectInstruction = buildProjectInstruction({ caseName, clientName, visaSubclass, agentName, caseId });

    try {
      // 1. Create the Manus Project
      const createRes = await fetch(`${MANUS_BASE}/v2/project.create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-manus-api-key': apiKey,
        },
        body: JSON.stringify({
          name: projectName,
          instruction: projectInstruction,
          enable_skills: [OZSKY_SKILL_ID],
        }),
      });

      const createData = await createRes.json();
      if (!createData.ok) {
        throw new Error(createData.error?.message || `Manus project.create error ${createRes.status}`);
      }

      const projectId = createData.project_id;
      const projectUrl = `https://manus.im/app/projects/${projectId}`;

      return res.status(200).json({
        project_id: projectId,
        project_url: projectUrl,
        name: projectName,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// Build a rich project instruction that gives the AI full case context
function buildProjectInstruction({ caseName, clientName, visaSubclass, agentName, caseId }) {
  return `You are an AI assistant embedded in NexusCRM, the case management system for Ozsky International migration agency in Perth, Western Australia.

## Case Context
- **Client:** ${clientName}
- **Case:** ${caseName || `${clientName} — ${visaSubclass}`}
- **Visa Subclass:** ${visaSubclass || 'Unknown'}
- **Assigned Agent:** ${agentName || 'Ozsky Team'}
- **CRM Case ID:** ${caseId}

## Your Role
You are a specialist Australian migration AI assistant with deep knowledge of:
- Visa subclass ${visaSubclass || 'requirements'} under the Migration Act 1958
- Department of Home Affairs (DHA) policy and PAM3 guidelines
- ANZSCO occupation codes and skills assessment pathways
- State/Territory nomination requirements (especially Western Australia)
- Ozsky International's internal SOPs, fee structures, and client communication standards

## Instructions
- Always respond in the context of this specific case
- Reference relevant visa criteria, policy instruments, and legislative provisions where applicable
- Flag any compliance risks, missing documents, or procedural issues clearly
- Use Australian English spelling and professional but approachable tone
- When drafting client communications, offer both English and Simplified Chinese versions
- Do not provide legal advice — frame responses as professional migration guidance

## Tools Available
You have access to the ozsky-migration-agent skill which contains Ozsky's SOPs, templates, and visa knowledge base.`;
}
