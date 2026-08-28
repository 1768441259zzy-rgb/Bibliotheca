import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { VocabEntry } from '@/lib/vocabulary';
import { formatAnnotationDate } from '@/lib/reading/annotations';

export type VocabImportItem = {
  english: string;
  chinese?: string;
  source?: string;
  createdAt?: string;
};

function stampName(): string {
  return formatAnnotationDate(new Date().toISOString()).replace(/\./g, '-');
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, text: string, mime: string) {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function normalizeRow(raw: Record<string, unknown>): VocabImportItem | null {
  const keys = Object.keys(raw);
  const pick = (...names: string[]) => {
    const key = keys.find((k) =>
      names.includes(k.trim().toLowerCase().replace(/\s+/g, ''))
    );
    return key ? String(raw[key] ?? '').trim() : '';
  };

  const english =
    pick('english', 'en', '英文', '单词', 'word') ||
    String(raw.english ?? raw.en ?? '').trim();
  if (!english) return null;

  const chinese =
    pick('chinese', 'zh', '中文', '释义', '意思', 'translation') ||
    String(raw.chinese ?? raw.zh ?? '').trim();
  const source =
    pick('source', '来源', '出处') || String(raw.source ?? '').trim();
  const createdAt =
    pick('createdat', 'created_at', 'date', '日期', '时间') ||
    String(raw.createdAt ?? raw.created_at ?? '').trim();

  return {
    english,
    ...(chinese ? { chinese } : {}),
    ...(source ? { source } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
}

function parseCsvOrJsonText(text: string): VocabImportItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const data = JSON.parse(trimmed) as { entries?: unknown[] } | unknown[];
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.entries)
        ? data.entries
        : [];
    return list
      .map((raw) => normalizeRow(raw as Record<string, unknown>))
      .filter((x): x is VocabImportItem => Boolean(x));
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headerCells = parseCsvLine(lines[0]).map((c) =>
    c.trim().toLowerCase().replace(/\s+/g, '')
  );
  const looksLikeHeader =
    headerCells.includes('english') ||
    headerCells.includes('en') ||
    headerCells.includes('英文') ||
    headerCells.includes('单词');
  const start = looksLikeHeader ? 1 : 0;
  const idx = (names: string[]) =>
    headerCells.findIndex((h) => names.includes(h));

  const enIdx = looksLikeHeader
    ? Math.max(0, idx(['english', 'en', '英文', '单词', 'word']))
    : 0;
  const zhIdx = looksLikeHeader
    ? idx(['chinese', 'zh', '中文', '释义', '意思', 'translation'])
    : 1;
  const sourceIdx = looksLikeHeader ? idx(['source', '来源', '出处']) : 2;
  const dateIdx = looksLikeHeader
    ? idx(['createdat', 'created_at', 'date', '日期', '时间'])
    : 3;

  return lines.slice(start).flatMap((line) => {
    const cells = parseCsvLine(line);
    const english = String(cells[enIdx] ?? '').trim();
    if (!english) return [];
    return [
      {
        english,
        chinese:
          zhIdx >= 0
            ? String(cells[zhIdx] ?? '').trim() || undefined
            : undefined,
        source:
          sourceIdx >= 0
            ? String(cells[sourceIdx] ?? '').trim() || undefined
            : undefined,
        createdAt:
          dateIdx >= 0
            ? String(cells[dateIdx] ?? '').trim() || undefined
            : undefined,
      },
    ];
  });
}

function parseExcelBuffer(buf: ArrayBuffer): VocabImportItem[] {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
  return rows
    .map((row) => normalizeRow(row))
    .filter((x): x is VocabImportItem => Boolean(x));
}

function xmlTextContents(xml: string): string[] {
  const texts: string[] = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const t = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
    if (t) texts.push(t);
  }
  return texts;
}

function parseDocxTableRows(xml: string): VocabImportItem[] {
  const rows: VocabImportItem[] = [];
  const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  let rowMatch: RegExpExecArray | null;
  let isFirst = true;
  while ((rowMatch = rowRe.exec(xml))) {
    const cells: string[] = [];
    const cellRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[0]))) {
      cells.push(xmlTextContents(cellMatch[0]).join('').trim());
    }
    if (cells.length === 0) continue;
    if (
      isFirst &&
      /english|英文|单词|word/i.test(cells[0]) &&
      /chinese|中文|释义/i.test(cells[1] ?? '')
    ) {
      isFirst = false;
      continue;
    }
    isFirst = false;
    const english = cells[0]?.trim();
    if (!english) continue;
    rows.push({
      english,
      chinese: cells[1]?.trim() || undefined,
      source: cells[2]?.trim() || undefined,
      createdAt: cells[3]?.trim() || undefined,
    });
  }
  return rows;
}

function parseDocxLineItems(texts: string[]): VocabImportItem[] {
  const items: VocabImportItem[] = [];
  for (const line of texts) {
    const m =
      line.match(/^(.+?)\s*[|｜\t]\s*(.+)$/) ||
      line.match(/^(.+?)\s{2,}(.+)$/) ||
      line.match(/^(.+?)\s*[-–—:：]\s*(.+)$/);
    if (!m) continue;
    const english = m[1].trim();
    const chinese = m[2].trim();
    if (!english || /^(english|英文|单词)$/i.test(english)) continue;
    items.push({ english, chinese });
  }
  return items;
}

