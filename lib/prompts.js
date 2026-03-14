export const TOOLS = [
  { id:'bonbonaya', icon:'🍬', name:'بونبوناية', sub:'English Mnemonics + Arabic Explanation', color:'#f97316', bg:'rgba(249,115,22,.1)', gradient:'linear-gradient(135deg,#f97316,#fb923c)' },
  { id:'mcq_bank', icon:'🧪', name:'بنك أسئلة', sub:'50 MCQ English + Egyptian Arabic', color:'#818cf8', bg:'rgba(129,140,248,.1)', gradient:'linear-gradient(135deg,#6366f1,#818cf8)' },
  { id:'smart_extract', icon:'🧠', name:'Smart Extract', sub:'ورقة مراجعة ذكية', color:'#22d3ee', bg:'rgba(34,211,238,.1)', gradient:'linear-gradient(135deg,#0891b2,#22d3ee)' },
  { id:'ultra_summary', icon:'📄', name:'Ultra Summary', sub:'ملخص مضغوط + جداول', color:'#34d399', bg:'rgba(52,211,153,.1)', gradient:'linear-gradient(135deg,#059669,#34d399)' },
  { id:'trick_questions', icon:'❓', name:'Trick Questions', sub:'Tricky Traps + Beast MCQs', color:'#f43f5e', bg:'rgba(244,63,94,.1)', gradient:'linear-gradient(135deg,#be123c,#f43f5e)' },
  { id:'flashcards', icon:'🗂️', name:'Flashcards', sub:'بطاقات مراجعة للطباعة', color:'#a855f7', bg:'rgba(168,85,247,.1)', gradient:'linear-gradient(135deg,#7c3aed,#a855f7)' },
]

export function getPrompt(toolId, content) {
  const base = `Return ONLY complete HTML starting with <!DOCTYPE html>. No text outside HTML.`
  const prompts = {
    bonbonaya: `${base} You are a creative medical teacher from TAMREDEANO. Create a BONBONAYA file. Mnemonics/Brain Hacks IN ENGLISH. Explanations IN EGYPTIAN ARABIC. Include: Weird Mnemonics, Brain Hacks, Exam Pointers, Tricky Traps. Content: ${content}`,
    mcq_bank: `${base} You are a medical exam designer from TAMREDEANO. Create EXACTLY 50 MCQ questions. Questions and options IN ENGLISH. Answers and explanations IN EGYPTIAN ARABIC DIALECT. Make questions clinical and tricky. Content: ${content}`,
    smart_extract: `${base} أنت خبير ضغط معلومات طبية من TAMREDEANO. اعمل ورقة مراجعة ذكية: ملخص سريع، أهم النقاط، جداول مقارنة، فخاخ الامتحان. المحتوى: ${content}`,
    ultra_summary: `${base} أنت آلة ضغط معلومات طبية من TAMREDEANO. اعمل ورقة مراجعة مضغوطة: ملخص 30 ثانية، جداول، مصطلحات، checklist. المحتوى: ${content}`,
    trick_questions: `${base} أنت مصمم أسئلة خادعة Beast Mode من TAMREDEANO. اعمل Tricky Traps (6-8) + Beast MCQs (4-5 مع شرح مفصل). المحتوى: ${content}`,
    flashcards: `${base} أنت خبير بطاقات مراجعة طبية من TAMREDEANO. اعمل 30 بطاقة مراجعة مطبوعة، كل بطاقة: سؤال + إجابة + Memory Trigger. المحتوى: ${content}`,
  }
  return prompts[toolId] || prompts.smart_extract
}
