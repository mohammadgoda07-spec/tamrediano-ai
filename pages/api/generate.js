import { getPrompt } from '../../lib/prompts'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { toolId, content, uid } = req.body
  if (!toolId || !content || !uid) return res.status(400).json({ error: 'Missing fields' })

  const prompt = getPrompt(toolId, content)
  let html = ''

  if (process.env.GROQ_API_KEY) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 8000, messages: [
          { role: 'system', content: 'Return COMPLETE HTML ONLY starting with <!DOCTYPE html>' },
          { role: 'user', content: prompt }
        ]})
      })
      const d = await r.json()
      html = d.choices?.[0]?.message?.content || ''
    } catch(e) { console.error('Groq failed:', e.message) }
  }

  if (!html && process.env.GEMINI_API_KEY) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Return COMPLETE HTML ONLY starting with <!DOCTYPE html>\n\n' + prompt }] }], generationConfig: { maxOutputTokens: 8192 } })
      })
      const d = await r.json()
      html = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch(e) { console.error('Gemini failed:', e.message) }
  }

  if (!html) return res.status(500).json({ error: 'AI service unavailable' })

  const match = html.match(/<!DOCTYPE html[\s\S]*<\/html>/i)
  res.status(200).json({ html: match ? match[0] : html })
}
