// api/generate-contract.js
// Place at: /api/generate-contract.js in your Vercel project root
// Run: npm install docx   (add to package.json dependencies)

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak, LevelFormat, HeadingLevel, UnderlineType
} = require('docx');

const TEAL   = '1A7EA6';
const DARK   = '1C2B3A';
const LIGHT  = 'F0F7FB';
const border = { style: BorderStyle.SINGLE, size: 6, color: 'C0D8E8' };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };
const W = 9360; // content width DXA (A4 with 1.5cm margins each side ~ 9360)

// ── helpers ──────────────────────────────────────────────────────────────────
const p = (text, opts = {}) => new Paragraph({
  alignment: opts.align || AlignmentType.LEFT,
  spacing: { before: opts.before ?? 80, after: opts.after ?? 80 },
  children: [new TextRun({
    text: text || '',
    bold: opts.bold,
    italics: opts.italic,
    size: opts.size || 20,
    font: 'Arial',
    color: opts.color || DARK,
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
  })]
});

const heading = (text, level = 1) => new Paragraph({
  spacing: { before: 200, after: 100 },
  children: [new TextRun({
    text, bold: true, size: level === 1 ? 24 : 22,
    font: 'Arial', color: TEAL,
    underline: level === 1 ? { type: UnderlineType.SINGLE } : undefined
  })]
});

const twoColRow = (label, value, headerRow = false) => new TableRow({
  tableHeader: headerRow,
  children: [
    new TableCell({
      borders, width: { size: 3000, type: WidthType.DXA }, margins: cellMargins,
      shading: { fill: headerRow ? TEAL : 'E8F4FA', type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, font: 'Arial', color: headerRow ? 'FFFFFF' : DARK })] })]
    }),
    new TableCell({
      borders, width: { size: 6360, type: WidthType.DXA }, margins: cellMargins,
      children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: 19, font: 'Arial', color: DARK })] })]
    })
  ]
});

const spacer = (n = 1) => Array.from({ length: n }, () => p('', { size: 18, before: 0, after: 0 }));

const bullet = (text, numbered = false) => new Paragraph({
  spacing: { before: 60, after: 60 },
  numbering: { reference: numbered ? 'numbers' : 'bullets', level: 0 },
  children: [new TextRun({ text, size: 19, font: 'Arial', color: DARK })]
});

