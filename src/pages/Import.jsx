import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Download,
  CheckCircle2,
  FileText,
  ScanLine,
} from 'lucide-react'
import { Card, CardHeader, Button, ErrorNote, Badge } from '../components/ui'
import { uploadStatement, loadDemo } from '../lib/api'
import { currency } from '../lib/format'

const SAMPLE = `Date,Description,Amount
2026-11-01,WHOLE FOODS MARKET,84.20
2026-11-02,DOORDASH*SUSHI PALACE,42.50
2026-11-03,NETFLIX.COM MONTHLY,15.99
2026-11-04,SHELL GAS STATION,51.30
2026-11-05,ELECTRIC UTILITY BILL,96.40`

const SOURCE_LABEL = {
  pdf: 'PDF statement',
  text: 'CSV / TSV file',
}

export default function Import({ user, onImported, onNavigate }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleUpload = useCallback(
    async (file) => {
      setBusy(true)
      setError(null)
      setResult(null)
      try {
        const summary = await uploadStatement(user, file)
        setResult(summary)
        await onImported()
      } catch (err) {
        setError(err.message)
      } finally {
        setBusy(false)
      }
    },
    [user, onImported]
  )

  const onDrop = useCallback(
    (accepted) => {
      if (accepted[0]) handleUpload(accepted[0])
    },
    [handleUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.tsv', '.txt'],
      'application/pdf': ['.pdf'],
    },
  })

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'moneytrack-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadDemoData = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const summary = await loadDemo(user)
      setResult(summary)
      await onImported()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const source = result?.import?.source

  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Import a statement</h2>
        <p className="mt-1 text-xs text-muted">
          Bank or credit-card statements as <span className="text-ink">PDF</span>, CSV or TSV.
          PDFs need selectable text — export CSV for scans or screenshots.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="p-4">
            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-200 ${
                isDragActive
                  ? 'border-accent bg-accent/5'
                  : 'border-line-strong bg-canvas/40 hover:border-accent/50'
              }`}
            >
              <input {...getInputProps()} aria-label="Upload PDF, CSV or TSV statement" />
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-accent">
                <UploadCloud className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {busy ? 'Crunching numbers…' : isDragActive ? 'Drop it here' : 'Drop your statement here'}
                </p>
                <p className="mt-1 text-xs text-muted">or click to browse · .pdf, .csv, .tsv, .txt</p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-faint">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Parsed locally, never uploaded to a third party
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button variant="secondary" size="sm" onClick={loadDemoData} loading={busy}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Load demo dataset
              </Button>
              <button
                onClick={downloadSample}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted underline-offset-2 hover:text-accent hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download sample CSV
              </button>
            </div>

            {error && (
              <div className="mt-3">
                <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="How parsing works" icon={FileSpreadsheet} />
          <ul className="space-y-3 px-5 pb-5 text-xs text-muted">
            <li className="flex gap-2">
              <span className="num text-accent">01</span>
              <span>
                <span className="text-ink">PDF</span> — text is extracted and dated rows with an amount
                are detected. Cards lists and summaries are skipped.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="num text-accent">02</span>
              <span>
                <span className="text-ink">CSV / TSV</span> — split on commas or tabs with a header
                containing “date”.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="num text-accent">03</span>
              Categories, waste flags and projections are applied to every row.
            </li>
          </ul>
          <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-line bg-canvas/40 p-3">
            <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-muted">
              Scanned or image-only PDFs contain no text. Export CSV from your bank instead — no OCR
              is run on your device.
            </p>
          </div>
        </Card>
      </div>

      {result && (
        <Card className="glow-accent">
          <CardHeader
            title="Import complete"
            subtitle={
              result.import
                ? `${SOURCE_LABEL[source] || 'Statement'}${result.import.pages ? ` · ${result.import.pages} page${result.import.pages === 1 ? '' : 's'}` : ''} · ${result.import.transactions} transactions`
                : `${result.transaction_count} transactions in this file`
            }
            icon={CheckCircle2}
            action={<Badge tone="accent">Analysed</Badge>}
          />
          <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-faint">Spent</p>
              <p className="num mt-1 text-sm text-ink">{currency(result.total_spent)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-faint">Waste</p>
              <p className="num mt-1 text-sm text-danger">{currency(result.waste_total)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-faint">Categories</p>
              <p className="num mt-1 text-sm text-ink">{result.categories.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-faint">Annual leak</p>
              <p className="num mt-1 text-sm text-warn">{currency(result.annual_waste_projection)}</p>
            </div>
          </div>
          {result.import && (
            <div className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-[11px] text-faint">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{result.import.file}</span>
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => onNavigate('overview')}>
          Go to overview
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
