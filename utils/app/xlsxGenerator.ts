/**
 * Minimal XLSX generator using JSZip.
 *
 * Produces a valid OpenXML spreadsheet (.xlsx) from a 2-D string array.
 * No external runtime dependency beyond jszip (already in package.json).
 */

import JSZip from 'jszip';

/** Convert a 0-based column index to an Excel column letter (A, B, …, Z, AA, …) */
function colLetter(col: number): string {
  let letter = '';
  let n = col + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Strip characters Excel rejects (control chars except tab/LF/CR)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Generate a proper .xlsx Blob from a rows×cols string matrix.
 *
 * @param rows     2-D array of string values (first row treated as header)
 * @param sheetName  Optional worksheet tab name (default "Sheet1")
 */
export async function generateXLSXBlob(
  rows: string[][],
  sheetName = 'Sheet1',
): Promise<Blob> {
  const zip = new JSZip();

  /* ── Shared-string table ─────────────────────────────────── */
  const strings: string[] = [];
  const strIdx = new Map<string, number>();
  const si = (val: string): number => {
    if (!strIdx.has(val)) {
      strIdx.set(val, strings.length);
      strings.push(val);
    }
    return strIdx.get(val)!;
  };

  /* ── Build worksheet XML ─────────────────────────────────── */
  const sheetRows = rows.map((row, ri) => {
    const cells = row.map((cell, ci) => {
      const ref = `${colLetter(ci)}${ri + 1}`;
      const v = cell ?? '';
      // Numbers (no leading zeros, not empty)
      const num = parseFloat(v);
      if (v.trim() !== '' && !isNaN(num) && String(num) === v.trim()) {
        return `<c r="${ref}"><v>${num}</v></c>`;
      }
      return `<c r="${ref}" t="s"><v>${si(v)}</v></c>`;
    });
    return `<row r="${ri + 1}">${cells.join('')}</row>`;
  });

  /* ── Pack into zip ───────────────────────────────────────── */

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetRows.join('\n    ')}
  </sheetData>
</worksheet>`,
  );

  const ssItems = strings
    .map(s => `<si><t xml:space="preserve">${escXml(s)}</t></si>`)
    .join('\n  ');
  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
     count="${strings.length}" uniqueCount="${strings.length}">
  ${ssItems}
</sst>`,
  );

  // Minimal styles: bold first row
  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
</styleSheet>`,
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
