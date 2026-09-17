import React, { useEffect, useMemo, useState } from 'react';
import {
  FileCode2,
  Plus,
  Eye,
  Copy,
  Trash2,
  Save,
  X,
  Search,
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
    .btn { display: inline-block; background: #8B1A10; color: #ffffff; padding: 10px 20px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 13px; }
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
      <a href="{{unsubscribe_link}}" style="color: #8B1A10;">Unsubscribe</a>
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
    <div className="p-2 sm:p-4 md:p-6 bg-[#E8ECEF] min-h-[calc(100vh-3.5rem)] font-sans text-gray-800">
      <div className="max-w-[1240px] mx-auto bg-white rounded-lg shadow-md border border-[#C5CED6] overflow-hidden">
        {/* PowerMTA Top Crimson Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-[#8B1A10] via-[#A81D14] to-[#75110B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#E0A328]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black/25 flex items-center justify-center text-white border border-white/20 shrink-0">
              <FileCode2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>Email Templates</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 border border-white/20 text-[#FFD54F]">
                  MIME Composer
                </span>
              </h1>
              <p className="text-[11px] text-gray-200 mt-0.5 hidden sm:block">
                Standardized HTML layouts, RFC 8058 compliant headers, and dynamic merge tags.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Template</span>
            </button>
          </div>
        </div>

        {/* Search / Filter bar */}
        <div className="p-3 sm:p-4 bg-[#F8FAFC] border-b border-[#CCD2D8] flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates by name or subject..."
              className="w-full bg-white border border-[#CCD2D8] rounded pl-9 pr-4 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#8B1A10] focus:outline-none"
            />
          </div>

          <div className="text-xs text-gray-600 font-mono font-bold">
            {filtered.length} templates
          </div>
        </div>

        {/* Template Cards Grid */}
        <div className="p-4 md:p-6">
          {filtered.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-[#CCD2D8] rounded-lg text-xs text-gray-500 space-y-3 bg-[#F8FAFC]">
              <FileCode2 className="w-8 h-8 mx-auto text-gray-400" />
              <p className="text-sm font-bold text-gray-700">No templates found</p>
              <p className="text-xs text-gray-500">Create your first reusable email template.</p>
              <button
                onClick={openNew}
                className="px-3.5 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold inline-block"
              >
                Create Template
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded bg-white border border-[#CCD2D8] flex flex-col justify-between hover:border-[#8B1A10] hover:shadow-xs transition-all space-y-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{t.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-mono line-clamp-1">
                      Subject: {t.subject || '(No Subject)'}
                    </p>
                  </div>

                  {/* Mini Preview Box */}
                  <div
                    className="h-28 rounded bg-[#F8FAFC] border border-[#CCD2D8] overflow-hidden p-3 text-gray-800 text-[9px] select-none pointer-events-none opacity-90 shadow-inner"
                    dangerouslySetInnerHTML={{
                      __html: (t.htmlBody || '<p>Empty template</p>').slice(0, 1500),
                    }}
                  />

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] text-xs">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
                      <span>Opens: {t.trackOpens !== false ? 'ON' : 'OFF'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelected(t);
                          setShowEditor(true);
                        }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
                        title="Edit Template"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelected({ ...t, id: '', name: `${t.name} (Copy)` });
                          setShowEditor(true);
                        }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition"
                        title="Duplicate Template"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        className="p-1.5 rounded hover:bg-rose-50 text-gray-500 hover:text-rose-600 transition"
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
        </div>

        {/* Editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs p-3 md:p-6 flex items-center justify-center font-sans">
            <div className="w-full max-w-6xl h-[90vh] bg-white border border-[#CCD2D8] rounded-lg flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-150">
              {/* Modal Header */}
              <div className="p-4 border-b border-[#CCD2D8] flex items-center justify-between bg-gradient-to-r from-[#8B1A10] to-[#75110B] text-white">
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-[#FFD54F]" />
                  <span className="font-bold text-white text-sm">
                    {selected?.id ? 'Edit Template' : 'New Email Template'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Template'}</span>
                  </button>
                  <button
                    onClick={() => setShowEditor(false)}
                    className="p-1.5 rounded hover:bg-white/20 text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Template Inputs */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-[#CCD2D8] bg-[#F8FAFC] text-xs">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-700 font-bold mb-1">
                    Template Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Welcome Series #1"
                    className="w-full bg-white border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-700 font-bold mb-1">
                    Default Subject
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line with {{first_name}}"
                    className="w-full bg-white border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-700 font-bold mb-1">
                    Preheader / Preview Text
                  </label>
                  <input
                    value={preheader}
                    onChange={(e) => setPreheader(e.target.value)}
                    placeholder="Snippet preview in inbox"
                    className="w-full bg-white border border-[#CCD2D8] rounded px-3 py-1.5 text-gray-900 focus:border-[#8B1A10] focus:outline-none"
                  />
                </div>
              </div>

              {/* Split Editor: Code on Left, Live Preview on Right */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
                <div className="flex flex-col border-r border-[#CCD2D8] bg-white">
                  <div className="px-4 py-2 bg-[#F1F4F7] border-b border-[#CCD2D8] text-[11px] font-mono text-gray-700 font-bold uppercase tracking-wider">
                    HTML Source Code
                  </div>
                  <textarea
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    spellCheck={false}
                    className="flex-1 w-full resize-none bg-white text-gray-900 p-4 font-mono text-xs leading-relaxed outline-none border-none"
                  />
                </div>

                <div className="flex flex-col bg-[#F8FAFC]">
                  <div className="px-4 py-2 bg-[#F1F4F7] border-b border-[#CCD2D8] text-[11px] font-mono text-gray-700 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Live Rendered Preview</span>
                    <span className="text-[#2E7D32] font-mono">Sample: Alex Vance</span>
                  </div>
                  <div className="flex-1 overflow-auto p-6 bg-white">
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
    </div>
  );
};
