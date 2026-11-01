// Ditado por voz (Web Speech API): Chrome/Edge no computador e Android, Safari no iPhone/iPad/Mac.
// O áudio é processado pelo serviço de voz do próprio navegador (Google/Apple); o sistema recebe só o texto.

type Rec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

const Classe = () => (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition

export const ditadoSuportado = () => typeof window !== 'undefined' && !!Classe()

/** Começa a ditar: devolve uma função para parar. Frases prontas chegam em onTexto; a prévia, em onPrevia. */
export function ditar(o: { onTexto: (t: string) => void; onPrevia: (t: string) => void; onFim: (erro?: string) => void }) {
  const C = Classe()
  if (!C) {
    o.onFim('sem-suporte')
    return () => undefined
  }
  const r = new C()
  r.lang = 'pt-BR'
  r.continuous = true
  r.interimResults = true
  let parado = false
  r.onresult = (e) => {
    let previa = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]
      if (res.isFinal) o.onTexto(res[0].transcript.trim())
      else previa += res[0].transcript
    }
    o.onPrevia(previa)
  }
  r.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return
    parado = true
    o.onFim(e.error)
  }
  // alguns navegadores encerram após um silêncio: reinicia enquanto o usuário não parar
  r.onend = () => {
    if (parado) return o.onFim()
    try {
      r.start()
    } catch {
      o.onFim()
    }
  }
  r.start()
  return () => {
    parado = true
    r.stop()
  }
}
