export type MetadadosGrupo = { descricao: string; origem: string; criterios: string | null }
type Campo = keyof MetadadosGrupo
type Entrada = Record<Campo, unknown>
type Resultado = { ok: true; metadados: MetadadosGrupo } | { ok: false; campo: Campo; motivo: 'obrigatorio' | 'limite' | 'controle' }

export function validarMetadadosGrupo(entrada: Entrada): Resultado {
  const metadados: MetadadosGrupo = { descricao: '', origem: '', criterios: null }
  for (const campo of ['descricao', 'origem', 'criterios'] as const) {
    const valor = entrada[campo]
    if (campo === 'criterios' && valor === null) continue
    if (typeof valor !== 'string') return { ok: false, campo, motivo: 'obrigatorio' }
    const texto = valor.replace(/\r\n?/g, '\n').replace(/^[ \n]+|[ \n]+$/g, '')
    if (/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/u.test(texto)) return { ok: false, campo, motivo: 'controle' }
    if (!texto) {
      if (campo === 'criterios') continue
      return { ok: false, campo, motivo: 'obrigatorio' }
    }
    if (Array.from(texto).length > (campo === 'criterios' ? 2000 : 500)) return { ok: false, campo, motivo: 'limite' }
    metadados[campo] = texto
  }
  return { ok: true, metadados }
}
