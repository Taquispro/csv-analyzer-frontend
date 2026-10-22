import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown,
  CircleHelp, Database, FileSpreadsheet, LayoutDashboard, LockKeyhole, Moon,
  MoreHorizontal, Plus, ShieldCheck, Sparkles, Sun, Table2, Upload, X, Zap,
} from 'lucide-react';

// In production, call the deployed Spring Boot backend directly.
// During local development, use relative URLs so the Vite /api proxy works.
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://csv-analyzer-backend-5ynj.onrender.com' : '')
).replace(/\/$/, '');

const operations = [
  ['COUNT_ROWS', 'Count rows'], ['SUM', 'Sum'], ['AVERAGE', 'Average'],
  ['MIN', 'Minimum'], ['MAX', 'Maximum'], ['GROUP_AVERAGE', 'Average by group'], ['TOP', 'Top records'],
];
const filters = [['EQ', 'Equals'], ['CONTAINS', 'Contains'], ['GT', 'Greater than'], ['GTE', 'At least'], ['LT', 'Less than'], ['LTE', 'At most']];
const suggestions = [
  { icon: BarChart3, text: 'What is the average value for each category?' },
  { icon: ArrowUpRight, text: 'Show me the top 5 records by value' },
  { icon: Database, text: 'How many rows are in this dataset?' },
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function responseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body?.error || body?.message || (typeof body === 'string' ? body : 'The request could not be completed.'));
  return body;
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return <label className="field"><span>{label}</span><span className="select-wrap"><select value={value} onChange={onChange} disabled={disabled}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select><ChevronDown size={14} /></span></label>;
}

