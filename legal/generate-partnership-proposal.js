const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, BorderStyle, WidthType,
        ShadingType, VerticalAlign, PageNumber, HeadingLevel, ImageRun } = require("docx");
const fs = require("fs");
const path = require("path");

const LOGO_PATH = path.join(__dirname, "Nhancio-logo.png");
const LOGO_BYTES = fs.readFileSync(LOGO_PATH);

// Nhancio brand palette (from nhancio.com + SP7 theme)
const C = {
  primary: "8B5CF6",
  primaryDark: "6D28D9",
  soft: "A78BFA",
  softLight: "C4B5FD",
  lavender: "E3D7FF",
  babyblue: "D9ECFF",
  mint: "CFFFE5",
  blush: "FADADD",
  peach: "FFE5B4",
  ink: "1F2937",
  muted: "4B5563",
  lightMuted: "6B7280",
  white: "FFFFFF",
  line: "E5E7EB",
  tableHeaderBg: "8B5CF6",
  tableAlt: "F5F3FF",
  softBg: "Faf5FF",
};

const PAGE_W = 12240;
const PAGE_H = 15840;
const MARGIN = 1080; // 0.75"
const CONTENT_W = PAGE_W - MARGIN * 2; // 10080

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thin = { style: BorderStyle.SINGLE, size: 8, color: C.line };
const thinBorders = { top: thin, bottom: thin, left: thin, right: thin };
const accentBottom = {
  top: noBorder,
  left: noBorder,
  right: noBorder,
  bottom: { style: BorderStyle.SINGLE, size: 24, color: C.primary },
};

function p(text, opts = {}) {
  const {
    bold = false, size = 22, color = C.ink, align = AlignmentType.LEFT,
    spacingBefore = 0, spacingAfter = 120, indent, font = "Arial",
    italic = false,
  } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { before: spacingBefore, after: spacingAfter, line: 276 },
    indent,
    children: [
      new TextRun({ text, bold, size, color, font, italics: italic }),
    ],
  });
}

function runs(parts, opts = {}) {
  const { align = AlignmentType.LEFT, spacingBefore = 0, spacingAfter = 120 } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { before: spacingBefore, after: spacingAfter, line: 276 },
    children: parts.map((part) =>
      new TextRun({
        text: part.text,
        bold: !!part.bold,
        italics: !!part.italics,
        size: part.size || 22,
        color: part.color || C.ink,
        font: "Arial",
      })
    ),
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: C.soft, space: 8 },
    },
    children: [new TextRun({ text, bold: true, size: 28, color: C.primaryDark, font: "Arial" })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: C.primary, font: "Arial" })],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 40, after: 60, line: 276 },
    children: [new TextRun({ text, size: 21, color: C.ink, font: "Arial" })],
  });
}

function bulletBoldLead(lead, rest, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 40, after: 60, line: 276 },
    children: [
      new TextRun({ text: lead, bold: true, size: 21, color: C.ink, font: "Arial" }),
      new TextRun({ text: rest, size: 21, color: C.ink, font: "Arial" }),
    ],
  });
}

function spacer(after = 120) {
  return new Paragraph({ spacing: { after }, children: [] });
}

function cell(text, width, opts = {}) {
  const {
    bold = false, fill, color = C.ink, align = AlignmentType.LEFT,
    size = 20, vAlign = VerticalAlign.CENTER, borders = thinBorders,
  } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    verticalAlign: vAlign,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, bold, size, color, font: "Arial" })],
      }),
    ],
  });
}

function multiCell(paragraphs, width, opts = {}) {
  const { fill, borders = thinBorders, vAlign = VerticalAlign.TOP } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    verticalAlign: vAlign,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: paragraphs,
  });
}

