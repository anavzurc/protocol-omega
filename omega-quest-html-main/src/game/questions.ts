export type Dificuldade = "facil" | "medio" | "dificil";

export type Principio =
  | "Fundamentos"
  | "Características"
  | "Modelos de Serviço"
  | "Modelos de Implantação";

export interface Questao {
  enunciado: string;
  alternativas: string[];
  correta: number;
  dificuldade: Dificuldade;
  principio: Principio;
  explicacao: string;
}

export const QUESTOES: Questao[] = [
  // ===== FUNDAMENTOS =====

  {
    principio: "Fundamentos",
    dificuldade: "facil",
    enunciado: "O que melhor define Computação em Nuvem?",
    alternativas: [
      "Entrega de recursos computacionais pela internet sob demanda",
      "Uso exclusivo de computadores locais",
      "Armazenamento apenas em dispositivos físicos",
      "Programação sem conexão com redes"
    ],
    correta: 0,
    explicacao:
      "Computação em Nuvem consiste na disponibilização de recursos computacionais pela internet, permitindo acesso sob demanda a processamento, armazenamento e serviços.",
  },

  {
    principio: "Fundamentos",
    dificuldade: "facil",
    enunciado: "Qual foi uma das principais motivações para o surgimento da Computação em Nuvem?",
    alternativas: [
      "Reduzir custos e aumentar a flexibilidade dos recursos",
      "Eliminar completamente a internet",
      "Substituir todos os sistemas operacionais",
      "Impedir o compartilhamento de recursos"
    ],
    correta: 0,
    explicacao:
      "A nuvem surgiu para oferecer escalabilidade, flexibilidade e redução de custos associados à aquisição e manutenção de infraestrutura própria.",
  },

  {
    principio: "Fundamentos",
    dificuldade: "medio",
    enunciado: "Qual alternativa representa corretamente uma vantagem da Computação em Nuvem?",
    alternativas: [
      "Escalabilidade de recursos conforme a demanda",
      "Necessidade de comprar servidores para cada usuário",
      "Manutenção exclusivamente manual",
      "Ausência de conectividade entre sistemas"
    ],
    correta: 0,
    explicacao:
      "Uma das maiores vantagens da nuvem é a escalabilidade, permitindo aumentar ou reduzir recursos conforme necessário.",
  },

  {
    principio: "Fundamentos",
    dificuldade: "medio",
    enunciado: "Em Computação em Nuvem, os recursos são normalmente disponibilizados de forma:",
    alternativas: [
      "Sob demanda",
      "Somente presencial",
      "Exclusivamente por mídia física",
      "Apenas durante horário comercial"
    ],
    correta: 0,
    explicacao:
      "Os recursos podem ser solicitados e utilizados quando necessário, característica conhecida como serviço sob demanda.",
  },

  {
    principio: "Fundamentos",
    dificuldade: "dificil",
    enunciado: "Qual cenário representa um uso típico da Computação em Nuvem?",
    alternativas: [
      "Hospedar um sistema acessível pela internet para milhares de usuários",
      "Guardar arquivos somente em um pendrive",
      "Executar software sem qualquer rede",
      "Limitar aplicações a um único computador"
    ],
    correta: 0,
    explicacao:
      "A hospedagem de aplicações acessíveis pela internet para diversos usuários é um dos exemplos mais comuns de utilização da nuvem.",
  },

  // ===== CARACTERÍSTICAS =====

  {
    principio: "Características",
    dificuldade: "facil",
    enunciado: "Qual característica da nuvem permite aumentar ou reduzir recursos conforme a demanda?",
    alternativas: [
      "Elasticidade",
      "Virtualização",
      "Criptografia",
      "Endereçamento"
    ],
    correta: 0,
    explicacao:
      "Elasticidade é a capacidade de expandir ou reduzir recursos rapidamente conforme a necessidade.",
  },

  {
    principio: "Características",
    dificuldade: "facil",
    enunciado: "O amplo acesso à rede significa que os serviços podem ser acessados:",
    alternativas: [
      "Por diversos dispositivos conectados à internet",
      "Somente por servidores físicos",
      "Apenas por computadores de mesa",
      "Somente na mesma sala da empresa"
    ],
    correta: 0,
    explicacao:
      "Os serviços em nuvem podem ser acessados por computadores, tablets, celulares e outros dispositivos conectados à rede.",
  },

  {
    principio: "Características",
    dificuldade: "medio",
    enunciado: "O pooling de recursos refere-se a:",
    alternativas: [
      "Compartilhamento de recursos entre múltiplos clientes",
      "Uso exclusivo de um servidor por cliente",
      "Desligamento automático de sistemas",
      "Backup manual de aplicações"
    ],
    correta: 0,
    explicacao:
      "Os provedores agrupam recursos para atender múltiplos clientes de forma eficiente.",
  },

  {
    principio: "Características",
    dificuldade: "medio",
    enunciado: "O que significa serviço medido (Measured Service)?",
    alternativas: [
      "O uso dos recursos pode ser monitorado e cobrado conforme o consumo",
      "Todos os serviços são gratuitos",
      "A cobrança é fixa para sempre",
      "Não existe monitoramento de utilização"
    ],
    correta: 0,
    explicacao:
      "Os provedores monitoram o consumo dos recursos e geralmente cobram de acordo com o uso realizado.",
  },

  {
    principio: "Características",
    dificuldade: "dificil",
    enunciado: "Qual conjunto contém apenas características essenciais da Computação em Nuvem?",
    alternativas: [
      "Elasticidade, serviço sob demanda, amplo acesso à rede",
      "Monitor CRT, DVD e impressora",
      "Mouse, teclado e gabinete",
      "Banco de dados local, impressora e scanner"
    ],
    correta: 0,
    explicacao:
      "As características essenciais incluem elasticidade, amplo acesso, pooling de recursos, serviço medido e serviço sob demanda.",
  },

  // ===== MODELOS DE SERVIÇO =====

  {
    principio: "Modelos de Serviço",
    dificuldade: "facil",
    enunciado: "Qual modelo fornece softwares completos acessados pela internet?",
    alternativas: [
      "SaaS",
      "PaaS",
      "IaaS",
      "VPN"
    ],
    correta: 0,
    explicacao:
      "Software as a Service (SaaS) entrega aplicações prontas aos usuários finais.",
  },

  {
    principio: "Modelos de Serviço",
    dificuldade: "facil",
    enunciado: "Em qual modelo o cliente utiliza uma plataforma para desenvolver aplicações sem gerenciar servidores?",
    alternativas: [
      "PaaS",
      "IaaS",
      "SaaS",
      "LAN"
    ],
    correta: 0,
    explicacao:
      "Platform as a Service fornece ambiente para desenvolvimento e implantação de aplicações.",
  },

  {
    principio: "Modelos de Serviço",
    dificuldade: "medio",
    enunciado: "Qual modelo oferece recursos como máquinas virtuais, rede e armazenamento?",
    alternativas: [
      "IaaS",
      "SaaS",
      "PaaS",
      "SMTP"
    ],
    correta: 0,
    explicacao:
      "Infrastructure as a Service disponibiliza infraestrutura virtualizada sob demanda.",
  },

  {
    principio: "Modelos de Serviço",
    dificuldade: "medio",
    enunciado: "Qual exemplo está mais associado ao modelo SaaS?",
    alternativas: [
      "Aplicação acessada diretamente pelo navegador",
      "Máquina virtual configurada pelo usuário",
      "Servidor físico em datacenter próprio",
      "Cabeamento de rede local"
    ],
    correta: 0,
    explicacao:
      "No SaaS o usuário consome uma aplicação pronta sem precisar administrar infraestrutura.",
  },

  {
    principio: "Modelos de Serviço",
    dificuldade: "dificil",
    enunciado: "Qual sequência apresenta os modelos de serviço do mais próximo do usuário final ao mais próximo da infraestrutura?",
    alternativas: [
      "SaaS → PaaS → IaaS",
      "IaaS → SaaS → PaaS",
      "PaaS → IaaS → SaaS",
      "SaaS → IaaS → PaaS"
    ],
    correta: 0,
    explicacao:
      "SaaS entrega software pronto, PaaS fornece plataforma de desenvolvimento e IaaS oferece infraestrutura.",
  },

  // ===== MODELOS DE IMPLANTAÇÃO =====

  {
    principio: "Modelos de Implantação",
    dificuldade: "facil",
    enunciado: "Qual modelo de implantação é disponibilizado ao público em geral?",
    alternativas: [
      "Nuvem Pública",
      "Nuvem Privada",
      "Nuvem Comunitária",
      "Nuvem Local"
    ],
    correta: 0,
    explicacao:
      "A nuvem pública oferece serviços para vários clientes através da internet.",
  },

  {
    principio: "Modelos de Implantação",
    dificuldade: "facil",
    enunciado: "Qual modelo é mantido para uso exclusivo de uma organização?",
    alternativas: [
      "Nuvem Privada",
      "Nuvem Pública",
      "Nuvem Comunitária",
      "Nuvem Compartilhada"
    ],
    correta: 0,
    explicacao:
      "A nuvem privada é utilizada exclusivamente por uma única organização.",
  },

  {
    principio: "Modelos de Implantação",
    dificuldade: "medio",
    enunciado: "O que caracteriza uma Nuvem Híbrida?",
    alternativas: [
      "Combinação de ambientes públicos e privados",
      "Uso apenas de servidores locais",
      "Uso exclusivo de provedores públicos",
      "Ausência de integração entre ambientes"
    ],
    correta: 0,
    explicacao:
      "A nuvem híbrida integra recursos de nuvens públicas e privadas.",
  },

  {
    principio: "Modelos de Implantação",
    dificuldade: "medio",
    enunciado: "Uma Nuvem Comunitária é normalmente compartilhada por:",
    alternativas: [
      "Organizações com interesses ou requisitos em comum",
      "Apenas uma empresa",
      "Qualquer usuário da internet",
      "Somente usuários domésticos"
    ],
    correta: 0,
    explicacao:
      "A nuvem comunitária atende grupos que possuem objetivos ou necessidades semelhantes.",
  },

  {
    principio: "Modelos de Implantação",
    dificuldade: "dificil",
    enunciado: "Qual cenário representa melhor uma estratégia de Nuvem Híbrida?",
    alternativas: [
      "Dados sensíveis em nuvem privada e serviços públicos em nuvem pública",
      "Todos os recursos apenas em computadores locais",
      "Um único notebook sem conexão à internet",
      "Apenas armazenamento em pendrives"
    ],
    correta: 0,
    explicacao:
      "A nuvem híbrida permite combinar segurança da nuvem privada com a escalabilidade da nuvem pública.",
  },
];

export function sortearQuestao(
  historico: Set<number>,
  dificuldades?: Dificuldade[]
): { idx: number; q: Questao } {
  const filtro =
    dificuldades && dificuldades.length
      ? QUESTOES.map((q, i) => ({ q, i }))
          .filter(({ q }) =>
            dificuldades.includes(q.dificuldade)
          )
          .map(({ i }) => i)
      : QUESTOES.map((_, i) => i);

  const disponiveis = filtro.filter(
    (i) => !historico.has(i)
  );

  const pool =
    disponiveis.length
      ? disponiveis
      : filtro;

  const idx =
    pool[Math.floor(Math.random() * pool.length)];

  return {
    idx,
    q: QUESTOES[idx],
  };
}
