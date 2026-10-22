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
