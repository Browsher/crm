import { writeFileSync } from 'node:fs'
import { montarModelo } from '../src/features/empresas/modelo'

// CLI fino, no molde de scripts/db/cep-carregar.mts: a lógica vive em src/.
// Rodar depois de mexer no cabeçalho ou no gerador, e commitar o binário novo —
// o teste compara o arquivo versionado com o que este código produz.
const destino = 'public/modelo-empresas.xlsx'
const bytes = montarModelo()
writeFileSync(destino, bytes)
console.log(`${destino}: ${bytes.length} bytes`)
