/**
 * Static coordinate cache for Brazil's ~200 largest municipalities.
 * Used as fallback when provider has no lat/lon stored in DB.
 * Key = normalized city name (lowercase, no accents, no spaces/hyphens).
 */

interface CityCoord {
  lat: number;
  lon: number;
  state: string; // UF
}

const CITY_COORDS: Record<string, CityCoord> = {
  // São Paulo
  saopaulo: { lat: -23.5505, lon: -46.6333, state: 'SP' },
  guarulhos: { lat: -23.4538, lon: -46.5333, state: 'SP' },
  campinas: { lat: -22.9099, lon: -47.0626, state: 'SP' },
  saobernardodocampo: { lat: -23.6914, lon: -46.5646, state: 'SP' },
  santoandre: { lat: -23.6737, lon: -46.5432, state: 'SP' },
  osasco: { lat: -23.5325, lon: -46.7917, state: 'SP' },
  saojosedoscampos: { lat: -23.1896, lon: -45.8841, state: 'SP' },
  ribeiraopreto: { lat: -21.1704, lon: -47.8103, state: 'SP' },
  sorocaba: { lat: -23.5015, lon: -47.4526, state: 'SP' },
  santos: { lat: -23.9608, lon: -46.3336, state: 'SP' },
  saovicente: { lat: -23.9574, lon: -46.3883, state: 'SP' },
  maua: { lat: -23.6677, lon: -46.4613, state: 'SP' },
  diadema: { lat: -23.6861, lon: -46.6228, state: 'SP' },
  carapicuiba: { lat: -23.5224, lon: -46.8355, state: 'SP' },
  piracicaba: { lat: -22.7338, lon: -47.6476, state: 'SP' },
  bauru: { lat: -22.3246, lon: -49.0871, state: 'SP' },
  jundia: { lat: -23.1857, lon: -46.8978, state: 'SP' },
  jundiai: { lat: -23.1857, lon: -46.8978, state: 'SP' },
  saocaetanodosul: { lat: -23.6229, lon: -46.5548, state: 'SP' },
  itaquaquecetuba: { lat: -23.4862, lon: -46.3486, state: 'SP' },
  taubate: { lat: -23.0204, lon: -45.5558, state: 'SP' },
  suzano: { lat: -23.5424, lon: -46.3108, state: 'SP' },
  taboaodaserra: { lat: -23.6019, lon: -46.7582, state: 'SP' },
  embu: { lat: -23.6487, lon: -46.8521, state: 'SP' },
  embudasartes: { lat: -23.6487, lon: -46.8521, state: 'SP' },
  praiagrand: { lat: -24.0058, lon: -46.4028, state: 'SP' },
  praiagrande: { lat: -24.0058, lon: -46.4028, state: 'SP' },
  barueri: { lat: -23.5107, lon: -46.8764, state: 'SP' },
  cotia: { lat: -23.6035, lon: -46.9192, state: 'SP' },
  francodaro: { lat: -23.3229, lon: -46.7271, state: 'SP' },
  francodarocha: { lat: -23.3229, lon: -46.7271, state: 'SP' },
  guaruja: { lat: -23.9935, lon: -46.2564, state: 'SP' },
  limeira: { lat: -22.5646, lon: -47.4013, state: 'SP' },
  marilia: { lat: -22.2139, lon: -49.9458, state: 'SP' },
  aracatuba: { lat: -21.2089, lon: -50.4328, state: 'SP' },
  araraquara: { lat: -21.7845, lon: -48.1754, state: 'SP' },
  presidenteprudent: { lat: -22.1256, lon: -51.3889, state: 'SP' },
  presidenteprudente: { lat: -22.1256, lon: -51.3889, state: 'SP' },
  saocarlos: { lat: -22.0174, lon: -47.8908, state: 'SP' },
  americanA: { lat: -22.7374, lon: -47.3331, state: 'SP' },
  americana: { lat: -22.7374, lon: -47.3331, state: 'SP' },
  indaiatuba: { lat: -23.0903, lon: -47.2181, state: 'SP' },
  mogidascruzes: { lat: -23.5224, lon: -46.1856, state: 'SP' },
  itapevi: { lat: -23.5490, lon: -46.9342, state: 'SP' },

  // Rio de Janeiro
  riodejaneiro: { lat: -22.9068, lon: -43.1729, state: 'RJ' },
  saogoncalo: { lat: -22.8269, lon: -43.0634, state: 'RJ' },
  duquedecaxias: { lat: -22.7856, lon: -43.3117, state: 'RJ' },
  novaiguacu: { lat: -22.7592, lon: -43.4510, state: 'RJ' },
  niteroi: { lat: -22.8833, lon: -43.1036, state: 'RJ' },
  belfordroxo: { lat: -22.7643, lon: -43.3992, state: 'RJ' },
  saojoaddemeriti: { lat: -22.8036, lon: -43.3725, state: 'RJ' },
  saojoaodemeriti: { lat: -22.8036, lon: -43.3725, state: 'RJ' },
  camposdosgoytacazes: { lat: -21.7545, lon: -41.3244, state: 'RJ' },
  petr0polis: { lat: -22.5047, lon: -43.1785, state: 'RJ' },
  petropolis: { lat: -22.5047, lon: -43.1785, state: 'RJ' },
  voltaredonda: { lat: -22.5023, lon: -44.1044, state: 'RJ' },
  magé: { lat: -22.6528, lon: -43.1708, state: 'RJ' },
  mage: { lat: -22.6528, lon: -43.1708, state: 'RJ' },
  itaborai: { lat: -22.7444, lon: -42.8594, state: 'RJ' },
  mesquita: { lat: -22.8025, lon: -43.4197, state: 'RJ' },
  nilop0lis: { lat: -22.8058, lon: -43.4231, state: 'RJ' },
  nilopolis: { lat: -22.8058, lon: -43.4231, state: 'RJ' },
  queimados: { lat: -22.7106, lon: -43.5519, state: 'RJ' },
  marica: { lat: -22.9194, lon: -42.8186, state: 'RJ' },
  cabofrio: { lat: -22.8789, lon: -42.0186, state: 'RJ' },
  macae: { lat: -22.3708, lon: -41.7869, state: 'RJ' },

  // Minas Gerais
  belohorizonte: { lat: -19.9167, lon: -43.9345, state: 'MG' },
  uberlandia: { lat: -18.9186, lon: -48.2772, state: 'MG' },
  contagem: { lat: -19.9320, lon: -44.0539, state: 'MG' },
  juizdefora: { lat: -21.7642, lon: -43.3503, state: 'MG' },
  betim: { lat: -19.9678, lon: -44.1983, state: 'MG' },
  montes claros: { lat: -16.7350, lon: -43.8616, state: 'MG' },
  montesclaros: { lat: -16.7350, lon: -43.8616, state: 'MG' },
  ribeiraodasneves: { lat: -19.7669, lon: -44.0867, state: 'MG' },
  uberaba: { lat: -19.7472, lon: -47.9319, state: 'MG' },
  governadorvaladares: { lat: -18.8511, lon: -41.9494, state: 'MG' },
  ipatinga: { lat: -19.4683, lon: -42.5367, state: 'MG' },
  setelagoas: { lat: -19.4616, lon: -44.2467, state: 'MG' },
  divinopolis: { lat: -20.1389, lon: -44.8842, state: 'MG' },
  santaLuzia: { lat: -19.7697, lon: -43.8514, state: 'MG' },
  santaluzia: { lat: -19.7697, lon: -43.8514, state: 'MG' },
  ibirite: { lat: -20.0219, lon: -44.0589, state: 'MG' },
  sabinoB: { lat: -19.8847, lon: -43.9922, state: 'MG' },
  sabara: { lat: -19.8847, lon: -43.9922, state: 'MG' },
  vespasiano: { lat: -19.6917, lon: -43.9231, state: 'MG' },

  // Paraná
  curitiba: { lat: -25.4284, lon: -49.2733, state: 'PR' },
  londrina: { lat: -23.3045, lon: -51.1696, state: 'PR' },
  maringa: { lat: -23.4205, lon: -51.9333, state: 'PR' },
  pontaGrossa: { lat: -25.0994, lon: -50.1583, state: 'PR' },
  pontagrossa: { lat: -25.0994, lon: -50.1583, state: 'PR' },
  cascavel: { lat: -24.9578, lon: -53.4596, state: 'PR' },
  saojosedospinhais: { lat: -25.5350, lon: -49.2081, state: 'PR' },
  fozdoiguacu: { lat: -25.5163, lon: -54.5854, state: 'PR' },
  colombo: { lat: -25.2917, lon: -49.2242, state: 'PR' },
  guarapuava: { lat: -25.3935, lon: -51.4562, state: 'PR' },
  paranagua: { lat: -25.5205, lon: -48.5095, state: 'PR' },
  araucaria: { lat: -25.5929, lon: -49.4103, state: 'PR' },
  toledo: { lat: -24.7254, lon: -53.7433, state: 'PR' },
  campoLargo: { lat: -25.4594, lon: -49.5312, state: 'PR' },
  campolargo: { lat: -25.4594, lon: -49.5312, state: 'PR' },
  almirante_tamandare: { lat: -25.3264, lon: -49.3039, state: 'PR' },
  almirantetamandare: { lat: -25.3264, lon: -49.3039, state: 'PR' },
  pinhais: { lat: -25.4428, lon: -49.1928, state: 'PR' },
  piraquara: { lat: -25.4422, lon: -49.0631, state: 'PR' },
  fazendariogrande: { lat: -25.6619, lon: -49.3103, state: 'PR' },
  campinagrandedosul: { lat: -25.3056, lon: -49.0553, state: 'PR' },

  // Rio Grande do Sul
  portoalegre: { lat: -30.0346, lon: -51.2177, state: 'RS' },
  caxiasdosul: { lat: -29.1681, lon: -51.1794, state: 'RS' },
  pelotas: { lat: -31.7654, lon: -52.3376, state: 'RS' },
  canoas: { lat: -29.9178, lon: -51.1837, state: 'RS' },
  santamaria: { lat: -29.6842, lon: -53.8069, state: 'RS' },
  gravatai: { lat: -29.9447, lon: -50.9919, state: 'RS' },
  viamao: { lat: -30.0811, lon: -51.0233, state: 'RS' },
  novohamburgO: { lat: -29.6875, lon: -51.1306, state: 'RS' },
  novohamburgo: { lat: -29.6875, lon: -51.1306, state: 'RS' },
  saoleopoldo: { lat: -29.7603, lon: -51.1472, state: 'RS' },
  riogrande: { lat: -32.0350, lon: -52.0986, state: 'RS' },
  alvorada: { lat: -29.9897, lon: -51.0814, state: 'RS' },
  passofundo: { lat: -28.2628, lon: -52.4067, state: 'RS' },
  cachoeirinha: { lat: -29.9511, lon: -51.0939, state: 'RS' },
  sapucaiadosul: { lat: -29.8275, lon: -51.1450, state: 'RS' },
  esteio: { lat: -29.8617, lon: -51.1792, state: 'RS' },

  // Santa Catarina
  florianopolis: { lat: -27.5954, lon: -48.5480, state: 'SC' },
  joinville: { lat: -26.3045, lon: -48.8487, state: 'SC' },
  blumenau: { lat: -26.9194, lon: -49.0661, state: 'SC' },
  chapeco: { lat: -27.1006, lon: -52.6157, state: 'SC' },
  itajai: { lat: -26.9078, lon: -48.6619, state: 'SC' },
  criciuma: { lat: -28.6775, lon: -49.3697, state: 'SC' },
  jaragua_dosul: { lat: -26.4855, lon: -49.0710, state: 'SC' },
  jaraguadosul: { lat: -26.4855, lon: -49.0710, state: 'SC' },
  lages: { lat: -27.8161, lon: -50.3261, state: 'SC' },
  palhoça: { lat: -27.6453, lon: -48.6681, state: 'SC' },
  palhoca: { lat: -27.6453, lon: -48.6681, state: 'SC' },
  saojose: { lat: -27.6136, lon: -48.6278, state: 'SC' },
  biguacu: { lat: -27.4964, lon: -48.6558, state: 'SC' },

  // Bahia
  salvador: { lat: -12.9714, lon: -38.5124, state: 'BA' },
  feiradesantana: { lat: -12.2669, lon: -38.9668, state: 'BA' },
  vitóriadaconquista: { lat: -14.8619, lon: -40.8444, state: 'BA' },
  vitoriadaconquista: { lat: -14.8619, lon: -40.8444, state: 'BA' },
  camaçari: { lat: -12.6996, lon: -38.3244, state: 'BA' },
  camacari: { lat: -12.6996, lon: -38.3244, state: 'BA' },
  itabuna: { lat: -14.7856, lon: -39.2803, state: 'BA' },
  lauroDefreitas: { lat: -12.8931, lon: -38.3231, state: 'BA' },
  laurodefreitas: { lat: -12.8931, lon: -38.3231, state: 'BA' },
  ilheus: { lat: -14.7886, lon: -39.0494, state: 'BA' },
  jequie: { lat: -13.8578, lon: -40.0836, state: 'BA' },
  simoefilho: { lat: -12.7864, lon: -38.4014, state: 'BA' },
  simoesfilho: { lat: -12.7864, lon: -38.4014, state: 'BA' },

  // Pernambuco
  recife: { lat: -8.0476, lon: -34.8770, state: 'PE' },
  jaboataodosguararapes: { lat: -8.1800, lon: -35.0153, state: 'PE' },
  olinda: { lat: -8.0089, lon: -34.8553, state: 'PE' },
  paulista: { lat: -7.9386, lon: -34.8728, state: 'PE' },
  caruaru: { lat: -8.2823, lon: -35.9761, state: 'PE' },
  petrolina: { lat: -9.3886, lon: -40.5025, state: 'PE' },
  cabodeagostinho: { lat: -8.2844, lon: -35.0250, state: 'PE' },
  camaragibe: { lat: -8.0228, lon: -34.9908, state: 'PE' },

  // Ceará
  fortaleza: { lat: -3.7172, lon: -38.5433, state: 'CE' },
  caucaia: { lat: -3.7361, lon: -38.6531, state: 'CE' },
  juazeirodonorte: { lat: -7.2131, lon: -39.3153, state: 'CE' },
  maracanau: { lat: -3.8761, lon: -38.6253, state: 'CE' },
  sobral: { lat: -3.6861, lon: -40.3481, state: 'CE' },

  // Goiás
  goiania: { lat: -16.6869, lon: -49.2648, state: 'GO' },
  aparecidadegoiania: { lat: -16.8198, lon: -49.2469, state: 'GO' },
  anapolis: { lat: -16.3267, lon: -48.9526, state: 'GO' },
  rioverde: { lat: -17.7981, lon: -50.9192, state: 'GO' },
  luziania: { lat: -16.2525, lon: -47.9503, state: 'GO' },
  trindade: { lat: -16.6514, lon: -49.4914, state: 'GO' },
  senador_canedo: { lat: -16.7086, lon: -49.0931, state: 'GO' },
  senadorcanedo: { lat: -16.7086, lon: -49.0931, state: 'GO' },

  // Distrito Federal
  brasilia: { lat: -15.7975, lon: -47.8919, state: 'DF' },

  // Pará
  belem: { lat: -1.4558, lon: -48.5024, state: 'PA' },
  ananindeua: { lat: -1.3659, lon: -48.3886, state: 'PA' },
  santarem: { lat: -2.4431, lon: -54.7083, state: 'PA' },
  maraba: { lat: -5.3686, lon: -49.1178, state: 'PA' },
  castanhal: { lat: -1.2936, lon: -47.9261, state: 'PA' },
  marituba: { lat: -1.3561, lon: -48.3458, state: 'PA' },

  // Maranhão
  saoluis: { lat: -2.5307, lon: -44.2826, state: 'MA' },
  imperatriz: { lat: -5.5186, lon: -47.4917, state: 'MA' },
  saojosederibamar: { lat: -2.5486, lon: -44.0589, state: 'MA' },

  // Amazonas
  manaus: { lat: -3.1190, lon: -60.0217, state: 'AM' },

  // Espírito Santo
  vitoria: { lat: -20.3155, lon: -40.3128, state: 'ES' },
  vilavelha: { lat: -20.3297, lon: -40.2925, state: 'ES' },
  serra: { lat: -20.1209, lon: -40.3075, state: 'ES' },
  cariacica: { lat: -20.2636, lon: -40.4164, state: 'ES' },

  // Mato Grosso
  cuiaba: { lat: -15.6014, lon: -56.0979, state: 'MT' },
  varzeagrande: { lat: -15.6469, lon: -56.1325, state: 'MT' },
  rondonopolis: { lat: -16.4700, lon: -54.6372, state: 'MT' },
  sinop: { lat: -11.8639, lon: -55.5064, state: 'MT' },

  // Mato Grosso do Sul
  campogrande: { lat: -20.4697, lon: -54.6201, state: 'MS' },
  dourados: { lat: -22.2233, lon: -54.8083, state: 'MS' },
  treslagoas: { lat: -20.7511, lon: -51.6783, state: 'MS' },

  // Paraíba
  joaopessoa: { lat: -7.1195, lon: -34.8450, state: 'PB' },
  campinagrande: { lat: -7.2306, lon: -35.8811, state: 'PB' },

  // Rio Grande do Norte
  natal: { lat: -5.7945, lon: -35.2110, state: 'RN' },
  mossoro: { lat: -5.1878, lon: -37.3444, state: 'RN' },
  parnamirim: { lat: -5.9156, lon: -35.2628, state: 'RN' },

  // Alagoas
  maceio: { lat: -9.6658, lon: -35.7353, state: 'AL' },
  arapiraca: { lat: -9.7522, lon: -36.6611, state: 'AL' },

  // Piauí
  teresina: { lat: -5.0892, lon: -42.8019, state: 'PI' },

  // Sergipe
  aracaju: { lat: -10.9111, lon: -37.0717, state: 'SE' },

  // Rondônia
  portovelho: { lat: -8.7612, lon: -63.9004, state: 'RO' },

  // Tocantins
  palmas: { lat: -10.1689, lon: -48.3317, state: 'TO' },

  // Acre
  riobranco: { lat: -9.9747, lon: -67.8100, state: 'AC' },

  // Amapá
  macapa: { lat: 0.0349, lon: -51.0694, state: 'AP' },

  // Roraima
  boavista: { lat: 2.8195, lon: -60.6714, state: 'RR' },
};

/**
 * Normalize city name for lookup (same normalization as useProviders).
 */
function normalizeForLookup(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_\s]+/g, '')
    .trim();
}

/**
 * Get coordinates for a city from the static cache.
 * Returns null if not found.
 */
export function getCityCoords(city: string): { lat: number; lon: number } | null {
  const key = normalizeForLookup(city);
  const entry = CITY_COORDS[key];
  if (entry) return { lat: entry.lat, lon: entry.lon };
  return null;
}

export { CITY_COORDS };
