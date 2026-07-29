function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnNameFromIndex(index) {
  let value = index + 1;
  let result = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function cellRef(columnIndex, rowIndex) {
  return `${columnNameFromIndex(columnIndex)}${rowIndex}`;
}

function textCell(ref, value) {
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(ref, value) {
  return `<c r="${ref}"><v>${Number(value)}</v></c>`;
}

function formatBirthDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('es-AR');
}

function buildSheetXml(players, category, teamName) {
  const headerRow = [
    textCell('A3', 'Nro'),
    textCell('B3', 'Nombre y Apellido'),
    textCell('C3', 'DNI'),
    textCell('D3', 'Fecha de nacimiento'),
  ].join('');

  const dataRows = players
    .map((player, index) => {
      const rowNumber = index + 4;
      const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
      const cells = [
        numberCell(cellRef(0, rowNumber), index + 1),
        textCell(cellRef(1, rowNumber), fullName),
        textCell(cellRef(2, rowNumber), player?.dni || ''),
        textCell(cellRef(3, rowNumber), formatBirthDate(player?.birth_date)),
      ].join('');

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>
    <row r="1">
      <c r="B1" t="inlineStr"><is><t xml:space="preserve">Nombre del equipo</t></is></c>
      ${teamName ? `<c r="C1" t="inlineStr"><is><t xml:space="preserve">${escapeXml(teamName)}</t></is></c>` : ''}
      <c r="E1" t="inlineStr"><is><t xml:space="preserve">Categoria</t></is></c>
      ${category ? `<c r="F1" t="inlineStr"><is><t xml:space="preserve">${escapeXml(category)}</t></is></c>` : ''}
    </row>
    ${headerRow ? `<row r="3">${headerRow}</row>` : ''}
    ${dataRows}
  </sheetData>
</worksheet>`;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let c = i;

    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }

    table[i] = c >>> 0;
  }

  return table;
})();

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value));
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function concatUint8Arrays(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  parts.forEach((part) => {
    merged.set(part, offset);
    offset += part.length;
  });

  return merged;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = utf8Bytes(entry.name);
    const contentBytes = utf8Bytes(entry.content);
    const checksum = crc32(contentBytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  });

  const centralDirectory = concatUint8Arrays(centralParts);
  const zipEnd = new Uint8Array(22);
  const zipEndView = new DataView(zipEnd.buffer);

  zipEndView.setUint32(0, 0x06054b50, true);
  zipEndView.setUint16(4, 0, true);
  zipEndView.setUint16(6, 0, true);
  zipEndView.setUint16(8, entries.length, true);
  zipEndView.setUint16(10, entries.length, true);
  zipEndView.setUint32(12, centralDirectory.length, true);
  zipEndView.setUint32(16, offset, true);
  zipEndView.setUint16(20, 0, true);

  return new Blob([concatUint8Arrays([...localParts, centralDirectory, zipEnd])], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function buildGoodFaithXlsxBlob(players, category, teamName = '') {
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Lista de Buena Fe" sheetId="1" r:id="rId1" />
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" />
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="xml" ContentType="application/xml" />
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" />
</Relationships>`;

  return createStoredZip([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/worksheets/sheet1.xml', content: buildSheetXml(players, category, teamName) },
  ]);
}
