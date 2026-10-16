import type { PerguntaP } from '../lib/pesquisa'

// Pesquisa de clima + eNPS (sentido: maior = melhor; "inv" = afirmação negativa, invertida no cálculo)
export const PERGUNTAS_CLIMA: PerguntaP[] = [
  { n: 1, dim: 'eNPS', escala: 'nps', texto: 'De 0 a 10, quanto você recomendaria esta área/empresa como um bom lugar para trabalhar?' },
  { n: 2, dim: 'Liderança', escala: 'conc', texto: 'Minha liderança me dá direção clara sobre prioridades.' },
  { n: 3, dim: 'Liderança', escala: 'conc', texto: 'Minha liderança está disponível quando preciso.' },
  { n: 4, dim: 'Comunicação', escala: 'conc', texto: 'Recebo as informações de que preciso para fazer bem o meu trabalho.' },
  { n: 5, dim: 'Comunicação', escala: 'conc', texto: 'Sinto-me à vontade para dar opiniões e discordar.' },
  { n: 6, dim: 'Reconhecimento', escala: 'conc', texto: 'Meu trabalho é reconhecido quando faço um bom trabalho.' },
  { n: 7, dim: 'Reconhecimento', escala: 'conc', texto: 'Considero justa a forma como as pessoas são avaliadas aqui.' },
  { n: 8, dim: 'Desenvolvimento', escala: 'conc', texto: 'Tenho oportunidades de aprender e me desenvolver.' },
  { n: 9, dim: 'Desenvolvimento', escala: 'conc', texto: 'Vejo possibilidades de crescimento para mim aqui.' },
  { n: 10, dim: 'Colaboração', escala: 'conc', texto: 'Na minha equipe as pessoas se ajudam.' },
  { n: 11, dim: 'Colaboração', escala: 'conc', texto: 'A colaboração com outras áreas funciona bem.' },
  { n: 12, dim: 'Condições de trabalho', escala: 'conc', texto: 'Tenho as ferramentas e os sistemas necessários para trabalhar.' },
  { n: 13, dim: 'Condições de trabalho', escala: 'conc', inv: true, texto: 'O volume de trabalho é frequentemente excessivo.' },
  { n: 14, dim: 'Equilíbrio', escala: 'conc', texto: 'Consigo equilibrar trabalho e vida pessoal.' },
  { n: 15, dim: 'Orgulho e pertencimento', escala: 'conc', texto: 'Tenho orgulho de trabalhar aqui.' },
  { n: 16, dim: 'Orgulho e pertencimento', escala: 'conc', texto: 'Pretendo continuar trabalhando aqui nos próximos 2 anos.' },
]

// Diagnóstico de cultura (inspirado nos traços de Denison: envolvimento, consistência, adaptabilidade, missão)
export const PERGUNTAS_CULTURA: PerguntaP[] = [
  { n: 1, dim: 'Envolvimento', escala: 'conc', texto: 'As decisões costumam ser tomadas no nível em que a melhor informação está disponível.' },
  { n: 2, dim: 'Envolvimento', escala: 'conc', texto: 'Trabalhamos como uma equipe, e não como silos.' },
  { n: 3, dim: 'Envolvimento', escala: 'conc', texto: 'Investimos continuamente no desenvolvimento das pessoas.' },
  { n: 4, dim: 'Consistência', escala: 'conc', texto: 'Há um conjunto claro de valores que orienta como trabalhamos.' },
  { n: 5, dim: 'Consistência', escala: 'conc', texto: 'Quando há divergência, buscamos soluções em que todos ganham.' },
  { n: 6, dim: 'Consistência', escala: 'conc', texto: 'Processos e controles são aplicados de forma consistente.' },
  { n: 7, dim: 'Adaptabilidade', escala: 'conc', texto: 'Respondemos bem a mudanças (sistemas, normas, prazos da matriz).' },
  { n: 8, dim: 'Adaptabilidade', escala: 'conc', texto: 'As necessidades dos clientes internos influenciam nossas decisões.' },
  { n: 9, dim: 'Adaptabilidade', escala: 'conc', texto: 'Erros são vistos como oportunidade de aprendizado e melhoria.' },
  { n: 10, dim: 'Missão', escala: 'conc', texto: 'Entendo como o meu trabalho contribui para os objetivos da empresa.' },
  { n: 11, dim: 'Missão', escala: 'conc', texto: 'Temos metas claras e compartilhadas.' },
  { n: 12, dim: 'Missão', escala: 'conc', texto: 'A liderança tem uma visão de longo prazo que inspira.' },
]
