import { useState, type ReactNode } from 'react'

// Convite de reunião (texto do Outlook/Google/iCloud) apresentado de forma legível:
// links "safelinks" do Outlook voltam ao endereço original, o link da reunião vira botão,
// ID e senha aparecem em destaque e o texto quebra linha em vez de sair da tela.

/** Desembrulha links do Outlook (…safelinks.protection.outlook.com/?url=…) para o endereço real. */
export function linkReal(u: string) {
  try {
    const url = new URL(u)
    if (/safelinks\.protection\.outlook\.com$/i.test(url.hostname)) return url.searchParams.get('url') ?? u
    return u
  } catch {
    return u
  }
}

const LINK = /https?:\/\/[^\s<>"]+/g
const REUNIAO = /(teams\.microsoft\.com\/(l\/meetup-join|meet)|zoom\.us\/j\/|meet\.google\.com\/|webex\.com\/)/i

/** Limpa o texto do convite: tira os "<safelinks…>" duplicados e troca os embrulhados pelo link real. */
export function limparConvite(txt: string) {
  return txt
    .replace(/<https?:\/\/[^>\s]*safelinks[^>\s]*>/gi, '') // "link<safelink>" → "link"
    .replace(LINK, (u) => linkReal(u))
    .replace(/_{10,}/g, '────────')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function comLinks(txt: string): ReactNode[] {
  const out: ReactNode[] = []
  let ult = 0
  for (const m of txt.matchAll(LINK)) {
    const i = m.index ?? 0
    if (i > ult) out.push(txt.slice(ult, i))
    const u = m[0].replace(/[).,;]+$/, '')
    out.push(
      <a key={i} href={u} target="_blank" rel="noopener noreferrer">
        {u.length > 70 ? u.slice(0, 67) + '…' : u}
      </a>,
    )
    ult = i + u.length
  }
  if (ult < txt.length) out.push(txt.slice(ult))
  return out
}

export function Convite({ descricao, organizador, participantes }: { descricao?: string | null; organizador?: string | null; participantes?: string | null }) {
  const [aberto, setAberto] = useState(false)
  const txt = descricao ? limparConvite(descricao) : ''
  const entrar = [...txt.matchAll(LINK)].map((m) => m[0]).find((u) => REUNIAO.test(u))
  const id = txt.match(/ID d[ae] [Rr]euni[ãa]o:\s*([\d\s]+\d)/)?.[1]?.trim() ?? txt.match(/Meeting ID:\s*([\d\s]+\d)/i)?.[1]?.trim()
  const senha = txt.match(/(?:Senha|Passcode|Password):\s*(\S+)/i)?.[1]
  const pessoas = (participantes ?? '')
    .split(/,\s*/)
    .map((x) => x.trim())
    .filter(Boolean)

  return (
    <div className="cv">
      {(organizador || pessoas.length > 0) && (
        <div className="cv-quem">
          {organizador && (
            <div>
              <span className="small muted">Enviado por </span>
              <b>{organizador}</b>
            </div>
          )}
          {pessoas.length > 0 && (
            <div className="cv-pessoas">
              <span className="small muted">Participantes ({pessoas.length}): </span>
              {pessoas.map((p, i) => (
                <span key={i} className="chip muted">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {(entrar || id || senha) && (
        <div className="row cv-acesso">
          {entrar && (
            <a className="btn primary sm" href={entrar} target="_blank" rel="noopener noreferrer">
              {/teams/i.test(entrar) ? 'Entrar no Teams' : /zoom/i.test(entrar) ? 'Entrar no Zoom' : /meet\.google/i.test(entrar) ? 'Entrar no Google Meet' : 'Entrar na reunião'}
            </a>
          )}
          {id && (
            <span className="small">
              ID: <b>{id}</b>
            </span>
          )}
          {senha && (
            <span className="small">
              Senha: <b>{senha}</b>
            </span>
          )}
        </div>
      )}
      {txt && (
        <>
          <button type="button" className="linkbtn small" style={{ justifySelf: 'start' }} onClick={() => setAberto(!aberto)}>
            {aberto ? '▾ Ocultar convite completo' : '▸ Ver convite completo'}
          </button>
          {aberto && <div className="small cv-texto">{comLinks(txt)}</div>}
        </>
      )}
    </div>
  )
}
