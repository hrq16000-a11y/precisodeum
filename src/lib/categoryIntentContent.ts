/**
 * Conteúdo semântico por categoria — focado na intenção de busca do Google:
 * "o que é", "como funciona", "procedimentos comuns", "onde encontrar".
 *
 * Puro (sem React/DOM) para permitir testes unitários e reuso em SSR.
 */
import { getPriceEstimate } from '@/lib/priceEstimates';

export interface IntentFaqItem {
  question: string;
  answer: string;
}

const lower = (s: string) => (s || '').trim().toLowerCase();

/** Bloco de FAQ por intenção. Sempre 4 itens estáveis (bom para FAQPage). */
export function buildCategoryIntentFaq(
  categoryName: string,
  city?: string | null,
): IntentFaqItem[] {
  const name = categoryName || 'este serviço';
  const n = lower(name);
  const local = city ? ` em ${city}` : ' na sua região';

  return [
    {
      question: `O que é o serviço de ${n}?`,
      answer: `${name} reúne profissionais especializados em executar, instalar, reparar e dar manutenção nesse tipo de trabalho, seja em residências, comércios ou condomínios. O escopo pode ir de um atendimento pontual até projetos completos, sempre combinados diretamente entre cliente e profissional.`,
    },
    {
      question: `Como funciona a contratação de ${n}${local}?`,
      answer: `Você descreve o que precisa, compara os perfis disponíveis${local} — avaliações, fotos de trabalhos anteriores e áreas atendidas — e fala direto com o profissional pelo WhatsApp ou telefone. A plataforma não cobra comissão e não intermedeia o pagamento: o combinado é entre você e quem executa.`,
    },
    {
      question: `Quais são os procedimentos mais comuns em ${n}?`,
      answer: `Os atendimentos mais pedidos costumam ser: avaliação/diagnóstico no local, orçamento detalhado, execução do serviço com material combinado previamente, testes e limpeza final. Para trabalhos maiores, é comum dividir em etapas com prazos definidos e registro fotográfico do antes e depois.`,
    },
    {
      question: `Onde encontrar profissionais de ${n}${local}?`,
      answer: `Aqui mesmo: a busca prioriza profissionais próximos do seu CEP ou cidade e mostra a distância aproximada, a nota média e as regiões atendidas. Se ainda não houver alguém${local}, ampliamos automaticamente para cidades vizinhas do mesmo estado.`,
    },
  ];
}

/** Texto contextual de faixas de preço + valorização da mão de obra. */
export function buildPricingContext(
  categorySlug: string,
  categoryName: string,
  city?: string | null,
) {
  const estimate = getPriceEstimate(categorySlug);
  const region = city ? city : 'sua região';
  const name = categoryName || 'este serviço';

  const rangeLabel = estimate
    ? `Na média nacional, ${lower(name)} costuma variar de ${estimate.min.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} a ${estimate.max.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} por ${estimate.unit}.`
    : `Os valores de ${lower(name)} variam conforme o escopo, o material usado e a complexidade do atendimento.`;

  return {
    heading: `Quanto custa ${lower(name)} em ${region}?`,
    range: rangeLabel,
    regional: `Preço é sempre regional: custo de deslocamento, disponibilidade de mão de obra qualificada e o padrão de acabamento pedido em ${region} mudam bastante o valor final. Use as faixas apenas como referência inicial e peça um orçamento com fotos ou visita técnica.`,
    valuation: `Aqui não existe leilão de preços. Não ordenamos profissionais pelo menor valor e não incentivamos disputa por centavos — trabalho bem-feito tem custo, garantia e responsabilidade. Compare experiência, avaliações reais e clareza do orçamento antes de decidir apenas pelo preço.`,
    bullets: [
      'Peça orçamento detalhado, separando mão de obra e material.',
      'Confirme prazo, forma de pagamento e garantia por escrito no WhatsApp.',
      'Desconfie de valores muito abaixo da faixa regional: costumam esconder retrabalho.',
      'Avalie o profissional depois do serviço — isso valoriza quem entrega qualidade.',
    ],
  };
}

