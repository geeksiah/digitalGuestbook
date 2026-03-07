export const parseCsvRow = (row: string) => {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cols.push(current.trim());
  return cols;
};

export const parseXlsxRows = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const decoder = new TextDecoder();

  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (view.getUint32(i, true) === eocdSignature) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Invalid XLSX file');

  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);

  const unzipEntryText = async (entryName: string) => {
    let offset = centralOffset;
    const centralEnd = centralOffset + centralSize;
    while (offset < centralEnd) {
      if (view.getUint32(offset, true) !== centralSignature) break;
      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

      if (fileName === entryName) {
        if (view.getUint32(localOffset, true) !== localSignature) throw new Error('Invalid XLSX entry');
        const localNameLen = view.getUint16(localOffset + 26, true);
        const localExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        const compressed = bytes.slice(dataStart, dataStart + compressedSize);

        let uncompressed: Uint8Array;
        if (compression === 0) {
          uncompressed = compressed;
        } else if (compression === 8) {
          const inflateCtor = (
            globalThis as {
              DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array>;
            }
          ).DecompressionStream;
          if (!inflateCtor) throw new Error('XLSX decompression is not supported on this device');
          const stream = new Blob([compressed]).stream().pipeThrough(new inflateCtor('deflate-raw'));
          const inflated = await new Response(stream).arrayBuffer();
          uncompressed = new Uint8Array(inflated);
        } else {
          throw new Error('Unsupported XLSX compression');
        }
        return decoder.decode(uncompressed);
      }

      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return '';
  };

  const listEntries = () => {
    const entries: string[] = [];
    let offset = centralOffset;
    const centralEnd = centralOffset + centralSize;
    while (offset < centralEnd) {
      if (view.getUint32(offset, true) !== centralSignature) break;
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
      entries.push(fileName);
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
    return entries;
  };

  const entries = listEntries();
  const sharedStringsXml = entries.includes('xl/sharedStrings.xml') ? await unzipEntryText('xl/sharedStrings.xml') : '';
  const worksheetPath = entries.includes('xl/worksheets/sheet1.xml')
    ? 'xl/worksheets/sheet1.xml'
    : entries.find((name) => name.startsWith('xl/worksheets/') && name.endsWith('.xml')) || '';
  if (!worksheetPath) throw new Error('No worksheet found in XLSX');
  const worksheetXml = await unzipEntryText(worksheetPath);

  const parser = new DOMParser();
  const sharedStrings = sharedStringsXml
    ? Array.from(parser.parseFromString(sharedStringsXml, 'application/xml').getElementsByTagName('si')).map((si) =>
        Array.from(si.getElementsByTagName('t'))
          .map((node) => node.textContent || '')
          .join('')
      )
    : [];

  const worksheetDoc = parser.parseFromString(worksheetXml, 'application/xml');
  const rowNodes = Array.from(worksheetDoc.getElementsByTagName('row'));
  const rows = rowNodes.map((rowNode) => {
    const row: string[] = [];
    const cells = Array.from(rowNode.getElementsByTagName('c'));
    cells.forEach((cell) => {
      const ref = cell.getAttribute('r') || '';
      const colLetters = ref.replace(/[0-9]/g, '');
      let colIndex = row.length;
      if (colLetters) {
        colIndex = 0;
        for (let i = 0; i < colLetters.length; i += 1) {
          colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64);
        }
        colIndex -= 1;
      }

      const type = cell.getAttribute('t');
      let value = '';
      if (type === 's') {
        const idx = Number(cell.getElementsByTagName('v')[0]?.textContent || '-1');
        value = idx >= 0 ? String(sharedStrings[idx] || '') : '';
      } else if (type === 'inlineStr') {
        value = Array.from(cell.getElementsByTagName('t'))
          .map((node) => node.textContent || '')
          .join('');
      } else {
        value = cell.getElementsByTagName('v')[0]?.textContent || '';
      }
      row[colIndex] = value.trim();
    });
    return row;
  });

  return rows.filter((row) => row.some((value) => String(value || '').trim()));
};