async function parseDocxBuffer(buf: ArrayBuffer): Promise<VocabImportItem[]> {
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('无效的 Word 文件');
  const xml = await docFile.async('string');
  const fromTable = parseDocxTableRows(xml);
  if (fromTable.length > 0) return fromTable;
  return parseDocxLineItems(xmlTextContents(xml));
}

export async function parseVocabImportFile(
  file: File
): Promise<VocabImportItem[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) {
    return parseExcelBuffer(await file.arrayBuffer());
  }
  if (name.endsWith('.docx')) {
    return parseDocxBuffer(await file.arrayBuffer());
  }
  if (name.endsWith('.doc')) {
    throw new Error('暂不支持旧版 .doc，请另存为 .docx 或 Excel 后再导入');
  }
  if (name.endsWith('.pdf')) {
    throw new Error('PDF 不适合可靠导入，请用 Excel / Word 表格');
  }
  return parseCsvOrJsonText(await file.text());
}

export function exportVocabJson(entries: VocabEntry[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries: entries.map((e) => ({
      english: e.english,
      chinese: e.chinese,
      source: e.source ?? '',
      createdAt: e.createdAt,
      updatedAt: e.updatedAt ?? '',
    })),
  };
  downloadText(
    `bibliotheca-vocab-${stampName()}.json`,
    `${JSON.stringify(payload, null, 2)}\n`,
    'application/json;charset=utf-8'
  );
}

export function exportVocabCsv(entries: VocabEntry[]) {
  const header = 'english,chinese,source,createdAt';
  const rows = entries.map((e) =>
    [
      escapeCsv(e.english),
      escapeCsv(e.chinese ?? ''),
      escapeCsv(e.source ?? ''),
      escapeCsv(e.createdAt ?? ''),
    ].join(',')
  );
  downloadText(
    `bibliotheca-vocab-${stampName()}.csv`,
    `\uFEFF${[header, ...rows].join('\n')}\n`,
    'text/csv;charset=utf-8'
  );
}

export function exportVocabExcel(entries: VocabEntry[]) {
  const rows = entries.map((e) => ({
    english: e.english,
    chinese: e.chinese ?? '',
    source: e.source ?? '',
    createdAt: e.createdAt ?? '',
    日期: e.createdAt ? formatAnnotationDate(e.createdAt) : '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 28 },
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vocabulary');
  XLSX.writeFile(wb, `bibliotheca-vocab-${stampName()}.xlsx`);
}

export async function exportVocabWord(entries: VocabEntry[]) {
  const headerCells = ['English', '中文', '来源', '日期'];
  const bodyRows = entries.map((e) => [
    e.english,
    e.chinese ?? '',
    e.source ?? '',
    e.createdAt ? formatAnnotationDate(e.createdAt) : '',
  ]);

  const cellXml = (text: string, bold = false) => `
    <w:tc>
      <w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr>
      <w:p>
        <w:r>
          ${bold ? '<w:rPr><w:b/></w:rPr>' : ''}
          <w:t xml:space="preserve">${escapeXml(text)}</w:t>
        </w:r>
      </w:p>
    </w:tc>`;

  const rowXml = (cells: string[], bold = false) =>
    `<w:tr>${cells.map((c) => cellXml(c, bold)).join('')}</w:tr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
        <w:t>Bibliotheca Vocabulary</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r><w:t>导出日期 ${stampName()} · 共 ${entries.length} 条</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="8C6D58"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="8C6D58"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="8C6D58"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="8C6D58"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="C9A84C"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="C9A84C"/>
        </w:tblBorders>
      </w:tblPr>
      ${rowXml(headerCells, true)}
      ${bodyRows.map((r) => rowXml(r)).join('\n')}
    </w:tbl>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder('word')?.file('document.xml', documentXml);
  zip.folder('word')?.folder('_rels')?.file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(
    `bibliotheca-vocab-${stampName()}.docx`,
    new Blob([blob], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
  );
}

/** 打开可打印页，浏览器里「另存为 PDF」即可 */
export function exportVocabPdfPrint(entries: VocabEntry[]) {
  const rows = entries
    .map(
      (e) => `<tr>
        <td>${escapeXml(e.english)}</td>
        <td>${escapeXml(e.chinese || '')}</td>
        <td>${escapeXml(e.source || '')}</td>
        <td>${escapeXml(
          e.createdAt ? formatAnnotationDate(e.createdAt) : ''
        )}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Bibliotheca Vocabulary</title>
  <style>
    body { font-family: "Times New Roman", "Songti SC", "SimSun", serif; color: #3b2f2a; margin: 32px; }
    h1 { font-weight: 400; font-size: 28px; margin: 0 0 6px; }
    p.meta { color: #7a6a5f; font-size: 12px; margin: 0 0 20px; letter-spacing: .08em; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #c9a84c; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f6ebe3; font-weight: 600; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>Bibliotheca · Vocabulary</h1>
  <p class="meta">导出 ${stampName()} · 共 ${entries.length} 条 · 打印后可另存为 PDF</p>
  <table>
    <thead>
      <tr><th>English</th><th>中文</th><th>来源</th><th>日期</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('浏览器拦截了弹窗，请允许后重试');
  }
  win.document.write(html);
  win.document.close();
}
