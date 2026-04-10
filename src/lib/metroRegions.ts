/**
 * Metropolitan regions of Brazil — maps a normalized metro key
 * to the set of member municipalities (normalized names).
 *
 * Used for precise geo-matching: "Região Metropolitana de Curitiba"
 * matches São José dos Pinhais but NOT Londrina.
 *
 * All member names are pre-normalized via normalize().
 */
import { normalize } from './normalize';

interface MetroRegion {
  pole: string;        // normalized pole city
  state: string;       // UF
  members: string[];   // normalized member city names
}

const METRO_REGIONS: MetroRegion[] = [
  {
    pole: 'curitiba',
    state: 'PR',
    members: [
      'curitiba', 'saojosedospinhais', 'colombo', 'araucaria', 'pinhais',
      'campolargo', 'almirantetamandare', 'piraquara', 'fazendariogrande',
      'campinagrandedosul', 'quatrobarras', 'bocaiuvadosul',
      'itaperucu', 'riobrancodosul', 'mandirituba',
      'contenda', 'balsanova', 'lapa', 'tijucasdosul',
      'adrianopolis', 'agudosdosul', 'campomagro',
      'cerroazul', 'doutorulysses', 'pien',
      'quitandinha', 'tunasdoparana',
    ],
  },
  {
    pole: 'saopaulo',
    state: 'SP',
    members: [
      'saopaulo', 'guarulhos', 'osasco', 'saobernardodocampo', 'santoandre',
      'saocaetanodosul', 'diadema', 'maua', 'suzano', 'taboaodaserra',
      'barueri', 'carapicuiba', 'cotia', 'embudasartes',
      'francodarocha', 'itaquaquecetuba', 'itapevi',
      'mogidascruzes', 'ferrazdevasconcelos', 'poa',
      'ribeiraopires', 'riograndedaserra',
      'santanadeparnaiba', 'jandira', 'caieiras', 'mairipora',
      'aruja', 'biritibamirim', 'salesopolis', 'guararema',
      'vargemgrandepaulista', 'juquitiba', 'saolourencodaserra',
      'itapecericadaserra',
    ],
  },
  {
    pole: 'riodejaneiro',
    state: 'RJ',
    members: [
      'riodejaneiro', 'saogoncalo', 'duquedecaxias', 'novaiguacu', 'niteroi',
      'belfordroxo', 'saojoaodemeriti', 'mesquita', 'nilopolis', 'queimados',
      'mage', 'itaborai', 'marica', 'guapimirim', 'tangua', 'cachoeirasdemacacu',
      'itaguai', 'seropedica', 'japeri', 'paracambi', 'mangaratiba',
    ],
  },
  {
    pole: 'belohorizonte',
    state: 'MG',
    members: [
      'belohorizonte', 'contagem', 'betim', 'ribeiraodasneves', 'santaluzia',
      'ibirite', 'sabara', 'vespasiano', 'novalima', 'raposos',
      'caete', 'pedroleopoldo', 'lagoasanta', 'confins',
      'matozinhos', 'esmeraldas', 'florestal', 'rioacima',
      'saojosedalapa', 'jaboticatubas', 'itaguaradamata',
      'taquaracudeminas', 'baldim', 'brumadinho',
    ],
  },
  {
    pole: 'portoalegre',
    state: 'RS',
    members: [
      'portoalegre', 'canoas', 'gravatai', 'viamao', 'novohamburgo',
      'saoleopoldo', 'alvorada', 'cachoeirinha', 'sapucaiadosul', 'esteio',
      'guaiba', 'eldoradodosul', 'triunfo', 'charqueadas',
      'saojeronimo', 'montenegro', 'ivoti', 'doisirmaos',
      'estanciavelha', 'campobom', 'portao', 'sapiranga',
      'ararica', 'novasantarita', 'igrejinha',
    ],
  },
  {
    pole: 'recife',
    state: 'PE',
    members: [
      'recife', 'jaboataodosguararapes', 'olinda', 'paulista', 'camaragibe',
      'cabodeagostinho', 'abreuelima', 'igarassu',
      'itapissuma', 'ilhadeitamaraca', 'ipojuca', 'moreno',
      'saolourencodamata', 'aracoiaba',
    ],
  },
  {
    pole: 'fortaleza',
    state: 'CE',
    members: [
      'fortaleza', 'caucaia', 'maracanau', 'maranguape', 'pacatuba',
      'eusebio', 'aquiraz', 'horizonte', 'itaitinga', 'guaiuba',
      'chorozinho', 'pacajus', 'cascavel', 'pindoretama', 'saogoncalodoamarante',
    ],
  },
  {
    pole: 'salvador',
    state: 'BA',
    members: [
      'salvador', 'camacari', 'laurodefreitas', 'simoesfilho',
      'candeias', 'diasdavila', 'madrededeus',
      'saofranciscodoconde', 'veracruz', 'itaparica',
      'pojuca', 'saosebastiaodopasse',
    ],
  },
  {
    pole: 'goiania',
    state: 'GO',
    members: [
      'goiania', 'aparecidadegoiania', 'trindade', 'senadorcanedo',
      'goianira', 'neropolis', 'inhumas', 'bonfinopolis',
      'abadiadegoias', 'aragoiania', 'hidrolandia', 'goianapolis',
      'santoantoniodegoias', 'caldazinha',
      'caturai', 'taquaraldegoias',
    ],
  },
  {
    pole: 'vitoria',
    state: 'ES',
    members: [
      'vitoria', 'vilavelha', 'serra', 'cariacica', 'viana', 'guarapari',
      'fundao',
    ],
  },
  {
    pole: 'florianopolis',
    state: 'SC',
    members: [
      'florianopolis', 'saojose', 'palhoca', 'biguacu', 'santoantoniodelisboa',
      'governadorcelsoramos', 'aguasmornas', 'angelina', 'anitapolis',
      'antoniocarlos', 'ranchoqueimado',
      'santoamarodaimperatriz', 'saopedrodealcantara',
    ],
  },
  {
    pole: 'belem',
    state: 'PA',
    members: [
      'belem', 'ananindeua', 'marituba', 'benevides', 'santabarbaradopara',
      'santaisabeldopara',
    ],
  },
  {
    pole: 'natal',
    state: 'RN',
    members: [
      'natal', 'parnamirim', 'saogoncalodoamarante', 'macaiba',
      'cearamirim', 'extremoz', 'niziafloresta',
      'saojosedemipibu', 'montealegre', 'veracruz',
    ],
  },
  {
    pole: 'saoluis',
    state: 'MA',
    members: [
      'saoluis', 'saojosederibamar', 'pacodolumiar', 'raposa', 'alcantara',
    ],
  },
  {
    pole: 'joaopessoa',
    state: 'PB',
    members: [
      'joaopessoa', 'santarita', 'bayeux', 'cabedelo',
      'conde', 'lucena', 'cruzdoespiritosanto',
    ],
  },
  {
    pole: 'maceio',
    state: 'AL',
    members: [
      'maceio', 'riolargo', 'marechaldeodoro', 'satuba',
      'paripueira', 'barradesantoantonio',
      'pilar', 'santaluziadonorte', 'coqueiroseco',
    ],
  },
  {
    pole: 'cuiaba',
    state: 'MT',
    members: [
      'cuiaba', 'varzeagrande', 'nossasenhoradolivramento',
      'santoantoniodeleverguer', 'acorizal', 'chapadadosguimaraes',
    ],
  },
  {
    pole: 'campogrande',
    state: 'MS',
    members: [
      'campogrande', 'terenos', 'sidrolandia',
      'novaalvoradadosul', 'ribasdoriopardo', 'jaraguari',
    ],
  },
  {
    pole: 'campinas',
    state: 'SP',
    members: [
      'campinas', 'hortolandia', 'sumare', 'americana', 'santabarbara doeste',
      'indaiatuba', 'paulinia', 'valinhos', 'vinhedo', 'itatiba',
      'jaguariuna', 'pedreira', 'cosmopolis', 'artur nogueira',
      'engenheiro coelho', 'holambra', 'santo antonio de posse',
      'morungaba', 'monte mor', 'nova odessa',
    ].map(s => s.replace(/\s/g, '')),
  },
  {
    pole: 'manaus',
    state: 'AM',
    members: [
      'manaus', 'iranduba', 'riopretodaeva', 'presidentefigueiredo',
      'manacapuru', 'itacoatiara', 'novaairao', 'careirodavarze',
    ],
  },
  {
    pole: 'brasilia',
    state: 'DF',
    members: [
      'brasilia', 'luziania', 'valparaiso degoias', 'aguaslindas degoias',
      'novogama', 'cidadeocidental', 'planaltina', 'formosa',
      'santoantoniododescoberto', 'alexania',
    ].map(s => s.replace(/\s/g, '')),
  },
  {
    pole: 'santos',
    state: 'SP',
    members: [
      'santos', 'saovicente', 'guaruja', 'praiagrande', 'cubatao',
      'bertioga', 'itanhaem', 'mongagua', 'peruibe',
    ],
  },
];

