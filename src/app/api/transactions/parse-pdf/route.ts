import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Date patterns: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY
const DATE_RE = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/;

// Amount: optional sign, digits, optional decimal
const AMOUNT_RE = /([+-]?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})/;

function parseFlexDate(s: string): string | null {
  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const d = new Date(Number(year), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function parseAmount(s: string): number {
  // Remove spaces, currency symbols; normalise decimal separator
  const clean = s.replace(/\s/g, "").replace(/[€$£]/g, "");
  // If last separator is comma with 2 digits → decimal comma
  const normalised = clean.replace(/\.(\d{3})/g, "$1").replace(",", ".");
  return Math.abs(parseFloat(normalised) || 0);
}

interface ParsedRow {
  date: string;
  amount: number;
  description: string;
}

function extractRows(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const dateMatch   = line.match(DATE_RE);
    const amountMatch = line.match(new RegExp(AMOUNT_RE.source, "g"));
    if (!dateMatch || !amountMatch) continue;

    const isoDate = parseFlexDate(dateMatch[1]);
    if (!isoDate) continue;

    // If there are 2+ amounts on the line, the last is usually the running balance
    // (saldo contabilístico) and the second-to-last is the transaction amount (montante).
    // If there is only one amount, use it directly.
    const montanteMatch = amountMatch.length >= 2
      ? amountMatch[amountMatch.length - 2]
      : amountMatch[0];
    const amount = parseAmount(montanteMatch);
    if (amount <= 0) continue;

    // Description = everything between the date and the montante, cleaned up
    const afterDate = line.slice(dateMatch.index! + dateMatch[0].length);
    const montanteIdx = afterDate.indexOf(montanteMatch);
    const rawDesc = (montanteIdx > 0 ? afterDate.slice(0, montanteIdx) : afterDate)
      .replace(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g, "")  // strip any extra dates
      .replace(/\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g, "")
      .replace(/[|·•\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    rows.push({ date: isoDate, amount, description: rawDesc.slice(0, 300) });
  }

  return rows;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const info   = await parser.getInfo();
    await parser.destroy();

    const rows = extractRows(result.text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Could not detect any transactions in this PDF. The file may be image-based or have an unsupported format." },
        { status: 422 }
      );
    }

    return NextResponse.json({ rows, pageCount: info.total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PDF parse error:", err);
    return NextResponse.json({ error: `Failed to parse PDF: ${msg}` }, { status: 500 });
  }
}
