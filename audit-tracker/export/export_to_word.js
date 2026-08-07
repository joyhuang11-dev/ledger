const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, VerticalAlign,
  PageOrientation, Footer, PageNumber,
} = require("docx");

const dataPath = process.argv[2] || path.join(__dirname, "rows.json");
const outPath = process.argv[3] || path.join(__dirname, "output.docx");

const { title: rawTitle, rows } = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
const title = rawTitle.replace(/（協作用工作底稿）/g, "").trim();

const FONT = "新細明體";
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };

// docx-js wants the PORTRAIT base size here; with orientation LANDSCAPE it
// swaps width/height internally to produce the actual landscape page.
const PAGE_PORTRAIT_W = 11906; // A4 short edge (becomes the landscape height)
const PAGE_PORTRAIT_H = 16838; // A4 long edge (becomes the landscape width)
const MARGIN = 720; // 0.5"
const USABLE_W = PAGE_PORTRAIT_H - MARGIN * 2; // usable width of the rendered landscape page

const COL_RATIOS = [0.07, 0.09, 0.13, 0.09, 0.205, 0.205, 0.21];
const COL_WIDTHS = COL_RATIOS.map((r) => Math.round(USABLE_W * r));

function cellParagraphs(text, opts = {}) {
  const lines = String(text || "").split("\n");
  return lines.map(
    (line) =>
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: line, font: FONT, size: 20, bold: !!opts.bold }),
        ],
      })
  );
}

function headerCellSimple(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, font: FONT, size: 20, bold: true })],
      }),
    ],
  });
}

function dataCell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: cellParagraphs(text, opts),
  });
}

const headers = [
  "稽核項目編號", "受稽核單位", "稽核項目", "實際稽核期間起迄",
  "內部控制缺失及異常事項", "應行處理措施或改善計畫", "實際改善情形",
];

const headerRow = new TableRow({
  tableHeader: true,
  children: headers.map((h, i) => headerCellSimple(h, COL_WIDTHS[i])),
});

const bodyRows = [];
for (const row of rows) {
  bodyRows.push(
    new TableRow({
      children: [
        dataCell(row.no, COL_WIDTHS[0], { center: true }),
        dataCell(row.unit, COL_WIDTHS[1], { center: true }),
        dataCell(row.item, COL_WIDTHS[2]),
        dataCell(row.period, COL_WIDTHS[3], { center: true }),
        dataCell(row.deficiency, COL_WIDTHS[4]),
        dataCell(row.action, COL_WIDTHS[5]),
        dataCell(row.result, COL_WIDTHS[6]),
      ],
    })
  );
  bodyRows.push(
    new TableRow({
      children: [
        new TableCell({
          width: { size: COL_WIDTHS[0] + COL_WIDTHS[1], type: WidthType.DXA },
          columnSpan: 2,
          borders: BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: `稽核人員：${row.auditor}`, font: FONT, size: 20 })] })],
        }),
        new TableCell({
          width: { size: COL_WIDTHS[2], type: WidthType.DXA },
          borders: BORDERS,
          children: [new Paragraph({ children: [] })],
        }),
        new TableCell({
          width: { size: COL_WIDTHS[3] + COL_WIDTHS[4], type: WidthType.DXA },
          columnSpan: 2,
          borders: BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: `稽核報告文號：${row.doc_no}`, font: FONT, size: 20 })] })],
        }),
        new TableCell({
          width: { size: COL_WIDTHS[5], type: WidthType.DXA },
          borders: BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: `稽核報告日期：${row.report_date}`, font: FONT, size: 20 })] })],
        }),
        new TableCell({
          width: { size: COL_WIDTHS[6], type: WidthType.DXA },
          borders: BORDERS,
          children: [new Paragraph({ children: [] })],
        }),
      ],
    })
  );
}

const table = new Table({
  width: { size: USABLE_W, type: WidthType.DXA },
  columnWidths: COL_WIDTHS,
  rows: [headerRow, ...bodyRows],
});

const doc = new Document({
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_PORTRAIT_W, height: PAGE_PORTRAIT_H, orientation: PageOrientation.LANDSCAPE },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: title, font: FONT, size: 24, bold: true })],
        }),
        table,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log("wrote", outPath);
});