function ResultTable({ result }) {
  if (Array.isArray(result) && result.length && typeof result[0] === 'object' && result[0] !== null) {
    const columns = Object.keys(result[0]);
    return <div className="result-table-wrap"><table><thead><tr>{columns.map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>{result.map((row, i) => <tr key={i}>{columns.map((key) => <td key={key}>{row[key] == null ? '—' : String(row[key])}</td>)}</tr>)}</tbody></table></div>;
  }
  return <pre className="result-json">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>;
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('clarity-theme') || 'light');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [question, setQuestion] = useState('');
  const [operation, setOperation] = useState('COUNT_ROWS');
  const [column, setColumn] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [filterColumn, setFilterColumn] = useState('');
  const [filterOperator, setFilterOperator] = useState('EQ');
  const [filterValue, setFilterValue] = useState('');
  const [direction, setDirection] = useState('DESC');
  const [limit, setLimit] = useState(5);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [analyses, setAnalyses] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const questionRef = useRef(null);
  const columns = preview?.columns || [];
  const resultRows = useMemo(() => preview?.rowCount?.toLocaleString() || '—', [preview]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('clarity-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (columns.length) {
      setColumn((current) => columns.includes(current) ? current : columns[0]);
      setGroupBy((current) => columns.includes(current) ? current : columns[0]);
    }
  }, [preview]);

  function acceptFile(candidate) {
    if (!candidate) return;
    setError('');
    if (!candidate.name.toLowerCase().endsWith('.csv') && candidate.type !== 'text/csv') return setError('Choose a CSV file to continue.');
    if (candidate.size > 5 * 1024 * 1024) return setError('This file is larger than the 5 MB upload limit.');
    setFile(candidate);
    setPreview(null);
    setResult(null);
  }

  async function previewFile() {
    if (!file) return;
    setBusy('preview'); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      setPreview(await responseBody(await fetch(`${API_BASE_URL}/api/csv/preview`, { method: 'POST', body })));
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  async function askData(prompt = question) {
    if (!file) return setError('Upload a CSV and preview it before asking a question.');
    if (!prompt.trim()) return setError('Write a question about your data first.');
    setBusy('ask'); setError('');
    try {
      const body = new FormData(); body.append('file', file); body.append('question', prompt.trim());
      setResult({ ...(await responseBody(await fetch(`${API_BASE_URL}/api/csv/ask`, { method: 'POST', body }))), kind: 'AI' });
      setAnalyses((value) => value + 1);
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  async function runManual(event) {
    event.preventDefault();
    if (!file) return setError('Upload and preview a CSV before running an analysis.');
    setBusy('manual'); setError('');
    try {
      const body = new FormData(); body.append('file', file); body.append('operation', operation);
      if (operation !== 'COUNT_ROWS') body.append('column', column);
      if (operation === 'GROUP_AVERAGE') body.append('groupBy', groupBy);
      if (operation === 'TOP') { body.append('sortDirection', direction); body.append('limit', String(limit)); }
      if (filterColumn) { body.append('filterColumn', filterColumn); body.append('filterOperator', filterOperator); body.append('filterValue', filterValue); }
      setResult({ ...(await responseBody(await fetch(`${API_BASE_URL}/api/csv/analyze`, { method: 'POST', body }))), kind: 'MANUAL' });
      setAnalyses((value) => value + 1);
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  function resetFile() {
    setFile(null); setPreview(null); setResult(null); setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brand-symbol"><Activity size={19} strokeWidth={2.5} /></span><span>clarity<span className="brand-dot">.</span></span></a>
      <div className="workspace-switcher"><span className="workspace-avatar">P</span><span className="workspace-copy"><b>Personal workspace</b><small>Free plan</small></span><ChevronDown size={14} /></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav"><a className="side-link current" href="#top"><LayoutDashboard size={17} />Overview</a><a className="side-link" href="#data-panel"><Database size={17} />Datasets<span className="side-count">{file ? 1 : 0}</span></a><a className="side-link" href="#analysis-panel"><BarChart3 size={17} />Analysis</a></nav>
      <div className="sidebar-spacer" />
      <div className="side-promo"><div className="promo-orbit"><Sparkles size={17} /></div><b>Answers are closer than you think.</b><p>Ask a question in plain English and let Clarity handle the analysis.</p><button className="promo-button" onClick={() => { questionRef.current?.focus(); document.querySelector('#analysis-panel')?.scrollIntoView({ behavior: 'smooth' }); }}>Explore AI analysis <ArrowRight size={14} /></button></div>
      <div className="account"><div className="account-avatar">TA</div><div className="account-copy"><b>Data Analyst</b><span>Personal account</span></div><button className="icon-button" aria-label="Account menu"><MoreHorizontal size={19} /></button></div>
    </aside>

    <main className="main-content" id="top">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><b>Overview</b></div><div className="top-actions"><span className="service-status"><i />Services operational</span><span className="top-divider" /><button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span></button><button className="help-button" aria-label="Help"><CircleHelp size={17} /></button></div></header>
      <div className="page-content">
        <section className="welcome"><div><div className="overline"><span />DATA WORKSPACE</div><h1>Make your data <span>make sense.</span></h1><p>Good morning, Analyst. What would you like to discover today?</p></div><button className="button button-primary upload-shortcut" onClick={() => fileRef.current?.click()}><Upload size={16} />Upload dataset</button></section>

        <section className="metrics" aria-label="Dataset overview">
          <article className="metric-card"><div className="metric-heading">ACTIVE DATASET<FileSpreadsheet className="metric-icon lavender" size={17} /></div><strong className="metric-value file-value">{file?.name || 'No dataset yet'}</strong><span className="metric-note">{file ? `${formatBytes(file.size)} · ${preview ? 'Ready to explore' : 'Ready to preview'}` : 'Upload a CSV to get started'}</span></article>
          <article className="metric-card"><div className="metric-heading">TOTAL RECORDS<Database className="metric-icon blue" size={17} /></div><strong className="metric-value">{resultRows}</strong><span className="metric-note">Rows available for analysis</span></article>
          <article className="metric-card"><div className="metric-heading">DATA FIELDS<Table2 className="metric-icon green" size={17} /></div><strong className="metric-value">{preview ? columns.length : '—'}</strong><span className="metric-note">Columns found in your dataset</span></article>
          <article className="metric-card"><div className="metric-heading">INSIGHTS CREATED<Sparkles className="metric-icon amber" size={17} /></div><strong className="metric-value">{analyses}</strong><span className="metric-note">Analyses in this session</span></article>
        </section>

        {error && <div className="error-banner" role="alert"><span><X size={15} /></span>{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}

        <section className="work-grid">
          <div className="left-column">
            <article className="card data-card" id="data-panel"><div className="card-heading"><div><span className="card-kicker">YOUR SOURCE</span><h2>Bring in your data</h2></div><span className="step-number">01</span></div>
              <input ref={fileRef} className="hidden-input" type="file" accept=".csv,text/csv" onChange={(e) => acceptFile(e.target.files?.[0])} />
              {!file ? <div className={`drop-area ${dragging ? 'is-dragging' : ''}`} role="button" tabIndex="0" onClick={() => fileRef.current?.click()} onKeyDown={(e) => ['Enter', ' '].includes(e.key) && fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files?.[0]); }}><div className="upload-art"><div className="paper"><div /><div /><div /></div><span><Upload size={15} /></span></div><b>Drop your CSV to get started</b><p>or <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>browse files</button> from your computer</p><div className="upload-limits"><span className="csv-label">CSV</span> Up to 5 MB <i /> Up to 100,000 rows</div></div> : <div className="selected-file"><div className="file-icon"><FileSpreadsheet size={20} /></div><div className="selected-copy"><b>{file.name}</b><span>{formatBytes(file.size)} <i /> CSV file</span></div><span className="file-check"><Check size={14} /></span><button className="icon-button remove-button" onClick={resetFile} aria-label="Remove selected file"><X size={17} /></button></div>}
              <div className="data-card-footer"><span><LockKeyhole size={13} />Processed securely for this request</span><button className="button button-outline" disabled={!file || busy === 'preview'} onClick={previewFile}>{busy === 'preview' ? <span className="spinner" /> : <>{preview ? 'Refresh preview' : 'Preview data'}<ArrowRight size={14} /></>}</button></div>
            </article>

            <article className="card preview-card"><div className="card-heading"><div><span className="card-kicker">A QUICK LOOK</span><h2>Dataset preview</h2></div>{preview && <span className="preview-count"><span />{Number(preview.rowCount).toLocaleString()} records</span>}</div>
              {!preview ? <div className="preview-empty"><div className="preview-empty-icon"><Table2 size={20} /></div><b>Nothing to preview just yet</b><span>Choose a CSV file and we’ll show the first few rows here.</span></div> : <div className="preview-table-wrap"><table><thead><tr>{columns.map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody>{preview.preview?.map((row, i) => <tr key={i}>{columns.map((name) => <td key={name}>{row[name] ?? ''}</td>)}</tr>)}</tbody></table></div>}
              {preview && <div className="table-foot"><span>Showing {preview.preview?.length || 0} of {Number(preview.rowCount).toLocaleString()} rows</span><span>{columns.length} fields detected</span></div>}
            </article>
          </div>

          <div className="right-column">
            <article className="card ask-card" id="analysis-panel"><div className="card-heading"><div><span className="card-kicker">YOUR DATA, IN CONVERSATION</span><h2>Ask Clarity</h2></div><span className="ai-badge"><Sparkles size={12} /> AI ASSISTANT</span></div><p className="card-intro">Describe what you want to know. Clarity will choose the right analysis and explain what it finds.</p>
              <form onSubmit={(e) => { e.preventDefault(); askData(); }}><label className="sr-only" htmlFor="question">Ask a question about this dataset</label><div className="question-box"><textarea ref={questionRef} id="question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask anything about your dataset..." rows={3} /><div className="question-bottom"><span><Sparkles size={12} />Natural language analysis</span><button className="ask-submit" disabled={!file || busy === 'ask'}>{busy === 'ask' ? <span className="spinner light-spinner" /> : <>Ask Clarity<ArrowUpRight size={14} /></>}</button></div></div></form>
              <div className="suggested-header"><span>GET INSPIRED</span><i /></div><div className="suggestions">{suggestions.map(({ icon: Icon, text }) => <button key={text} onClick={() => { setQuestion(text); if (file && preview) askData(text); else { questionRef.current?.focus(); if (!file) setError('Upload and preview a CSV to ask a question.'); } }}><span className="suggestion-icon"><Icon size={14} /></span>{text}<ArrowUpRight className="suggestion-arrow" size={14} /></button>)}</div>
            </article>

            <article className="card manual-card"><button className="manual-heading" onClick={() => setManualOpen(!manualOpen)} aria-expanded={manualOpen}><span><span className="card-kicker">MORE CONTROL</span><b>Build an analysis</b></span><span className="manual-toggle">{manualOpen ? <X size={14} /> : <Plus size={15} />}</span></button>
              {manualOpen && <form className="manual-form" onSubmit={runManual}><p className="card-intro">Select the operation and fields to run a focused analysis.</p><SelectField label="Operation" value={operation} onChange={(e) => setOperation(e.target.value)} options={operations} disabled={!preview} />
                {operation !== 'COUNT_ROWS' && <SelectField label="Value column" value={column} onChange={(e) => setColumn(e.target.value)} options={columns.map((c) => [c, c])} disabled={!preview} />}
                {operation === 'GROUP_AVERAGE' && <SelectField label="Group results by" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} options={columns.map((c) => [c, c])} disabled={!preview} />}
                <SelectField label="Filter column (optional)" value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)} options={[['', 'No filter'], ...columns.map((c) => [c, c])]} disabled={!preview} />
                {filterColumn && <div className="filter-controls"><SelectField label="Condition" value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)} options={filters} /><label className="field"><span>Match value</span><input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="Enter value" /></label></div>}
                {operation === 'TOP' && <div className="filter-controls"><SelectField label="Order" value={direction} onChange={(e) => setDirection(e.target.value)} options={[["DESC", "Highest first"], ["ASC", "Lowest first"]]} /><label className="field"><span>Rows to return</span><input type="number" min="1" max="100" value={limit} onChange={(e) => setLimit(e.target.value)} /></label></div>}
                <button className="button button-primary run-button" disabled={!preview || busy === 'manual'}>{busy === 'manual' ? <span className="spinner light-spinner" /> : <>Run analysis<ArrowRight size={14} /></>}</button>
              </form>}
            </article>
          </div>
        </section>

        {result && <section className="card result-card"><div className="card-heading"><div><span className="card-kicker">ANALYSIS RESULT</span><h2>{result.kind === 'AI' ? 'Here’s what I found' : 'Analysis complete'}</h2></div><span className="result-tag">{result.operation?.replaceAll('_', ' ')}</span></div>{result.explanation && <div className="explanation"><Sparkles size={16} /><p>{result.explanation}</p></div>}<ResultTable result={result.result} /></section>}
        <footer className="page-footer"><span>© 2026 Clarity Analytics</span><span><ShieldCheck size={13} /> Your data, treated with care</span><span>Thoughtful analysis <Zap size={12} /></span></footer>
      </div>
    </main>
  </div>;
}
