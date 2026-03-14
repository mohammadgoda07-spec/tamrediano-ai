import { useState, useEffect, useRef, useCallback } from 'react'
import { signInWithGoogle, logout, saveDocument, getUserDocuments, deleteDocument } from '../lib/firebase'
import { TOOLS } from '../lib/prompts'

async function extractText(file) {
  if (file.type === 'application/pdf') {
    if (!window.pdfjsLib) {
      await new Promise((res, rej) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res() }
        s.onerror = rej
        document.head.appendChild(s)
      })
    }
    const buf = await file.arrayBuffer()
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
    let txt = ''
    for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      txt += content.items.map(x => x.str).join(' ') + '\n'
    }
    return txt.trim().substring(0, 15000)
  }
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => res(e.target.result.substring(0, 15000))
    r.onerror = rej
    r.readAsText(file, 'UTF-8')
  })
}

export default function Home({ user }) {
  const [tab, setTab] = useState('generate')
  const [selectedTool, setSelectedTool] = useState(null)
  const [inputMode, setInputMode] = useState('file')
  const [file, setFile] = useState(null)
  const [textInput, setTextInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState('')
  const [error, setError] = useState('')
  const [generatedHtml, setGeneratedHtml] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [previewDoc, setPreviewDoc] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (tab === 'library' && user?.uid) {
      setDocsLoading(true)
      getUserDocuments(user.uid).then(setDocs).catch(console.error).finally(() => setDocsLoading(false))
    }
  }, [tab, user])

  const handleDrop = useCallback(e => {
    e.preventDefault()
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0])
  }, [])

  const run = async () => {
    if (!selectedTool) { setError('اختار نوع الملف أولاً'); return }
    if (!user) { setError('سجّل دخولك أولاً بـ Google'); return }
    setError(''); setGeneratedHtml(''); setLoading(true)
    try {
      let content = ''
      if (inputMode === 'file') {
        if (!file) { setError('ارفع ملف أولاً'); setLoading(false); return }
        setLoadMsg('📖 قراءة الملف...')
        content = await extractText(file)
        if (!content.trim()) { setError('مش لاقي نص — جرّب لصق النص'); setLoading(false); return }
      } else {
        content = textInput.trim()
        if (!content) { setError('الصق النص أولاً'); setLoading(false); return }
      }
      setLoadMsg('🤖 AI بيولّد...')
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: selectedTool, content, uid: user.uid })
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'حصل خطأ') }
      const { html } = await res.json()
      setGeneratedHtml(html)
      const tool = TOOLS.find(t => t.id === selectedTool)
      await saveDocument(user.uid, selectedTool, `${tool.name} — ${content.substring(0, 50)}`, html)
      setShowPreview(true)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const downloadHtml = () => {
    const html = previewDoc?.html || generatedHtml
    if (!html) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    a.download = `tamrediano-${Date.now()}.html`
    a.click()
  }

  const printHtml = () => {
    const html = previewDoc?.html || generatedHtml
    if (!html) return
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 800)
  }

  const tool = selectedTool ? TOOLS.find(t => t.id === selectedTool) : null
  const S = { fontFamily: "'Tajawal', sans-serif" }

  if (user === undefined) return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #242c42', borderTopColor: '#38e8d8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, backgroundImage: 'linear-gradient(rgba(56,232,216,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(56,232,216,.018) 1px,transparent 1px)', backgroundSize: '56px 56px' }} />

      {showPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.95)', zIndex: 600, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 52, background: '#111520', borderBottom: '1px solid #242c42', flexShrink: 0 }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, ...S }}>{previewDoc ? previewDoc.title : tool?.name + ' — Preview'}</div>
            <button onClick={downloadHtml} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: '#fff', ...S, fontSize: 12, cursor: 'pointer' }}>⬇️ تحميل</button>
            <button onClick={printHtml} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#059669,#34d399)', color: '#fff', ...S, fontSize: 12, cursor: 'pointer' }}>🖨️ PDF</button>
            <button onClick={() => { setShowPreview(false); setPreviewDoc(null) }} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #242c42', background: '#181d2e', color: '#9ba3bc', ...S, fontSize: 12, cursor: 'pointer' }}>✕</button>
          </div>
          <iframe srcDoc={previewDoc?.html || generatedHtml} style={{ flex: 1, border: 'none', background: '#fff' }} />
        </div>
      )}

      <header style={{ position: 'sticky', top: 0, zIndex: 200, height: 60, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,13,20,.92)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#7c6ef0,#38e8d8)', display: 'grid', placeItems: 'center', fontSize: 17 }}>🧠</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, background: 'linear-gradient(90deg,#38e8d8,#7c6ef0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'sans-serif' }}>Tamrediano AI</div>
            <div style={{ fontSize: 9, color: '#4a5570', fontFamily: 'monospace', letterSpacing: 1 }}>MEDICAL · DOCUMENT · GENERATOR</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[['generate','⚡ توليد'],['library','📚 مكتبتي']].map(([id,lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${tab===id?'#38e8d8':'#242c42'}`, background: tab===id?'rgba(56,232,216,.1)':'transparent', color: tab===id?'#38e8d8':'#4a5570', ...S, fontSize: 12, cursor: 'pointer' }}>{lbl}</button>
          ))}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={user.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #38d898' }} />
              <button onClick={logout} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #242c42', background: 'transparent', color: '#4a5570', ...S, fontSize: 11, cursor: 'pointer' }}>خروج</button>
            </div>
          ) : (
            <button onClick={signInWithGoogle} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#38e8d8,#7c6ef0)', color: '#fff', ...S, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔑 Google Login</button>
          )}
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 5, maxWidth: 960, margin: '0 auto', padding: '32px 16px 60px' }}>

        {tab === 'generate' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ display: 'inline-block', padding: '4px 14px', marginBottom: 14, borderRadius: 20, border: '1px solid rgba(56,232,216,.2)', background: 'rgba(56,232,216,.05)', fontSize: 11, color: '#38e8d8', fontFamily: 'monospace' }}>✦ يولّد ملفات بأسلوب TAMREDEANO</div>
              <h1 style={{ fontSize: 'clamp(24px,5vw,44px)', fontWeight: 800, marginBottom: 10, lineHeight: 1.2, ...S }}>
                ولّد ملفاتك الطبية{' '}
                <span style={{ background: 'linear-gradient(90deg,#38e8d8,#7c6ef0,#f0c060)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>في ثوانٍ</span>
              </h1>
              <p style={{ color: '#9ba3bc', fontSize: 14, ...S }}>ارفع محتوى طبي — اختار نوع الملف — احفظ كـ PDF</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 24 }}>
              {TOOLS.map(t => (
                <div key={t.id} onClick={() => setSelectedTool(t.id)} style={{ padding: '14px 10px', borderRadius: 12, border: `1px solid ${selectedTool===t.id ? t.color : '#242c42'}`, background: selectedTool===t.id ? t.bg : '#181d2e', cursor: 'pointer', textAlign: 'center', transition: 'all .2s', position: 'relative' }}>
                  {selectedTool===t.id && <span style={{ position: 'absolute', top: 6, left: 8, fontSize: 9, color: t.color, fontFamily: 'monospace', fontWeight: 700 }}>✓</span>}
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, ...S }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: '#4a5570', lineHeight: 1.4, ...S }}>{t.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#111520', border: '1px solid #242c42', borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '0 18px', height: 44, display: 'flex', alignItems: 'center', gap: 8, background: '#0a0d14', borderBottom: '1px solid #242c42' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {['#f04060','#f0a020','#38d898'].map((c,i) => <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
                </div>
                <div style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#4a5570', fontFamily: 'monospace' }}>tamrediano.ai {tool ? `— ${tool.name}` : ''}</div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {[['file','📎 رفع ملف'],['text','✏️ لصق نص']].map(([m,lbl]) => (
                    <button key={m} onClick={() => setInputMode(m)} style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${inputMode===m?'#38e8d8':'#242c42'}`, background: inputMode===m?'rgba(56,232,216,.08)':'transparent', color: inputMode===m?'#38e8d8':'#4a5570', ...S, fontSize: 12, cursor: 'pointer' }}>{lbl}</button>
                  ))}
                </div>

                {inputMode === 'file' && (
                  !file ? (
                    <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #2d3854', borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', background: '#181d2e', marginBottom: 14 }}>
                      <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, ...S }}>اسحب الملف أو اضغط</div>
                      <div style={{ fontSize: 11, color: '#4a5570', ...S }}>PDF · TXT · Word</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 14, background: 'rgba(56,216,152,.06)', border: '1px solid rgba(56,216,152,.2)', borderRadius: 9 }}>
                      <span style={{ fontSize: 22 }}>📄</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, ...S }}>{file.name}</div>
                        <div style={{ fontSize: 10, color: '#4a5570', fontFamily: 'monospace' }}>{(file.size/1024).toFixed(1)} KB</div>
                      </div>
                      <button onClick={() => setFile(null)} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(240,64,96,.1)', color: '#f04060', fontSize: 13, cursor: 'pointer' }}>✕</button>
                    </div>
                  )
                )}

                {inputMode === 'text' && (
                  <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="الصق المحتوى الطبي هنا..." style={{ width: '100%', minHeight: 120, padding: '10px 12px', marginBottom: 14, background: '#181d2e', border: '1px solid #2d3854', borderRadius: 9, color: '#e8eaf0', ...S, fontSize: 13, resize: 'vertical', outline: 'none' }} />
                )}

                <button onClick={run} disabled={loading} style={{ width: '100%', height: 48, borderRadius: 10, border: 'none', background: loading ? '#242c42' : (tool ? tool.gradient : 'linear-gradient(135deg,#38e8d8,#7c6ef0)'), color: '#fff', ...S, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? .65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={loading ? { animation: 'spin .8s linear infinite', display: 'inline-block' } : {}}>{loading ? '⏳' : '⚡'}</span>
                  {loading ? loadMsg : `ولّد ${tool?.name || 'الملف'}`}
                </button>

                {loading && <div style={{ height: 2, background: '#242c42', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}><div style={{ height: '100%', background: 'linear-gradient(90deg,#38e8d8,#7c6ef0)', animation: 'progAnim 1.6s ease-in-out infinite' }} /></div>}

                {error && <div style={{ display: 'flex', gap: 8, padding: '10px 14px', marginTop: 10, background: 'rgba(240,64,96,.07)', border: '1px solid rgba(240,64,96,.25)', borderRadius: 9, color: '#f87171', fontSize: 12, ...S }}><span>⚠️</span><span>{error}</span></div>}

                {generatedHtml && !loading && (
                  <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(56,216,152,.06)', border: '1px solid rgba(56,216,152,.25)', borderRadius: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#38d898', marginBottom: 8, ...S }}>✅ تم التوليد وحُفظ في مكتبتك!</div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      <button onClick={() => { setPreviewDoc(null); setShowPreview(true) }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#38e8d8,#7c6ef0)', color: '#fff', ...S, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>👁️ معاينة</button>
                      <button onClick={downloadHtml} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a78bfa)', color: '#fff', ...S, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⬇️ تحميل</button>
                      <button onClick={printHtml} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#059669,#34d399)', color: '#fff', ...S, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨️ PDF</button>
                    </div>
                  </div>
                )}

                {!user && <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(56,232,216,.05)', border: '1px solid rgba(56,232,216,.15)', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: '#9ba3bc', ...S }}>سجّل دخولك لحفظ الملفات تلقائياً</div>
                  <button onClick={signInWithGoogle} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#38e8d8,#7c6ef0)', color: '#fff', ...S, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Google Login</button>
                </div>}
              </div>
            </div>
          </>
        )}

        {tab === 'library' && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, ...S }}>📚 مكتبتي</h2>
              <p style={{ color: '#4a5570', fontSize: 13, ...S }}>كل الملفات بتتحفظ هنا تلقائياً</p>
            </div>
            {!user ? (
              <div style={{ textAlign: 'center', padding: 50 }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, ...S }}>سجّل دخولك الأول</div>
                <button onClick={signInWithGoogle} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#38e8d8,#7c6ef0)', color: '#fff', ...S, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 12 }}>Google Login</button>
              </div>
            ) : docsLoading ? (
              <div style={{ color: '#4a5570', ...S }}>جاري التحميل...</div>
            ) : docs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 50 }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📭</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, ...S }}>مكتبتك فاضية</div>
                <button onClick={() => setTab('generate')} style={{ padding: '9px 22px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#38e8d8,#7c6ef0)', color: '#fff', ...S, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 12 }}>⚡ ابدأ التوليد</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {docs.map(d => {
                  const t = TOOLS.find(x => x.id === d.toolId)
                  return (
                    <div key={d.id} style={{ padding: '12px 14px', border: '1px solid #242c42', borderRadius: 10, background: '#181d2e', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{t?.icon || '📄'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...S }}>{d.title}</div>
                        <div style={{ fontSize: 10, color: '#4a5570', fontFamily: 'monospace' }}>{new Date(d.createdAt).toLocaleDateString('ar-EG')}</div>
                      </div>
                      <button onClick={() => { setPreviewDoc(d); setShowPreview(true) }} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${t?.color || '#38e8d8'}`, background: 'transparent', color: t?.color || '#38e8d8', ...S, fontSize: 11, cursor: 'pointer' }}>فتح</button>
                      <button onClick={async () => { if(confirm('حذف؟')) { await deleteDocument(d.id); setDocs(prev => prev.filter(x => x.id !== d.id)) } }} style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(240,64,96,.1)', color: '#f04060', fontSize: 12, cursor: 'pointer' }}>✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      <footer style={{ position: 'relative', zIndex: 5, textAlign: 'center', padding: 16, color: '#4a5570', fontSize: 10, fontFamily: 'monospace', borderTop: '1px solid #242c42' }}>
        TAMREDIANO AI · BY MOHAMED FEKRY
      </footer>
    </>
  )
}
