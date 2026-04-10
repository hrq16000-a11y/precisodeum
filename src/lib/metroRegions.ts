/**
 * Metropolitan regions of Brazil — maps a normalized metro key
 * to the set of member municipalities (normalized names).
 *
 * Used for precise geo-matching: "Região Metropolitana de Curitiba"
 * matches São José dos Pinhais but NOT Londrina.
 */

function n(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\s]+/g, '');
}

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
      'campinagrandedosul', 'quatro barras', 'quatrobarras', 'bocaiuvadosul',
      'itaperucu', 'riobraodosul', 'riobrancodosul', 'mandirituba',
      'contendA', 'contenda', 'balsamova', 'balsanova', 'lapa', 'tijucasdosul',
      'adrianopolis', 'agudosdosul', 'campomagro', 'campodomourao',
      'cerroazul', 'doutor_ulysses', 'doutorulysses', 'piendosul', 'pien',
      'quitandinha', 'tunasdoparana', 'tunasdo parana',
    ].map(n),
  },
  {
    pole: 'saopaulo',
    state: 'SP',
    members: [
      'saopaulo', 'guarulhos', 'osasco', 'saobernardodocampo', 'santoandre',
      'saocaetanodosul', 'diadema', 'maua', 'suzano', 'taboaodaserra',
      'barueri', 'carapicuiba', 'cotia', 'embudasartes', 'embu',
      'francodarocha', 'francodaro', 'itaquaquecetuba', 'itapevi',
      'mogidascruzes', 'ferrazdevasconcelos', 'poadearaujo', 'poa',
      'ribeiraopires', 'rioGrandedaserrA', 'riograndedaserra', 'santana de parnaiba',
      'santanadeparnaiba', 'jandira', 'caieiras', 'mairipora',
      'aruja', 'biritibamirim', 'salesopolis', 'guararema',
      'vargem grande paulista', 'vargemgrandepaulista', 'juquitiba', 'saolourençodaserra',
      'saolourencodaserra', 'itapecerica_daserra', 'itapecerica', 'itapecericadaserra',
    ].map(n),
  },
  {
    pole: 'riodejaneiro',
    state: 'RJ',
    members: [
      'riodejaneiro', 'saogoncalo', 'duquedecaxias', 'novaiguacu', 'niteroi',
      'belfordroxo', 'saojoaodemeriti', 'mesquita', 'nilopolis', 'queimados',
      'mage', 'itaborai', 'marica', 'guapimirim', 'tangua', 'cachoeirasdemacacu',
      'itaguai', 'seropedica', 'japeri', 'paracambi', 'mangaratiba',
    ].map(n),
  },
  {
    pole: 'belohorizonte',
    state: 'MG',
    members: [
      'belohorizonte', 'contagem', 'betim', 'ribeiraodasneves', 'santaluzia',
      'ibirite', 'sabara', 'vespasiano', 'novaLima', 'novalima', 'raposos',
      'caete', 'pedro leopoldo', 'pedroleopoldo', 'lagoasanta', 'confins',
      'matozinhos', 'esmeraldas', 'florestal', 'rioAcima', 'rioacima',
      'saojosedalapa', 'jaboticatubas', 'itaguaradamata', 'taquaracu de minas',
      'taquaracudeminas', 'baldim', 'brumadinhos', 'brumadinho',
    ].map(n),
  },
  {
    pole: 'portoalegre',
    state: 'RS',
    members: [
      'portoalegre', 'canoas', 'gravatai', 'viamao', 'novohamburgo',
      'saoleopoldo', 'alvorada', 'cachoeirinha', 'sapucaiadosul', 'esteio',
      'guaiba', 'eldoradodosul', 'triunfo', 'charqueadas', 'saojeron',
      'saojeronimo', 'montenegro', 'ivoti', 'dois irmaos', 'doisirmaos',
      'estanciavelha', 'campo bom', 'campobom', 'portao', 'sapiranga',
      'ararica', 'novasantarita', 'igrejinha',
    ].map(n),
  },
  {
    pole: 'recife',
    state: 'PE',
    members: [
      'recife', 'jaboataodosguararapes', 'olinda', 'paulista', 'camaragibe',
      'cabodeagostinho', 'abreu e lima', 'abreuelima', 'igarassu',
      'itapissuma', 'itamaraca', 'ilhadeitamaraca', 'ipojuca', 'moreno',
      'saolourençodamata', 'saolourencodamata', 'aracoiaba',
    ].map(n),
  },
  {
    pole: 'fortaleza',
    state: 'CE',
    members: [
      'fortaleza', 'caucaia', 'maracanau', 'maranguape', 'pacatuba',
      'eusebio', 'aquiraz', 'horizonte', 'itaitinga', 'guaiuba',
      'chorozinho', 'pacajus', 'cascavel', 'pindoretama', 'saogoncalodoamarante',
    ].map(n),
  },
  {
    pole: 'salvador',
    state: 'BA',
    members: [
      'salvador', 'camacari', 'laurodefreitas', 'simoesfilho', 'simoefilho',
      'candeias', 'diasdavila', 'madre de deus', 'madrededeus',
      'saofranciscode conte', 'saofranciscodoconde', 'veracruz', 'itaparica',
      'pojuca', 'saoSebastiaodopassé', 'saosebastiaodopasse',
    ].map(n),
  },
  {
    pole: 'goiania',
    state: 'GO',
    members: [
      'goiania', 'aparecidadegoiania', 'trindade', 'senadorcanedo',
      'goianira', 'neropolis', 'inhumas', 'bonfinopolis', 'abadia de goias',
      'abadiadegoias', 'aragoiania', 'hidrolandia', 'goianapolis',
      'santo antonio de goias', 'santoantoniodegoias', 'caldazinha',
      'caturai', 'taquaraldegoias',
    ].map(n),
  },
  {
    pole: 'vitoria',
    state: 'ES',
    members: [
      'vitoria', 'vilavelha', 'serra', 'cariacica', 'viana', 'guarapari',
      'fundao',
    ].map(n),
  },
  {
    pole: 'florianopolis',
    state: 'SC',
    members: [
      'florianopolis', 'saojose', 'palhoca', 'biguacu', 'santoantoniodelisboa',
      'governadorcelsoramos', 'aguasmornas', 'angelina', 'anitapolis',
      'antoniocarlos', 'rancho queimado', 'ranchoqueimado',
      'santoamarodaimperatriz', 'saopedrodeAlcantara', 'saopedrodeAlcantarA',
      'saopedrodealcantara',
    ].map(n),
  },
  {
    pole: 'belem',
    state: 'PA',
    members: [
      'belem', 'ananindeua', 'marituba', 'benevides', 'santabarbaradopara',
      'santaisabeldopara',
    ].map(n),
  },
  {
    pole: 'natal',
    state: 'RN',
    members: [
      'natal', 'parnamirim', 'saogoncalodoamarante', 'macaiba', 'ceara-mirim',
      'cearamirim', 'extremoz', 'niziafloresta', 'saojosedemipibU',
      'saojosedemipibu', 'monte alegre', 'montealegre', 'veracruz',
    ].map(n),
  },
  {
    pole: 'saoluis',
    state: 'MA',
    members: [
      'saoluis', 'saojosederibamar', 'pacodolumiar', 'raposa', 'alcantara',
    ].map(n),
  },
  {
    pole: 'joaopessoa',
    state: 'PB',
    members: [
      'joaopessoa', 'santarita', 'bayeux', 'cabedelo', 'condE',
      'conde', 'lucena', 'cruzdoespiritosanto',
    ].map(n),
  },
  {
    pole: 'maceio',
    state: 'AL',
    members: [
      'maceio', 'rioLargo', 'riolargo', 'marechaldeodoro', 'satuba',
      'paripueira', 'barradeSantoantonio', 'barradesantoantonio',
      'pilar', 'santaLuziadoNorte', 'santaluziadonorte', 'coqueiroseco',
    ].map(n),
  },
  {
    pole: 'cuiaba',
    state: 'MT',
    members: [
      'cuiaba', 'varzeagrande', 'nossasenhoradolivramento', 'santoantoniodoleverguer',
      'santoantoniodeleverguer', 'acorizal', 'chapadadosguimaraes',
    ].map(n),
  },
  {
    pole: 'campogrande',
    state: 'MS',
    members: [
      'campogrande', 'terenos', 'sidrolandia', 'novaalvorada dosul',
      'novaalvoradadosul', 'ribas do rio pardo', 'ribasdo riopardo',
      'ribasdoriopardo', 'jaraguari',
    ].map(n),
  },
];

