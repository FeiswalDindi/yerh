export function downloadCsv(name: string, rows: (string | number)[][]) {
  const content = rows
    .map((row) =>
      row
        .map((value) => {
          let cell = String(value);
          if (typeof value === 'string' && /^[\u0000-\u0020]*[=+@-]|^[\t\r\n]/.test(cell))
            cell = "'" + cell;
          return '"' + cell.replaceAll('"', '""') + '"';
        })
        .join(','),
    )
    .join('\r\n');
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.download = name;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
