import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ModulePage } from './components/ModulePage'
import { Biblioteca } from './pages/Biblioteca'
import { Anotacoes } from './pages/Anotacoes'
import { Diversidade, PesquisaClima, Politicas, Termometro } from './pages/Cultura'
import { ModoTV, Mural, Reconhecimentos } from './pages/Comunicacao'
import { Checklists, NpsInterno, ObrigacoesPage } from './pages/Processos'
import { Cobertura, Organograma } from './pages/PessoasExtra'
import { ChecklistNr1, GuiaNr1, IndicadoresNr1, InventarioNr1, PainelNr1, PesquisaNr1 } from './pages/Nr1'
import { Arquivos } from './pages/Arquivos'
import { Calendario } from './pages/Calendario'
import { Configuracoes } from './pages/Config'
import { Dashboard } from './pages/Dashboard'
import { Avaliacoes, Competencias } from './pages/Desempenho'
import { TreinoInterno, Treinamentos } from './pages/Desenvolvimento'
import { Incentive } from './pages/Incentive'
import { Despesas } from './pages/Despesas'
import { Eficiencia } from './pages/Eficiencia'
import { Fechamento } from './pages/Fechamento'
import { Diagnostico, Projetos, Tarefas } from './pages/Gestao'
import { Okr } from './pages/Okr'
import { OneOnOne } from './pages/OneOnOne'
import { Cargos, Ferias, PessoaPerfil, Pessoas, Vagas } from './pages/Pessoas'
import { Semana } from './pages/Semana'
import { AuthGate } from './pages/Login'
import { Anexos } from './pages/Anexos'
import { Reunioes } from './pages/Reunioes'
import { ConfigurarEtiquetas, EtiquetaDetalhe, Etiquetas } from './pages/Etiquetas'
import { Usuarios } from './pages/Usuarios'

// Módulos que usam apenas a tela genérica (lista/kanban/gantt + formulário)
const GENERIC: [string, string][] = [
  ['ponto', 'ponto'],
  ['ocorrencias', 'ocorrencias'],
  ['exames', 'exames'],
  ['feedbacks', 'feedbacks'],
  ['onboarding', 'onboarding'],
  ['pdis', 'pdis'],
  ['centros-custo', 'centrosCusto'],
  ['nr1-plano', 'acoesPsico'],
  ['grupos', 'gruposTrabalho'],
  ['ouvidoria', 'ouvidoria'],
  ['solicitacoes', 'solicitacoes'],
  ['reembolsos', 'reembolsos'],
  ['patrimonio', 'patrimonio'],
  ['beneficios', 'beneficios'],
  ['holerites', 'holerites'],
  ['admissoes', 'admissoes'],
  ['nr1-bem-estar', 'checkinsBemEstar'],
  ['nr1-relatos', 'relatosPsico'],
]

export default function App() {
  return (
    <AuthGate>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/semana" element={<Semana />} />
        <Route path="/anotacoes" element={<Anotacoes />} />
        <Route path="/arquivos" element={<Arquivos />} />
        <Route path="/clima" element={<PesquisaClima key="clima" tipo="clima" />} />
        <Route path="/cultura" element={<PesquisaClima key="cultura" tipo="cultura" />} />
        <Route path="/humor" element={<Termometro />} />
        <Route path="/politicas" element={<Politicas />} />
        <Route path="/diversidade" element={<Diversidade />} />
        <Route path="/mural" element={<Mural />} />
        <Route path="/reconhecimentos" element={<Reconhecimentos />} />
        <Route path="/tv" element={<ModoTV />} />
        <Route path="/obrigacoes" element={<ObrigacoesPage />} />
        <Route path="/checklists" element={<Checklists />} />
        <Route path="/nps-interno" element={<NpsInterno />} />
        <Route path="/organograma" element={<Organograma />} />
        <Route path="/cobertura" element={<Cobertura />} />
        <Route path="/nr1" element={<PainelNr1 />} />
        <Route path="/nr1-inventario" element={<InventarioNr1 />} />
        <Route path="/nr1-pesquisa" element={<PesquisaNr1 />} />
        <Route path="/nr1-indicadores" element={<IndicadoresNr1 />} />
        <Route path="/nr1-checklist" element={<ChecklistNr1 />} />
        <Route path="/nr1-guia" element={<GuiaNr1 />} />
        <Route path="/tarefas" element={<Tarefas />} />
        <Route path="/projetos" element={<Projetos />} />
        <Route path="/okr" element={<Okr />} />
        <Route path="/one-on-one" element={<OneOnOne />} />
        <Route path="/eficiencia" element={<Eficiencia />} />
        <Route path="/diagnostico" element={<Diagnostico />} />
        <Route path="/pessoas" element={<Pessoas />} />
        <Route path="/pessoas/:id" element={<PessoaPerfil />} />
        <Route path="/vagas" element={<Vagas />} />
        <Route path="/ferias" element={<Ferias />} />
        <Route path="/cargos" element={<Cargos />} />
        <Route path="/avaliacoes" element={<Avaliacoes />} />
        <Route path="/competencias" element={<Competencias />} />
        <Route path="/treinamentos" element={<Treinamentos />} />
        <Route path="/treinamento-interno" element={<TreinoInterno />} />
        <Route path="/incentive" element={<Incentive />} />
        <Route path="/despesas" element={<Despesas />} />
        <Route path="/fechamento" element={<Fechamento />} />
        <Route path="/biblioteca" element={<Biblioteca />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/anexos" element={<Anexos />} />
        <Route path="/reunioes" element={<Reunioes />} />
        <Route path="/etiquetas" element={<Etiquetas />} />
        <Route path="/etiquetas/configurar" element={<ConfigurarEtiquetas />} />
        <Route path="/etiquetas/:id" element={<EtiquetaDetalhe />} />
        <Route path="/usuarios" element={<Usuarios />} />
        {GENERIC.map(([p, col]) => (
          <Route key={p} path={'/' + p} element={<ModulePage key={col} col={col} />} />
        ))}
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
    </AuthGate>
  )
}