// Build a lookup: normalizedPole → MetroRegion
const _poleMap: Record<string, MetroRegion> = {};
// Build a lookup: normalizedMember → list of metro regions it belongs to
const _memberMap: Record<string, MetroRegion[]> = {};

METRO_REGIONS.forEach((mr) => {
  _poleMap[mr.pole] = mr;
  mr.members.forEach((m) => {
    if (!_memberMap[m]) _memberMap[m] = [];
    _memberMap[m].push(mr);
  });
});

/**
 * Given a normalized city name extracted from a "Região Metropolitana de X"
 * pattern, find the metro region whose pole matches.
 */
export function findMetroByPole(poleCityNorm: string): MetroRegion | null {
  return _poleMap[poleCityNorm] || null;
}

/**
 * Check if a provider city (normalized) is a member of a given metro region.
 */
export function isMemberOfMetro(providerCityNorm: string, metro: MetroRegion): boolean {
  return metro.members.includes(providerCityNorm);
}

/**
 * Known regional pattern aliases that map to a specific metro pole.
 * E.g. "baixadafluminense" → riodejaneiro, "regiaodoabc" → saopaulo
 */
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

/**
 * Try to resolve a normalized geo string to a metro region.
 * Handles: "regiaometropolitanade..." , "grande..." , regional aliases.
 */
export function resolveMetroRegion(normalizedGeo: string, stateNorm?: string): MetroRegion | null {
  // 1. "regiaometropolitanade..." pattern
  const rmPrefix = 'regiaometropolitanade';
  if (normalizedGeo.startsWith(rmPrefix)) {
    const pole = normalizedGeo.slice(rmPrefix.length);
    const found = findMetroByPole(pole);
    if (found) return found;
  }

  // Also handle without "de": "regiaometropolitanacuritiba"
  const rmPrefix2 = 'regiaometropolitana';
  if (normalizedGeo.startsWith(rmPrefix2) && !normalizedGeo.startsWith(rmPrefix)) {
    const pole = normalizedGeo.slice(rmPrefix2.length);
    const found = findMetroByPole(pole);
    if (found) return found;
  }

  // 2. "grande..." pattern
  if (normalizedGeo.startsWith('grande')) {
    const pole = normalizedGeo.slice(6);
    const found = findMetroByPole(pole);
    if (found) return found;
  }

  // 3. Regional aliases
  const alias = REGIONAL_ALIASES[normalizedGeo];
  if (alias) {
    return findMetroByPole(alias) || null;
  }

  // 4. Direct pole match (user typed a city that is a metro pole)
  if (stateNorm) {
    const found = findMetroByPole(normalizedGeo);
    if (found && n(found.state) === stateNorm) return found;
  }

  return null;
}

export { METRO_REGIONS };
export type { MetroRegion };