const subbullet = (text) => new Paragraph({
  spacing: { before: 40, after: 40 },
  numbering: { reference: 'alpha', level: 0 },
  children: [new TextRun({ text, size: 19, font: 'Arial', color: DARK })]
});

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    clientName, clientAddress, clientEmail, clientPhone,
    visaTypes, serviceDescription,
    totalFee, gstIncluded,
    paymentMode, // 'single' | 'two'
    payment1Amount, payment1Desc,
    payment2Amount, payment2Desc,
    contractDate, consultant, marn,
    disbursements = [], // [{item, estimatedCost}]
  } = req.body;

  const date = contractDate || new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  const gstNote = gstIncluded === true ? 'GST is included in all fees above.' : 'GST is not applicable on this transaction.';
  const feeBase = parseFloat((totalFee || '0').replace(/[^0-9.]/g, ''));
  const gstAmount = gstIncluded ? (feeBase / 11).toFixed(2) : '0.00';
  const subTotal = gstIncluded ? (feeBase - parseFloat(gstAmount)).toFixed(2) : feeBase.toFixed(2);
  const visaLabel = Array.isArray(visaTypes) ? visaTypes.join(' / ') : visaTypes || '';

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
        },
        {
          reference: 'numbers',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
        },
        {
          reference: 'alpha',
          levels: [{ level: 0, format: LevelFormat.LOWER_LETTER, text: '(%1)', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }]
        },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }
        }
      },
      children: [

        // ── HEADER ─────────────────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 6 } },
          children: [
            new TextRun({ text: 'OZSKY INTERNATIONAL', bold: true, size: 36, font: 'Arial', color: TEAL }),
            new TextRun({ text: '\n', break: 1 }),
            new TextRun({ text: 'Education and Migration Agency', size: 22, font: 'Arial', color: '555555' }),
          ]
        }),
        p('Level 2, 731 Hay St, Perth WA 6000  |  +61 430 270 005  |  l.jiang@ozs.com.au', { align: AlignmentType.CENTER, size: 18, color: '777777', before: 100, after: 400 }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 300, after: 120 },
          children: [new TextRun({ text: 'Migration Agent Clients Agreement', bold: true, size: 40, font: 'Arial', color: DARK })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 600 },
          children: [new TextRun({ text: 'Immigration Advisory & Service', size: 26, font: 'Arial', color: TEAL, italics: true })]
        }),

        // ── 1. MIGRATION FIRM DETAILS ─────────────────────────────────────────
        heading('MIGRATION FIRM (\'AGENT\') DETAILS'),
        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: [3000, 6360],
          rows: [
            twoColRow('Name', 'OZSKY PERTH PTY LTD T/A OZSKY INTERNATIONAL'),
            twoColRow('ABN', '56 614 271 180'),
            twoColRow('Business Address', 'Level 2, 731 Hay St, PERTH, WA 6000'),
            twoColRow('Email', 'l.jiang@ozs.com.au'),
            twoColRow('Phone', '0430 270 005'),
            twoColRow('MARN', marn || '1800784'),
          ]
        }),

        ...spacer(2),

        // ── 2. CLIENT DETAILS ─────────────────────────────────────────────────
        heading('CLIENT DETAILS'),
        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: [3000, 6360],
          rows: [
            twoColRow('Name', clientName || ''),
            twoColRow('Address', clientAddress || ''),
            twoColRow('Email', clientEmail || ''),
            twoColRow('Phone / Mobile', clientPhone || ''),
          ]
        }),

        ...spacer(2),

        // ── 3. SERVICE CATEGORY ───────────────────────────────────────────────
        heading('SERVICE CATEGORY'),
        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: [3000, 6360],
          rows: [
            twoColRow('Visa Application', 'Visa Category / Class / Subclass: ' + visaLabel),
            twoColRow('Services Included', serviceDescription || 'Skills assessment, EOI, State Nomination and Visa Application'),
          ]
        }),

        ...spacer(2),

        // ── FEES ──────────────────────────────────────────────────────────────
        heading('FEES & CHARGES'),
        p('Fees and charges are set out in the SCHEDULE OF FEES below. All fees must be paid in accordance with the Payment Method and Structure.', { size: 19 }),

        ...spacer(1),

        // ── 4. WARNINGS ───────────────────────────────────────────────────────
        heading('WARNINGS'),
        p('Prior to signing this Agreement, you need to understand that it is intended to be legally binding and that each of us will be expected to comply with its terms. The Agreement is intended to comply with the requirements of the Migration (Migration Agents Code of Conduct) Regulations 2021 (1 March 2022 Code of Conduct). By signing the Agreement, you agree that the Agreement is fully compliant and that the fee is reasonable in all circumstances. You also acknowledge that in the event of an unforeseen or undisclosed event material to the application, it may be necessary to vary this Agreement to take account of the additional work.', { size: 19, italic: true }),

        // Page break before T&C
        new Paragraph({ children: [new PageBreak()] }),

        // ── 5. TERMS AND CONDITIONS ───────────────────────────────────────────
        heading('TERMS AND CONDITIONS'),

        // 1. Appointment
        p('1.  APPOINTMENT OF AGENT', { bold: true, size: 20 }),
        p('The Client appoints Ozsky Perth Pty Ltd [ABN 56 614 271 180] as the Agent to represent the Client to perform the services described in this Agreement.', { size: 19, before: 40 }),
        ...spacer(1),

        // 2. Code of Conduct
        p('2.  CODE OF CONDUCT', { bold: true, size: 20 }),
        p('The Agent must comply with the Migration (Migration Agents Code of Conduct) Regulations 2021 (\'the Code\'), which came into effect on 1 March 2022.', { size: 19, before: 40 }),
        subbullet('The Agent guarantees that the Client will be provided a copy of the Code immediately upon request. It is also available at www.mara.gov.au.'),
        subbullet('If the Code is amended in a way that is inconsistent with this Agreement, the Agent and Client agree to vary this Agreement to comply with the new Code.'),
        ...spacer(1),

        // 3. Services
        p('3.  SERVICES TO BE PROVIDED', { bold: true, size: 20 }),
        p('The services to be provided under this Agreement include the following:', { size: 19, before: 40 }),
        subbullet('Provide advice relating to the Client\'s migration goals and their choice of visa category;'),
        subbullet('Provide frank and candid advice regarding the prospects of success. The Agent does not guarantee the success of an application;'),
        subbullet('Analyse current immigration laws relating to the nominated visa category or review application;'),
        subbullet('Assist in the completion and/or checking of relevant application forms;'),
        subbullet('Provide advice and assistance relating to documentation required to support the application;'),
        subbullet('Prepare any necessary supporting submissions to the Department or review body;'),
        subbullet('Submit the application to the Department or review body for processing as soon as possible;'),
        subbullet('Keep the Client informed of the developments concerning the application\'s progress;'),
        subbullet('Promptly advise the Client of any communications from the Department or review body;'),
        subbullet('Advise the Client promptly of the outcome of the application;'),
        subbullet('Provide post-grant migration advice regarding visa conditions and requirements if requested.'),
        ...spacer(1),

        // 4. Agent Obligations
        p('4.  AGENT OBLIGATIONS', { bold: true, size: 20 }),
        subbullet('All immigration assistance will be provided by migration agents or associates as directed by the Agent;'),
        subbullet('All migration agents are registered with the Office of the Migration Agents Registration Authority (OMARA);'),
        subbullet('The Agent maintains the required level of Professional Indemnity Insurance;'),
        subbullet('The Agent will act in accordance with the law and the best interests of the Client and deal with the Client competently, diligently and fairly;'),
        subbullet('The Agent will provide courteous and attentive service;'),
        subbullet('The Agent will, on request, provide the Client with a copy of their application and any related documents — the Agent is entitled to charge a reasonable amount for such copies;'),
        subbullet('The Agent will advise the Client in writing if, in the Agent\'s opinion, the application is vexatious or grossly unfounded.'),
        ...spacer(1),

        // 5. Client Agrees
        p('5.  THE CLIENT AGREES THAT:', { bold: true, size: 20 }),
        subbullet('The Agent is able to advise the Client about immigration law at a particular point in time but is unable to predict future changes in the law;'),
        subbullet('The Client will respond promptly to request(s) by the Agent for further information or documents;'),
        subbullet('The Agent will be under no obligation to submit the Client\'s application to the Department or review body until payment has been made in full for all fees due at that stage;'),
        subbullet('The final decision on an application submitted to the Department is beyond the Agent\'s control. The Agent has not guaranteed the success of any application;'),
        subbullet('All information provided to the Agent is true and current to the best of the Client\'s knowledge and belief. If the Agent reasonably believes that the Client has provided false information or documents, the Agent has the right to terminate the service;'),
        subbullet('The Client will, during the processing of an application, notify the Agent of any material changes in the circumstances of the Client or the Client\'s immediate family.'),
        ...spacer(1),

        // 6. Destruction of Files
        p('6.  RETENTION AND DESTRUCTION OF FILES', { bold: true, size: 20 }),
        p('The Agent must keep all documents and records for 7 years after the date of the last action on the file. After that period, the Agent may destroy files in accordance with the Code.', { size: 19, before: 40 }),
        p('On completion or termination of this Agreement, all documents to which the Client is entitled will be returned within 14 days of a written request.', { size: 19 }),
        ...spacer(1),

        // 7. Limitation of Liability
        p('7.  LIMITATIONS OF OUR LIABILITY', { bold: true, size: 20 }),
        p('The Agent\'s total aggregate liability will not exceed the maximum amount provided under the Professional Indemnity Insurance held by the Agent. The Agent will not be liable for loss arising from changes to the law affecting the Client\'s application after the application has been lodged.', { size: 19, before: 40 }),
        ...spacer(1),

        // 8. Termination & Refund Policy (NEW - required by 2022 Code)
        p('8.  TERMINATION OF AGREEMENT & REFUND POLICY', { bold: true, size: 20 }),
        p('Either party may terminate this Agreement by providing written notice. In the event of termination:', { size: 19, before: 40 }),
        subbullet('The Agent is entitled to retain fees only for services actually completed up to the date of termination;'),
        subbullet('Any client money held by the Agent for services not yet rendered must be refunded to the Client within 14 days of termination, together with a Statement of Services detailing all work performed;'),
        subbullet('The Agent must notify the Department of Home Affairs or relevant review authority of the termination no later than 14 days after termination takes effect (section 57 of the Code);'),
        subbullet('The Agent is not obliged to continue doing work if: the Client does not pay fees when due; the Client does not provide adequate and timely instructions; the Client engages another agent without consent; or there is a conflict of interest.'),
        ...spacer(1),

        // 9. Confidentiality
        p('9.  CONFIDENTIALITY', { bold: true, size: 20 }),
        subbullet('The Agent will preserve the confidentiality of the Client and will not disclose confidential information without the Client\'s written consent unless required by law;'),
        subbullet('The Agent will preserve the confidentiality of the Client\'s medical records and documents in accordance with the Privacy Act 1988.'),
        ...spacer(1),

        // 10. Disputes
        p('10. RESOLUTION OF DISPUTES', { bold: true, size: 20 }),
        subbullet('If a dispute arises, the parties agree to discuss it with the aim of reaching a mutually acceptable agreement in writing within 21 days;'),
        subbullet('If the parties cannot reach an agreement within 21 days, the parties agree to refer the matter to mediation or alternative dispute resolution available in their jurisdiction;'),
        subbullet('Complaints may also be made to the Office of the Migration Agents Registration Authority (OMARA) at www.mara.gov.au.'),
        ...spacer(1),

        // 11. Governing Law
        p('11. GOVERNING LAW', { bold: true, size: 20 }),
        p('The governing law of this Agreement is that of Western Australia, Australia.', { size: 19, before: 40 }),
        ...spacer(1),

        // ── NEW CLAUSE: Consumer Guide (required s42(3)(d) 2022 Code) ──────────
        p('12. CONSUMER GUIDE ACKNOWLEDGMENT', { bold: true, size: 20, color: TEAL }),
        p('The Client acknowledges receipt of the Consumer Guide for Migration Services published by the OMARA (available at www.mara.gov.au). The Client confirms that the Consumer Guide has been provided to them prior to or at the time of signing this Agreement, as required by section 42(3)(d) of the 1 March 2022 Code of Conduct.', { size: 19, before: 40 }),
        ...spacer(1),

        // ── NEW CLAUSE: Disbursements (required s47 2022 Code) ────────────────
        p('13. DISBURSEMENTS', { bold: true, size: 20, color: TEAL }),
        p('The following government charges and third-party fees are payable by the Client directly and are NOT included in the professional fees above. These are estimates only and may vary:', { size: 19, before: 40 }),

        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: [6000, 3360],
          rows: [
            new TableRow({
              children: [
                new TableCell({ borders, width: { size: 6000, type: WidthType.DXA }, margins: cellMargins,
                  shading: { fill: TEAL, type: ShadingType.CLEAR },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Disbursement Item', bold: true, size: 19, font: 'Arial', color: 'FFFFFF' })] })] }),
                new TableCell({ borders, width: { size: 3360, type: WidthType.DXA }, margins: cellMargins,
                  shading: { fill: TEAL, type: ShadingType.CLEAR },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Estimated Cost (AUD)', bold: true, size: 19, font: 'Arial', color: 'FFFFFF' })] })] }),
              ]
            }),
            ...( disbursements.length > 0 ? disbursements : [
              { item: 'Skills Assessment fee (e.g. Engineers Australia)', estimatedCost: 'Approx. $835 – $1,175' },
              { item: 'Visa application charge (VAC) – Primary applicant', estimatedCost: 'Approx. $4,640 – $7,160' },
              { item: 'Visa application charge (VAC) – Secondary applicant (if applicable)', estimatedCost: 'Approx. $1,160 – $1,790' },
              { item: 'Police clearance certificate (AFP or overseas)', estimatedCost: 'Approx. $42 – $100' },
              { item: 'Medical examination (eMedical)', estimatedCost: 'Approx. $300 – $400' },
              { item: 'State nomination application fee (if applicable)', estimatedCost: 'Varies by state' },
              { item: 'Translation of documents (if applicable)', estimatedCost: 'At cost' },
            ]).map(d => new TableRow({
              children: [
                new TableCell({ borders, width: { size: 6000, type: WidthType.DXA }, margins: cellMargins,
                  children: [new Paragraph({ children: [new TextRun({ text: d.item, size: 19, font: 'Arial', color: DARK })] })] }),
                new TableCell({ borders, width: { size: 3360, type: WidthType.DXA }, margins: cellMargins,
                  children: [new Paragraph({ children: [new TextRun({ text: d.estimatedCost, size: 19, font: 'Arial', color: DARK })] })] }),
              ]
            }))
          ]
        }),
        p('Note: Disbursement amounts are subject to change by the relevant government authority. The Client is responsible for making these payments directly.', { size: 18, italic: true, color: '777777' }),

        // Page break before Schedule of Fees
        new Paragraph({ children: [new PageBreak()] }),

        // ── SCHEDULE OF FEES ──────────────────────────────────────────────────
        heading('SCHEDULE OF FEES'),

        // Fee type
        p('1.  FEE TYPE', { bold: true, size: 20 }),
        p(paymentMode === 'single' ? 'Lump Sum — single payment' : `Lump Sum — paid by ${paymentMode === 'two' ? '2' : '3'} instalments`, { size: 19, before: 40 }),
        ...spacer(1),

        // GST
        p('2.  GST', { bold: true, size: 20 }),
        p(gstIncluded ? 'GST is applicable and payable on this transaction.' : 'GST is not payable on this transaction.', { size: 19, before: 40 }),
        ...spacer(1),

        // Professional Fee
        p('3.  PROFESSIONAL FEE ESTIMATE', { bold: true, size: 20 }),
        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: [6000, 3360],
          rows: [
            new TableRow({
              children: [
                new TableCell({ borders, width: { size: 6000, type: WidthType.DXA }, margins: cellMargins,
                  shading: { fill: TEAL, type: ShadingType.CLEAR },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, size: 19, font: 'Arial', color: 'FFFFFF' })] })] }),
                new TableCell({ borders, width: { size: 3360, type: WidthType.DXA }, margins: cellMargins,
                  shading: { fill: TEAL, type: ShadingType.CLEAR },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Amount (AUD)', bold: true, size: 19, font: 'Arial', color: 'FFFFFF' })] })] }),
              ]
            }),
            new TableRow({ children: [
              new TableCell({ borders, width: { size: 6000, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: 'Professional Agent Fee', size: 19, font: 'Arial' })] })] }),
              new TableCell({ borders, width: { size: 3360, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: `$ ${subTotal}`, size: 19, font: 'Arial' })] })] }),
            ]}),
            ...(gstIncluded ? [new TableRow({ children: [
              new TableCell({ borders, width: { size: 6000, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: 'GST (10%)', size: 19, font: 'Arial' })] })] }),
              new TableCell({ borders, width: { size: 3360, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: `$ ${gstAmount}`, size: 19, font: 'Arial' })] })] }),
            ]})] : []),
            new TableRow({ children: [
              new TableCell({ borders, width: { size: 6000, type: WidthType.DXA }, margins: cellMargins,
                shading: { fill: 'E8F4FA', type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: 'TOTAL LUMP SUM ESTIMATE', bold: true, size: 19, font: 'Arial', color: TEAL })] })] }),
              new TableCell({ borders, width: { size: 3360, type: WidthType.DXA }, margins: cellMargins,
                shading: { fill: 'E8F4FA', type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: `$ ${parseFloat(totalFee || '0').toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, bold: true, size: 19, font: 'Arial', color: TEAL })] })] }),
            ]})
          ]
        }),
        ...spacer(2),

        // Payment Structure
        p('4.  PAYMENT METHOD AND STRUCTURE', { bold: true, size: 20 }),
        p('Payment should be made by Direct Deposit or Credit Card (a surcharge of 2% applies to credit card payments). Please also refer to invoices received from the Agent.', { size: 19, before: 40 }),
        ...spacer(1),

        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: [2000, 2500, 4860],
          rows: [
            new TableRow({ children: [
              new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: cellMargins,
                shading: { fill: TEAL, type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: 'Payment', bold: true, size: 19, font: 'Arial', color: 'FFFFFF' })] })] }),
              new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, margins: cellMargins,
                shading: { fill: TEAL, type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: 'Amount', bold: true, size: 19, font: 'Arial', color: 'FFFFFF' })] })] }),
              new TableCell({ borders, width: { size: 4860, type: WidthType.DXA }, margins: cellMargins,
                shading: { fill: TEAL, type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: 'Block of Work', bold: true, size: 19, font: 'Arial', color: 'FFFFFF' })] })] }),
            ]}),
            ...(paymentMode === 'single' ? [
              new TableRow({ children: [
                new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'Full Payment', size: 19, font: 'Arial' })] })] }),
                new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: `$ ${payment1Amount || totalFee || '—'}`, size: 19, font: 'Arial' })] })] }),
                new TableCell({ borders, width: { size: 4860, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: payment1Desc || serviceDescription || '—', size: 19, font: 'Arial' })] })] }),
              ]})
            ] : [
              new TableRow({ children: [
                new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'Deposit (1st)', size: 19, font: 'Arial' })] })] }),
                new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: `$ ${payment1Amount || '—'}`, size: 19, font: 'Arial' })] })] }),
                new TableCell({ borders, width: { size: 4860, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: payment1Desc || '—', size: 19, font: 'Arial' })] })] }),
              ]}),
              new TableRow({ children: [
                new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: 'Instalment (2nd)', size: 19, font: 'Arial' })] })] }),
                new TableCell({ borders, width: { size: 2500, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: `$ ${payment2Amount || '—'}`, size: 19, font: 'Arial' })] })] }),
                new TableCell({ borders, width: { size: 4860, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: payment2Desc || '—', size: 19, font: 'Arial' })] })] }),
              ]}),
              new TableRow({ children: [
                new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: cellMargins,
                  shading: { fill: 'E8F4FA', type: ShadingType.CLEAR },
                  children: [new Paragraph({ children: [new TextRun({ text: 'Balance Total', bold: true, size: 19, font: 'Arial', color: TEAL })] })] }),
                new TableCell({ borders, width: { size: 7360, type: WidthType.DXA }, columnSpan: 2, margins: cellMargins,
                  shading: { fill: 'E8F4FA', type: ShadingType.CLEAR },
                  children: [new Paragraph({ children: [new TextRun({ text: `$ ${parseFloat(totalFee || '0').toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, bold: true, size: 19, font: 'Arial', color: TEAL })] })] }),
              ]}),
            ])
          ]
        }),

        // Page break before signatures
        new Paragraph({ children: [new PageBreak()] }),

        // ── SIGNATURES ────────────────────────────────────────────────────────
        heading('SIGNATURES'),

        p('By signing below, both parties agree to the terms of this Agreement and confirm that the Client has received a copy of the Consumer Guide for Migration Services (OMARA).', { size: 19 }),
        ...spacer(2),

        // Agent sig
        p('AGENT: OZSKY PERTH PTY LTD T/A OZSKY INTERNATIONAL', { bold: true, size: 20 }),
        ...spacer(1),
        new Table({
          width: { size: W, type: WidthType.DXA }, columnWidths: [4680, 4680],
          rows: [new TableRow({ children: [
            new TableCell({ borders: noBorders, width: { size: 4680, type: WidthType.DXA }, margins: cellMargins, children: [
              new Paragraph({ spacing: { before: 0, after: 600 }, children: [new TextRun({ text: 'Signature: ___________________________', size: 19, font: 'Arial' })] }),
              p(`Name: ${consultant || 'Liang Jiang'}`, { size: 19 }),
              p('Position: Principal Migration Agent', { size: 19 }),
              p(`Date: ${date}`, { size: 19 }),
            ]}),
            new TableCell({ borders: noBorders, width: { size: 4680, type: WidthType.DXA }, margins: cellMargins, children: [
              new Paragraph({ spacing: { before: 0, after: 600 }, children: [new TextRun({ text: 'Signature: ___________________________', size: 19, font: 'Arial' })] }),
              p(`Name: ${clientName || ''}`, { size: 19 }),
              p('Position: Client', { size: 19 }),
              new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: 'Date: ___________________________', size: 19, font: 'Arial' })] }),
            ]}),
          ]})]
        }),

        ...spacer(3),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: TEAL, space: 6 } },
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: 'Initial ________', size: 19, font: 'Arial', color: '777777' })]
        }),
        p('Ozsky Perth Pty Ltd T/A Ozsky International  |  MARN: ' + (marn || '1800784') + '  |  www.ozs.com.au', { align: AlignmentType.CENTER, size: 16, color: '999999' }),
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  const safeName = (clientName || 'Client').replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/ /g, '_');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Service_Agreement.docx"`);
  res.send(buffer);
};
