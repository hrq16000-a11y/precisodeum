export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  count: number;
}

export interface Provider {
  id: string;
  name: string;
  businessName?: string;
  category: string;
  categorySlug: string;
  city: string;
  state: string;
  neighborhood: string;
  rating: number;
  reviewCount: number;
  photo: string;
  description: string;
  phone: string;
  whatsapp: string;
  yearsExperience: number;
  plan: 'free' | 'pro' | 'premium';
  services: Service[];
  reviews: Review[];
  slug: string;
  featured: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price?: string;
  area: string;
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  qualityRating: number;
  punctualityRating: number;
  serviceRating: number;
  comment: string;
  date: string;
}

export const categories: Category[] = [
  { id: '1', name: 'Eletricista', slug: 'eletricista', icon: '⚡', count: 1240 },
  { id: '2', name: 'Técnico em Informática', slug: 'tecnico-informatica', icon: '💻', count: 890 },
  { id: '3', name: 'Encanador', slug: 'encanador', icon: '🔧', count: 1050 },
  { id: '4', name: 'Ar-condicionado', slug: 'ar-condicionado', icon: '❄️', count: 760 },
  { id: '5', name: 'Instalador de Câmeras', slug: 'instalador-cameras', icon: '📷', count: 430 },
  { id: '6', name: 'Marido de Aluguel', slug: 'marido-de-aluguel', icon: '🛠️', count: 1520 },
  { id: '7', name: 'Antenista', slug: 'antenista', icon: '📡', count: 310 },
  { id: '8', name: 'Instalador de TV', slug: 'instalador-tv', icon: '📺', count: 420 },
  { id: '9', name: 'Mudanças', slug: 'mudancas', icon: '🚚', count: 680 },
  { id: '10', name: 'Pedreiro', slug: 'pedreiro', icon: '🧱', count: 1380 },
];

