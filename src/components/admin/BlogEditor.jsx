import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

function ToolbarBtn({ onClick, active, children, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={'rounded px-2 py-1 text-xs font-medium ' + (active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700')}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-700 bg-slate-900/80 px-3 py-2">
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">B</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">I</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">H2</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3">H3</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="List">• List</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered">1. List</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">Quote</ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code">Code</ToolbarBtn>
      <ToolbarBtn
        onClick={() => {
          const url = window.prompt('Link URL');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        active={editor.isActive('link')}
        title="Link"
      >
        Link
      </ToolbarBtn>
    </div>
  );
}

export function BlogEditor({ post, onBack, onSave, api }) {
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [readTime, setReadTime] = useState(post?.read_time || '5 min');
  const [status, setStatus] = useState(post?.status || 'draft');
  const [publishedAt, setPublishedAt] = useState(post?.published_at ? post.published_at.slice(0, 16) : '');
  const [prompt, setPrompt] = useState('');
  const [ideas, setIdeas] = useState([]);
  const [assistBusy, setAssistBusy] = useState(false);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
      Placeholder.configure({ placeholder: 'Start writing your article…' }),
    ],
    content: post?.body_html || '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[420px] px-4 py-3 focus:outline-none text-slate-100',
      },
    },
  });

  const loadIdeas = useCallback(() => {
    api('/admin/blog/ideas').then((r) => setIdeas(r.ideas || [])).catch(() => setIdeas([]));
  }, [api]);

  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  const applyAssistResult = (result) => {
    if (result.title) setTitle(result.title);
    if (result.slug) setSlug(result.slug);
    if (result.excerpt) setExcerpt(result.excerpt);
    if (result.read_time) setReadTime(result.read_time);
    if (result.body_html && editor) {
      editor.commands.setContent(result.body_html);
    }
  };

  const runAssist = async (action, extra = {}) => {
    setAssistBusy(true);
    setErr('');
    try {
      const body = {
        action,
        prompt,
        title,
        excerpt,
        body_html: editor?.getHTML() || '',
        ...extra,
      };
      const result = await api('/admin/blog/assist', { method: 'POST', body });
      applyAssistResult(result);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setAssistBusy(false);
    }
  };

  const generateFromIdea = async (idea) => {
    setAssistBusy(true);
    setErr('');
    try {
      await api('/admin/blog/ideas/' + idea.id + '/use', { method: 'POST' });
      const result = await api('/admin/blog/assist', {
        method: 'POST',
        body: { action: 'generate', ideaId: idea.id },
      });
      applyAssistResult(result);
      setPrompt(`Write about: ${idea.title}`);
      loadIdeas();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setAssistBusy(false);
    }
  };

  const refreshIdeas = async () => {
    setIdeasBusy(true);
    setErr('');
    try {
      await api('/admin/blog/ideas/refresh', { method: 'POST' });
      loadIdeas();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setIdeasBusy(false);
    }
  };

  const dismissIdea = async (id) => {
    try {
      await api('/admin/blog/ideas/' + id + '/dismiss', { method: 'POST' });
      loadIdeas();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setErr('');
    try {
      await onSave({
        id: post?.id,
        title,
        slug,
        excerpt,
        read_time: readTime,
        status,
        published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
        body_html: editor?.getHTML() || '',
      });
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm text-slate-400 hover:text-white">← Back to posts</button>
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-lg font-semibold"
          placeholder="Post title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="button" disabled={saving} onClick={handleSave} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save draft'}
        </button>
      </div>

      {err && <p className="mb-3 text-sm text-rose-400">{err}</p>}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_1fr_260px]">
        {/* Ideas sidebar */}
        <aside className="flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
            <h3 className="text-sm font-semibold text-slate-200">Recommended ideas</h3>
            <button type="button" disabled={ideasBusy} onClick={refreshIdeas} className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
              {ideasBusy ? '…' : 'Refresh'}
            </button>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto p-2">
            {ideas.length === 0 && (
              <li className="px-2 py-4 text-center text-xs text-slate-500">No ideas yet. Click Refresh to run research.</li>
            )}
            {ideas.map((idea) => (
              <li key={idea.id} className="rounded-lg border border-slate-700/80 bg-slate-800/50 p-2">
                <p className="text-xs font-medium leading-snug text-slate-100">{idea.title}</p>
                {idea.angle && <p className="mt-1 text-[10px] text-slate-400">{idea.angle}</p>}
                <div className="mt-2 flex gap-1">
                  <button type="button" disabled={assistBusy} onClick={() => generateFromIdea(idea)} className="rounded bg-indigo-600/80 px-2 py-0.5 text-[10px] font-medium hover:bg-indigo-500 disabled:opacity-50">
                    Generate
                  </button>
                  <button type="button" onClick={() => dismissIdea(idea.id)} className="rounded px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700">
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Editor center */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60">
          <div className="grid gap-2 border-b border-slate-700 p-3 sm:grid-cols-2">
            <input className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs" placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <input className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs" placeholder="Read time" value={readTime} onChange={(e) => setReadTime(e.target.value)} />
            <textarea className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs sm:col-span-2" rows={2} placeholder="Excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
            <select className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
            <input type="datetime-local" className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
          </div>
          <EditorToolbar editor={editor} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* AI panel */}
        <aside className="flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60">
          <div className="border-b border-slate-700 px-3 py-2">
            <h3 className="text-sm font-semibold text-slate-200">AI assistant</h3>
            <p className="mt-0.5 text-[10px] text-slate-500">CreativeBuilds voice · E-E-A-T · CTA</p>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            <textarea
              className="min-h-[120px] flex-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs text-slate-100"
              placeholder='e.g. "Write a how-to on building a website with a free GitHub template"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button type="button" disabled={assistBusy || !prompt.trim()} onClick={() => runAssist('generate')} className="rounded-lg bg-indigo-600 py-2 text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50">
              {assistBusy ? 'Generating…' : 'Generate draft'}
            </button>
            <button type="button" disabled={assistBusy} onClick={() => runAssist('expand', { prompt })} className="rounded-lg border border-slate-600 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50">
              Expand article
            </button>
            <button type="button" disabled={assistBusy} onClick={() => runAssist('add_cta')} className="rounded-lg border border-slate-600 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50">
              Add CTA
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default BlogEditor;
