const nav=document.querySelector('#areas'),list=document.querySelector('#scenarios'),frame=document.querySelector('#preview')
let area=new URLSearchParams(location.search).get('area')||'revisao-final',selected=''
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
function loadScenario(id){const a=CRM_CATALOGUE.find(a=>a.id===area),s=a.scenes.find(s=>s.id===id)||a.scenes[0];selected=s.id;document.querySelectorAll('.scenario').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===selected)));document.querySelector('#previewTitle').textContent=s.title;document.querySelector('#previewNote').textContent=s.note||'Conteúdo aprovado · estrutura em revisão';const q=new URLSearchParams({area:s.context||area,panel:s.panel||s.id,theme:document.querySelector('#theme').value});if(s.mobilePanel)q.set('mobile-panel',s.mobilePanel);if(s.panelSize)q.set('panel-size',s.panelSize);if(s.stateStudy)q.set('state-study','1');if(s.confirmationLayout)q.set('confirmation-layout',s.confirmationLayout);if(s.confirmationDemo)q.set('confirmation-demo','1');if(s.mediaLayout)q.set('media',s.mediaLayout);if(s.mediaCaption)q.set('media-caption',s.mediaCaption);if(s.profileVolume)q.set('profile-volume',String(s.profileVolume));if(s.profileLayout)q.set('profile',s.profileLayout);if(s.adminLayout)q.set('admin',s.adminLayout);if(s.walletLayout)q.set('wallet',s.walletLayout);if(s.walletOpen)q.set('wallet-open','1');if(s.mirrorLayout)q.set('mirror',s.mirrorLayout);if(s.criteriaLayout)q.set('criteria',s.criteriaLayout);if(s.bankLayout)q.set('bank',s.bankLayout);if(s.bankTab)q.set('bank-tab',s.bankTab);if(s.dailyLayout)q.set('daily',s.dailyLayout);if(s.companyGrouping)q.set('company',s.companyGrouping);if(s.actions)q.set('actions',s.actions);if(s.layout)q.set('layout',s.layout);if(s.state)q.set('state',s.state);if(s.tab)q.set('tab',s.tab);if(s.confirm)q.set('confirm',s.confirm);frame.src='mockup.html?'+q.toString();document.querySelector('#openPreview').href=frame.src;history.replaceState(null,'','?area='+area+'&view='+selected)}
function renderArea(id){area=CRM_CATALOGUE.some(a=>a.id===id)?id:'dia';document.body.classList.toggle('review-mode',area==='revisao-final');const a=CRM_CATALOGUE.find(a=>a.id===area);if(a.defaultDevice){document.querySelector('#device').value=a.defaultDevice;document.querySelector('.frame-wrap').classList.toggle('mobile',a.defaultDevice==='mobile')}document.querySelector('#areaTitle').textContent=a.title;document.querySelector('#areaState').textContent=a.badge||(area==='estrutura'?'Menu escolhido':area==='botoes'?'Rodapé escolhido':'Conteúdo aprovado');document.querySelector('#areaDescription').textContent=a.description;const ruleBox=document.querySelector('.principles');ruleBox.innerHTML='<h3>'+esc(a.ruleTitle||'O padrão comum')+'</h3>'+(a.rules||['Várias seções usam menu interno; tarefas curtas abrem direto. Cabeçalho e rodapé seguem o mesmo padrão. Voltar recupera o conteúdo anterior.','Confirmações curtas no centro. Formulários e consultas na lateral. Sem resumo duplicado.','As ações deste arquivo são simulações.']).map(rule=>'<p>'+esc(rule)+'</p>').join('');nav.innerHTML=CRM_CATALOGUE.map(a=>'<button data-area="'+a.id+'" aria-pressed="'+(a.id===area)+'">'+esc(a.title)+'</button>').join('');list.innerHTML=a.scenes.map(s=>'<button class="scenario" data-id="'+s.id+'" aria-pressed="false"><strong>'+esc(s.title)+'</strong><span>'+esc(s.description)+'</span><small>'+esc(s.status||'Conteúdo aprovado · estrutura a validar')+'</small></button>').join('');loadScenario(a.defaultScene||a.scenes[0].id)}
nav.addEventListener('click',e=>{const b=e.target.closest('[data-area]');if(b)renderArea(b.dataset.area)})
list.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)loadScenario(b.dataset.id)})
document.querySelector('#device').addEventListener('change',e=>document.querySelector('.frame-wrap').classList.toggle('mobile',e.target.value==='mobile'))
document.querySelector('#theme').addEventListener('change',()=>loadScenario(selected))
const initialView=new URLSearchParams(location.search).get('view');renderArea(area);if(initialView&&CRM_CATALOGUE.find(a=>a.id===area).scenes.some(s=>s.id===initialView))loadScenario(initialView)

function fitPreview(){
 const host=document.querySelector('.frame-wrap')
 const mobile=document.querySelector('#device').value==='mobile'
 const notebook=document.querySelector('#device').value==='notebook'
 const width=mobile?390:notebook?1024:1280,height=mobile?844:notebook?768:900
 const scale=Math.min(1,Math.max(0.1,(host.clientWidth-2)/width))
 frame.style.width=width+'px';frame.style.minWidth=width+'px';frame.style.height=height+'px'
 frame.style.transform='scale('+scale+')';frame.style.transformOrigin='top left'
 frame.style.position='absolute';frame.style.top='0';frame.style.left=Math.max(0,(host.clientWidth-width*scale)/2)+'px'
 host.style.height=(height*scale+4)+'px'
 const link=document.querySelector('#openPreview');if(link)link.href=frame.src
}
new ResizeObserver(fitPreview).observe(document.querySelector('.frame-wrap'))
document.querySelector('#device').addEventListener('change',fitPreview)
frame.addEventListener('load',fitPreview)
fitPreview()
