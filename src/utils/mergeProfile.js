export function mergeScalar(existing, incoming) {
  if (existing === null || existing === undefined || existing === '') return incoming ?? existing;
  return existing;
}

export function mergeArrayField(existing, incoming, keyFn) {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing ?? [];
  const hasReal = arr => Array.isArray(arr) && arr.some(item => !!keyFn(item));
  if (!hasReal(existing)) return incoming;
  const existingKeys = new Set((existing ?? []).map(keyFn).filter(Boolean));
  const toAppend = incoming.filter(item => !existingKeys.has(keyFn(item)));
  return [...existing, ...toAppend];
}

export function mergeObjectField(existing, incoming) {
  const result = { ...(existing || {}) };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (result[k] === null || result[k] === undefined || result[k] === '') {
      result[k] = v;
    }
  }
  return result;
}

export function mergeClientData(client = {}, importData = {}, overwrite = false) {
  const ep = client.profile || {};
  const np = importData.profile || {};
  // When overwriting, only replace with a non-empty incoming value to avoid
  // clearing fields that the AI extraction left blank.
  const s  = (ex, inc) => overwrite ? (inc != null && inc !== '' ? inc : ex) : mergeScalar(ex, inc);
  const a  = (ex, inc, kf) => overwrite ? (inc ?? []) : mergeArrayField(ex, inc, kf);
  const o  = (ex, inc) => overwrite ? (inc ?? {}) : mergeObjectField(ex, inc);

  return {
    ...client,
    name:        s(client.name,        importData.name),
    email:       s(client.email,       importData.email),
    phone:       s(client.phone,       importData.phone),
    nationality: s(client.nationality, importData.nationality),
    type:        s(client.type,        importData.type),
    profile: {
      ...ep,
      sex:            s(ep.sex,            np.sex),
      dob:            s(ep.dob,            np.dob),
      birthplace:     s(ep.birthplace,     np.birthplace),
      passportNo:     s(ep.passportNo,     np.passportNo),
      passportExpiry: s(ep.passportExpiry, np.passportExpiry),
      auAddress:      s(ep.auAddress,      np.auAddress),
      maritalStatus:  s(ep.maritalStatus,  np.maritalStatus),
      chinaId:        s(ep.chinaId,        np.chinaId),
      nameZh:         s(ep.nameZh,         np.nameZh || importData.nameChinese),
      qq:             s(ep.qq,             np.qq),
      eaFileNo:       s(ep.eaFileNo,       np.eaFileNo),
      consultant:     s(ep.consultant,     np.consultant),
      visaTarget:     s(ep.visaTarget,     np.visaTarget),
      currentStatus:  s(ep.currentStatus,  np.currentStatus),
      visaHistory:       a(ep.visaHistory,       np.visaHistory,       v => v.applicationNo || v.appNo),
      skillsAssessments: a(ep.skillsAssessments, np.skillsAssessments, s => s.appId),
      caseTimeline:      a(ep.caseTimeline,       np.caseTimeline,      t => `${t.date}|${t.event}`),
      keyIssues:         a(ep.keyIssues,          np.keyIssues,         i => i.item),
      addressHistory:    a(ep.addressHistory,     np.addressHistory,    x => `${x.from}|${x.address}`),
      employmentHistory: a(ep.employmentHistory,  np.employmentHistory, x => `${x.from}|${x.company}`),
      documents:         a(ep.documents,          np.documents,         d => d.name),
      nextSteps:         a(ep.nextSteps || [],     np.nextSteps || [],   x => x),
      sponsor:          o(ep.sponsor,          np.sponsor),
      character:        o(ep.character,        np.character),
      marriage:         o(ep.marriage,         np.marriage),
      serviceAgreement: o(ep.serviceAgreement, np.serviceAgreement),
    },
  };
}
