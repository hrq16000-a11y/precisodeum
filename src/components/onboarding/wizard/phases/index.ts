/**
 * phases/ — barrel plano com todos os 19 steps unificados na ordem do
 * UnifiedPhase (fase 2 da consolidação).
 *
 * O WizardShell e os testes E2E consomem por aqui para garantir que a
 * lista canônica vive em UM ÚNICO lugar.
 */
export { default as Step01_Identity } from './Step01_Identity';
export { default as Step02_Who } from './Step02_Who';
export { default as Step03_ClientCity } from './Step03_ClientCity';
export { default as Step04_ProKind } from './Step04_ProKind';
export { default as Step05_ProDocument } from './Step05_ProDocument';
export { default as Step06_ProLocation } from './Step06_ProLocation';
export { default as Step07_TriageCelebration } from './Step07_TriageCelebration';
// Step08_Action / Step09_Kind / Step10_Location / Step11_Contact REMOVIDOS
// na consolidação Bet Mode (mai/2026). Eram re-exports da árvore legada
// `Phase1Basic.tsx` que duplicava telas já cobertas pela triagem (Bet Mode).
// Após a triagem, o usuário entra direto em main_service.
export { default as Step12_Service } from './Step12_Service';
export { default as Step13_ServiceDetails } from './Step13_ServiceDetails';
export { default as Step14_Photos } from './Step14_Photos';
export { default as Step15_Celebration } from './Step15_Celebration';
export { default as Step16_Document } from './Step16_Document';
export { default as Step17_Avatar } from './Step17_Avatar';
export { default as Step18_ExtrasA } from './Step18_ExtrasA';
export { default as Step19_ExtrasB } from './Step19_ExtrasB';
export { default as Step20_MoreServices } from './Step20_MoreServices';
export { default as Step21_PortfolioAlbums } from './Step21_PortfolioAlbums';