export const providers: Provider[] = [
  {
    id: '1',
    name: 'Carlos Silva',
    businessName: 'CS Elétrica',
    category: 'Eletricista',
    categorySlug: 'eletricista',
    city: 'Curitiba',
    state: 'PR',
    neighborhood: 'Centro',
    rating: 4.8,
    reviewCount: 127,
    photo: '',
    description: 'Eletricista profissional com mais de 15 anos de experiência. Especialista em instalações residenciais e comerciais, quadros de distribuição e projetos elétricos.',
    phone: '(41) 99999-0001',
    whatsapp: '5541999990001',
    yearsExperience: 15,
    plan: 'premium',
    slug: 'carlos-silva-eletricista-curitiba',
    featured: true,
    services: [
      { id: 's1', name: 'Instalação elétrica residencial', description: 'Instalação completa de fiação e tomadas', price: 'A partir de R$ 200', area: 'Curitiba e região' },
      { id: 's2', name: 'Troca de disjuntores', description: 'Substituição e upgrade de disjuntores', price: 'R$ 80 - R$ 150', area: 'Curitiba' },
      { id: 's3', name: 'Projeto elétrico', description: 'Elaboração de projetos elétricos completos', price: 'Sob consulta', area: 'Curitiba e região' },
    ],
    reviews: [
      { id: 'r1', userName: 'Maria Santos', rating: 5, qualityRating: 5, punctualityRating: 5, serviceRating: 5, comment: 'Excelente profissional! Pontual e trabalho impecável.', date: '2024-01-15' },
      { id: 'r2', userName: 'João Oliveira', rating: 4, qualityRating: 5, punctualityRating: 4, serviceRating: 4, comment: 'Bom trabalho, recomendo.', date: '2024-01-10' },
    ],
  },
  {
    id: '2',
    name: 'Ana Rodrigues',
    category: 'Técnico em Informática',
    categorySlug: 'tecnico-informatica',
    city: 'São Paulo',
    state: 'SP',
    neighborhood: 'Vila Mariana',
    rating: 4.9,
    reviewCount: 89,
    photo: '',
    description: 'Técnica em informática especializada em manutenção de computadores, notebooks e redes. Atendimento rápido e garantia nos serviços.',
    phone: '(11) 99999-0002',
    whatsapp: '5511999990002',
    yearsExperience: 8,
    plan: 'pro',
    slug: 'ana-rodrigues-tecnico-informatica-sao-paulo',
    featured: true,
    services: [
      { id: 's4', name: 'Formatação de computador', description: 'Formatação com backup e instalação de programas', price: 'R$ 120', area: 'São Paulo - Zona Sul' },
      { id: 's5', name: 'Configuração de rede', description: 'Instalação e configuração de rede Wi-Fi', price: 'R$ 150', area: 'São Paulo' },
    ],
    reviews: [
      { id: 'r3', userName: 'Pedro Costa', rating: 5, qualityRating: 5, punctualityRating: 5, serviceRating: 5, comment: 'Resolveu meu problema em menos de 1 hora!', date: '2024-02-01' },
    ],
  },
  {
    id: '3',
    name: 'Roberto Almeida',
    businessName: 'RA Encanamentos',
    category: 'Encanador',
    categorySlug: 'encanador',
    city: 'Rio de Janeiro',
    state: 'RJ',
    neighborhood: 'Copacabana',
    rating: 4.7,
    reviewCount: 203,
    photo: '',
    description: 'Encanador com 20 anos de experiência. Desentupimento, vazamentos, instalação de aquecedores e reformas hidráulicas.',
    phone: '(21) 99999-0003',
    whatsapp: '5521999990003',
    yearsExperience: 20,
    plan: 'premium',
    slug: 'roberto-almeida-encanador-rio-de-janeiro',
    featured: true,
    services: [
      { id: 's6', name: 'Desentupimento', description: 'Desentupimento de pias, ralos e vasos', price: 'A partir de R$ 100', area: 'Rio de Janeiro' },
      { id: 's7', name: 'Reparo de vazamento', description: 'Identificação e reparo de vazamentos', price: 'R$ 150 - R$ 400', area: 'Zona Sul RJ' },
    ],
    reviews: [
      { id: 'r4', userName: 'Lucia Ferreira', rating: 5, qualityRating: 5, punctualityRating: 4, serviceRating: 5, comment: 'Profissional honesto e competente.', date: '2024-01-20' },
    ],
  },
  {
    id: '4',
    name: 'Fernando Souza',
    category: 'Ar-condicionado',
    categorySlug: 'ar-condicionado',
    city: 'Florianópolis',
    state: 'SC',
    neighborhood: 'Trindade',
    rating: 4.6,
    reviewCount: 67,
    photo: '',
    description: 'Instalação e manutenção de ar-condicionado split e multi-split. Limpeza e higienização com garantia.',
    phone: '(48) 99999-0004',
    whatsapp: '5548999990004',
    yearsExperience: 10,
    plan: 'pro',
    slug: 'fernando-souza-ar-condicionado-florianopolis',
    featured: false,
    services: [
      { id: 's8', name: 'Instalação de split', description: 'Instalação completa de ar-condicionado split', price: 'R$ 400 - R$ 800', area: 'Florianópolis' },
      { id: 's9', name: 'Limpeza de ar-condicionado', description: 'Higienização completa do aparelho', price: 'R$ 150', area: 'Florianópolis e São José' },
    ],
    reviews: [],
  },
  {
    id: '5',
    name: 'Marcos Pereira',
    businessName: 'MP Construções',
    category: 'Pedreiro',
    categorySlug: 'pedreiro',
    city: 'Belo Horizonte',
    state: 'MG',
    neighborhood: 'Savassi',
    rating: 4.5,
    reviewCount: 156,
    photo: '',
    description: 'Pedreiro experiente com equipe completa. Reformas, construções, acabamentos e manutenção predial.',
    phone: '(31) 99999-0005',
    whatsapp: '5531999990005',
    yearsExperience: 18,
    plan: 'free',
    slug: 'marcos-pereira-pedreiro-belo-horizonte',
    featured: false,
    services: [
      { id: 's10', name: 'Reforma completa', description: 'Reforma de cômodos e áreas externas', price: 'Sob consulta', area: 'BH e região' },
    ],
    reviews: [
      { id: 'r5', userName: 'Sandra Lima', rating: 4, qualityRating: 4, punctualityRating: 4, serviceRating: 5, comment: 'Equipe dedicada e resultado muito bom.', date: '2024-02-05' },
    ],
  },
  {
    id: '6',
    name: 'Paulo Mendes',
    category: 'Marido de Aluguel',
    categorySlug: 'marido-de-aluguel',
    city: 'Curitiba',
    state: 'PR',
    neighborhood: 'Batel',
    rating: 4.9,
    reviewCount: 312,
    photo: '',
    description: 'Marido de aluguel multifuncional. Pequenos reparos, montagem de móveis, instalações e muito mais.',
    phone: '(41) 99999-0006',
    whatsapp: '5541999990006',
    yearsExperience: 12,
    plan: 'premium',
    slug: 'paulo-mendes-marido-de-aluguel-curitiba',
    featured: true,
    services: [
      { id: 's11', name: 'Montagem de móveis', description: 'Montagem de qualquer tipo de móvel', price: 'A partir de R$ 80', area: 'Curitiba' },
      { id: 's12', name: 'Instalação de prateleiras', description: 'Instalação segura em qualquer parede', price: 'R$ 50 - R$ 100', area: 'Curitiba' },
    ],
    reviews: [
      { id: 'r6', userName: 'Camila Nunes', rating: 5, qualityRating: 5, punctualityRating: 5, serviceRating: 5, comment: 'Super profissional e atencioso! Recomendo muito.', date: '2024-02-10' },
    ],
  },
];

export const testimonials = [
  { name: 'Fernanda M.', city: 'Curitiba, PR', text: 'Encontrei um eletricista excelente em menos de 5 minutos. Super recomendo!', rating: 5 },
  { name: 'Ricardo S.', city: 'São Paulo, SP', text: 'Plataforma incrível! Os profissionais são verificados e confiáveis.', rating: 5 },
  { name: 'Juliana A.', city: 'Rio de Janeiro, RJ', text: 'Já usei 3 vezes e sempre encontrei profissionais ótimos. Nota 10!', rating: 5 },
];

export const howItWorks = [
  { step: 1, title: 'Busque o serviço', description: 'Digite o serviço que você precisa e sua localização.', icon: '🔍' },
  { step: 2, title: 'Compare profissionais', description: 'Veja avaliações, preços e portfólios de profissionais verificados.', icon: '⭐' },
  { step: 3, title: 'Entre em contato', description: 'Fale diretamente com o profissional pelo WhatsApp ou formulário.', icon: '💬' },
];