/** Keywords locais para a meta tag `keywords`. */
export function buildCategoryKeywords(
  categoryName: string,
  city?: string | null,
  state?: string | null,
): string {
  const n = lower(categoryName || '');
  if (!n) return '';
  const base = [
    n,
    `${n} perto de mim`,
    `${n} preço`,
    `contratar ${n}`,
    `melhor ${n}`,
    `${n} orçamento`,
  ];
  if (city) {
    const c = city.trim();
    base.push(`${n} em ${c}`, `${n} ${c}`, `${n} ${c} whatsapp`, `profissional de ${n} em ${c}`);
    if (state) base.push(`${n} ${c} ${state}`);
  }
  return Array.from(new Set(base)).join(', ');
}

/**
 * SEO local das páginas de oportunidade (categorias sem prestador).
 * Foca em intenção de captação: "seja o primeiro", "cadastre-se", "patrocine".
 */
export function buildOpportunitySeo(
  categoryName: string,
  city?: string | null,
  state?: string | null,
) {
  const name = categoryName || 'Serviço';
  const n = lower(name);
  const c = city ? city.trim() : '';
  const region = c ? `${c}${state ? ` (${state})` : ''}` : 'sua região';
  const localSuffix = c ? ` em ${c}` : ' no Brasil';

  const title = c
    ? `${name} em ${c}: seja o primeiro profissional da região | Preciso de Um`
    : `${name}: vaga aberta para profissionais e patrocinadores | Preciso de Um`;

  const description = c
    ? `Ainda não há profissionais de ${n} em ${c}. Cadastre seu serviço gratuitamente e apareça em primeiro lugar para quem procura ${n} na região — ou patrocine a categoria.`
    : `Categoria de ${n} aberta: cadastre-se grátis e seja o primeiro profissional a receber contatos, ou patrocine a categoria e ganhe destaque exclusivo.`;

  const keywords = Array.from(new Set([
    n,
    `${n}${localSuffix}`,
    `cadastro de ${n}`,
    `trabalhar como ${n}`,
    `divulgar serviço de ${n}`,
    `${n} clientes`,
    ...(c ? [`${n} ${c}`, `profissional de ${n} em ${c}`, `patrocinar ${n} em ${c}`] : []),
    ...(c && state ? [`${n} ${c} ${state}`] : []),
  ])).join(', ');

  const copy = {
    heading: `Por que ser o primeiro profissional de ${n} em ${region}`,
    paragraphs: [
      `A categoria de ${n}${localSuffix} está aberta: nenhum profissional ocupou esse espaço ainda. Isso significa que todas as buscas por ${n} feitas${c ? ` em ${c}` : ''} hoje ficam sem resposta — e quem se cadastrar primeiro passa a receber esses contatos diretamente no WhatsApp, sem intermediário e sem comissão.`,
      `O cadastro é 100% gratuito para profissionais. Você monta uma página própria com fotos dos seus trabalhos, áreas atendidas, horários e formas de contato. Quanto mais completo o perfil, melhor o posicionamento nas buscas por ${n}${localSuffix} — dentro do portal e nos buscadores.`,
      `Para empresas e fornecedores, essa é uma categoria de patrocínio com concorrência zero${c ? ` em ${c}` : ''}: seu banner e sua marca aparecem em destaque exclusivo para todo mundo que procurar por ${n}, incluindo o público que chega pelas páginas de bairro e cidade.`,
      `Preencha o formulário abaixo com seu nome e WhatsApp. Nossa equipe entra em contato para ajudar no cadastro ou apresentar as opções de patrocínio da categoria de ${n}${localSuffix}.`,
    ],
  };

  return { title, description, keywords, copy };
}
