const params = new URLSearchParams(location.search)
document.documentElement.dataset.theme = params.get('theme') === 'light' ? 'light' : 'dark'
document.documentElement.dataset.panelSize=params.get('panel-size')==='amplo'?'amplo':'base'
document.documentElement.dataset.mobilePanel=params.get('mobile-panel')==='contexto'?'contexto':'inteiro'
const area = params.get('area') || 'dia'
const layoutVariant = params.get('layout') || 'menu'
const actionPlacement = params.get('actions') || 'rodape'
const companyGrouping = params.get('company') || 'tres'
const dailyLayout = params.get('daily') || 'direto'
const bankLayout = params.get('bank') || 'original'
const criteriaLayout = params.get('criteria') || 'tres'
const mirrorLayout = params.get('mirror') || 'direto'
const walletLayout = params.get('wallet') || 'lateral'
const adminLayout = params.get('admin') || 'menu'
const profileLayout = params.get('profile') || 'original'
const profileVolume = params.get('profile-volume') === '1000' ? 1000 : 3
const stateStudy = params.get('state-study') === '1'
const studySale = Object.freeze({empresa:'Horizonte Segurança Eletrônica',valor:'R$ 1.250,00',data:'06/11/2026'})
const confirmationLayout = params.get('confirmation-layout') || 'original'
const confirmationDemo = params.get('confirmation-demo') === '1'
const mediaLayout = params.get('media') || 'integrada'
const mediaLongCaption = params.get('media-caption') === 'longa'
if(params.has('actions'))document.body.classList.add('button-study')
const $ = selector => document.querySelector(selector)
const panelElement = $('#panel')
const dialog = $('#confirmation')
const names = {usuarios:'Usuários',banco:'Banco de empresas',dia:'Meu dia',funil:'Funil',prospeccao:'Prospecção',carteira:'Carteira',gestor:'Empresas',whatsapp:'WhatsApp',historicos:'Históricos',confirmacoes:'Funil',estados:'Meu dia'}
const company = 'Horizonte Segurança Eletrônica'
const savedSearches=[
 {name:'Segurança eletrônica · Mooca',date:'05/11/2026',count:14,region:'Mooca · São Paulo/SP',activity:'Segurança eletrônica',companies:[company,'Casa Ipê Materiais Elétricos','Estúdio Cedro Instalações']},
 {name:'Materiais elétricos · Santo André',date:'04/11/2026',count:11,region:'Santo André/SP',activity:'Materiais elétricos',companies:['Casa Ipê Materiais Elétricos','Armazém Aurora']},
 {name:'Instalações · Região Leste',date:'03/11/2026',count:0,region:'Região Leste · São Paulo/SP',activity:'Instalações',companies:[]}
]

const state = {panel:null,tab:'passo',stack:[],dirty:false,historyFilter:'todos',queryId:0,profileOpen:true,profileCompanyPage:1,profileTab:'empresas',profileFilter:'todos',adminIndex:0,adminSection:'menu',clientSection:'menu',walletPageOpen:params.get('wallet-open')==='1',walletPageTab:'atendimento',bankCompanyName:company,bankSection:'menu',bankPage:params.get('bank-tab')||'buscar',returnSection:'menu',companySection:'menu',structureEditing:false,structureMenu:'inicio',drafts:{},readState:params.get('state')||'normal'}
let confirmAction = null
let bankReturnFocus = null
let criteriaBaseline = {}
const mirrorInitial = {origem:'2026-11-04',campos:['nicho'],semana:'exibida',dias:[]}
let mirrorDraft = structuredClone(mirrorInitial)
let mirrorError = ''
let mirrorSent = false
let walletReturnFocus = null
let walletPageHistoryFilter = null
let adminReturnFocus = null
let adminSecretVisible = false
let profileReturnFocus = null
let mediaReturnFocus = null
let mediaExpanded = false
let mediaReadScroll = 0
const demoUsers = [
 {nome:'Pessoa de exemplo',email:'vendedor@empresa.example',papel:'vendedor',ativo:true,pendente:false},
 {nome:'Pessoa inativa',email:'inativo@empresa.example',papel:'vendedor',ativo:false,pendente:false},
 {nome:'Outro gestor',email:'gestor@empresa.example',papel:'gestor',ativo:true,pendente:false},
 {nome:'Gestor da sessão',email:'sessao@empresa.example',papel:'gestor',ativo:true,pendente:false,mine:true}
]
const walletFilters = {nome:'',uf:'',retorno:''}
const profileExpanded = new Set()
const profileCompanies = [
 {nome:'Horizonte Segurança Eletrônica',retorno:'06/11/2026',passo:'Apresentar as opções de câmeras'},
 {nome:'Casa Ipê Materiais Elétricos',retorno:'05/11/2026',passo:'Retomar a conversa com a compradora'},
 {nome:'Estúdio Cedro Instalações',retorno:'Sem retorno agendado',passo:'Não registrado'}
]
const profileCompanyRows = profileVolume===1000?Array.from({length:1000},(_,index)=>profileCompanies[index]||{nome:'Empresa de exemplo '+String(index+1).padStart(4,'0'),retorno:'Sem retorno agendado',passo:'Não registrado'}):profileCompanies
const profileActivity = [
 {id:0,empresa:'Horizonte Segurança Eletrônica',titulo:'Falei, e ficou combinado o próximo passo',tipo:'Atendimento',quando:'06/11/2026, 10:20',nota:'Pediu opções de câmeras para a loja.',passo:'Enviar as opções combinadas',retorno:'09/11/2026'},
 {id:1,empresa:'Casa Ipê Materiais Elétricos',titulo:'Liguei, não falei com ninguém',tipo:'Atendimento',quando:'06/11/2026, 09:10',nota:'Sem anotação.',passo:null,retorno:null},
 {id:2,empresa:'Armazém Aurora',titulo:'Atividade sem ligação',resultado:'Não liguei',tipo:'Atividade',quando:'05/11/2026, 16:40',nota:'Organizou as informações para a próxima tentativa.',passo:'Ligar para a pessoa responsável',retorno:'Data não informada'}
]
const expandedBankSearches = new Set()
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const btn = (label,action,style='outline') => '<button type="button" class="'+style+'" data-action="'+action+'">'+label+'</button>'
const field = (label,name,placeholder='',type='text',value='',required=false) => '<label class="field">'+label+'<input name="'+name+'" type="'+type+'" placeholder="'+placeholder+'" value="'+esc(value)+'" '+(required?'required':'')+'></label>'
const text = (label,name,placeholder='') => '<label class="field">'+label+'<textarea name="'+name+'" placeholder="'+placeholder+'"></textarea></label>'
const select = (label,name,options) => '<label class="field">'+label+'<select name="'+name+'">'+options.map(o=>'<option>'+o+'</option>').join('')+'</select></label>'
const checks = (label,name,values) => '<section class="section"><h2>'+label+'</h2><div class="check-grid">'+values.map(v=>'<label class="check"><input type="checkbox" name="'+name+'" value="'+esc(v)+'">'+v+'</label>').join('')+'</div></section>'
const section = (title,body) => '<section class="section"><h2>'+title+'</h2>'+body+'</section>'
const facts = rows => '<dl>'+rows.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>'
const footer = (left,right,note='') => (note?'<small>'+note+'</small>':'')+'<div class="button-row">'+left+(right||'')+'</div>'
const form = body => '<form id="edit-form" autocomplete="off">'+body+'</form>'
function toast(message){const el=$('#toast');el.textContent=message;el.hidden=false;setTimeout(()=>{el.hidden=true},4500)}
function capture(){
  if(!state.panel||mirrorStructureActive())return
  const key=state.panel+':'+state.tab
  state.drafts[key]=Array.from($('#panel-body').querySelectorAll('input[name],select[name],textarea[name]')).map(el=>({name:el.name,value:el.value,checked:el.checked,type:el.type}))
}
function restore(){
  if(mirrorStructureActive())return
  for(const d of state.drafts[state.panel+':'+state.tab]||[]){
    const candidates=Array.from($('#panel-body').querySelectorAll('[name]')).filter(el=>el.name===d.name)
    const el=candidates.find(el=>el.type!=='checkbox'&&el.type!=='radio'||el.value===d.value)
    if(el){if(el.type==='checkbox'||el.type==='radio')el.checked=d.checked;else el.value=d.value}
  }
}
function changePanel(id,nested=true){
  const next=()=>{
    capture()
    if(nested&&state.panel)state.stack.push({panel:state.panel,tab:state.tab,dirty:state.dirty,historyFilter:state.historyFilter,queryId:state.queryId,adminIndex:state.adminIndex,adminSection:state.adminSection,clientSection:state.clientSection,bankCompanyName:state.bankCompanyName,bankSection:state.bankSection,bankPage:state.bankPage,companySection:state.companySection,returnSection:state.returnSection,structureMenu:state.structureMenu,structureEditing:state.structureEditing})
    if(!nested)state.stack=[]
    if(id==='resultadoBusca')state.bankSection='menu'
    if(id==='retorno')state.returnSection='menu'
    if(id==='empresa')state.companySection='menu'
    if(id==='cliente')state.clientSection='menu'
    if(id==='adminAccess')state.adminSection='menu'
    if(id==='midia'){mediaExpanded=false;mediaReadScroll=0}
    if(id==='negociacao'){state.structureMenu='inicio';state.structureEditing=false}
    if(id==='espelho'){mirrorDraft=structuredClone(mirrorInitial);mirrorError='';mirrorSent=false}
    state.panel=id;state.tab='passo';state.dirty=false;state.historyFilter='todos';state.readState='normal';render()
  }
  if(state.dirty)ask('descarte',next);else next()
}
function closePanel(){
  const discardCriteria=criteriaStructureActive()&&state.dirty
  const discardMirror=mirrorStructureActive()&&state.dirty
  const next=()=>{
    if(state.panel==='adminCredencial')adminSecretVisible=false
    if(state.panel==='midia')mediaExpanded=false
    if(discardMirror){mirrorDraft=structuredClone(mirrorInitial);mirrorError=''}
    if(discardCriteria){
      for(const key of Object.keys(state.drafts))if(key.startsWith('criterios:'))delete state.drafts[key]
      Object.assign(state.drafts,structuredClone(criteriaBaseline))
    }
    state.dirty=false
    if(state.stack.length){Object.assign(state,state.stack.pop())}else state.panel=null
    state.readState='normal';render()
    if(!state.panel&&bankReturnFocus?.isConnected)bankReturnFocus.focus({preventScroll:true})
    if(!state.panel&&walletPageHistoryFilter!==null){state.historyFilter=walletPageHistoryFilter;walletPageHistoryFilter=null}
    if(!state.panel&&walletReturnFocus?.isConnected)walletReturnFocus.focus({preventScroll:true})
    if(!state.panel&&adminReturnFocus?.isConnected)adminReturnFocus.focus({preventScroll:true})
    if(!state.panel&&profileReturnFocus?.isConnected)profileReturnFocus.focus({preventScroll:true})
    if(!state.panel&&mediaReturnFocus?.isConnected)mediaReturnFocus.focus({preventScroll:true})
  }
  if(state.dirty)ask('descarte',next);else next()
}
function back(){
  if(state.panel==='midia'&&mediaExpanded){
    mediaExpanded=false;render();$('#panel-body').scrollLeft=0;$('#panel-body').scrollTop=mediaReadScroll
    $('#panel-footer [data-action="ampliarMidia"]')?.focus({preventScroll:true});return
  }
  if(state.panel==='adminAccess'&&state.adminSection!=='menu'){state.adminSection='menu';render();return}
  if(state.panel==='cliente'&&state.clientSection!=='menu'){state.clientSection='menu';render();return}
  if(mirrorStructureActive()&&state.tab!=='passo'){state.tab='passo';render();return}
  if(bankStructureActive()&&state.bankSection!=='menu'){state.bankSection='menu';render();return}
  if(dailyStructureActive()&&state.returnSection!=='menu'){state.returnSection='menu';render();return}
  if(companyStructureActive()&&state.companySection!=='menu'){state.companySection='menu';render();return}
  if(structuredNegotiationActive()){structureBack();return}
  if(state.panel==='criterios'&&state.tab!=='passo'){capture();state.tab='passo';render();return}
  if(state.tab!=='passo'&&specForPanel().tabs){
    const go=()=>{capture();state.tab='passo';state.dirty=false;render()}
    if(state.dirty)ask('descarte',go);else go()
  }else closePanel()
}
function historyContent(scope='comercial'){
  const own=scope==='negociacao'
  const events=[
    {type:'Atendimento',title:'Falei, tem interesse',when:'05/11/2026, 09:40',author:own?'Você':'Vendedor de exemplo',note:'Cliente pediu uma proposta com opções de câmeras para a loja.',outcome:'Falei, tem interesse',next:'Apresentar as opções de câmeras',date:'06/11/2026'},
    {type:'Atendimento',title:'Falei, pediu para ligar em outro momento',when:'03/11/2026, 14:20',author:own?'Você':'Vendedor de exemplo',note:'Sem anotação.',outcome:'Falei, pediu para ligar em outro momento',next:'Ligar para a pessoa responsável',date:'05/11/2026'}
  ]
  if(scope==='comercial')events.unshift({type:'Venda',title:'Venda registrada',when:'05/11/2026, 11:15',author:'Vendedor de exemplo',note:'Conjunto de câmeras e fonte de alimentação.',sale:'R$ 1.250,00',saleDate:'04/11/2026'})
  const visible=events.filter(e=>state.historyFilter==='todos'||e.type===(state.historyFilter==='vendas'?'Venda':'Atendimento'))
  const controls='<div class="history-tools" role="group" aria-label="Filtrar eventos">'+[['todos','Todos',events.length],['atendimentos','Atendimentos',2],['vendas','Vendas',scope==='comercial'?1:0]].map(([id,label,count])=>'<button type="button" data-filter="'+id+'" aria-pressed="'+(state.historyFilter===id)+'">'+label+' '+count+'</button>').join('')+'</div><div class="history-help"><span>Horários de Brasília</span>'+btn('Expandir todos','expandir','ghost')+'</div>'
  return controls+(visible.length?'<div class="timeline">'+visible.map(e=>'<details><summary><div><strong>'+e.title+'</strong><span class="type">'+e.type+'</span></div><small>'+e.when+' · Por '+e.author+'</small></summary><div class="event-detail"><p>'+e.note+'</p>'+facts(e.sale?[['Valor',e.sale],['Data efetiva da venda',e.saleDate]]:[['Resultado do atendimento',e.outcome],['Próximo passo registrado',e.next],['Data do retorno registrado',e.date]])+'</div></details>').join('')+'</div>':'<div class="empty">Nenhum registro neste filtro.</div>')+'<p class="hint">'+visible.length+' registros · Abra um evento para ver os detalhes.</p>'
}
function companySections(){
 if(area==='banco'&&bankLayout==='pagina'&&state.bankCompanyName!==company){
  const unknown='Não informado nesta prévia'
  return {
   contatos:section('Contatos',facts([['Telefone principal',unknown],['Telefones na origem',unknown],['E-mail',unknown]])),
   cadastro:section('Cadastro',facts([['Razão social',unknown],['Nome fantasia',esc(state.bankCompanyName)],['CNPJ',unknown],['Situação cadastral',unknown],['Porte',unknown],['Data de abertura',unknown],['Natureza jurídica',unknown],['Capital social',unknown]])),
   endereco:section('Endereço',facts([['Logradouro',unknown],['Número e complemento',unknown],['Bairro',unknown],['Cidade / UF',unknown],['CEP',unknown]])),
   atividades:section('Atividades e tributação',facts([['CNAE principal',unknown],['Atividade',unknown],['Atividades secundárias',unknown],['Regime tributário',unknown]])),
   socios:section('Sócios e administradores',facts([['Nome e função',unknown]])),
   origem:section('Origem',facts([['Encontrada em','Banco de empresas'],['Recebida em',savedSearches[state.queryId].date]]))
  }
 }
 return {
  contatos:section('Contatos',facts([...(walletActive()?[['Contato principal','Contato principal não informado']]:[]),['Telefone principal','(11) 0000-0000'],['Telefones na origem','Não informado'],['E-mail','comercial@horizonte.example']])),
  cadastro:section('Cadastro',facts([['Razão social','Horizonte Segurança Eletrônica Ltda.'],['Nome fantasia',company],['CNPJ','00.000.000/0000-00 · ilustrativo'],['Situação cadastral','Ativa'],['Porte','Pequena empresa'],['Data de abertura','Não informada'],['Natureza jurídica','Sociedade empresária limitada'],['Capital social','Não informado']])),
  endereco:section('Endereço',facts([['Logradouro','Rua de Exemplo'],['Número e complemento','100 · Loja'],['Bairro','Mooca'],['Cidade / UF','São Paulo / SP'],['CEP','Não informado']])),
  atividades:section('Atividades e tributação',facts([['CNAE principal','Não informado nesta demonstração'],['Atividade','Comércio de equipamentos de segurança'],['Atividades secundárias','Não informadas'],['Regime tributário','Não informado']])),
  socios:section('Sócios e administradores',facts([['Nome e função','Não informado']])),
  origem:section('Origem',facts([['Encontrada em','Banco de empresas'],['Recebida em','05/11/2026']]))
 }
}
function companyContent(){
 return Object.values(companySections()).join('')
}


