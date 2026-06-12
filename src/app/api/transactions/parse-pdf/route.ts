import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// DD-MM-YYYY (10 chars exactly)
const DATE10_RE = /^(\d{2})-(\d{2})-(\d{4})/;

function parseDate10(s: string): string | null {
  const m = s.match(DATE10_RE);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Parse a Portuguese amount string like "-35,63" or "1.065,84" → number
function parsePortugueseAmount(s: string): number {
  // Remove thousand separators (period), replace decimal comma with dot
  const clean = s.replace(/\./g, "").replace(",", ".");
  return parseFloat(clean);
}

interface ParsedRow {
  date: string;
  amount: number;
  description: string;
}

function extractRows(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];

  // Collapse multi-line entries: join lines that don't start with a date onto the previous line
  const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const line of rawLines) {
    if (DATE10_RE.test(line) || lines.length === 0) {
      lines.push(line);
    } else {
      // continuation of previous line
      lines[lines.length - 1] += " " + line;
    }
  }

  // Amount pattern: optional sign, digits with optional thousands separator, comma + 2 decimals
  const AMOUNT_RE = /(-?\d{1,3}(?:\.\d{3})*,\d{2})/g;

  for (const line of lines) {
    // Must start with DD-MM-YYYY
    if (!DATE10_RE.test(line)) continue;

    const isoDate = parseDate10(line);
    if (!isoDate) continue;

    // Skip the first date (mov date) and possibly second date (value date, also 10 chars + separator)
    let rest = line.slice(10); // skip first date
    if (DATE10_RE.test(rest)) rest = rest.slice(10); // skip second date if present

    // Find all amounts on the line
    const amounts = [...rest.matchAll(AMOUNT_RE)].map((m) => m[1]);
    if (amounts.length < 2) continue; // need at least amount + balance

    // Second-to-last = transaction amount, last = running balance
    const amountStr = amounts[amounts.length - 2];
    const amount = parsePortugueseAmount(amountStr);
    if (isNaN(amount) || amount === 0) continue;

    // Description = everything between dates and the first amount
    const firstAmountIdx = rest.indexOf(amounts[0]);
    const rawDesc = rest
      .slice(0, firstAmountIdx)
      .replace(/[|·•\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    rows.push({
      date: isoDate,
      amount: Math.abs(amount),
      description: rawDesc.slice(0, 300),
    });
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
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);

    const rows = extractRows(data.text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Could not detect any transactions in this PDF. The file may be image-based or have an unsupported format." },
        { status: 422 }
      );
    }

    return NextResponse.json({ rows, pageCount: data.numpages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PDF parse error:", err);
    return NextResponse.json({ error: `Failed to parse PDF: ${msg}` }, { status: 500 });
  }
}
