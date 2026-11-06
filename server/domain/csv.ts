// CSV for German Excel: semicolons, CRLF, UTF-8 with BOM. Cells that a spreadsheet would read as
// a formula are prefixed with an apostrophe.

function cell(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}
