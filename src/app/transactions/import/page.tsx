"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import Link from "next/link";

interface Category { id: string; name: string; direction: "INCOME" | "EXPENSE" }

interface ReviewRow {
  date: string;              // YYYY-MM-DD
  amount: string;            // editable string
  description: string;
  categoryId: string;        // per-row category
  direction: "INCOME" | "EXPENSE"; // per-row direction
  selected: boolean;
  imported?: boolean;        // already imported in a previous batch
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isoToInputDate(iso: string): string {
  // ISO "2024-01-15T..." → "2024-01-15"
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}

function csvParseAmount(raw: string): string {
  const n = Math.abs(parseFloat(raw.replace(/[€$£\s]/g, "").replace(/,(\d{2})$/, ".$1").replace(/,/g, "")) || 0);
  return n.toFixed(2);
}

function csvParseDate(raw: string): string {
  if (!raw) return "";
  const d1 = new Date(raw);
  if (!isNaN(d1.getTime())) return d1.toISOString().slice(0, 10);
  const m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) {
    const d2 = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
  }
  return "";
}

function guessColumn(columns: string[], patterns: RegExp[]): string {
  for (const pat of patterns) { const f = columns.find((c) => pat.test(c)); if (f) return f; }
  return columns[0] ?? "";
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ImportPage() {
  // navigation
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // file source
  const [isPdf,      setIsPdf]      = useState(false);
  const [pdfMeta,    setPdfMeta]    = useState<{ pages: number; detected: number } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [fileError,  setFileError]  = useState<string | null>(null);

  // CSV column mapping
  const [csvRaw,     setCsvRaw]     = useState<Record<string, string>[]>([]);
  const [columns,    setColumns]    = useState<string[]>([]);
  const [dateCol,    setDateCol]    = useState("");
  const [amountCol,  setAmountCol]  = useState("");
  const [descCol,    setDescCol]    = useState("");

  // shared
  const [direction,  setDirection]  = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  // review (step 3)
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [search,     setSearch]     = useState("");

  // new-category inline form
  const [showNewCat,    setShowNewCat]    = useState(false);
  const [newCatName,    setNewCatName]    = useState("");
  const [newCatDir,     setNewCatDir]     = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [savingCat,     setSavingCat]     = useState(false);

  // import result
  const [importing,      setImporting]      = useState(false);
  const [lastBatch,      setLastBatch]      = useState<number | null>(null); // rows imported in last batch
  const [totalImported,  setTotalImported]  = useState(0);
  const [done,           setDone]           = useState(false); // user clicked "Finish"

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/category").then((r) => r.json()).then(setCategories).catch(() => {});
  }, []);

  const filteredCategories = categories.filter((c) => c.direction === direction);

  // ── upload handler ────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setFileError(null);
    const isPdfFile = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    setIsPdf(isPdfFile);

    if (isPdfFile) {
      if (file.size > 4 * 1024 * 1024) {
        setFileError("PDF is too large (max 4 MB on free plan). Try splitting it into smaller files.");
        return;
      }
      setPdfLoading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res  = await fetch("/api/transactions/parse-pdf", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) { setFileError(`Failed to parse PDF (${res.status}): ${data.error ?? "Unknown error"}`); return; }
        const rows: ReviewRow[] = (data.rows as { date: string; amount: number; description: string }[]).map((r) => ({
          date:        isoToInputDate(r.date),
          amount:      r.amount.toFixed(2),
          description: r.description,
          categoryId:  categoryId,
          direction:   direction,
          selected:    true,
        }));
        setPdfMeta({ pages: data.pageCount, detected: rows.length });
        setReviewRows(rows);
        setStep(2); // PDF → configure step
      } catch (e) { setFileError(`Failed to upload or parse the PDF: ${e instanceof Error ? e.message : String(e)}`); }
      finally  { setPdfLoading(false); }
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete(res) {
          const rows = res.data as Record<string, string>[];
          const cols = res.meta.fields ?? [];
          setCsvRaw(rows);
          setColumns(cols);
          setDateCol(guessColumn(cols,   [/date/i, /datum/i, /data/i]));
          setAmountCol(guessColumn(cols, [/amount/i, /valor/i, /montant/i, /debit/i, /credit/i, /value/i]));
          setDescCol(guessColumn(cols,   [/desc/i, /memo/i, /narr/i, /payee/i, /detail/i, /reference/i]));
          setStep(2);
        },
      });
    }
  }

  // Build preview rows for CSV mapping step
  const csvPreview: ReviewRow[] = csvRaw.slice(0, 5).map((r) => ({
    date:        csvParseDate(r[dateCol] ?? ""),
    amount:      csvParseAmount(r[amountCol] ?? ""),
    description: (r[descCol] ?? "").slice(0, 300),
    categoryId:  categoryId,
    direction:   direction,
    selected:    true,
  }));

  function buildCsvReviewRows(): ReviewRow[] {
    return csvRaw.map((r) => ({
      date:        csvParseDate(r[dateCol] ?? ""),
      amount:      csvParseAmount(r[amountCol] ?? ""),
      description: (r[descCol] ?? "").slice(0, 300),
      categoryId:  categoryId,
      direction:   direction,
      selected:    true,
    }));
  }

  // ── row update helpers ────────────────────────────────────────────────────

  function updateRow(i: number, field: keyof ReviewRow, value: string | boolean) {
    setReviewRows((rows) => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function deleteRow(i: number) {
    setReviewRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  function toggleAll(val: boolean) {
    const visibleIndices = new Set(visibleRows.map((r) => r.originalIndex));
    setReviewRows((rows) =>
      rows.map((r, i) =>
        r.imported ? r : visibleIndices.has(i) ? { ...r, selected: val } : r
      )
    );
  }

  const selectedRows  = reviewRows.filter((r) => r.selected && !r.imported);
  const remainingRows = reviewRows.filter((r) => !r.imported);

  const searchLower = search.toLowerCase().trim();
  const visibleRows = !searchLower
    ? reviewRows.map((r, i) => ({ ...r, originalIndex: i }))
    : reviewRows
        .map((r, i) => ({ ...r, originalIndex: i }))
        .filter((r) =>
          r.description.toLowerCase().includes(searchLower) ||
          r.date.includes(searchLower) ||
          r.amount.includes(searchLower)
        );

  // ── import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    const validSelected = selectedRows.filter((r) => r.amount && parseFloat(r.amount) > 0 && r.date && r.categoryId);
    if (validSelected.length === 0) return alert("No valid rows selected. Make sure each selected row has a category.");

    // track which original indices are being imported
    const importingIndices = new Set(
      reviewRows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.selected && !r.imported && r.amount && parseFloat(r.amount) > 0 && r.date && r.categoryId)
        .map(({ i }) => i)
    );

    setImporting(true);
    try {
      const res  = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validSelected.map((r) => ({
            date:        new Date(r.date).toISOString(),
            amount:      parseFloat(r.amount),
            description: r.description,
            categoryId:  r.categoryId,
            direction:   r.direction,
          })),
        }),
      });
      const data = await res.json();
      // Mark imported rows; deselect them so they can't be imported again
      setReviewRows((rows) =>
        rows.map((r, i) =>
          importingIndices.has(i) ? { ...r, imported: true, selected: false } : r
        )
      );
      setLastBatch(data.inserted ?? validSelected.length);
      setTotalImported((t) => t + (data.inserted ?? validSelected.length));
    } finally { setImporting(false); }
  }

  async function handleCreateCategory() {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      const res  = await fetch("/api/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim(), direction: newCatDir }),
      });
      if (!res.ok) { alert("Failed to create category — name may already exist."); return; }
      const cat: Category = await res.json();
      setCategories((prev) => [...prev, cat]);
      setCategoryId(cat.id);
      setDirection(cat.direction);
      setNewCatName("");
      setShowNewCat(false);
    } finally { setSavingCat(false); }
  }

  function reset() {
    setStep(1); setIsPdf(false); setPdfMeta(null); setFileError(null);
    setCsvRaw([]); setColumns([]); setReviewRows([]); setSearch("");
    setLastBatch(null); setTotalImported(0); setDone(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── styles ─────────────────────────────────────────────────────────────────

  const selectCls = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const inputCls  = "w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-emerald-400 dark:focus:border-emerald-500 rounded px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:bg-white dark:focus:bg-slate-900 transition-colors";

  // Step labels
  const stepDefs = [
    { label: "Upload" },
    { label: isPdf ? "Configure" : "Map Columns" },
    { label: "Review & Edit" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/transactions" className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Import Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload a bank statement (CSV or PDF) to bulk-import transactions</p>
        </div>
      </div>

      {/* Step indicator */}
      {!done && (
        <div className="flex items-center gap-2 mb-8">
          {stepDefs.map(({ label }, i) => {
            const n       = i + 1;
            const stepDone = step > n;
            const act      = step === n;
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${stepDone ? "bg-emerald-500 text-white" : act ? "bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900" : "bg-slate-200 dark:bg-slate-700 text-slate-500"}`}>
                  {stepDone ? "✓" : n}
                </div>
                <span className={`text-sm ${act ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-400"}`}>{label}</span>
                {i < 2 && <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-16 text-center cursor-pointer hover:border-emerald-400 transition-colors"
            onClick={() => !pdfLoading && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            {pdfLoading ? (
              <>
                <div className="flex justify-center mb-4">
                  <svg className="animate-spin w-10 h-10 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">Parsing PDF…</p>
                <p className="text-xs text-slate-400 mt-1">Extracting transactions from your bank statement</p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-4">📂</div>
                <p className="text-slate-600 dark:text-slate-400 font-medium mb-1">Drop your file here or click to browse</p>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-lg">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                    CSV export
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium rounded-lg">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    PDF bank statement
                  </span>
                </div>
              </>
            )}
            <input ref={fileRef} type="file" accept=".csv,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          {fileError && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/40 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {fileError}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2a: PDF Configure ── */}
      {step === 2 && isPdf && (
        <div className="space-y-5">
          {/* Detection summary */}
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {pdfMeta?.detected} transactions detected across {pdfMeta?.pages} page{pdfMeta?.pages !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70">
                Review each row in the next step — you can edit or remove anything that looks wrong
              </p>
            </div>
          </div>

          {/* Config */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Configure Import</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Transaction Direction</label>
                <select value={direction} onChange={(e) => { setDirection(e.target.value as "INCOME" | "EXPENSE"); setCategoryId(""); }} className={selectCls}>
                  <option value="EXPENSE">Expense — outgoing (debit)</option>
                  <option value="INCOME">Income — incoming (credit)</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">Applied to all rows. You can fine-tune after import.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Category (applied to all)</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                  <option value="">Select category…</option>
                  {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Preview first 3 rows */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              Preview — first {Math.min(3, reviewRows.length)} rows
            </p>
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>{["Date","Amount","Description"].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody>
                {reviewRows.slice(0, 3).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString("en-IE") : <span className="text-red-400">—</span>}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">€{parseFloat(r.amount || "0").toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs">{r.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between gap-2">
            <button onClick={reset} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Upload Different File
            </button>
            <button onClick={() => setStep(3)} className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
              Review &amp; Edit All Rows →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2b: CSV Column Mapping ── */}
      {step === 2 && !isPdf && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Map Columns — {csvRaw.length} rows detected</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([
                { label: "Date Column",        value: dateCol,   set: setDateCol },
                { label: "Amount Column",      value: amountCol, set: setAmountCol },
                { label: "Description Column", value: descCol,   set: setDescCol },
              ] as const).map(({ label, value, set }) => (
                <div key={label}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                  <select value={value} onChange={(e) => set(e.target.value)} className={selectCls}>
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Direction</label>
                <select value={direction} onChange={(e) => { setDirection(e.target.value as "INCOME" | "EXPENSE"); setCategoryId(""); }} className={selectCls}>
                  <option value="EXPENSE">Expense (outgoing)</option>
                  <option value="INCOME">Income (incoming)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                  <option value="">Select category…</option>
                  {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 border-b border-slate-100 dark:border-slate-800">Preview (first 5 rows)</p>
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>{["Date","Amount","Description"].map((h) => <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>)}</tr>
              </thead>
              <tbody>
                {csvPreview.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400">{r.date ? new Date(r.date).toLocaleDateString("en-IE") : <span className="text-red-400">invalid</span>}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300">€{r.amount}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 truncate max-w-xs">{r.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between gap-2">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Back</button>
            <button
              onClick={() => { setReviewRows(buildCsvReviewRows()); setStep(3); }}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              Review &amp; Edit All Rows →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Edit ── */}
      {step === 3 && !done && (
        <div className="space-y-4">
          {/* Success banner after each batch */}
          {lastBatch !== null && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span><strong>{lastBatch}</strong> transaction{lastBatch !== 1 ? "s" : ""} imported · <strong>{totalImported}</strong> total so far</span>
              </div>
              <button onClick={() => setLastBatch(null)} className="text-emerald-500 hover:text-emerald-700">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {/* Top bar: stats + bulk controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {selectedRows.length} of {remainingRows.length} remaining selected
                  {searchLower && <span className="text-slate-400 font-normal"> · {visibleRows.length} shown</span>}
                  {reviewRows.some((r) => r.imported) && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      ({reviewRows.filter((r) => r.imported).length} already imported)
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Select rows, pick a category above, then click Apply</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleAll(true)} className="text-xs text-emerald-600 hover:underline">Select all</button>
                <span className="text-slate-300 text-xs">·</span>
                <button onClick={() => toggleAll(false)} className="text-xs text-slate-500 hover:underline">None</button>
              </div>
            </div>

            {/* Category apply bar */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500 shrink-0">Apply to selected:</span>
                <select value={direction} onChange={(e) => { setDirection(e.target.value as "INCOME" | "EXPENSE"); setCategoryId(""); }}
                  className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-36">
                  <option value="">Category…</option>
                  {categories.filter((c) => c.direction === direction).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {/* Add new category */}
                <button
                  onClick={() => { setShowNewCat((v) => !v); setNewCatDir(direction); }}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New
                </button>
                <button
                  onClick={() => {
                    if (!categoryId) return;
                    setReviewRows((rows) => rows.map((r) =>
                      r.selected && !r.imported ? { ...r, categoryId, direction } : r
                    ));
                  }}
                  disabled={!categoryId || selectedRows.length === 0}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Apply to {selectedRows.length} row{selectedRows.length !== 1 ? "s" : ""}
                </button>
                {selectedRows.some((r) => r.categoryId) && (
                  <>
                    <span className="text-slate-300 text-xs">·</span>
                    <button
                      onClick={() => setReviewRows((rows) => rows.map((r) =>
                        r.selected && !r.imported ? { ...r, categoryId: "" } : r
                      ))}
                      className="text-xs text-slate-400 hover:text-red-500 hover:underline"
                    >
                      Clear selected
                    </button>
                  </>
                )}
              </div>

              {/* Inline new-category form */}
              {showNewCat && (
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-400 shrink-0">New category:</span>
                  <input
                    autoFocus
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); if (e.key === "Escape") setShowNewCat(false); }}
                    placeholder="Name…"
                    className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-36"
                  />
                  <select value={newCatDir} onChange={(e) => setNewCatDir(e.target.value as "INCOME" | "EXPENSE")}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                  <button
                    onClick={handleCreateCategory}
                    disabled={!newCatName.trim() || savingCat}
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors"
                  >
                    {savingCat ? "Saving…" : "Create"}
                  </button>
                  <button onClick={() => setShowNewCat(false)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                </div>
              )}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by description, date (YYYY-MM-DD) or amount…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto max-h-[58vh] overflow-y-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-8" />
                  <col className="w-28" />
                  <col className="w-24" />
                  <col />
                  <col className="w-36" />
                  <col className="w-8" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"></th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount (€)</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No rows match your search.</td></tr>
                  )}
                  {visibleRows.map(({ originalIndex: i, ...r }) => (
                    <tr
                      key={i}
                      className={`group border-t border-slate-100 dark:border-slate-800 transition-colors ${
                        r.imported
                          ? "opacity-30 bg-slate-50/50 dark:bg-slate-800/10"
                          : r.selected
                            ? "bg-white dark:bg-slate-900"
                            : "bg-slate-50/50 dark:bg-slate-800/20 opacity-50"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-1.5 align-middle">
                        {r.imported ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={(e) => updateRow(i, "selected", e.target.checked)}
                            className="rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500"
                          />
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) => updateRow(i, "date", e.target.value)}
                          className={inputCls}
                        />
                      </td>

                      {/* Amount */}
                      <td className="px-2 py-1.5 align-middle">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">€</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={r.amount}
                            onChange={(e) => updateRow(i, "amount", e.target.value)}
                            className={`${inputCls} pl-5`}
                          />
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-2 py-1.5 align-middle">
                        <input
                          type="text"
                          value={r.description}
                          onChange={(e) => updateRow(i, "description", e.target.value)}
                          placeholder="Description…"
                          className={inputCls}
                        />
                      </td>

                      {/* Category badge */}
                      <td className="px-2 py-1.5 align-middle">
                        {(() => {
                          const cat = categories.find((c) => c.id === r.categoryId);
                          return cat ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-full">
                              {cat.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300 dark:text-slate-600 italic">none</span>
                          );
                        })()}
                      </td>

                      {/* Delete */}
                      <td className="px-2 py-1.5 align-middle">
                        <button
                          onClick={() => deleteRow(i)}
                          className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove row"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between gap-2">
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Back
              </button>
              {totalImported > 0 && (
                <button
                  onClick={() => setDone(true)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Finish ({totalImported} imported)
                </button>
              )}
            </div>
            <button
              onClick={handleImport}
              disabled={importing || selectedRows.length === 0 || !categoryId}
              className="px-6 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? "Importing…" : `Import ${selectedRows.length} Selected`}
            </button>
          </div>
          {selectedRows.some((r) => !r.categoryId) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-right">
              {selectedRows.filter((r) => !r.categoryId).length} selected row{selectedRows.filter((r) => !r.categoryId).length !== 1 ? "s" : ""} still need a category
            </p>
          )}
        </div>
      )}

      {/* ── Done ── */}
      {done && (
        <div className="py-16 text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Import Complete</p>
          <p className="text-slate-500 mb-8">{totalImported} transaction{totalImported !== 1 ? "s" : ""} imported successfully.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setDone(false)} className="px-5 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Back to Review
            </button>
            <button onClick={reset} className="px-5 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Import Another File
            </button>
            <Link href="/transactions" className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors">
              View Transactions
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
