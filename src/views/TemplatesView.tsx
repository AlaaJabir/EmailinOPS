import React, { useEffect, useMemo, useState } from 'react';
import {
  FileCode2,
  Plus,
  Eye,
  Copy,
  Trash2,
  Send,
  Save,
  X,
  Search,
  CheckCircle2,
  Tag,
  Clock,
} from 'lucide-react';
import { Template } from '../types';

interface TemplatesViewProps {
  templates: Template[];
  authFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => void;
  onTest?: (payload: any) => Promise<void>;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  templates,
  authFetch,
  onRefresh,
  onTest,
}) => {
  const [selected, setSelected] = useState<Template | null>(templates[0] || null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [preheader, setPreheader] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setSubject(selected.subject || '');
      setHtml(selected.htmlBody || '');
      setPreheader(selected.preheader || '');
    }
  }, [selected]);

  const previewHtml = useMemo(
    () =>
      html
        .replace(/\{\{\s*first_name\s*\}\}/gi, 'Alex')
        .replace(/\{\{\s*last_name\s*\}\}/gi, 'Vance')
        .replace(/\{\{\s*email\s*\}\}/gi, 'alex@example.com')
        .replace(/\{\{\s*(unsubscribe_url|unsubscribe_link)\s*\}\}/gi, '#unsubscribe'),
    [html]
  );

  const openNew = () => {
    setSelected(null);
    setName('New Template');
    setSubject('Important announcement regarding your service');
    setPreheader('Read this brief summary');
    setHtml(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1E293B; margin: 0; padding: 24px; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 32px; }
    h1 { font-size: 20px; font-weight: 700; color: #0F172A; margin-top: 0; }
    p { font-size: 14px; margin-bottom: 16px; }
    .btn { display: inline-block; background: #4F46E5; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hello {{first_name}},</h1>
    <p>We are excited to share our latest infrastructure updates with you. Everything is operating smoothly.</p>
    <p><a href="https://example.com" class="btn">View System Telemetry</a></p>
    <div class="footer">
      You are receiving this notification because you subscribed to operational alerts.<br/>
      <a href="{{unsubscribe_link}}" style="color: #4F46E5;">Unsubscribe</a>
    </div>
  </div>
</body>
</html>`
    );
    setShowEditor(true);
  };

  const save = async () => {
    if (!authFetch || !name.trim() || !html.trim()) return;
    setSaving(true);
    try {
      const body = {
        name,
        subject,
        preheader,
        htmlBody: html,
        plainText: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        variables: ['first_name', 'last_name', 'email', 'unsubscribe_link'],
        trackOpens: true,
        trackClicks: true,
      };
      const r = selected?.id
        ? await authFetch(`/api/templates/${selected.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await authFetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      if (r.ok) {
        setShowEditor(false);
        onRefresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!authFetch || !confirm('Permanently delete this template?')) return;
    const r = await authFetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (r.ok) {
      if (selected?.id === id) setSelected(null);
      onRefresh();
    }
  };

  const filtered = templates.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.subject && t.subject.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-indigo-400" />
            <span>Email Templates</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Standardized HTML layouts, RFC 8058 compliant headers, and dynamic merge tags.
          </p>
        </div>

        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Template</span>
        </button>
      </div>

      {/* Search / Filter bar */}
      <div className="p-3.5 rounded-lg bg-[#111827] border border-slate-800/90 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name or subject..."
            className="w-full bg-[#0A0F1A] border border-slate-800 rounded-md pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500/60 focus:outline-none"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          {filtered.length} templates
        </div>
      </div>

      {/* Template Cards Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-800 rounded-lg text-xs text-slate-400 space-y-3 bg-[#111827]/40">
          <FileCode2 className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-sm font-medium text-slate-300">No templates found</p>
          <p className="text-xs text-slate-500">Create your first reusable email template.</p>
          <button
            onClick={openNew}
            className="px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-block"
          >
            Create Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="p-5 rounded-lg bg-[#111827] border border-slate-800/90 flex flex-col justify-between hover:border-slate-700/80 transition-colors space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white line-clamp-1">{t.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono line-clamp-1">
                  Subject: {t.subject || '(No Subject)'}
                </p>
              </div>

              {/* Mini Preview Box */}
              <div
                className="h-28 rounded-md bg-white border border-slate-700 overflow-hidden p-3 text-slate-900 text-[9px] select-none pointer-events-none opacity-90 shadow-inner"
                dangerouslySetInnerHTML={{
                  __html: (t.htmlBody || '<p>Empty template</p>').slice(0, 1500),
                }}
              />

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                  <span>Opens: {t.trackOpens !== false ? 'ON' : 'OFF'}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelected(t);
                      setShowEditor(true);
                    }}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Edit Template"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setSelected({ ...t, id: '', name: `${t.name} (Copy)` });
                      setShowEditor(true);
                    }}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    title="Duplicate Template"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    className="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                    title="Delete Template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs p-3 md:p-6 flex items-center justify-center font-sans">
          <div className="w-full max-w-6xl h-[90vh] bg-[#111827] border border-slate-800 rounded-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0E1524]">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-white text-sm">
                  {selected?.id ? 'Edit Template' : 'New Email Template'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Template'}</span>
                </button>
                <button
                  onClick={() => setShowEditor(false)}
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Template Inputs */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-slate-800 bg-[#0A0F1A] text-xs">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Template Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Welcome Series #1"
                  className="w-full bg-[#111827] border border-slate-800 rounded-md px-3 py-1.5 text-white focus:border-indigo-500/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Default Subject
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line with {{first_name}}"
                  className="w-full bg-[#111827] border border-slate-800 rounded-md px-3 py-1.5 text-white focus:border-indigo-500/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Preheader / Preview Text
                </label>
                <input
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  placeholder="Snippet preview in inbox"
                  className="w-full bg-[#111827] border border-slate-800 rounded-md px-3 py-1.5 text-white focus:border-indigo-500/60 focus:outline-none"
                />
              </div>
            </div>

            {/* Split Editor: Code on Left, Live Preview on Right */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
              <div className="flex flex-col border-r border-slate-800 bg-[#0B0F19]">
                <div className="px-4 py-2 bg-[#0E1524] border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  HTML Source Code
                </div>
                <textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  spellCheck={false}
                  className="flex-1 w-full resize-none bg-[#0B0F19] text-indigo-200 p-4 font-mono text-xs leading-relaxed outline-none"
                />
              </div>

              <div className="flex flex-col bg-slate-100">
                <div className="px-4 py-2 bg-[#0E1524] border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Live Rendered Preview</span>
                  <span className="text-emerald-400 font-mono">Sample Contact: Alex Vance</span>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-slate-100">
                  <div
                    className="max-w-xl mx-auto shadow-sm"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