function companyStructureActive(){
 return state.panel==='empresa'&&['tres','quatro'].includes(companyGrouping)
}
function companyGroups(){
 const groups=[
  {id:'cadastro',name:'Cadastro e origem',hint:'CNPJ, razão social, porte e origem dos dados',parts:['cadastro','origem']},
  {id:'atividade',name:'Atividades e sócios',hint:'CNAE, atividade, regime tributário e responsáveis',parts:['atividades','socios']}
 ]
 if(companyGrouping==='tres')return [
  {id:'contato',name:'Contato e localização',hint:'Telefones, e-mail e endereço completo',parts:['contatos','endereco']},
  ...groups
 ]
 return [
  {id:'contatos',name:'Contatos',hint:'Telefone principal, telefones na origem e e-mail',parts:['contatos']},
  groups[0],
  {id:'endereco',name:'Endereço',hint:'Logradouro, bairro, cidade e CEP',parts:['endereco']},
  groups[1]
 ]
}
function companyStructureSpec(){
 const groups=companyGroups()
 const selected=groups.find(group=>group.id===state.companySection)
 const sections=companySections()
 const body=selected
  ? selected.parts.map(key=>sections[key]).join('')
  : '<nav class="structure-menu" aria-label="Seções dos dados da empresa">'+groups.map(group=>
   '<button type="button" class="structure-menu-entry" data-company-section="'+group.id+'"><span><strong>'+group.name+'</strong><small>'+group.hint+'</small></span><span aria-hidden="true">›</span></button>'
  ).join('')+'</nav>'
 return {context:'Dados da empresa',title:area==='banco'&&bankLayout==='pagina'?state.bankCompanyName:company,description:selected?selected.name:'Consulta dos dados salvos',internal:!!selected,body,
  foot:area==='dia'?footer(btn('Negociação','negociacao'),null,'Acesso comercial'):''}
}

