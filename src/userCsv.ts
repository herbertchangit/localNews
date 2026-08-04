export type CsvRow = Record<string, string>;

export const parseCsv = (source: string): CsvRow[] => {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false;
  const text = source.replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { value += '"'; index++; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(value); value = ""; }
    else if (character === "\n") { row.push(value); rows.push(row); row = []; value = ""; }
    else if (character !== "\r") value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  const [header = [], ...data] = rows;
  const keys = header.map((key) => key.trim().toLowerCase());
  return data.filter((item) => item.some((cell) => cell.trim())).map((item) =>
    Object.fromEntries(keys.map((key, index) => [key, item[index]?.trim() || ""])),
  );
};

const quote = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const toCsv = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");

export const csvBoolean = (value: string) => ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
