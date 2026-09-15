export function ResumoVenda({ venda }: {venda:{centavos:string;data:string}}) {
  const valor=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(venda.centavos)/100)
  return <p><strong>{valor}</strong> · Data da venda: {venda.data.split('-').reverse().join('/')}</p>
}
