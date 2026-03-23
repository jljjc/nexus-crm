import { mergeScalar, mergeArrayField, mergeObjectField, mergeClientData } from './mergeProfile';

// ── mergeScalar ──────────────────────────────────────────────────────────────
test('mergeScalar: keeps existing non-empty value', () => {
  expect(mergeScalar('existing', 'incoming')).toBe('existing');
});
test('mergeScalar: uses incoming when existing is null', () => {
  expect(mergeScalar(null, 'incoming')).toBe('incoming');
});
test('mergeScalar: uses incoming when existing is empty string', () => {
  expect(mergeScalar('', 'incoming')).toBe('incoming');
});

// ── mergeArrayField ──────────────────────────────────────────────────────────
const keyFn = v => v.applicationNo;

test('mergeArrayField: replaces skeleton array (no real entries)', () => {
  const existing = [{ applicationNo: '', visaType: '' }];
  const incoming = [{ applicationNo: 'A1', visaType: '500' }];
  const result = mergeArrayField(existing, incoming, keyFn);
  expect(result).toEqual(incoming);
});

test('mergeArrayField: appends new entries without duplicates', () => {
  const existing = [{ applicationNo: 'A1', visaType: '500' }];
  const incoming = [
    { applicationNo: 'A1', visaType: '500' }, // duplicate
    { applicationNo: 'A2', visaType: '189' }, // new
  ];
  const result = mergeArrayField(existing, incoming, keyFn);
  expect(result).toHaveLength(2);
  expect(result[1].applicationNo).toBe('A2');
});

test('mergeArrayField: returns incoming when existing is empty array', () => {
  expect(mergeArrayField([], [{ applicationNo: 'A1' }], keyFn))
    .toEqual([{ applicationNo: 'A1' }]);
});

// ── mergeObjectField ─────────────────────────────────────────────────────────
test('mergeObjectField: fills null sub-fields', () => {
  const result = mergeObjectField(
    { name: 'Alice', passportNo: null },
    { name: 'Bob', passportNo: 'P123' },
  );
  expect(result.name).toBe('Alice');     // kept
  expect(result.passportNo).toBe('P123'); // filled
});

// ── mergeClientData ──────────────────────────────────────────────────────────
test('mergeClientData: does not overwrite populated scalar', () => {
  const client = { name: 'Alice', nationality: 'Chinese', profile: {} };
  const imp = { name: 'Bob', nationality: 'Australian', profile: {} };
  const result = mergeClientData(client, imp);
  expect(result.name).toBe('Alice');
  expect(result.nationality).toBe('Chinese');
});

test('mergeClientData: overwrites when overwrite=true', () => {
  const client = { name: 'Alice', profile: {} };
  const imp = { name: 'Bob', profile: {} };
  const result = mergeClientData(client, imp, true);
  expect(result.name).toBe('Bob');
});

test('mergeClientData: appends to visaHistory without duplicates', () => {
  const client = {
    name: 'Alice', profile: {
      visaHistory: [{ applicationNo: 'A1', visaType: '500' }],
    },
  };
  const imp = {
    profile: {
      visaHistory: [
        { applicationNo: 'A1', visaType: '500' },
        { applicationNo: 'A2', visaType: '600' },
      ],
    },
  };
  const result = mergeClientData(client, imp);
  expect(result.profile.visaHistory).toHaveLength(2);
});
