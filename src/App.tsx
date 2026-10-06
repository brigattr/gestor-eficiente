import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ModulePage } from './components/ModulePage'
import { Biblioteca } from './pages/Biblioteca'
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
import { Usuarios } from './pages/Usuarios'

// Módulos que usam apenas a tela genérica (lista/kanban/gantt + formulário)
const GENERIC: [string, string][] = [
  ['ponto', 'ponto'],
  ['ocorrencias', 'ocorrencias'],
  ['exames', 'exames'],
  ['feedbacks', 'feedbacks'],
  ['onboarding', 'onboarding'],
  ['pdis', 'pdis'],
  ['reunioes', 'reunioes'],
  ['centros-custo', 'centrosCusto'],
]

export default function App() {
  return (
    <AuthGate>
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/semana" element={<Semana />} />
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
