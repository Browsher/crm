const banco = new URL(process.env.DATABASE_URL || 'postgres://invalido/invalido')
if (process.env.CRM_E2E !== '1' || process.env.CRM_E2E_ASSISTENTE !== '1' || process.env.ALVO ||
    banco.username !== 'app_teste' || !['localhost', '127.0.0.1', '[::1]'].includes(banco.hostname) ||
    !/^\/teste_[0-9a-f]{12}$/.test(banco.pathname) || banco.search ||
    process.env.ANTHROPIC_API_KEY !== 'chave-apenas-e2e') {
  throw new Error('Ambiente de simulação Claude inválido')
}

const original = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.hostname !== 'api.anthropic.com') return original(input, init)
  if (url.href !== 'https://api.anthropic.com/v1/messages' || init?.method !== 'POST') {
    throw new Error('Rota Claude fora da simulação')
  }
  const corpo = JSON.parse(init.body)
  const pedido = JSON.parse(corpo.messages[0].content)
  if (pedido.produto.sku === 'QS-T-001' && pedido.especialidade === 'Games' && pedido.regioes[0]?.estado === 'SP') {
    const perfil = pedido.perfis.find(p => /games/i.test(p.rotulo)) ?? pedido.perfis.find(p => p.id === 'lojas')
    if (perfil) return responder({ perfil: perfil.id, titulo: perfil.rotulo, descricao: 'Revenda de eletrônicos para jogos.', nicho: 'Comércio de games e acessórios', termos: 'projeção, jogos eletrônicos' })
  }
  if (pedido.produto.sku === 'IC-8177' && pedido.regioes.length === 2) {
    const perfil = pedido.perfis.find(p => p.id === 'lojas' && p.cnaes.some(c => c.codigo === '4759899'))
    if (perfil) return responder({
      perfil: perfil.id, titulo: perfil.titulo, descricao: 'Revenda de câmeras para segurança residencial.', cnaes: ['4759899'],
      perfilEmpresa: {
        portes: { valor: ['ME', 'EPP'], motivo: 'Recorte para lojas pequenas de segurança.' },
        mei: { valor: 'excluir', motivo: 'Segmentação para esta campanha de revenda.' },
        regime: { valor: 'simples', motivo: 'Recorte cadastral opcional para este público.' },
        estabelecimento: { valor: 'matriz', motivo: 'Buscar o estabelecimento principal.' },
        aberturaUltimosDias: { valor: 365, motivo: 'Opção para prospectar empresas recentes.' },
        contato: { valor: 'celular', motivo: 'Facilita o primeiro contato por telefone móvel.' },
      },
    })
  }
  if (pedido.produto.sku === 'QS-023' && pedido.perfis.length === 1) {
    const [perfil] = pedido.perfis
    if (perfil.id === 'atacado_racao' && perfil.cnaes[0]?.codigo === '4623109') return responder({
      perfil: perfil.id, titulo: perfil.titulo, descricao: 'Distribuição de ração com linha de acessórios pet.', cnaes: ['4623109'],
    })
  }
  if (pedido.produto.sku === 'QS-026') {
    return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{resposta inválida' }] })
  }
  return Response.json({ erro: 'Dados da chamada não correspondem às expectativas do teste.' }, { status: 422 })
}

function responder(sugestao) {
  return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ sugestoes: [sugestao] }) }] })
}