function headerBar() {
  const logoCol = 720;
  const textCol = CONTENT_W - logoCol;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [logoCol, textCol],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: accentBottom,
            width: { size: logoCol, type: WidthType.DXA },
            shading: { fill: C.softBg, type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 0, right: 80 },
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    type: "png",
                    data: LOGO_BYTES,
                    transformation: { width: 28, height: 28 },
                    altText: {
                      title: "Nhancio",
                      description: "Nhancio company logo",
                      name: "nhancio-logo-header",
                    },
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: accentBottom,
            width: { size: textCol, type: WidthType.DXA },
            shading: { fill: C.softBg, type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 40, bottom: 40, left: 0, right: 0 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({ text: "NHANCIO", bold: true, size: 18, color: C.primary, font: "Arial" }),
                  new TextRun({ text: "  ·  ", size: 18, color: C.soft, font: "Arial" }),
                  new TextRun({ text: "MagicBox AI Partnership Proposal", size: 18, color: C.muted, font: "Arial" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function coverBand() {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: C.primary, type: ShadingType.CLEAR },
            margins: { top: 240, bottom: 280, left: 280, right: 280 },
            children: [
              new Paragraph({
                spacing: { after: 140 },
                children: [
                  new ImageRun({
                    type: "png",
                    data: LOGO_BYTES,
                    transformation: { width: 64, height: 64 },
                    altText: {
                      title: "Nhancio",
                      description: "Nhancio company logo",
                      name: "nhancio-logo-cover",
                    },
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: "PROJECT PARTNERSHIP PROPOSAL",
                    bold: true,
                    size: 18,
                    color: C.lavender,
                    font: "Arial",
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: "MagicBox AI",
                    bold: true,
                    size: 48,
                    color: C.white,
                    font: "Arial",
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: "Technology & Business Development Collaboration",
                    size: 24,
                    color: C.softLight,
                    font: "Arial",
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 120 },
                children: [
                  new TextRun({
                    text: "Nhancio Technologies  ×  Maruthi Technologies",
                    bold: true,
                    size: 22,
                    color: C.white,
                    font: "Arial",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function infoCard(label, value) {
  const w = Math.floor(CONTENT_W / 2) - 60;
  return new TableCell({
    borders: thinBorders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill: C.softBg, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: label, size: 16, color: C.primary, bold: true, font: "Arial" })],
      }),
      new Paragraph({
        children: [new TextRun({ text: value, size: 20, color: C.ink, font: "Arial" })],
      }),
    ],
  });
}

function roleCard(title, subtitle, items, fill) {
  const paras = [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: title, bold: true, size: 22, color: C.primaryDark, font: "Arial" })],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: subtitle, italic: true, size: 18, color: C.muted, font: "Arial" })],
    }),
    ...items.map(
      (t) =>
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: "›  ", size: 20, color: C.primary, font: "Arial" }),
            new TextRun({ text: t, size: 19, color: C.ink, font: "Arial" }),
          ],
        })
    ),
  ];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          multiCell(paras, CONTENT_W, { fill, borders: thinBorders }),
        ],
      }),
    ],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 22, color: C.ink },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: C.primaryDark },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: C.primary },
        paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "bullets2",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "bullets3",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "bullets4",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "bullets5",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "nextsteps",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "bullets6",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "bullets7",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "creditSteps",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [headerBar(), spacer(80)],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: {
                top: { style: BorderStyle.SINGLE, size: 8, color: C.lavender, space: 8 },
              },
              spacing: { before: 80 },
              tabStops: [{ type: "right", position: CONTENT_W }],
              children: [
                new TextRun({
                  text: "Confidential  ·  Nhancio × MagicBox AI",
                  size: 16,
                  color: C.lightMuted,
                  font: "Arial",
                }),
                new TextRun({ text: "\t", font: "Arial" }),
                new TextRun({ text: "Page ", size: 16, color: C.lightMuted, font: "Arial" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.lightMuted, font: "Arial" }),
                new TextRun({ text: " of ", size: 16, color: C.lightMuted, font: "Arial" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.lightMuted, font: "Arial" }),
              ],
            }),
          ],
        }),
      },
      children: [
        coverBand(),
        spacer(200),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [Math.floor(CONTENT_W / 2) - 60, Math.floor(CONTENT_W / 2) - 60],
          rows: [
            new TableRow({
              children: [
                infoCard("Document Type", "Partnership / Project Proposal"),
                infoCard("Date", "20 July 2026"),
              ],
            }),
          ],
        }),
        spacer(80),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [Math.floor(CONTENT_W / 2) - 60, Math.floor(CONTENT_W / 2) - 60],
          rows: [
            new TableRow({
              children: [
                infoCard("Prepared By", "Nhancio Technologies Pvt. Ltd."),
                infoCard("Product", "MagicBox AI (magicboxai.in)"),
              ],
            }),
          ],
        }),
        spacer(200),

        p(
          "This proposal outlines a collaboration between Nhancio Technologies (technology partner for MagicBox AI) and Maruthi Technologies (business development partner) to grow MagicBox AI through referred commercial business, with clearly defined roles, revenue-sharing terms, and mutual responsibilities.",
          { size: 21, color: C.muted, spacingAfter: 200 }
        ),

        // 1. Parties
        h1("1. Parties"),
        h2("1.1 Technology Partner"),
        runs([
          { text: "Nhancio Technologies Private Limited", bold: true },
          { text: " (“Nhancio”), represented for technology delivery by " },
          { text: "Didigam Nithin", bold: true },
          { text: " (“Nithin”)." },
        ]),
        bullet("Owns and develops the MagicBox AI platform and related technology."),
        bullet("Primary contact for product, engineering, infrastructure, and platform operations."),

        h2("1.2 Business Development Partner"),
        runs([
          { text: "Maruthi Technologies", bold: true },
          { text: " (“Maruthi”), responsible for go-to-market, client acquisition, demos, and relationship management for referred business." },
        ]),
        bullet("Sources and qualifies business opportunities for MagicBox AI."),
        bullet("Leads marketing, demos, and commercial conversations for referred accounts."),

        h2("1.3 Platform / Product"),
        runs([
          { text: "MagicBox AI", bold: true },
          { text: " — an AI marketing automation platform for brand-aware content generation, approval, scheduling, and publishing (“the Platform”)." },
        ]),

        // 2. Purpose
        h1("2. Purpose of Collaboration"),
        p("The Parties intend to combine Nhancio’s technology capability with Maruthi’s business development strength to:"),
        bullet("Acquire new customers and commercial opportunities for MagicBox AI through referrals and outreach."),
        bullet("Deliver a reliable product experience backed by continuous technology development."),
        bullet("Share economics fairly on revenue generated from referred business."),
        bullet("Establish clear ownership of roles so delivery, sales, and support do not overlap or stall."),

        // 3. Commercial terms
        h1("3. Commercial Terms"),
        h2("3.1 Profit Share on Referred Business"),
        p(
          "For all business acquired through referrals introduced by Maruthi Technologies, profits generated from that referred business shall be shared as follows:"
        ),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [5040, 2520, 2520],
          rows: [
            new TableRow({
              children: [
                cell("Allocation", 5040, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Party", 2520, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Share", 2520, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("Platform / Technology Partner", 5040, { fill: C.tableAlt }),
                cell("Nhancio / MagicBox AI", 2520, { fill: C.tableAlt, align: AlignmentType.CENTER }),
                cell("50%", 2520, { bold: true, fill: C.tableAlt, color: C.primaryDark, align: AlignmentType.CENTER, size: 24 }),
              ],
            }),
            new TableRow({
              children: [
                cell("Business Development Partner", 5040),
                cell("Maruthi Technologies", 2520, { align: AlignmentType.CENTER }),
                cell("50%", 2520, { bold: true, color: C.primaryDark, align: AlignmentType.CENTER, size: 24 }),
              ],
            }),
          ],
        }),
        spacer(160),

        p(
          "This 50% platform share applies specifically to profits arising from revenue generated by businesses / clients obtained through Maruthi’s referrals.",
          { size: 21, color: C.muted }
        ),

        h2("3.2 Scope of Shareable Economics"),
        bulletBoldLead("Included: ", "Subscription fees, usage fees, project fees, retainers, and other commercial revenue from referred clients, less agreed direct costs attributable to delivering that revenue."),
        bulletBoldLead("Excluded (unless agreed in writing): ", "Organic / inbound customers not introduced by Maruthi; prior Nhancio clients; pure R&D or internal use of the Platform."),
        bulletBoldLead("Definition to confirm: ", "Parties should finalise whether “profit” means net profit after direct costs (recommended) or a simple revenue split. Until defined, reporting will show both gross revenue and net after direct costs."),

        h2("3.3 Referral Attribution"),
        bullet("A client is “Referred” when Maruthi introduces the opportunity in writing (email / shared CRM) before a paid engagement starts."),
        bullet("Attribution window: 12 months from first introduction, unless Parties agree otherwise in writing."),
        bullet("If both Parties influenced the deal, attribution is agreed case-by-case in writing before contracting."),
        bullet("Nhancio maintains a simple referral log (client name, date introduced, status, revenue)."),

        h2("3.4 Settlement & Reporting"),
        bullet("Nhancio shares a monthly statement of referred revenue, direct costs, and calculated profit share."),
        bullet("Settlement within 15 business days after month-end (or as otherwise agreed)."),
        bullet("Either Party may request reasonable supporting invoices / payment records for referred accounts."),

        h2("3.5 Product Pricing (Monthly Plan)"),
        p(
          "MagicBox AI monthly plan pricing for this collaboration is aligned to the live product pricing as follows:"
        ),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [3360, 3360, 3360],
          rows: [
            new TableRow({
              children: [
                cell("Market", 3360, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Monthly Plan Price", 3360, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Notes", 3360, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("India / local listing", 3360, { fill: C.tableAlt }),
                cell("₹3,900 / month", 3360, { fill: C.tableAlt, bold: true, color: C.primaryDark, align: AlignmentType.CENTER, size: 22 }),
                cell("Listed as the ₹3,900 plan", 3360, { fill: C.tableAlt, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("USA", 3360),
                cell("$39 / month", 3360, { bold: true, color: C.primaryDark, align: AlignmentType.CENTER, size: 22 }),
                cell("Matches product pricing", 3360, { align: AlignmentType.CENTER }),
              ],
            }),
          ],
        }),
        spacer(120),
        p(
          "The ₹3,900 per month plan corresponds to the USA product price of $39 per month, keeping commercial messaging consistent across markets.",
          { size: 21, color: C.muted }
        ),

        h2("3.6 Credit Model"),
        h2("3.6.1 First-Week Credit Allocation"),
        p(
          "During the first week of a customer’s subscription or onboarding under this plan, the credit allocation is:"
        ),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [5040, 5040],
          rows: [
            new TableRow({
              children: [
                cell("Period", 5040, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Credits Allocated", 5040, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("First week", 5040, { fill: C.tableAlt, align: AlignmentType.CENTER }),
                cell("0 credits", 5040, { fill: C.tableAlt, bold: true, color: C.primaryDark, align: AlignmentType.CENTER, size: 24 }),
              ],
            }),
          ],
        }),
        spacer(120),

        h2("3.6.2 Credit Definition"),
        p("Credits on MagicBox AI are defined as follows:"),
        bullet("1 credit = 1 image.", "bullets6"),
        bullet("1 credit = 1 second of video.", "bullets6"),
        bullet("Example: a 30-second video requires 30 credits; a 15-second video requires 15 credits.", "bullets6"),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [3360, 3360, 3360],
          rows: [
            new TableRow({
              children: [
                cell("Output", 3360, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Credits Used", 3360, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Example", 3360, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("Image", 3360, { fill: C.tableAlt, align: AlignmentType.CENTER }),
                cell("1 credit", 3360, { fill: C.tableAlt, align: AlignmentType.CENTER, bold: true }),
                cell("1 image → 1 credit", 3360, { fill: C.tableAlt, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("Video", 3360, { align: AlignmentType.CENTER }),
                cell("1 credit / second", 3360, { align: AlignmentType.CENTER, bold: true }),
                cell("30s video → 30 credits", 3360, { align: AlignmentType.CENTER }),
              ],
            }),
          ],
        }),
        spacer(120),

        h2("3.6.3 Credit Calculation for the $39 Plan"),
        p(
          "Monthly credit allocation for the $39 / ₹3,900 plan is derived from underlying Gemini generation costs and a target platform margin:"
        ),
        new Paragraph({
          numbering: { reference: "creditSteps", level: 0 },
          spacing: { before: 40, after: 60, line: 276 },
          children: [
            new TextRun({
              text: "Determine the current cost of creating an image or video using Gemini Nano Banana or Gemini VO3.",
              size: 21,
              color: C.ink,
              font: "Arial",
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "creditSteps", level: 0 },
          spacing: { before: 40, after: 60, line: 276 },
          children: [
            new TextRun({
              text: "Set the cost of one credit based on that provider price.",
              size: 21,
              color: C.ink,
              font: "Arial",
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "creditSteps", level: 0 },
          spacing: { before: 40, after: 60, line: 276 },
          children: [
            new TextRun({
              text: "Apply a 50% margin to the $39 plan, providing roughly $19.50 worth of credit value to the customer.",
              size: 21,
              color: C.ink,
              font: "Arial",
            }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "creditSteps", level: 0 },
          spacing: { before: 40, after: 60, line: 276 },
          children: [
            new TextRun({
              text: "Allocate credits accordingly, using $1 per image and 1 credit per second of video, so the remaining margin can cover additional platform and operating costs.",
              size: 21,
              color: C.ink,
              font: "Arial",
            }),
          ],
        }),
        spacer(80),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [5040, 5040],
          rows: [
            new TableRow({
              children: [
                cell("Plan Economics ($39 plan)", 5040, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Value", 5040, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("Customer pays (USA)", 5040, { fill: C.tableAlt }),
                cell("$39 / month", 5040, { fill: C.tableAlt, align: AlignmentType.CENTER, bold: true }),
              ],
            }),
            new TableRow({
              children: [
                cell("Target margin", 5040),
                cell("50%", 5040, { align: AlignmentType.CENTER, bold: true }),
              ],
            }),
            new TableRow({
              children: [
                cell("Credit value pool (~50% of plan)", 5040, { fill: C.tableAlt }),
                cell("~ $19.50", 5040, { fill: C.tableAlt, align: AlignmentType.CENTER, bold: true, color: C.primaryDark }),
              ],
            }),
            new TableRow({
              children: [
                cell("Working allocation basis", 5040),
                cell("$1 per image; 1 credit = 1s video", 5040, { align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("First-week credits", 5040, { fill: C.tableAlt }),
                cell("0 credits", 5040, { fill: C.tableAlt, align: AlignmentType.CENTER, bold: true }),
              ],
            }),
          ],
        }),
        spacer(120),
        p(
          "Final monthly credit counts may be updated as Gemini Nano Banana / Gemini VO3 provider costs change, while preserving the ~50% margin principle on the $39 plan.",
          { size: 21, color: C.muted }
        ),

        // 4. Roles
        h1("4. Roles & Responsibilities"),
        p("Roles are divided so technology and commercial growth stay clear and accountable.", {
          size: 21,
          color: C.muted,
          spacingAfter: 160,
        }),

        roleCard(
          "A. Nithin / Nhancio Technologies — Technology Partner",
          "Owns product, engineering, infrastructure, and platform reliability for MagicBox AI.",
          [
            "Design, develop, and maintain MagicBox AI product features and roadmap.",
            "Own architecture, codebase, hosting, integrations, security, and performance.",
            "Set up environments, releases, bug fixes, and technical support for the Platform.",
            "Provide technical enablement for demos (staging access, feature walkthroughs, FAQ).",
            "Implement referral tracking fields / admin visibility where practical.",
            "Ensure Platform uptime, data protection, and compliance basics for customer use.",
            "Prepare technical proposals / SOWs when referred deals need custom work.",
            "Invoice referred clients (or designate billing entity) and calculate profit share.",
          ],
          C.lavender
        ),
        spacer(160),

        roleCard(
          "B. Maruthi Technologies — Business Development Partner",
          "Owns pipeline, marketing, demos, and commercial relationship development for referred business.",
          [
            "Identify, qualify, and introduce target customers and partners for MagicBox AI.",
            "Lead business development, outreach, and relationship management for referred accounts.",
            "Plan and run marketing activities, campaigns, events, and partner promotions (as agreed).",
            "Conduct product demos, discovery calls, and follow-ups with prospects.",
            "Gather customer requirements and feedback; relay priorities to Nhancio.",
            "Support commercial negotiation and deal closing in coordination with Nhancio.",
            "Maintain pipeline hygiene and introduce opportunities into the shared referral log.",
            "Represent MagicBox AI professionally; use only approved brand assets and claims.",
          ],
          C.babyblue
        ),
        spacer(160),

        h2("4.1 Shared / Joint Responsibilities"),
        bullet("Agree positioning, pricing guidance, and demo narrative for MagicBox AI.", "bullets2"),
        bullet("Join strategic account calls when both commercial and technical input are needed.", "bullets2"),
        bullet("Protect confidential information and customer data of both Parties and end clients.", "bullets2"),
        bullet("Escalate blockers early (product gaps, pricing exceptions, delivery risk).", "bullets2"),
        bullet("Review partnership performance monthly (pipeline, conversion, revenue, product feedback).", "bullets2"),

        h2("4.2 RACI Snapshot"),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [3600, 3240, 3240],
          rows: [
            new TableRow({
              children: [
                cell("Activity", 3600, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Nhancio / Nithin", 3240, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
                cell("Maruthi Technologies", 3240, { bold: true, fill: C.tableHeaderBg, color: C.white, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("Product development", 3600, { fill: C.tableAlt }),
                cell("Accountable", 3240, { fill: C.tableAlt, align: AlignmentType.CENTER, bold: true }),
                cell("Consulted", 3240, { fill: C.tableAlt, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("Marketing & outreach", 3600),
                cell("Consulted", 3240, { align: AlignmentType.CENTER }),
                cell("Accountable", 3240, { align: AlignmentType.CENTER, bold: true }),
              ],
            }),
            new TableRow({
              children: [
                cell("Demos & discovery", 3600, { fill: C.tableAlt }),
                cell("Support", 3240, { fill: C.tableAlt, align: AlignmentType.CENTER }),
                cell("Accountable", 3240, { fill: C.tableAlt, align: AlignmentType.CENTER, bold: true }),
              ],
            }),
            new TableRow({
              children: [
                cell("Pricing & contracting", 3600),
                cell("Accountable", 3240, { align: AlignmentType.CENTER, bold: true }),
                cell("Responsible / Support", 3240, { align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("Customer technical delivery", 3600, { fill: C.tableAlt }),
                cell("Accountable", 3240, { fill: C.tableAlt, align: AlignmentType.CENTER, bold: true }),
                cell("Informed", 3240, { fill: C.tableAlt, align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell("Referral tracking & payouts", 3600),
                cell("Accountable", 3240, { align: AlignmentType.CENTER, bold: true }),
                cell("Responsible (intros)", 3240, { align: AlignmentType.CENTER }),
              ],
            }),
          ],
        }),

        // 5. IP
        h1("5. Intellectual Property"),
        bullet("MagicBox AI product, source code, trademarks, designs, and documentation remain the exclusive IP of Nhancio / the Platform owner.", "bullets3"),
        bullet("Maruthi receives a limited right to market, demo, and promote MagicBox AI for the purposes of this collaboration.", "bullets3"),
        bullet("Customer data belongs to the respective customer; each Party will handle it only as needed to perform its role.", "bullets3"),
        bullet("Materials created jointly for sales (pitch decks, case studies) may be co-branded with prior written approval.", "bullets3"),

        // 6. Confidentiality
        h1("6. Confidentiality & Brand Use"),
        bullet("Both Parties will keep non-public business, pricing, customer, and technical information confidential.", "bullets4"),
        bullet("Maruthi will use only approved MagicBox AI / Nhancio logos, claims, and pricing guidance in marketing and demos.", "bullets4"),
        bullet("Neither Party will publicly announce the partnership without mutual written consent (except as required by law).", "bullets4"),

        // 7. Term
        h1("7. Term, Review & Termination"),
        bullet("Initial term: 12 months from the Effective Date, renewable by mutual written agreement.", "bullets5"),
        bullet("Either Party may terminate for convenience with 30 days’ written notice.", "bullets5"),
        bullet("Either Party may terminate immediately for material breach not cured within 15 days of notice.", "bullets5"),
        bullet("On termination, profit share remains payable on referred business already contracted during the attribution window, unless Parties agree otherwise in writing.", "bullets5"),
        bullet("Parties will hold a quarterly business review covering pipeline, revenue, product feedback, and role clarity.", "bullets5"),

        // 8. Suggested additions (already light-touch in doc; call out open points)
        h1("8. Open Points to Finalise"),
        p("The following items are recommended to lock before signing a binding agreement:", {
          size: 21,
          color: C.muted,
        }),
        bullet("Profit vs revenue definition, and which direct costs are deductible."),
        bullet("Whether Maruthi’s share is on SaaS subscriptions only, or also on custom implementation fees."),
        bullet("Exclusivity (territory / segment) — exclusive, non-exclusive, or category-exclusive."),
        bullet("Minimum activity expectations (e.g., monthly demos / qualified intros), if any."),
        bullet("Who signs customer contracts and who holds receivable risk."),
        bullet("Support ownership after sale (L1 commercial vs L2 technical)."),
        bullet("Governing law and dispute resolution (recommended: Hyderabad, Telangana, India)."),

        // 9. Next steps
        h1("9. Proposed Next Steps"),
        new Paragraph({
          numbering: { reference: "nextsteps", level: 0 },
          spacing: { before: 40, after: 60 },
          children: [new TextRun({ text: "Align on commercial definition (profit vs revenue) and attribution rules.", size: 21, font: "Arial", color: C.ink })],
        }),
        new Paragraph({
          numbering: { reference: "nextsteps", level: 0 },
          spacing: { before: 40, after: 60 },
          children: [new TextRun({ text: "Confirm roles table and primary contacts for both Parties.", size: 21, font: "Arial", color: C.ink })],
        }),
        new Paragraph({
          numbering: { reference: "nextsteps", level: 0 },
          spacing: { before: 40, after: 60 },
          children: [new TextRun({ text: "Set up shared referral log / CRM process.", size: 21, font: "Arial", color: C.ink })],
        }),
        new Paragraph({
          numbering: { reference: "nextsteps", level: 0 },
          spacing: { before: 40, after: 60 },
          children: [new TextRun({ text: "Convert this proposal into a short Partnership / Referral Agreement for signature.", size: 21, font: "Arial", color: C.ink })],
        }),
        new Paragraph({
          numbering: { reference: "nextsteps", level: 0 },
          spacing: { before: 40, after: 60 },
          children: [new TextRun({ text: "Schedule kickoff: demo script, target segments, and first 30-day outreach plan.", size: 21, font: "Arial", color: C.ink })],
        }),

        // Signatures
        h1("10. Acceptance"),
        p(
          "By signing below, the Parties acknowledge they have reviewed this proposal and intend to proceed toward a formal agreement on these principles.",
          { size: 21, color: C.muted, spacingAfter: 240 }
        ),

        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: [Math.floor(CONTENT_W / 2) - 80, Math.floor(CONTENT_W / 2) - 80],
          rows: [
            new TableRow({
              children: [
                multiCell(
                  [
                    p("For Nhancio Technologies", { bold: true, size: 20, color: C.primaryDark, spacingAfter: 60 }),
                    p("Name: Didigam Nithin", { size: 19, spacingAfter: 40 }),
                    p("Role: Technology Partner / Director", { size: 19, spacingAfter: 40 }),
                    p("Signature: ____________________", { size: 19, spacingAfter: 40 }),
                    p("Date: ________________________", { size: 19, spacingAfter: 40 }),
                  ],
                  Math.floor(CONTENT_W / 2) - 80,
                  { fill: C.softBg }
                ),
                multiCell(
                  [
                    p("For Maruthi Technologies", { bold: true, size: 20, color: C.primaryDark, spacingAfter: 60 }),
                    p("Name: ____________________", { size: 19, spacingAfter: 40 }),
                    p("Role: Business Development Partner", { size: 19, spacingAfter: 40 }),
                    p("Signature: ____________________", { size: 19, spacingAfter: 40 }),
                    p("Date: ________________________", { size: 19, spacingAfter: 40 }),
                  ],
                  Math.floor(CONTENT_W / 2) - 80,
                  { fill: C.babyblue }
                ),
              ],
            }),
          ],
        }),

        spacer(280),
        p("— End of Proposal —", {
          align: AlignmentType.CENTER,
          size: 18,
          color: C.lightMuted,
          italic: true,
          spacingAfter: 40,
        }),
        p("Nhancio Technologies  ·  hello@nhancio.com  ·  nhancio.com", {
          align: AlignmentType.CENTER,
          size: 16,
          color: C.soft,
          spacingAfter: 0,
        }),
      ],
    },
  ],
});

const outPath = path.join(__dirname, "Nhancio_MagicBoxAI_Maruthi_Partnership_Proposal.docx");
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outPath, buffer);
  console.log("Wrote:", outPath);
});
