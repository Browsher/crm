import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  distDir: process.env.CRM_E2E === '1' ? '.next-e2e' : '.next',
  experimental: {
    // O padrão é 1 MB. 5.000 linhas dão ~830 KB, e o limite do transporte não
    // pode ser o limite de verdade: acima dele a requisição morre ANTES do
    // nosso código, e a mensagem que sobra não é nossa. Quem recusa é sempre o
    // relatório da fase 1, em português.
    //
    // O limite vale para o corpo HTTP bruto, com o overhead do multipart
    // incluído (a doc do Next sugere 10–20 KB de folga). Daí 2mb e não 1mb.
    // Ver docs/superpowers/specs/2026-09-09-empresas-design.md
    serverActions: { bodySizeLimit: '2mb' },
  },
}

export default nextConfig