function contactForm(){
 return form(section('Resultado do contato',select('O que aconteceu?','resultado',['Selecione o resultado','Não atendeu','Falei, tem interesse','Falei, pediu para ligar em outro momento','Falei, sem interesse']))+
 section('Anotação',text('O que foi conversado','anotacao','Ex.: pediu orçamento de quatro câmeras para a loja.'))+
 section('Próximo passo',field('O que fazer depois','proximoPasso','Ex.: enviar a proposta revisada.')+field('Data do retorno (opcional)','retorno','','date')))+
 '<p class="hint">Registre o próximo passo para organizar a próxima tentativa.</p>'
}
function criteriaSections(){
 return {
 procurar:section('O que procurar',text('Termos adicionais','termos','Ex.: segurança eletrônica, instalação de câmeras.')+text('Produtos de interesse','produtos','Ex.: câmeras, alarmes e interfones.'))+checks('Tipo de negócio','tipos',['Varejista','Atacadista','Distribuidor','Fabricante'])+section('Forma de atendimento',select('Atendimento','atendimento',['Qualquer','Priorizar loja física','Somente loja física','Somente online','Loja física e online'])),
 evitar:section('O que evitar',text('Negócios e termos a evitar','excluir','Ex.: lojas de usados.')+select('Situação no Google','situacao',['Qualquer situação','Priorizar em funcionamento','Somente em funcionamento','Excluir encerradas permanentemente','Excluir fechadas temporária ou permanentemente'])),
 contatos:checks('Site próprio','site',['Com site','Sem site'])+checks('E-mail comercial publicado','email',['Com e-mail','Sem e-mail'])+checks('Tipo de contato','telefone',['WhatsApp','Telefone fixo'])+section('Reputação no Google',field('Nota mínima','nota','0 a 5','number')+field('Mínimo de avaliações','avaliacoes','','number')),
 orientacoes:section('Orientações',text('O que priorizar','prioridades','Ex.: lojas que atendem instaladores de câmeras.')+text('Outras orientações','observacoes','Ex.: verificar se oferece orçamento para condomínios.'))
 }
}
function criteriaContent(parts){
 const content=criteriaSections()
 return form(parts?parts.map(id=>content[id]).join(''):content[state.tab==='passo'?'procurar':state.tab]||content.procurar)
}
function criteriaStructureActive(){
 return state.panel==='criterios'&&['tres','dois'].includes(criteriaLayout)
}
function criteriaGroups(){
 const contacts={id:'contatos',title:'Contatos e presença digital',hint:'Site, e-mail, telefone e reputação no Google',parts:['contatos']}
 if(criteriaLayout==='dois')return [
  {id:'perfil',title:'Perfil e preferências',hint:'Empresas, produtos, prioridades e restrições',parts:['procurar','evitar','orientacoes']},
  contacts
 ]
 return [
  {id:'perfil',title:'Empresas e produtos',hint:'Termos, produtos, tipo de negócio e atendimento',parts:['procurar']},
  contacts,
  {id:'preferencias',title:'Preferências e restrições',hint:'O que priorizar, evitar e outras orientações',parts:['evitar','orientacoes']}
 ]
}
function criteriaStructureSpec(){
 const groups=criteriaGroups()
 const selected=groups.find(group=>group.id===state.tab)
 return {context:'Google · Planejamento de 06/11/2026',title:'Critérios de busca',
  description:selected?selected.title:'Todos os critérios são opcionais.',internal:!!selected,
  body:selected?criteriaContent(selected.parts):'<nav class="structure-menu" aria-label="Seções dos critérios de busca">'+groups.map(group=>
   '<button type="button" class="structure-menu-entry" data-criteria-section="'+group.id+'"><span><strong>'+group.title+'</strong><small>'+group.hint+'</small></span><span aria-hidden="true">›</span></button>'
  ).join('')+'</nav>',
  foot:footer(btn('Cancelar','cancelar'),btn('Aplicar critérios','aplicarCriterios',''),'Depois de aplicar, salve o planejamento para confirmar o dia.')}
}
function mirrorStructureActive(){
 return state.panel==='espelho'&&['direto','menu'].includes(mirrorLayout)
}
function mirrorDays(){
 const start=mirrorDraft.semana==='exibida'?2:9
 return Array.from({length:7},(_,i)=>{
  const date=new Date(Date.UTC(2026,10,start+i)),iso=date.toISOString().slice(0,10)
  return {iso,label:new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(date),disabled:iso<='2026-11-06'||iso===mirrorDraft.origem}
 })
}
function mirrorSections(){
 const origin=section('Origem',select('Semana de origem','semanaOrigem',['Semana de 02/11/2026'])+
  '<label class="field">Dia de origem<select name="origem">'+[['2026-11-04','04/11/2026 · Segurança eletrônica · Mooca'],['2026-11-02','02/11/2026 · Materiais elétricos · Santo André']].map(([value,label])=>'<option value="'+value+'"'+(mirrorDraft.origem===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label>')
 const fields=section('O que copiar','<div class="check-grid">'+[['nicho','Nicho'],['criterios','Critérios de busca'],['regiao','Região: bairro, cidade e UF']].map(([value,label])=>'<label class="check"><input type="checkbox" name="campos" value="'+value+'"'+(mirrorDraft.campos.includes(value)?' checked':'')+'>'+label+'</label>').join('')+'</div>')
 const destination=section('Destino','<label class="field">Semana de destino<select name="semanaDestino">'+[['exibida','Semana exibida'],['proxima','Próxima semana']].map(([value,label])=>'<option value="'+value+'"'+(mirrorDraft.semana===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label><fieldset class="mirror-days"><legend>Dias de destino</legend>'+mirrorDays().map(day=>'<label class="check"><input type="checkbox" name="dias" value="'+day.iso+'"'+(mirrorDraft.dias.includes(day.iso)?' checked':'')+(day.disabled?' disabled':'')+'>'+day.label+'</label>').join('')+'</fieldset>')+'<p class="hint">Dias passados, hoje e o próprio dia de origem não podem ser escolhidos.</p>'
 return {origin:origin+fields,destination}
}
function mirrorStructureSpec(){
 const parts=mirrorSections()
 const menu=mirrorLayout==='menu'&&state.tab==='passo'
 const body=menu?'<nav class="structure-menu" aria-label="Seções do espelhamento"><button type="button" class="structure-menu-entry" data-mirror-section="origem"><span><strong>Origem e conteúdo</strong><small>Escolher o dia salvo e os campos que serão copiados</small></span><span aria-hidden="true">›</span></button><button type="button" class="structure-menu-entry" data-mirror-section="destino"><span><strong>Dias de destino</strong><small>Escolher a semana e os dias que receberão a cópia</small></span><span aria-hidden="true">›</span></button></nav>'
  :form('<fieldset class="mirror-form"'+(mirrorSent?' disabled':'')+'>'+(mirrorLayout==='direto'?parts.origin+parts.destination:state.tab==='origem'?parts.origin:parts.destination)+'</fieldset>')
 return {context:'Google · Planejamento',title:'Espelhar planejamento',description:menu||mirrorLayout==='direto'?'Escolha um dia salvo, os campos e os dias de destino.':state.tab==='origem'?'Origem e conteúdo':'Dias de destino',internal:mirrorLayout==='menu'&&state.tab!=='passo',
  body:(mirrorSent?'<div class="strip" role="status">Simulação concluída. Nenhum planejamento foi alterado.</div>':'')+'<div id="mirror-error" class="strip danger" role="alert"'+(mirrorError?'':' hidden')+'>'+esc(mirrorError)+'</div>'+body,
  foot:'<div class="mirror-actions">'+(mirrorSent?footer(btn('Concluir','concluir',''),null):footer(btn('Cancelar','cancelar'),btn('Espelhar nos dias escolhidos','espelhar','')))+'</div>'}
}
function walletActive(){
 return area==='carteira'&&['lateral','pagina'].includes(walletLayout)
}
function walletStepContent(){
 return section('Próximo passo',facts([['O que fazer','Apresentar as opções de câmeras'],['Retorno','06/11/2026']]))+
  '<section class="structure-entry"><h2>Atendimento</h2>'+btn('Registrar atendimento','clienteAtendimento')+'</section>'
}
function walletCustomerForm(){
 const options=[['nao_liguei','Não liguei'],['nao_atendeu','Liguei, não falei com ninguém'],['retornar_depois','Falei, pediu para ligar em outro momento'],['sem_interesse','Falei, não tem interesse'],['interessado','Falei, tem interesse'],['acompanhamento','Falei, e ficou combinado o próximo passo']]
 return form(section('O que aconteceu na ligação',options.map(([value,label])=>'<label class="check wallet-contact-choice"><input type="radio" name="tipo" value="'+value+'"'+(value==='acompanhamento'?' checked':'')+'>'+label+'</label>').join(''))+
  section('Nota',text('Nota','notaCliente'))+section('Próximo passo',field('Próximo passo','proximoPasso')+field('Data do próximo passo','proximoPassoData','','date')))
}
function walletMenu(){
 return '<nav class="structure-menu" aria-label="Seções do cliente">'+[
  ['atendimento','Atendimento e próximo passo','Consultar o combinado e registrar um contato'],
  ['dados','Dados da empresa','Contato e localização, cadastro, atividades e sócios'],
  ['historico','Histórico','Consultar atendimentos e vendas disponíveis']
 ].map(([id,title,hint])=>'<button type="button" class="structure-menu-entry" data-client-section="'+id+'"><span><strong>'+title+'</strong><small>'+hint+'</small></span><span aria-hidden="true">›</span></button>').join('')+'</nav>'
}
function walletClientSpec(){
 return {context:'Carteira · Cliente',title:company,description:state.clientSection==='menu'?'Na sua carteira':state.clientSection==='atendimento'?'Atendimento e próximo passo':'Histórico',internal:state.clientSection!=='menu',
  body:state.clientSection==='menu'?walletMenu():state.clientSection==='historico'?historyContent():walletStepContent(),
  foot:footer(btn('Registrar venda','venda',''),null)}
}
function walletDataContent(){
 const parts=companySections()
 return companyGroups().map(group=>'<section class="wallet-data-group"><h2>'+group.name+'</h2>'+group.parts.map(id=>parts[id]).join('')+'</section>').join('')
}
function walletPageMarkup(){
 if(!state.walletPageOpen)return '<h1>Minha carteira</h1><p class="intro">Clientes que estão sob seus cuidados.</p>'+
  '<section class="background-card wallet-filters"><h2>Localizar cliente</h2>'+field('Nome da empresa','walletNome','','text',walletFilters.nome)+select('UF','walletUf',['Qualquer UF','SP'])+select('Retorno','walletRetorno',['Qualquer retorno','Hoje','Atrasado','Próximo','Sem agendamento'])+'</section>'+
  '<section class="background-card" aria-label="Cliente da carteira"><h2>'+company+'</h2><p>Mooca · São Paulo/SP</p><p>Contato principal não informado</p><dl>'+[['Última atividade','Venda registrada em 05/11/2026'],['Próximo passo','Apresentar as opções de câmeras'],['Retorno','06/11/2026']].map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl><div class="wallet-open-row"><button class="outline" type="button" data-client-open>Ver cliente</button></div></section>'
 const tabs='<div class="wallet-page-tabs" role="tablist" aria-label="Seções da ficha do cliente">'+[['atendimento','Atendimento'],['dados','Dados da empresa'],['historico','Histórico']].map(([id,label])=>'<button class="outline" type="button" role="tab" id="wallet-tab-'+id+'" data-wallet-tab="'+id+'" aria-controls="wallet-page-content" aria-selected="'+(state.walletPageTab===id)+'" tabindex="'+(state.walletPageTab===id?'0':'-1')+'">'+label+'</button>').join('')+'</div>'
 return '<button class="outline" type="button" data-client-list>Voltar para a carteira</button><header class="wallet-page-header"><div><p class="intro">Na sua carteira</p><h1>'+company+'</h1><p>Mooca · São Paulo/SP</p></div></header>'+tabs+
  '<section id="wallet-page-content" role="tabpanel" aria-labelledby="wallet-tab-'+state.walletPageTab+'">'+(state.walletPageTab==='historico'?historyContent():state.walletPageTab==='dados'?walletDataContent():walletStepContent())+'</section><footer class="wallet-page-actions">'+btn('Registrar venda','venda','')+'</footer>'
}
function renderWalletPage(){
 $('#background').innerHTML=walletPageMarkup()
 const uf=$('[name=walletUf]'),retorno=$('[name=walletRetorno]')
 if(uf)uf.value=walletFilters.uf||'Qualquer UF'
 if(retorno)retorno.value=walletFilters.retorno||'Qualquer retorno'
}
function adminActive(){
 return area==='usuarios'&&['menu','painel'].includes(adminLayout)
}
function adminActions(user){
 if(user.mine)return []
 if(!user.ativo)return ['reativar']
 return ['nova_senha','mudar_papel','desativar']
}
function adminLabel(action,user){
 return action==='nova_senha'?'Nova senha provisória':action==='mudar_papel'?user.papel==='gestor'?'Tornar vendedor':'Tornar gestor':action==='desativar'?'Desativar':'Reativar'
}
function adminButton(action,index){
 return '<button type="button" class="outline" data-admin-action="'+action+'" data-admin-user="'+index+'">'+adminLabel(action,demoUsers[index])+'</button>'
}
function adminPageMarkup(){
 return '<div class="admin-page-heading"><div><h1>Usuários</h1><p class="intro">Gerencie os acessos da sua equipe.</p></div>'+btn('Novo usuário','usuario','')+'</div>'+
  demoUsers.map((user,index)=>{
   const profile=user.ativo&&user.papel==='vendedor'?'<button type="button" class="outline" data-admin-profile="'+index+'">Ver perfil</button>':''
   const actions=adminActions(user)
   const access=adminLayout==='painel'?'<button type="button" class="outline" data-admin-open="'+index+'">Gerenciar acesso</button>':actions.length?'<details class="admin-row-actions"><summary>Ações</summary><div class="admin-action-menu">'+profile+actions.map(action=>adminButton(action,index)).join('')+'</div></details>':'<span class="hint">Sua conta</span>'
   return '<article class="background-card admin-user-row" aria-label="'+user.nome+'"><div><h2>'+user.nome+'</h2><p>'+user.email+'</p><div class="admin-user-meta"><span class="badge">'+(user.papel==='gestor'?'Gestor':'Vendedor')+'</span><span>'+(user.ativo?'Ativo':'Inativo')+'</span><span>Senha '+(user.pendente?'com troca pendente':'definida')+'</span>'+(user.mine?'<span>Você</span>':'')+'</div></div>'+access+'</article>'
  }).join('')
}
function adminAccessSpec(){
 const user=demoUsers[state.adminIndex],actions=adminActions(user)
 const profile=user.ativo&&user.papel==='vendedor'?'<button type="button" class="outline" data-admin-profile="'+state.adminIndex+'">Ver perfil</button>':''
 let body='',foot='',internal=false
 if(!actions.length)body=section('Sua conta','<p>As alterações administrativas da própria conta não estão disponíveis.</p>')
 else if(!user.ativo){body=section('Situação',facts([['Papel',user.papel==='gestor'?'Gestor':'Vendedor'],['Acesso','Inativo']]));foot=footer(adminButton('reativar',state.adminIndex),null)}
 else if(state.adminSection==='senha'){internal=true;body=section('Senha de acesso',facts([['Situação',user.pendente?'Troca pendente':'Definida']]))+'<p class="hint">Gerar uma nova senha invalida a anterior e as sessões desta pessoa.</p>';foot=footer(adminButton('nova_senha',state.adminIndex),null)}
 else if(state.adminSection==='acesso'){internal=true;body=section('Papel e situação',facts([['Papel',user.papel==='gestor'?'Gestor':'Vendedor'],['Acesso','Ativo']]));foot=footer(adminButton('mudar_papel',state.adminIndex),adminButton('desativar',state.adminIndex))}
 else{body='<nav class="structure-menu" aria-label="Seções do acesso"><button type="button" class="structure-menu-entry" data-admin-section="senha"><span><strong>Senha de acesso</strong><small>'+(user.pendente?'Troca pendente':'Definida')+'</small></span><span aria-hidden="true">›</span></button><button type="button" class="structure-menu-entry" data-admin-section="acesso"><span><strong>Papel e situação</strong><small>'+(user.papel==='gestor'?'Gestor':'Vendedor')+' · Ativo</small></span><span aria-hidden="true">›</span></button></nav>';foot=profile?footer(profile,null):''}
 return {context:'Gestor · Gerenciar acesso',title:user.nome,description:user.email,internal,body,foot}
}
function adminConfirm(action,index,control){
 state.adminIndex=index
 const user=demoUsers[index]
 if(!adminActions(user).includes(action))return
 const disclosure=control.closest('details')
 adminReturnFocus=disclosure?.querySelector('summary')||control
 if(disclosure)disclosure.open=false
 const type=action==='nova_senha'?'novaSenha':action==='mudar_papel'?user.papel==='gestor'?'tornarVendedor':'papel':action==='desativar'?'desativarUsuario':'reativarUsuario'
 ask(type,()=>{
  if(action==='nova_senha'){adminSecretVisible=true;changePanel('adminCredencial')}
  else toast('Simulação concluída. Nenhum acesso foi alterado.')
 })
 $('#confirm-title').textContent=adminLabel(action,user)+': '+user.nome
 $('#confirm-text').textContent=action==='nova_senha'?'A senha anterior e as sessões desta pessoa serão invalidadas. Entregue a nova senha após confirmar.':action==='mudar_papel'?user.papel==='gestor'?'Esta pessoa perderá o acesso à administração.':'Esta pessoa poderá administrar usuários e empresas.':action==='desativar'?'Esta pessoa perderá o acesso ao CRM. Você poderá reativá-la depois.':'Esta pessoa poderá voltar a acessar o CRM.'
 $('#confirm-detail').innerHTML=facts([['Usuário',user.nome],['E-mail',user.email]])
}
function profileActive(){
 return area==='usuarios'&&['abas','blocos','lateral'].includes(profileLayout)
}
function profileCompanyPagination(){
 const total=profileCompanyRows.length,pages=Math.ceil(total/50),page=state.profileCompanyPage
 return '<nav class="profile-pagination" aria-label="Páginas das empresas"><p data-profile-page-label tabindex="-1" role="status">'+((page-1)*50+1).toLocaleString('pt-BR')+'–'+Math.min(page*50,total).toLocaleString('pt-BR')+' de '+total.toLocaleString('pt-BR')+' empresas · Página '+page+' de '+pages+'</p><div class="button-row"><button type="button" class="outline" data-profile-page="'+(page-1)+'"'+(page===1?' disabled':'')+'>Anterior</button><button type="button" class="outline" data-profile-page="'+(page+1)+'"'+(page===pages?' disabled':'')+'>Próxima</button></div></nav>'
}
function profileCompaniesContent(inPanel=false){
 const rows=profileCompanyRows.slice((state.profileCompanyPage-1)*50,state.profileCompanyPage*50)
 return '<section class="'+(inPanel?'profile-panel-section':'profile-section')+'" aria-label="Empresas do vendedor">'+(inPanel?'':'<h2>Empresas do vendedor</h2><p class="hint">Empresas vinculadas a Pessoa de exemplo.</p>')+'<div class="profile-company-list">'+rows.map((row,index)=>
  '<article class="profile-company" aria-labelledby="profile-company-'+index+'"><h3 id="profile-company-'+index+'">'+row.nome+'</h3><p>CNPJ não informado nesta prévia</p>'+facts([['Próximo retorno',row.retorno],['Próximo passo',row.passo]])+'</article>'
 ).join('')+'</div>'+(!inPanel&&profileCompanyRows.length>50?profileCompanyPagination():'')+'</section>'
}
function profileHistoryContent(inPanel=false){
 const visible=state.profileFilter==='vendas'?[]:profileActivity
 const allOpen=visible.length>0&&visible.every(event=>profileExpanded.has(event.id))
 return '<section class="'+(inPanel?'profile-panel-section':'profile-section')+'" aria-label="Últimos atendimentos">'+(inPanel?'':'<h2>Últimos atendimentos</h2>')+'<p class="hint">Até 20 registros, incluindo empresas atendidas anteriormente.</p>'+
  '<div class="history-tools" role="group" aria-label="Filtrar eventos do vendedor">'+[['todos','Todos',3],['atendimentos','Atendimentos',3],['vendas','Vendas',0]].map(([id,label,count])=>'<button type="button" data-profile-filter="'+id+'" aria-pressed="'+(state.profileFilter===id)+'">'+label+' '+count+'</button>').join('')+'</div>'+
  '<div class="history-help"><span>Horários de Brasília</span><button type="button" class="ghost" data-profile-expand'+(visible.length?'':' disabled')+'>'+(allOpen?'Recolher todos':'Expandir todos')+'</button></div>'+
  (visible.length?'<div class="timeline">'+visible.map(event=>'<details data-profile-event="'+event.id+'"'+(profileExpanded.has(event.id)?' open':'')+'><summary><span class="profile-event-company">'+event.empresa+'</span><div><strong>'+event.titulo+'</strong><span class="type">'+event.tipo+'</span></div><small>'+event.quando+' · Por Pessoa de exemplo</small></summary><div class="event-detail"><p>'+event.nota+'</p>'+facts([['Resultado do atendimento',event.resultado||event.titulo],...(event.passo?[['Próximo passo registrado',event.passo],['Data do retorno registrado',event.retorno]]:[])])+'</div></details>').join('')+'</div>':'<div class="empty">Nenhum registro neste filtro.</div>')+'</section>'
}
function profilePageMarkup(){
 if(!state.profileOpen)return adminPageMarkup()
 const metrics=[['Clientes em carteira','2'],['Retornos atrasados','1'],['Retornos hoje','1'],['Contatos registrados hoje','2']]
 const header='<button type="button" class="outline" data-profile-back>Voltar para Usuários</button><header class="profile-page-header"><div><p>Perfil do vendedor</p><h1>Pessoa de exemplo</h1><span>vendedor@empresa.example</span></div><div class="profile-header-actions"><span class="badge">Ativo</span><button type="button" class="outline" data-profile-refresh>Atualizar</button></div></header>'+
  '<section class="profile-metrics" aria-label="Resumo do vendedor">'+metrics.map(([label,value])=>'<article><h2>'+label+'</h2><strong>'+value+'</strong></article>').join('')+'</section>'
 if(profileLayout==='lateral')return header+'<nav class="profile-launchers" aria-label="Consultas do perfil"><button type="button" class="structure-menu-entry" data-profile-panel="profileCompanies"><span><strong>Empresas</strong><small>Empresas vinculadas e próximos passos</small></span><span aria-hidden="true">›</span></button><button type="button" class="structure-menu-entry" data-profile-panel="profileContacts"><span><strong>Atendimentos</strong><small>Linha do tempo do vendedor</small></span><span aria-hidden="true">›</span></button></nav>'
 if(profileLayout==='blocos')return header+'<div class="profile-columns">'+profileCompaniesContent()+profileHistoryContent()+'</div>'
 const tabs='<div class="profile-tabs" role="tablist" aria-label="Conteúdos do perfil">'+[['empresas','Empresas'],['atendimentos','Atendimentos']].map(([id,label])=>'<button type="button" id="profile-tab-'+id+'" role="tab" data-profile-tab="'+id+'" aria-controls="profile-content" aria-selected="'+(state.profileTab===id)+'" tabindex="'+(state.profileTab===id?'0':'-1')+'">'+label+'</button>').join('')+'</div>'
 return header+tabs+'<section id="profile-content" role="tabpanel" aria-labelledby="profile-tab-'+state.profileTab+'">'+(state.profileTab==='empresas'?profileCompaniesContent():profileHistoryContent())+'</section>'
}
function profilePanelActive(){
 return profileActive()&&['profileCompanies','profileContacts'].includes(state.panel)
}
function renderProfileConsultation(){
 if(profilePanelActive()){render();return $('#panel-body')}
 renderProfilePage();return $('#background')
}
function renderProfilePage(){
 $('#background').innerHTML=profilePageMarkup()
 $('#breadcrumb').textContent=state.profileOpen?'CRM / Usuários / Perfil do vendedor':'CRM / Usuários'
}
document.addEventListener('toggle',e=>{
 if(!profileActive()||!e.target.isConnected||!e.target.matches('[data-profile-event]'))return
 const id=Number(e.target.dataset.profileEvent)
 if(e.target.open)profileExpanded.add(id);else profileExpanded.delete(id)
},true)
function mediaViewerSpec(){
 const caption=mediaLongCaption?'Segue uma seleção de equipamentos para a instalação. A imagem reúne as opções que conversamos para facilitar a escolha do conjunto.\n\nAntes de fechar a proposta, precisamos confirmar os pontos de instalação, o espaço disponível e quem ficará responsável por receber os materiais. Também é importante conferir as medidas no local e identificar os ambientes que precisam de atendimento primeiro.\n\nPodemos separar a compra por etapas, começando pelos itens necessários para a primeira parte do serviço. Depois da confirmação, envio a relação final com a quantidade de cada equipamento e os detalhes combinados para a entrega.\n\nSe alguma opção da imagem não atender ao projeto, me informe qual ponto precisa ser ajustado. Assim conseguimos revisar a seleção antes de concluir o orçamento e deixar todas as informações registradas na mesma conversa.':'Opções de equipamentos para a instalação.'
 const image='<svg viewBox="0 0 640 500" role="img" aria-label="Imagem ilustrativa de equipamentos de segurança"><rect width="640" height="500" fill="#e6ebef"/><rect x="80" y="130" width="480" height="245" rx="14" fill="#a3aeb9"/><rect x="125" y="165" width="145" height="100" rx="12" fill="#fff"/><circle cx="196" cy="214" r="28" fill="#34404d"/><circle cx="196" cy="214" r="13" fill="#8fd0b9"/><path d="M285 215h65v-34h125v95H350v-34h-65" fill="#fff"/><rect x="130" y="295" width="355" height="35" rx="6" fill="#34404d"/><circle cx="460" cy="312" r="5" fill="#8fd0b9"/><text x="320" y="438" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="22" fill="#34404d">Imagem fictícia para avaliar o espaço</text></svg>'
 const captionMarkup='<p class="media-caption">'+esc(caption)+'</p>'
 return {context:'WhatsApp · Conversa selecionada',title:mediaExpanded?'Imagem ampliada':'Imagem da conversa',description:mediaExpanded?'Role para ver os detalhes da imagem.':'',internal:mediaExpanded,
  body:mediaExpanded?'<figure class="image-figure media-zoom-canvas">'+image+'</figure>':'<figure class="image-figure media-figure">'+image+(mediaLayout==='integrada'?'<figcaption>'+captionMarkup+'</figcaption>':'')+'</figure>',
  foot:mediaExpanded?'':mediaLayout==='separada'?captionMarkup:footer(btn('Ampliar imagem','ampliarMidia'),null)}
}
function resultContent(view=state.tab){
 const query=savedSearches[state.queryId]
 if(view==='filtros')return section('Filtros salvos',facts([['Fornecedor','Casa dos Dados'],['Região',query.region],['Atividade',query.activity+' · exemplo'],['Situação cadastral','Ativa'],['Contatos solicitados','Telefone comercial'],['Quantidade solicitada','20']]))+'<p class="hint">São os filtros registrados nesta busca.</p>'
 if(!query.count)return '<div class="strip"><strong>Busca concluída sem resultados</strong><br>20 solicitadas · 0 retornadas.</div><div class="empty">Nenhuma empresa encontrada nesta busca. Os critérios continuam disponíveis em Filtros usados.</div>'
 return '<div class="strip"><strong>Busca concluída</strong><br>20 solicitadas · '+query.count+' retornadas. As elegíveis foram incluídas na sua prospecção.</div>'+query.companies.map(n=>'<article class="list-row"><h2>'+n+'</h2><p>'+query.region+' · Banco de empresas</p><span class="badge">A contatar</span><div class="button-row">'+btn('Ver empresa','empresa')+'</div></article>').join('')+'<p class="hint">Demais empresas acessíveis na lista pessoal, com os filtros e a página preservados.</p>'
}


function structuredNegotiationActive(){
 return state.panel==='negociacao'&&['abas','secoes','menu'].includes(layoutVariant)
}
function nextStepContent(){
 return '<div class="structure-current">'+section('Próximo passo combinado',facts([['O que fazer','Apresentar as opções de câmeras'],['Retorno','06/11/2026']])+(!state.structureEditing?'<div class="structure-advance">'+btn('Avançar para Proposta enviada','avancar')+'</div>':''))+'</div>'
}
function groupedContactContent(){
 return nextStepContent()+(state.structureEditing
  ? '<section class="structure-editor"><h2>Registrar atendimento</h2>'+contactForm()+'</section>'
  : '<section class="structure-entry"><h2>Atendimento</h2>'+btn('Registrar atendimento','structure:editar',actionPlacement==='contexto'?'':'outline')+'</section>')
}
function structureSectionButton(id,title,description){
 const open=state.tab===id
 return '<button type="button" class="structure-section-trigger" data-structure-section="'+id+'" aria-expanded="'+open+'" aria-controls="structure-section-'+id+'"><span><strong>'+title+'</strong><small>'+description+'</small></span><span aria-hidden="true">'+(open?'−':'+')+'</span></button>'
}
function structureMenuButton(id,title,description){
 return '<button type="button" class="structure-menu-entry" data-structure-menu="'+id+'"><span><strong>'+title+'</strong><small>'+description+'</small></span><span aria-hidden="true">›</span></button>'
}
function structuredNegotiationSpec(){
 const actions=state.structureEditing
  ? footer(btn('Cancelar','cancelar'),btn('Salvar atendimento','salvarAtendimento',''))
  : footer(btn('Registrar venda','venda',''),btn('Sem interesse','confirm:arquivo'),'Ações da negociação')
 const contextual=layoutVariant==='menu'&&actionPlacement==='contexto'
 const common={context:'Negociação',title:company,description:'Etapa atual: Em negociação',foot:contextual&&!state.structureEditing?'':actions}
 if(layoutVariant==='abas'){
  return {...common,tabs:[['passo','Atendimento'],['historico','Histórico']],
   internal:state.structureEditing||state.tab==='historico',
   body:state.tab==='historico'?historyContent('negociacao'):groupedContactContent()}
 }
 if(layoutVariant==='secoes'){
  return {...common,internal:state.structureEditing,body:'<div class="structure-accordion">'+
   '<section class="structure-fold">'+structureSectionButton('passo','Atendimento e próximo passo','Ação combinada e registro do contato')+
   '<div id="structure-section-passo" class="structure-fold-body" '+(state.tab!=='passo'?'hidden':'')+'>'+(state.tab==='passo'?groupedContactContent():'')+'</div></section>'+
   '<section class="structure-fold">'+structureSectionButton('historico','Histórico','Contatos registrados nesta negociação')+
   '<div id="structure-section-historico" class="structure-fold-body" '+(state.tab!=='historico'?'hidden':'')+'>'+(state.tab==='historico'?historyContent('negociacao'):'')+'</div></section></div>'}
 }
 if(state.structureMenu==='inicio'){
  return {...common,body:'<nav class="structure-menu" aria-label="Seções da negociação">'+
   structureMenuButton('passo','Atendimento e próximo passo','Consultar o combinado ou registrar um contato')+
   structureMenuButton('historico','Histórico','Consultar os contatos anteriores')+'</nav>'+(contextual?'<section class="structure-action-group"><h2>Ações da negociação</h2><div class="button-row">'+btn('Registrar venda','venda','')+btn('Sem interesse','confirm:arquivo')+'</div></section>':'')}
 }
 return {...common,internal:true,body:'<div class="structure-view-name">'+(state.tab==='historico'?'Histórico':'Atendimento e próximo passo')+'</div>'+
  (state.tab==='historico'?historyContent('negociacao'):groupedContactContent())}
}
function changeStructureSection(next,fromMenu=false){
 const proceed=()=>{
  state.structureEditing=false
  state.tab=next
  if(fromMenu)state.structureMenu='conteudo'
  render()
  if(layoutVariant==='secoes')$('#panel-body').querySelector('[data-structure-section="'+next+'"]')?.focus()
 }
 if(state.dirty)ask('descarte',proceed);else proceed()
}
function structureBack(){
 if(state.structureEditing){
  const stop=()=>{state.structureEditing=false;state.dirty=false;render()}
  if(state.dirty)ask('descarte',stop);else stop()
  return
 }
 if(layoutVariant==='menu'&&state.structureMenu==='conteudo'){
  state.structureMenu='inicio';state.tab='passo';render();return
 }
 if(layoutVariant==='abas'&&state.tab==='historico'){state.tab='passo';render();return}
 closePanel()
}


function dailyStructureActive(){
 return state.panel==='retorno'&&['direto','menu'].includes(dailyLayout)
}
function returnStepContent(){
 return '<div class="structure-current daily-step">'+section('Próximo passo',facts([['O que fazer','Apresentar as opções de câmeras'],['Retorno','Hoje · 05/11/2026']]))+'</div>'
}
function returnMenuEntry(id,title,hint){
 return '<button type="button" class="structure-menu-entry" data-return-section="'+id+'"><span><strong>'+title+'</strong><small>'+hint+'</small></span><span aria-hidden="true">›</span></button>'
}
function dailyStructureSpec(){
 let body=''
 if(state.returnSection==='historico')body=historyContent('retorno')
 else if(state.returnSection==='passo')body=returnStepContent()
 else{
  const entries=(dailyLayout==='menu'?returnMenuEntry('passo','Próximo passo','Consultar a ação e a data combinadas'):'')+
   returnMenuEntry('dados','Dados da empresa','Contato e localização, cadastro, atividades e sócios')+
   returnMenuEntry('historico','Histórico do retorno','Consultar os registros anteriores disponíveis')
  body=(dailyLayout==='direto'?returnStepContent():'')+
   '<nav class="structure-menu" aria-label="Seções do retorno">'+entries+'</nav>'
 }
 return {context:'Retorno de hoje',title:company,description:'Próxima ação em 05/11/2026',
  internal:state.returnSection!=='menu',body,
  foot:footer(btn('Negociação','negociacao',''),null,'Ações do retorno')}
}


function bankCompaniesContent(query,index){
 if(!query.count)return '<p class="bank-results-empty">Nenhuma empresa encontrada nesta busca.</p>'
 return '<div class="bank-company-list">'+query.companies.map((name,companyIndex)=>
  '<article class="bank-company-row" aria-labelledby="bank-company-'+index+'-'+companyIndex+'"><div><h3 id="bank-company-'+index+'-'+companyIndex+'">'+esc(name)+'</h3><p>'+esc(query.region)+'</p></div><button type="button" class="outline" data-bank-company="'+index+':'+companyIndex+'">Ver empresa</button></article>'
 ).join('')+'</div><p class="bank-results-note">Exibindo '+query.companies.length+' de '+query.count+' empresas nesta prévia com dados fictícios.</p>'
}
function bankHistoryContent(){
 if(bankLayout!=='pagina')return savedSearches.map((q,i)=>'<article class="list-row"><h2>'+q.name+'</h2><p>'+q.date+' · Casa dos Dados</p><div class="date-line"><span class="badge">'+(q.count?q.count+' empresas':'Sem resultados')+'</span>'+btn('Ver busca','busca:'+i)+'</div></article>').join('')
 return savedSearches.map((q,i)=>{
  const expanded=expandedBankSearches.has(i)
  return '<article class="bank-search" aria-labelledby="bank-search-title-'+i+'"><div class="bank-search-head"><h2 id="bank-search-title-'+i+'">'+esc(q.name)+'</h2><p>'+q.date+' · Casa dos Dados</p><span class="badge">'+(q.count?q.count+' empresas':'Sem resultados')+'</span><div class="bank-search-actions"><button type="button" class="outline bank-expand" data-bank-companies="'+i+'" aria-expanded="'+expanded+'" aria-controls="bank-results-'+i+'">Ver empresas <span aria-hidden="true">⌄</span></button><button type="button" class="outline" data-bank-filters="'+i+'">Filtros usados</button></div></div><section id="bank-results-'+i+'" class="bank-results" role="region" aria-label="Empresas de '+esc(q.name)+'"'+(expanded?'':' hidden')+'>'+bankCompaniesContent(q,i)+'</section></article>'
 }).join('')
}
function bankStructureActive(){
 return state.panel==='resultadoBusca'&&['pagina','painel'].includes(bankLayout)
}
function bankStructureSpec(){
 const query=savedSearches[state.queryId]
 let body=''
 if(state.bankSection==='empresas')body='<div class="structure-view-name">Empresas encontradas</div>'+resultContent('passo')
 else if(state.bankSection==='filtros')body=resultContent('filtros')
 else body='<div class="strip"><strong>'+(query.count?'Busca concluída':'Busca concluída sem resultados')+'</strong><br>20 solicitadas · '+query.count+' retornadas.</div><nav class="structure-menu" aria-label="Seções da busca">'+
  '<button type="button" class="structure-menu-entry" data-bank-section="empresas"><span><strong>Empresas encontradas</strong><small>Consultar as empresas retornadas</small></span><span aria-hidden="true">›</span></button>'+
  '<button type="button" class="structure-menu-entry" data-bank-section="filtros"><span><strong>Filtros usados</strong><small>Consultar os critérios salvos desta pesquisa</small></span><span aria-hidden="true">›</span></button></nav>'
 return {context:'Banco de empresas',title:query.name,description:'Busca de '+query.date+' · Casa dos Dados',internal:state.bankSection!=='menu',body,foot:''}
}
function bankPageMarkup(){
 const heading='<h1>Banco de empresas</h1><p class="intro">Busque novas empresas para inclusão na sua prospecção pessoal.</p>'
 const search='<section class="background-card"><h2>Buscar empresas</h2><p>Escolha a região e o perfil das empresas que deseja encontrar.</p>'+btn('Buscar empresas','buscaSimulada','')+'</section>'
 if(bankLayout==='painel')return heading+'<div class="compact-group">'+btn('Ver histórico de buscas','historicoBuscas')+'</div>'+search
 const tabs='<div class="bank-page-tabs" role="tablist" aria-label="Áreas do Banco de empresas">'+
  [['buscar','Buscar empresas'],['historico','Histórico de buscas']].map(([id,label])=>'<button type="button" role="tab" data-bank-page="'+id+'" id="bank-tab-'+id+'" aria-controls="bank-page-content" aria-selected="'+(state.bankPage===id)+'" tabindex="'+(state.bankPage===id?'0':'-1')+'">'+label+'</button>').join('')+'</div>'
 return heading+tabs+'<section id="bank-page-content" role="tabpanel" aria-labelledby="bank-tab-'+state.bankPage+'">'+
  (state.bankPage==='historico'?'<h2 class="bank-history-title">Histórico de buscas</h2>'+bankHistoryContent():search)+'</section>'
}

function studyNotice(kind,title,message){
 const icon=kind==='error'?'!':kind==='success'?'✓':kind==='loading'?'◌':'i'
 return '<div class="state-notice state-notice-'+kind+'" role="'+(kind==='error'?'alert':'status')+'"><span class="state-symbol" aria-hidden="true">'+icon+'</span><div><strong>'+title+'</strong><p>'+message+'</p></div></div>'
}
function studySaleSummary(){
 return section('Dados enviados',facts([['Empresa',esc(studySale.empresa)],['Valor',studySale.valor],['Data efetiva',studySale.data]]))
}
function stateStudySpec(){
 const current=state.readState
 const companySpec={context:'Dados da empresa',title:company,description:'Consulta dos dados salvos',foot:''}
 if(current==='carregando')return {...companySpec,body:studyNotice('loading','Carregando dados','Aguarde a consulta desta empresa.')+'<div class="state-skeletons" aria-hidden="true">'+Array.from({length:3},()=>'<div class="skeleton"></div>').join('')}
 if(current==='erro')return {...companySpec,body:studyNotice('error','Não foi possível carregar','Tente novamente para consultar os dados desta empresa.'),foot:footer(btn('Tentar novamente','state:retry',''),null)}
 if(current==='indisponivel')return {context:'Consulta',title:'Dados da empresa',description:'',body:studyNotice('neutral','Conteúdo indisponível','Este conteúdo não está disponível para seu acesso.'),foot:''}
 if(current==='vazio'||current==='filtrado')return {context:'Carteira · Histórico',title:company,description:'Histórico comercial',body:(current==='filtrado'?'<div class="history-tools" role="group" aria-label="Filtrar histórico">'+[['todos','Todos'],['atendimentos','Atendimentos'],['vendas','Vendas']].map(([id,label])=>'<button type="button" data-study-filter="'+id+'" aria-pressed="'+(id==='vendas')+'">'+label+'</button>').join('')+'</div>':'')+studyNotice('neutral',current==='filtrado'?'Nenhuma venda neste filtro':'Ainda não há registros',current==='filtrado'?'Consulte todos os eventos para ver os atendimentos disponíveis.':'Os atendimentos e vendas aparecerão aqui após o primeiro registro.'),foot:current==='filtrado'?footer(btn('Ver todos','state:all',''),null):''}
 if(['enviando','incerto','verificando'].includes(current)){
  const pending=current==='enviando',checking=current==='verificando'
  const title=pending?'Registrando venda':checking?'Verificando registro':'Confirmação pendente'
  const message=pending?'Aguarde a confirmação do registro.':checking?'Aguarde a verificação do mesmo envio.':'A resposta não chegou. Verifique o registro antes de continuar.'
  const action=pending?'<button type="button" disabled>Registrando…</button>':checking?'<button type="button" disabled>Verificando…</button>':btn('Verificar registro','state:verify','')
  return {context:'Funil · Primeira venda',title:'Registrar venda',description:company,body:studyNotice(pending||checking?'loading':'warning',title,message)+studySaleSummary(),foot:footer(action,null)}
 }
 if(current==='sucesso'){
  const client=walletClientSpec()
  return {...client,body:(state.clientSection==='menu'?studyNotice('success','Venda registrada','Este cliente agora está na sua Carteira.'):'')+client.body}
 }
 return null
}
function specForPanel(){
 if(stateStudy){const study=stateStudySpec();if(study)return study}

 if(profilePanelActive())return {context:'Gestor · Perfil do vendedor',title:state.panel==='profileCompanies'?'Empresas do vendedor':'Últimos atendimentos',description:'Pessoa de exemplo',body:state.panel==='profileCompanies'?profileCompaniesContent(true):profileHistoryContent(true),foot:state.panel==='profileCompanies'&&profileCompanyRows.length>50?profileCompanyPagination():''}
 if(adminActive()&&state.panel==='adminAccess')return adminAccessSpec()
 if(adminActive()&&state.panel==='adminCredencial')return {context:'Gestor · Entrega de acesso',title:'Senha provisória',description:demoUsers[state.adminIndex].nome,body:adminSecretVisible?section('Entregue à pessoa','<p>Exemplo visual sem acesso ao CRM.</p><code class="password">EXEMPLO-SEM-ACESSO</code>'+btn('Copiar senha','copiarSenha')+'<p class="hint">Ao concluir, esta entrega não poderá ser consultada novamente. A pessoa deverá trocar a senha no primeiro acesso.</p>'):'<div class="empty">Entrega encerrada. A senha não está disponível para consulta.</div>',foot:footer(btn('Concluir','concluir',''),null)}
 if(walletActive()&&state.panel==='cliente')return walletClientSpec()
 if(walletActive()&&state.panel==='clienteAtendimento')return {context:'Carteira · Atendimento',title:company,description:'Registrar atendimento do cliente',body:walletCustomerForm(),foot:footer(btn('Cancelar','cancelar'),btn('Salvar atendimento','salvarAtendimento',''))}
 if(mirrorStructureActive())return mirrorStructureSpec()
 if(criteriaStructureActive())return criteriaStructureSpec()
 if(bankStructureActive())return bankStructureSpec()
 if(dailyStructureActive())return dailyStructureSpec()
 if(companyStructureActive())return companyStructureSpec()
 if(structuredNegotiationActive())return structuredNegotiationSpec()

 switch(state.panel){
 case 'empresa':return {context:'Dados da empresa',title:company,description:'Consulta dos dados salvos',body:companyContent(),foot:area==='dia'?footer(btn('Negociação','negociacao'),null,'Acesso comercial'):''}
 case 'retorno':return {context:'Retorno de hoje',title:company,description:'Próxima ação em 05/11/2026',tabs:[['passo','Próximo passo'],['historico','Histórico']],body:state.tab==='historico'?historyContent('retorno'):section('Próximo passo',facts([['O que fazer','Apresentar as opções de câmeras'],['Retorno','Hoje · 05/11/2026']])),foot:footer(btn('Dados da empresa','empresa'),btn('Negociação','negociacao',''),'Ações do retorno')}
 case 'negociacao':return {context:'Negociação',title:company,description:'Etapa atual: Em negociação',tabs:[['passo','Próximo passo'],['atendimento','Atendimento'],['historico','Histórico']],body:state.tab==='historico'?historyContent('negociacao'):state.tab==='atendimento'?contactForm():section('Próximo passo',facts([['O que fazer','Apresentar as opções de câmeras'],['Retorno','06/11/2026']])+ '<div style="margin-top:18px">'+btn('Avançar para Proposta enviada','avancar')+'</div>'),foot:state.tab==='atendimento'?footer(btn('Cancelar','cancelar'),btn('Salvar atendimento','salvarAtendimento','')):footer(btn('Registrar venda','venda',''),btn('Sem interesse','confirm:arquivo'),'Ações da negociação')}
 case 'venda':return {context:area==='carteira'?'Carteira · Nova venda':'Funil · Primeira venda',title:'Registrar venda',description:company,body:form(section('Dados da venda',field('Valor em reais','valor','0,00','text','',true)+field('Data da venda','data','','date','',true)+text('Observação (opcional)','nota','')))+'<div class="strip warning">'+(area==='carteira'?'A empresa continua na Carteira e o retorno agendado é mantido.':'A primeira venda leva à ficha deste cliente na Carteira.')+'</div><p class="hint">Vendas não podem ser editadas nem excluídas nesta versão. Confira os dados antes de confirmar.</p>',foot:footer(btn('Cancelar','cancelar'),btn('Conferir venda','conferirVenda',''))}
 case 'arquivo':return {context:'Arquivo do Funil',title:'Sem interesse',description:'As três últimas empresas arquivadas pelo seu Funil.',body:['Armazém Aurora','Casa Ipê Materiais Elétricos','Estúdio Cedro Instalações'].map((n,i)=>'<article class="list-row"><h2>'+n+'</h2><p>Arquivada em '+(5-i)+'/11/2026</p>'+btn('Devolver','devolver')+'</article>').join('')+'<p class="hint">Devolver abre uma negociação em Primeiro contato. O histórico anterior é preservado e os retornos antigos não são restaurados.</p>',foot:footer(btn('Ver todos em Sem interesse','verArquivo'),null)}
 case 'criterios':return {context:'Google · Planejamento de 06/11/2026',title:'Critérios de busca',description:'Todos os critérios são opcionais.',tabs:[['passo','Procurar'],['evitar','Evitar'],['contatos','Contatos'],['orientacoes','Orientações']],body:criteriaContent(),foot:footer(btn('Cancelar','cancelar'),btn('Aplicar critérios','aplicarCriterios',''))}
 case 'espelho':return {context:'Google · Planejamento',title:'Espelhar planejamento',description:'Copie os campos escolhidos para outros dias.',body:form(section('Origem',select('Semana de origem','semana',['Semana de 02/11/2026'])+select('Dia de origem','origem',['04/11/2026 · Segurança eletrônica · Mooca']))+checks('O que copiar','campos',['Nicho','Critérios de busca','Região: bairro, cidade e UF'])+section('Destino',select('Semana de destino','destino',['Semana exibida','Próxima semana']))+checks('Dias de destino','dias',['Sexta-feira, 06/11','Sábado, 07/11','Domingo, 08/11']))+'<p class="hint">Dias passados, o dia atual e a própria origem não são destinos elegíveis.</p>',foot:footer(btn('Cancelar','cancelar'),btn('Espelhar nos dias escolhidos','espelhar',''))}
 case 'filtrosBusca':return {context:savedSearches[state.queryId].name,title:'Filtros usados',description:'Busca de '+savedSearches[state.queryId].date+' · Casa dos Dados',body:resultContent('filtros'),foot:''}
 case 'historicoBuscas':return {context:'Banco de empresas',title:'Histórico de buscas',description:'Inclui pesquisas sem resultados.',body:bankHistoryContent(),foot:''}
 case 'resultadoBusca':return {context:'Banco de empresas',title:savedSearches[state.queryId].name,description:'Busca de '+savedSearches[state.queryId].date+' · Casa dos Dados',tabs:[['passo','Empresas'],['filtros','Filtros usados']],body:resultContent(),foot:''}
 case 'usuario':return {context:'Gestor · Usuários',title:'Novo usuário',description:'Crie o acesso e entregue a senha provisória à pessoa.',body:form(section('Identificação',field('Nome','nome','Nome da pessoa','text','',true)+field('E-mail','email','pessoa@empresa.example','email','',true))+section('Papel','<label class="check"><input type="radio" name="papel" value="vendedor" checked>Vendedor</label><label class="check"><input type="radio" name="papel" value="gestor">Gestor</label>')),foot:footer(btn('Cancelar','cancelar'),btn('Criar usuário','criarUsuario',''))}
 case 'credencial':return {context:'Gestor · Entrega de acesso',title:'Senha provisória',description:'Pessoa de exemplo · Vendedor',body:section('Entregue à pessoa','<p>Esta senha será mostrada apenas nesta entrega.</p><code class="password">EXEMPLO-SEM-ACESSO</code>'+btn('Copiar senha','copiarSenha')+'<p class="hint" style="margin-top:14px">Ao concluir, não será possível consultar esta senha novamente. A pessoa deverá trocá-la no primeiro acesso.</p>')+'<div class="strip">Prévia visual. O texto acima não é uma senha de acesso.</div>',foot:footer(btn('Concluir','concluir',''),null)}
 case 'lista':return {context:'Gestor · Listas',title:'Renomear lista',description:'Clientes de exemplo · Região Leste',body:form(section('Identificação',field('Nome da lista','nomeLista','','text','Clientes de exemplo · Região Leste',true))),foot:footer(btn('Cancelar','cancelar'),btn('Salvar nome','salvarLista',''))}
 case 'midia':return mediaViewerSpec()
 case 'historico':return {context:area==='gestor'?'Gestor · Ficha da empresa':'Carteira · Ficha do cliente',title:'Histórico comercial',description:company,body:historyContent(),foot:'<p class="hint" style="margin:0">Referência de conteúdo. As páginas atuais mantêm seu acesso e suas consultas.</p>'}
 default:return {title:'Nenhum conteúdo selecionado',body:'',foot:''}
 }
}
function render(){
 const open=!!state.panel;panelElement.hidden=!open;document.body.classList.toggle('has-panel',open)
 panelElement.classList.toggle('media-expanded',state.panel==='midia'&&mediaExpanded)
 if(!open)return
 const spec=specForPanel()
 $('#panel-context').textContent=spec.context||''
 $('#panel-title').textContent=spec.title
 $('#panel-description').textContent=spec.description||''
 $('#back').textContent=state.stack.length||spec.internal||(spec.tabs&&state.tab!=='passo')?'Voltar':'Fechar'
 $('#tabs').hidden=!spec.tabs
 $('#tabs').innerHTML=(spec.tabs||[]).map(([id,title])=>'<button type="button" role="tab" data-tab="'+id+'" aria-selected="'+(state.tab===id)+'" tabindex="'+(state.tab===id?'0':'-1')+'">'+title+'</button>').join('')
 $('#panel-body').classList.toggle('media-content',state.panel==='midia')
 $('#panel-body').classList.toggle('media-stage',state.panel==='midia'&&mediaLayout==='separada'&&!mediaExpanded)
 if(state.panel==='midia'){$('#panel-body').setAttribute('tabindex','0');$('#panel-body').setAttribute('aria-label',mediaExpanded?'Imagem ampliada':'Imagem e legenda')}
 else{$('#panel-body').removeAttribute('tabindex');$('#panel-body').removeAttribute('aria-label')}
 if(state.panel==='midia'&&mediaLayout==='separada'&&!mediaExpanded){$('#panel-footer').setAttribute('tabindex','0');$('#panel-footer').setAttribute('aria-label','Legenda da imagem')}
 else{$('#panel-footer').removeAttribute('tabindex');$('#panel-footer').removeAttribute('aria-label')}
 $('#panel-footer').classList.toggle('media-caption-footer',state.panel==='midia'&&mediaLayout==='separada'&&!mediaExpanded)
 $('#panel-body').innerHTML=spec.body
 $('#panel-footer').innerHTML=spec.foot
 $('#panel-footer').hidden=!spec.foot
 restore()
 if(!stateStudy&&state.readState==='carregando')$('#panel-body').innerHTML='<p role="status">Carregando conteúdo…</p>'+Array.from({length:9},()=>'<div class="skeleton"></div>').join('')
 if(!stateStudy&&state.readState==='erro')$('#panel-body').innerHTML='<div class="strip danger" role="alert">Não foi possível carregar este conteúdo.<br>'+btn('Tentar novamente','tentar')+'</div>'
 if(!stateStudy&&state.readState==='vazio')$('#panel-body').innerHTML='<div class="empty">Nenhum registro para este recorte. Ajuste os filtros para continuar.</div>'
 if(!stateStudy&&(state.readState==='enviando'||state.readState==='incerto')){
   const pending=state.readState==='enviando'
   if(state.panel==='venda'){const value=document.querySelector('[name=valor]');const date=document.querySelector('[name=data]');if(value)value.value='1250,00';if(date)date.value='2026-11-05'}
   $('#panel-body').insertAdjacentHTML('afterbegin','<div class="strip warning" role="status">'+(pending?'Registrando… Aguarde a confirmação.':'Não foi possível confirmar o resultado do envio. Os dados enviados foram preservados.')+(!pending?'<br>'+btn('Confirmar envio anterior','recuperar'):'')+'</div>')
   panelElement.querySelectorAll('input,textarea,select,#panel-footer button').forEach(el=>{el.disabled=true})
   $('#back').disabled=pending
 }else $('#back').disabled=stateStudy&&['enviando','verificando'].includes(state.readState)
 $('#panel-body').setAttribute('aria-busy',String(stateStudy&&['carregando','enviando','verificando'].includes(state.readState)))
 $('#panel-title').focus({preventScroll:true})
}
const confirmations={ reativarUsuario:{title:'Reativar esta pessoa?',text:'Pessoa de exemplo poderá voltar a acessar o CRM.',accept:'Reativar'}, tornarVendedor:{title:'Tornar esta pessoa vendedora?',text:'Pessoa de exemplo perderá o acesso à administração de usuários e empresas.',accept:'Tornar vendedor'}, reativarLista:{title:'Reativar esta lista?',text:'Empresas elegíveis poderão voltar à prospecção, conforme as regras atuais. Vínculos e histórico são preservados.',accept:'Reativar lista'},
 arquivo:{title:'Marcar como Sem interesse?',text:'A negociação será encerrada e os retornos agendados serão cancelados. O histórico e o vínculo com você serão preservados.',accept:'Marcar como Sem interesse'},
 venda:{title:'Confirmar venda?',text:'Confira a empresa, o valor e a data efetiva antes de registrar. A venda não poderá ser editada nem excluída nesta versão.',accept:'Confirmar venda'},
 descarte:{title:'Descartar alterações?',text:'As alterações ainda não salvas deste formulário serão perdidas.',accept:'Descartar',cancel:'Continuar editando'},
 desativarUsuario:{title:'Desativar esta pessoa?',text:'Pessoa de exemplo perderá o acesso ao CRM. Você poderá reativá-la depois.',accept:'Desativar'},
 papel:{title:'Tornar esta pessoa gestora?',text:'Pessoa de exemplo poderá administrar usuários e empresas. As restrições de alteração da própria conta permanecem.',accept:'Tornar gestor'},
 novaSenha:{title:'Gerar nova senha provisória?',text:'A senha anterior e as sessões de Pessoa de exemplo serão invalidadas. Depois da confirmação, entregue a nova senha.',accept:'Gerar nova senha'},
 desativarLista:{title:'Desativar esta lista?',text:'Empresas elegíveis desta lista poderão deixar de aparecer para novas prospecções. Carteiras e histórico são preservados. Empresas vinculadas a outra lista ativa podem continuar disponíveis.',accept:'Desativar lista'}
}
function renderConfirmationStudy(type,value,date){
 const subject=type==='descarte'?'Registrar atendimento':company
 const label=type==='descarte'?'Formulário':'Empresa'
 const subjectMarkup='<small>'+label+'</small><strong>'+esc(subject)+'</strong>'+(type==='descarte'?'<span>'+esc(company)+'</span>':'')
 const saleRows=[['Valor','R$ '+esc(value)],['Data efetiva',esc(date.split('-').reverse().join('/'))]]
 const target=$('#confirm-target')
 dialog.dataset.layout=confirmationLayout
 target.hidden=false
 target.innerHTML=confirmationLayout==='destacado'?'<div class="confirm-subject">'+subjectMarkup+(type==='venda'?facts(saleRows):'')+'</div>':'<p class="confirm-inline">'+label+': <strong>'+esc(subject)+'</strong>'+(type==='descarte'?'<br>'+esc(company):'')+(type==='venda'?'<br>Valor: <strong>'+saleRows[0][1]+'</strong><br>Data efetiva: <strong>'+saleRows[1][1]+'</strong>':'')+'</p>'
 $('#confirm-detail').innerHTML=''
}
function ask(type,next){
 const c=confirmations[type]||confirmations.descarte
 $('#confirm-title').textContent=c.title;$('#confirm-text').textContent=c.text
 $('#cancel-confirm').textContent=c.cancel||'Cancelar'
 $('#accept-confirm').textContent=c.accept;$('#accept-confirm').className=['arquivo','desativarUsuario','desativarLista','descarte'].includes(type)?'danger':''
 const value=$('[name=valor]')?.value||'1.250,00'
 const date=$('[name=data]')?.value||'2026-11-05'
 $('#confirm-detail').innerHTML=type==='venda'?facts([['Empresa',company],['Valor','R$ '+esc(value)],['Data efetiva',esc(date.split('-').reverse().join('/'))]]):''
 if(confirmationLayout!=='original')renderConfirmationStudy(type,value,date)
 else{$('#confirm-target').hidden=true;dialog.removeAttribute('data-layout')}
 confirmAction=()=>{
   if(next){state.dirty=false;delete state.drafts[state.panel+':'+state.tab];next();return}
   if(type==='novaSenha'){state.panel='credencial';state.tab='passo';state.dirty=false;render()}
   toast('Simulação concluída. Nenhum dado foi alterado no CRM.')
 }
 dialog.showModal()
 $('#cancel-confirm').focus()
}
$('#accept-confirm').addEventListener('click',()=>{dialog.close('accept');const next=confirmAction;confirmAction=null;next?.()})
dialog.addEventListener('close',()=>{if(dialog.returnValue!=='accept')confirmAction=null;if(adminActive()&&state.panel!=='adminCredencial'&&adminReturnFocus?.isConnected)adminReturnFocus.focus({preventScroll:true})})
$('#back').addEventListener('click',back)
$('#panel-body').addEventListener('input',()=>{if(!mirrorStructureActive()){state.dirty=true;capture()}})
$('#panel-body').addEventListener('change',e=>{
 if(!mirrorStructureActive()||mirrorSent)return
 const input=e.target
 if(input.name==='origem')mirrorDraft.origem=input.value
 if(input.name==='campos')mirrorDraft.campos=input.checked?[...mirrorDraft.campos,input.value]:mirrorDraft.campos.filter(value=>value!==input.value)
 if(input.name==='dias')mirrorDraft.dias=input.checked?[...mirrorDraft.dias,input.value]:mirrorDraft.dias.filter(value=>value!==input.value)
 if(input.name==='semanaDestino'){mirrorDraft.semana=input.value;mirrorDraft.dias=[]}
 mirrorDraft.dias=mirrorDraft.dias.filter(value=>mirrorDays().some(day=>day.iso===value&&!day.disabled))
 state.dirty=JSON.stringify(mirrorDraft)!==JSON.stringify(mirrorInitial)
 if(input.name==='origem'||input.name==='semanaDestino'){
  mirrorError='';render();$('#panel-body').querySelector('[name="'+input.name+'"]')?.focus({preventScroll:true})
 }else if(mirrorDraft.campos.length&&mirrorDraft.dias.length){mirrorError='';$('#mirror-error').hidden=true}
})
document.addEventListener('submit',e=>{if(e.target.id==='edit-form')e.preventDefault()})
document.addEventListener('keydown',e=>{
 if(confirmationLayout!=='original'&&dialog.open&&e.key==='Tab'){
  const first=$('#cancel-confirm'),last=$('#accept-confirm')
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();return}
  if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();return}
 }
 if(e.key==='Escape'&&!dialog.open&&!state.panel&&adminActive()){
  const disclosure=document.querySelector('.admin-row-actions[open]')
  if(disclosure){e.preventDefault();disclosure.open=false;disclosure.querySelector('summary').focus();return}
 }
 if(e.key==='Escape'&&!dialog.open&&state.panel){e.preventDefault();if(state.readState!=='enviando'&&!(stateStudy&&state.readState==='verificando'))back()}
 if(e.target.matches('[role=tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
  e.preventDefault();const tabs=Array.from((e.target.closest('.profile-tabs')||e.target.closest('.wallet-page-tabs')||e.target.closest('.bank-page-tabs')||$('#tabs')).querySelectorAll('button'));const i=tabs.indexOf(e.target);const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].click();tabs[n].focus()
 }
})
document.addEventListener('click',e=>{
 const studyFilter=e.target.closest('[data-study-filter]')
 if(stateStudy&&studyFilter){
  if(studyFilter.dataset.studyFilter!=='vendas'){state.readState='normal';state.clientSection='historico';state.historyFilter=studyFilter.dataset.studyFilter;render()}
  return
 }
 const companyPage=e.target.closest('[data-profile-page]')
 if(companyPage&&!companyPage.disabled){
  state.profileCompanyPage=Math.max(1,Math.min(Math.ceil(profileCompanyRows.length/50),Number(companyPage.dataset.profilePage)))
  const content=renderProfileConsultation()
  if(profilePanelActive())$('#panel-body').scrollTop=0
  content.parentElement.querySelector('[data-profile-page-label]')?.focus({preventScroll:true})
  return
 }
 const profilePanel=e.target.closest('[data-profile-panel]')
 if(profilePanel){profileReturnFocus=profilePanel;changePanel(profilePanel.dataset.profilePanel,false);return}
 const profileBack=e.target.closest('[data-profile-back]')
 if(profileBack){if(profilePanelActive())closePanel();state.profileOpen=false;renderProfilePage();$('#background').querySelector('summary')?.focus({preventScroll:true});return}
 const profileTab=e.target.closest('[data-profile-tab]')
 if(profileTab){state.profileTab=profileTab.dataset.profileTab;renderProfilePage();$('#background').querySelector('[aria-selected=true]')?.focus({preventScroll:true});return}
 const profileFilter=e.target.closest('[data-profile-filter]')
 if(profileFilter){state.profileFilter=profileFilter.dataset.profileFilter;const content=renderProfileConsultation();content.querySelector('[data-profile-filter="'+state.profileFilter+'"]')?.focus({preventScroll:true});return}
 const profileExpand=e.target.closest('[data-profile-expand]')
 if(profileExpand){const allOpen=profileActivity.every(event=>profileExpanded.has(event.id));profileActivity.forEach(event=>{if(allOpen)profileExpanded.delete(event.id);else profileExpanded.add(event.id)});const content=renderProfileConsultation();content.querySelector('[data-profile-expand]')?.focus({preventScroll:true});return}
 const profileRefresh=e.target.closest('[data-profile-refresh]')
 if(profileRefresh){toast('Simulação visual. Nenhuma consulta real foi executada.');return}
 const adminOpen=e.target.closest('[data-admin-open]')
 if(adminOpen){state.adminIndex=Number(adminOpen.dataset.adminOpen);adminReturnFocus=adminOpen;changePanel('adminAccess',false);return}
 const adminSection=e.target.closest('[data-admin-section]')
 if(adminSection){state.adminSection=adminSection.dataset.adminSection;render();return}
 const adminAction=e.target.closest('[data-admin-action]')
 if(adminAction){adminConfirm(adminAction.dataset.adminAction,Number(adminAction.dataset.adminUser),adminAction);return}
 const adminProfile=e.target.closest('[data-admin-profile]')
 if(adminProfile){
  if(profileActive()){state.profileOpen=true;renderProfilePage()}
  else toast('Destino previsto: perfil de '+demoUsers[Number(adminProfile.dataset.adminProfile)].nome+', mantendo os filtros e a página da lista.')
  return
 }
 const clientOpen=e.target.closest('[data-client-open]')
 if(clientOpen){
  walletFilters.nome=$('[name=walletNome]')?.value||''
  walletFilters.uf=$('[name=walletUf]')?.value||'Qualquer UF'
  walletFilters.retorno=$('[name=walletRetorno]')?.value||'Qualquer retorno'
  walletReturnFocus=clientOpen
  if(walletLayout==='lateral')changePanel('cliente',false)
  else{state.walletPageOpen=true;state.walletPageTab='atendimento';renderWalletPage()}
  return
 }
 const clientList=e.target.closest('[data-client-list]')
 if(clientList){state.walletPageOpen=false;renderWalletPage();$('[data-client-open]')?.focus({preventScroll:true});return}
 const walletTab=e.target.closest('[data-wallet-tab]')
 if(walletTab){state.walletPageTab=walletTab.dataset.walletTab;renderWalletPage();$('#background').querySelector('[aria-selected=true]')?.focus();return}
 const clientSection=e.target.closest('[data-client-section]')
 if(clientSection){if(clientSection.dataset.clientSection==='dados')changePanel('empresa');else{state.clientSection=clientSection.dataset.clientSection;render()}return}
 const mirrorSection=e.target.closest('[data-mirror-section]')
 if(mirrorSection){state.tab=mirrorSection.dataset.mirrorSection;render();return}
 const criteriaSection=e.target.closest('[data-criteria-section]')
 if(criteriaSection){capture();state.tab=criteriaSection.dataset.criteriaSection;render();return}
 const companiesToggle=e.target.closest('[data-bank-companies]')
 if(companiesToggle){
  const index=Number(companiesToggle.dataset.bankCompanies)
  const expanded=!expandedBankSearches.has(index)
  if(expanded)expandedBankSearches.add(index);else expandedBankSearches.delete(index)
  companiesToggle.setAttribute('aria-expanded',String(expanded))
  $('#bank-results-'+index).hidden=!expanded
  return
 }
 const bankFilters=e.target.closest('[data-bank-filters]')
 if(bankFilters){state.queryId=Number(bankFilters.dataset.bankFilters);bankReturnFocus=bankFilters;changePanel('filtrosBusca',false);return}
 const bankCompany=e.target.closest('[data-bank-company]')
 if(bankCompany){
  const [queryIndex,companyIndex]=bankCompany.dataset.bankCompany.split(':').map(Number)
  state.queryId=queryIndex;state.bankCompanyName=savedSearches[queryIndex].companies[companyIndex]
  bankReturnFocus=bankCompany;changePanel('empresa',false);return
 }
 const pageTab=e.target.closest('[data-bank-page]')
 if(pageTab){const apply=()=>{state.bankPage=pageTab.dataset.bankPage;state.panel=null;state.stack=[];$('#background').innerHTML=bankPageMarkup();render();$('#background').querySelector('[aria-selected=true]')?.focus()};if(state.dirty)ask('descarte',apply);else apply();return}
 const bankSection=e.target.closest('[data-bank-section]')
 if(bankSection){state.bankSection=bankSection.dataset.bankSection;render();return}
 const tab=e.target.closest('[data-tab]')
 if(tab){if(structuredNegotiationActive()){changeStructureSection(tab.dataset.tab)}else{capture();state.tab=tab.dataset.tab;render()}$('#tabs').querySelector('[aria-selected=true]')?.focus();return}
 const returnSection=e.target.closest('[data-return-section]')
 if(returnSection){if(returnSection.dataset.returnSection==='dados')changePanel('empresa');else{state.returnSection=returnSection.dataset.returnSection;render()}return}
 const companySection=e.target.closest('[data-company-section]')
 if(companySection){state.companySection=companySection.dataset.companySection;render();return}
 const structureSection=e.target.closest('[data-structure-section]')
 if(structureSection){changeStructureSection(state.tab===structureSection.dataset.structureSection?'none':structureSection.dataset.structureSection);return}
 const structureMenu=e.target.closest('[data-structure-menu]')
 if(structureMenu){changeStructureSection(structureMenu.dataset.structureMenu,true);return}
 const filter=e.target.closest('[data-filter]')
 if(filter){
  state.historyFilter=filter.dataset.filter
  if(walletActive()&&state.walletPageOpen&&!state.panel){renderWalletPage();$('#background').querySelector('[data-filter="'+state.historyFilter+'"]')?.focus({preventScroll:true})}
  else render()
  return
 }
 const control=e.target.closest('[data-action]');if(!control||control.disabled)return
 const action=control.dataset.action
 if(stateStudy&&action.startsWith('state:')){
  if(action==='state:retry'){state.readState='normal';render();return}
  if(action==='state:all'){state.readState='normal';state.clientSection='historico';state.historyFilter='todos';render();return}
  if(action==='state:verify'){state.readState='verificando';render();return}
  if(action==='state:resume'){state.panel='venda';state.stack=[];state.readState='incerto';render();return}
 }
 if(action==='ampliarMidia'&&state.panel==='midia'){
  mediaReadScroll=$('#panel-body').scrollTop;mediaExpanded=true;render()
  $('#panel-body').scrollTop=0;$('#panel-body').scrollLeft=0;return
 }
 if(['empresa','retorno','negociacao','venda','arquivo','criterios','espelho','historicoBuscas','resultadoBusca','usuario','credencial','lista','midia','historico','clienteAtendimento'].includes(action)){
  if(action==='midia')mediaReturnFocus=control
  if(walletActive()&&!state.panel){walletReturnFocus=control;walletPageHistoryFilter=state.historyFilter}
  changePanel(action);return
 }
 if(walletActive()&&state.panel==='clienteAtendimento'&&action==='salvarAtendimento'){
  capture();state.dirty=false;delete state.drafts['clienteAtendimento:passo'];closePanel();toast('Simulação concluída. Nenhum atendimento foi registrado.');return
 }
 if(structuredNegotiationActive()&&action==='structure:editar'){capture();state.structureEditing=true;render();return}
 if(structuredNegotiationActive()&&action==='cancelar'){structureBack();return}
 if(structuredNegotiationActive()&&action==='salvarAtendimento'){state.dirty=false;state.structureEditing=false;delete state.drafts[state.panel+':'+state.tab];render();toast('Simulação concluída. Nenhum registro foi gravado.');return}
 if(action.startsWith('busca:')){state.queryId=Number(action.split(':')[1]);changePanel('resultadoBusca');return}
 if(action.startsWith('confirm:')){ask(action.split(':')[1]);return}
 if(action==='cancelar'||action==='concluir'){closePanel();return}
 if(action==='expandir'){const details=Array.from((walletActive()&&state.walletPageOpen&&!state.panel?$('#wallet-page-content'):$('#panel-body')).querySelectorAll('details'));const open=details.some(d=>!d.open);details.forEach(d=>{d.open=open});control.textContent=open?'Recolher todos':'Expandir todos';return}
 if(action==='tentar'){state.readState='normal';render();return}
 if(action==='conferirVenda'){if($('#edit-form')?.reportValidity())ask('venda');return}
 if(action==='criarUsuario'){if(!$('#edit-form')?.reportValidity())return;state.dirty=false;changePanel('credencial');return}
 if(action==='devolver'){toast('Simulação: a empresa voltaria ao Primeiro contato, sem restaurar retornos antigos.');return}
 if(action==='buscaSimulada'){toast('Simulação visual. Nenhuma busca foi enviada.');return}
 if(action==='verArquivo'){toast('Destino previsto: Prospecção → Localizar empresas → Sem interesse. Filtros e página são preservados.');return}
 if(action==='copiarSenha'){toast('Cópia simulada. Nenhuma senha real foi criada ou copiada.');return}
 if(action==='pagina'){toast('Prévia: a paginação deve preservar busca e filtros ao abrir e voltar de um detalhe.');return}
 if(action==='recuperar'){toast('Simulação: conferir o mesmo envio anterior, sem gerar outro comando.');return}
 if(action==='avancar'){toast('Simulação: avançaria a negociação para Proposta enviada.');return}
 if(action==='aplicarCriterios'){
  capture();state.dirty=false
  if(criteriaStructureActive()){
   criteriaBaseline=structuredClone(Object.fromEntries(Object.entries(state.drafts).filter(([key])=>key.startsWith('criterios:'))))
   closePanel()
  }
  toast('Simulação: critérios aplicados ao rascunho do dia. O planejamento ainda precisa ser salvo.');return
 }
 if(action==='espelhar'&&mirrorStructureActive()){
  if(!mirrorDraft.campos.length||!mirrorDraft.dias.length){mirrorError='Escolha pelo menos um campo e um dia de destino.';render();return}
  state.dirty=false;mirrorSent=true;mirrorError='';render();return
 }
 if(action==='salvarLista'&& !$('#edit-form')?.reportValidity())return
 if(['salvarLista','salvarAtendimento','espelhar'].includes(action)){state.dirty=false;toast('Simulação concluída. Nenhum registro foi gravado.')}
})
function card(name,action,label='Abrir retorno'){
 return '<article class="company-card"><h2>'+name+'</h2><p>Mooca · São Paulo/SP</p><p class="task">Apresentar as opções de câmeras</p><p>Hoje · 05/11/2026</p><div class="card-actions">'+btn('Dados da empresa','empresa')+btn(label,action)+'</div></article>'
}
const isManager=['gestor','whatsapp','usuarios'].includes(area)
$('#role-label').textContent=isManager?'Administração':'Área comercial'
$('#persona').textContent=isManager?'Gestor de exemplo':'Vendedor de exemplo'
$('#navigation').innerHTML=(isManager?['Gestão','Empresas','Listas','Usuários','WhatsApp']:['Meu dia','Prospecção','Funil','Carteira']).map(n=>'<span class="'+(n===(area==='banco'?'Prospecção':names[area]||'Meu dia')?'active':'')+'">'+n+'</span>').join('')
$('#breadcrumb').textContent=area==='banco'?'CRM / Prospecção / Banco de empresas':'CRM / '+(names[area]||'Meu dia')
let base='<h1>'+(names[area]||'Meu dia')+'</h1><p class="intro">Prévia com dados fictícios. Escolha um conteúdo para abrir.</p>'
if(profileActive()){
 base=profilePageMarkup()
}else if(adminActive()){
 base=adminPageMarkup()
}else if(walletActive()){
 base=walletPageMarkup()
}else if(area==='banco'){
 base=bankPageMarkup()
}else if(area==='funil'||area==='confirmacoes'){
 base='<h1>Funil comercial</h1><p class="intro">Acompanhe suas negociações até a primeira venda.</p><div style="margin:18px 0">'+btn('Sem interesse','arquivo')+'</div><div class="board">'+['Primeiro contato','Em negociação','Proposta enviada'].map((n,i)=>'<section class="column"><h2>'+n+'<span>'+(i===1?1:0)+'</span></h2>'+(i===1?card(company,'negociacao','Negociação'):'<div class="empty">Sem negociações nesta etapa.</div>')+'</section>').join('')+'</div>'
}else if(area==='dia'||area==='estados'){
 base='<h1>Meu dia</h1><p class="intro">Retornos atrasados, de hoje e próximos.</p><div class="compact-group" role="group" aria-label="Filtrar retornos">'+['Todos','Atrasos','Hoje','Próximos'].map(n=>'<button class="outline" type="button" data-action="filtro">'+n+'</button>').join('')+'</div><div class="card-list">'+card(company,'retorno')+card('Casa Ipê Materiais Elétricos','retorno')+'</div><p class="no-selection">Nenhum retorno selecionado</p>'
}else{
 const launches=area==='prospeccao'?[['Banco de empresas','Busque empresas e consulte suas pesquisas.','historicoBuscas','Ver histórico de buscas'],['Google','Planeje os próximos dias de prospecção.','criterios','Critérios de busca'],['Planejamento','Reaproveite um dia salvo.','espelho','Espelhar um dia']]:area==='gestor'?[['Empresa de exemplo','Consulte os dados salvos.','empresa','Ver empresa'],['Acessos da equipe','Administre somente as ações permitidas.','usuario','Novo usuário'],['Listas','Listas existentes permanecem disponíveis.','lista','Renomear']]:area==='whatsapp'?[['Conversa selecionada','Imagem fictícia recebida na conversa.','midia','Ampliar imagem']]:[['Ficha do cliente','A ficha completa mantém sua rota.','venda','Registrar venda'],['Histórico comercial','Linha do tempo expansível.','historico','Ver histórico']]
 base+='<div class="launchers">'+launches.map(([title,description,id,label])=>'<section class="background-card"><h2>'+title+'</h2><p>'+description+'</p>'+btn(label,id)+'</section>').join('')+'</div>'
}
if(stateStudy&&params.get('state')==='incerto')base='<h1>Funil comercial</h1><p class="intro">Prévia com dados fictícios.</p><section class="background-card"><h2>Verificação de venda pendente</h2><p>'+esc(studySale.empresa)+'</p><p>Os dados enviados continuam disponíveis para conferência.</p>'+btn('Reabrir verificação','state:resume')+'</section>'
$('#background').innerHTML=base
if(profileActive())$('#breadcrumb').textContent='CRM / Usuários / Perfil do vendedor'
const initial=params.get('panel')||'retorno'
if(initial!=='nenhum'){
 state.panel=initial;state.tab=params.get('tab')||'passo'
 if(dailyStructureActive()&&state.tab==='historico')state.returnSection='historico'
 if(structuredNegotiationActive()&&layoutVariant==='menu'&&state.tab!=='passo'){
  state.structureMenu='conteudo'
  if(state.tab==='atendimento'){state.tab='passo';state.structureEditing=true}
 }
 render()
}
if(confirmationDemo){
 if(state.panel==='venda'){
  $('[name=valor]').value='1.250,00';$('[name=data]').value='2026-11-06'
  $('#panel-footer [data-action="conferirVenda"]')?.focus()
 }else if(params.get('confirm')==='descarte'){
  $('[name=anotacao]').value='Cliente pediu as opções de câmeras para a loja.'
  state.dirty=true;capture();$('#back').focus()
 }else $('#panel-footer [data-action="confirm:arquivo"]')?.focus()
}
if(params.get('confirm'))ask(params.get('confirm'),confirmationDemo&&params.get('confirm')==='descarte'?()=>{state.structureEditing=false;render()}:undefined)

if(stateStudy&&params.get('state')==='alterado'){$('[name=anotacao]').value='Cliente pediu as opções de câmeras para a loja.';state.dirty=true;capture();$('#panel-body').insertAdjacentHTML('afterbegin',studyNotice('neutral','Alterações não salvas','Salve o atendimento para concluir a edição.'))}
