

## Plano: Corrigir warnings de forwardRef

### Problema
React emite "Function components cannot be given refs" quando um componente funcional é passado a `lazy()` ou recebe `ref` sem usar `forwardRef`.

### Alterações

**1. `src/components/AvatarUpload.tsx`**
- Converter para `forwardRef<HTMLDivElement, AvatarUploadProps>`
- Passar `ref` ao `<div>` raiz

**2. `src/components/FloatingHelpButton.tsx`**
- Converter para `forwardRef<HTMLDivElement>`
- Passar `ref` ao fragment wrapper (converter para `<div>`)

**3. `src/components/sponsors/SponsorLeaderBanner.tsx`**
- Converter para `forwardRef<HTMLDivElement>`
- Passar `ref` ao `<div>` wrapper

**4. `src/components/home/LeaderSponsor.tsx`**
- Já usa `memo`; trocar para `memo(forwardRef(...))`
- Passar `ref` ao `<motion.section>` raiz

### Arquivos modificados
- `src/components/AvatarUpload.tsx`
- `src/components/FloatingHelpButton.tsx`
- `src/components/sponsors/SponsorLeaderBanner.tsx`
- `src/components/home/LeaderSponsor.tsx`