// Build lookups
const _poleMap: Record<string, MetroRegion> = {};
const _memberMap: Record<string, MetroRegion[]> = {};

METRO_REGIONS.forEach((mr) => {
  _poleMap[mr.pole] = mr;
  mr.members.forEach((m) => {
    if (!_memberMap[m]) _memberMap[m] = [];
    _memberMap[m].push(mr);
  });
});

export function findMetroByPole(poleCityNorm: string): MetroRegion | null {
  return _poleMap[poleCityNorm] || null;
}

export function isMemberOfMetro(providerCityNorm: string, metro: MetroRegion): boolean {
  return metro.members.includes(providerCityNorm);
}

const REGIONAL_ALIASES: Record<string, string> = {
  baixadafluminense: 'riodejaneiro',
  baixadasantista: 'santos',
  regiaodoabc: 'saopaulo',
  abcpaulista: 'saopaulo',
  grandesaopaulo: 'saopaulo',
  granderiodejaneiro: 'riodejaneiro',
  grandebelohorizonte: 'belohorizonte',
  grandecuritiba: 'curitiba',
  grandeportoalegre: 'portoalegre',
  granderecife: 'recife',
  grandefortaleza: 'fortaleza',
  grandesalvador: 'salvador',
  grandegoiania: 'goiania',
  grandevitoria: 'vitoria',
  grandeflorianopolis: 'florianopolis',
  grandebelem: 'belem',
  grandenatal: 'natal',
  grandesaoluis: 'saoluis',
};

export function resolveMetroRegion(normalizedGeo: string, stateNorm?: string): MetroRegion | null {
  const rmPrefix = 'regiaometropolitanade';
  if (normalizedGeo.startsWith(rmPrefix)) {
    const pole = normalizedGeo.slice(rmPrefix.length);
    const found = findMetroByPole(pole);
    if (found) return found;
  }

  const rmPrefix2 = 'regiaometropolitana';
  if (normalizedGeo.startsWith(rmPrefix2) && !normalizedGeo.startsWith(rmPrefix)) {
    const pole = normalizedGeo.slice(rmPrefix2.length);
    const found = findMetroByPole(pole);
    if (found) return found;
  }

  if (normalizedGeo.startsWith('grande')) {
    const pole = normalizedGeo.slice(6);
    const found = findMetroByPole(pole);
    if (found) return found;
  }

  const alias = REGIONAL_ALIASES[normalizedGeo];
  if (alias) {
    return findMetroByPole(alias) || null;
  }

  if (stateNorm) {
    const found = findMetroByPole(normalizedGeo);
    if (found && normalize(found.state) === stateNorm) return found;
  }

  return null;
}

export { METRO_REGIONS };
export type { MetroRegion };
