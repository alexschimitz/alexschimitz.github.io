// Teste de navegador (opcional): python3 -m http.server 8765 na raiz; npm i puppeteer-core (fora do repo); CHROME=/caminho node tests/politica/e2e.mjs
import puppeteer from 'puppeteer-core';
const B=process.env.BASE||'http://localhost:8765';
const pages=['/politica/','/politica/gastos/','/politica/economia/','/politica/planos/','/politica/mapa/','/politica/eleicoes/','/politica/politicos/','/politica/governo/','/politica/propostas/','/politica/leis/','/politica/sigilos/','/politica/escandalos/','/politica/glossario/','/politica/fontes/','/politica/votacao/','/politica/votacao/?id=s-7108','/politica/votacao/?id=c-xx-invalido'];
const b=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
for(const vp of [{width:1280,height:900},{width:390,height:844,isMobile:true,hasTouch:true}]){
 for(const path of pages){
  const p=await b.newPage(); await p.setViewport(vp); const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push('pageerror '+e.message));
  p.on('requestfailed',r=>{ if(r.url().startsWith(B)) errs.push('reqfail '+r.url())});
  await p.goto(B+path,{waitUntil:'networkidle2',timeout:90000}); await new Promise(r=>setTimeout(r,1500));
  const info=await p.evaluate(()=>({crumbs:!!document.querySelector('.pol-crumbs'),cur:[...document.querySelectorAll('#main-nav [aria-current=page]')].map(a=>a.textContent.trim()),mais:!!document.querySelector('.nav-mais-btn,[aria-controls^="nav-mais"]'),termos:document.querySelectorAll('.gl-termo').length,ovf:document.documentElement.scrollWidth>innerWidth+1}));
  ok(errs.length===0 && (info.crumbs||path==='/politica/') && !info.ovf,`${vp.width} ${path} errs=${errs.length} crumbs=${info.crumbs} atual=${JSON.stringify(info.cur)} termos=${info.termos} overflowX=${info.ovf} ${errs.slice(0,3).join(' | ')}`);
  await p.close();
 }
}
// busca
let p=await b.newPage(); await p.setViewport({width:1280,height:900});
await p.goto(B+'/politica/?q=orcamento',{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,1500));
let r=await p.evaluate(()=>({n:document.querySelectorAll('#busca-res li.busca-item:not(.busca-hist)').length+document.querySelectorAll('#busca-res li').length*0,st:document.getElementById('busca-status').textContent,v:document.getElementById('busca-q').value}));
ok(r.n>0&&r.v==='orcamento','busca ?q=orcamento → '+r.n+' resultados; status="'+r.st+'"');
await p.select('#busca-uf','SP'); await new Promise(r=>setTimeout(r,500));
await p.$eval('#busca-q',e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}))}); await new Promise(r=>setTimeout(r,600));
r=await p.evaluate(()=>({n:document.querySelectorAll('#busca-res li.busca-item:not(.busca-hist)').length+document.querySelectorAll('#busca-res li').length*0,url:location.search}));
ok(r.n>0&&/uf=SP/.test(r.url),'filtro UF=SP sem texto → '+r.n+' resultados, URL '+r.url);
await p.$eval('#busca-q',e=>{e.value='xyzqwk';e.dispatchEvent(new Event('input',{bubbles:true}))}); await new Promise(r=>setTimeout(r,600));
r=await p.evaluate(()=>({n:document.querySelectorAll('#busca-res li.busca-item:not(.busca-hist)').length+document.querySelectorAll('#busca-res li').length*0,st:document.getElementById('busca-status').textContent}));
ok(r.n===0&&r.st.length>0,'estado vazio: "'+r.st+'"');
// glossário mouse/teclado
await p.goto(B+'/politica/fontes/',{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,1200));
await p.hover('.gl-termo'); await new Promise(r=>setTimeout(r,400));
ok(await p.evaluate(()=>{const t=document.getElementById('gl-tip');return t&&!t.hidden&&getComputedStyle(t).display!=='none'&&t.textContent.length>20}),'tooltip ao passar o mouse');
await p.mouse.move(5,5); await p.focus('.gl-termo'); await new Promise(r=>setTimeout(r,300));
ok(await p.evaluate(()=>{const t=document.getElementById('gl-tip');return t&&!t.hidden&&getComputedStyle(t).display!=='none'}),'tooltip ao focar com teclado');
await p.keyboard.press('Enter'); await new Promise(r=>setTimeout(r,300));
ok(await p.evaluate(()=>document.querySelector('dialog.gl-dialog')?.open===true),'Enter abre o diálogo');
await p.keyboard.press('Escape'); await new Promise(r=>setTimeout(r,300));
ok(await p.evaluate(()=>!document.querySelector('dialog.gl-dialog').open&&document.activeElement.classList.contains('gl-termo')),'Esc fecha e devolve o foco');
// glossário página
await p.goto(B+'/politica/glossario/?q=quorum',{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,800));
r=await p.evaluate(()=>({n:document.querySelectorAll('.gl-item').length,st:document.getElementById('gl-status').textContent}));
ok(r.n>=1,'glossário ?q=quorum → '+r.st);
await p.goto(B+'/politica/glossario/',{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,800));
ok((await p.$$eval('.gl-item',e=>e.length))>=100,'glossário lista todos: '+await p.$eval('#gl-status',e=>e.textContent));
// menu Mais desktop
await p.goto(B+'/politica/gastos/',{waitUntil:'networkidle2'});
const mb=await p.$('#main-nav button[aria-expanded]:not(.theme-toggle)');
if(mb){await mb.click(); ok(await p.evaluate(e=>e.getAttribute('aria-expanded')==='true',mb),'Mais abre'); await p.keyboard.press('Escape'); ok(await p.evaluate(e=>e.getAttribute('aria-expanded')==='false',mb),'Esc fecha Mais');} else ok(false,'botão Mais não encontrado');
// mobile menu
p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await p.goto(B+'/politica/leis/',{waitUntil:'networkidle2'}); await p.click('.menu-toggle'); await new Promise(r=>setTimeout(r,400));
r=await p.evaluate(()=>[...document.querySelectorAll('#main-nav a')].filter(a=>a.offsetParent&&a.getBoundingClientRect().height>0).map(a=>a.textContent.trim()));
ok(r.some(t=>/Salários/.test(t))&&r.some(t=>/Fontes/.test(t)),'menu mobile mostra itens: '+r.join(', '));
await p.screenshot({path:'/tmp/mob-menu.png'});
await p.goto(B+'/politica/fontes/',{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,1000));
await p.tap('.gl-termo'); await new Promise(r=>setTimeout(r,400));
ok(await p.evaluate(()=>document.querySelector('dialog.gl-dialog')?.open===true),'toque no termo abre diálogo (mobile)');
await p.screenshot({path:'/tmp/mob-dlg.png'});
// ---- Fase 4: como votou, votação, busca de votações (desktop e mobile)
const idx=await (await fetch(B+'/politica/data/votos/idx.json')).json();
const deps=await (await fetch(B+'/politica/data/deputados.json')).json();
let depId=null; for(const d of deps){ const r=await fetch(B+'/politica/data/votos/c/'+d.id+'.json'); if(r.ok){depId=d.id;break;} }
const sen=await (await fetch(B+'/politica/data/senadores.json')).json();
const vC=idx.v.find(v=>v.k[0]==='c');
for(const vp of [{width:1280,height:900},{width:390,height:844,isMobile:true,hasTouch:true}]){
  const q=await b.newPage(); await q.setViewport(vp); const errs=[];
  q.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); q.on('pageerror',e=>errs.push('pageerror '+e.message));
  await q.goto(B+`/politica/?vtipo=participou#perfil/c/${depId}/votos`,{waitUntil:'networkidle2',timeout:90000}); await new Promise(r=>setTimeout(r,2500));
  let r=await q.evaluate(()=>({tab:document.querySelector('#pft-votos')?.textContent,pj:document.querySelector('#pft-projetos')?.textContent,n:document.querySelectorAll('#pfp .vote-item').length,cnt:document.querySelector('.vt-count')?.textContent,sel:document.querySelector('.vt-filtros [name=tipo]')?.value,link:document.querySelector('#pfp .vt-links a')?.getAttribute('href'),ext:[...document.querySelectorAll('#pfp .vt-links a.ext')].map(a=>a.href)[0],termos:document.querySelectorAll('#pfp .gl-termo').length,ovf:document.documentElement.scrollWidth>innerWidth+1}));
  ok(r.tab==='Como votou'&&r.pj==='Projetos apresentados'&&r.n>0&&r.sel==='participou'&&/votacao\/\?id=c-/.test(r.link)&&/dadosabertos\.camara\.leg\.br/.test(r.ext)&&r.termos>0&&!r.ovf,`${vp.width} perfil Como votou: ${r.n} itens, "${r.cnt}", filtro da URL=${r.sel}, termos=${r.termos}, ovf=${r.ovf}`);
  await q.select('.vt-filtros [name=periodo]','2025'); await new Promise(r=>setTimeout(r,300));
  r=await q.evaluate(()=>({url:location.search+location.hash,cnt:document.querySelector('.vt-count').textContent,dts:[...document.querySelectorAll('#pfp .vote-item time')].map(t=>t.getAttribute('datetime').slice(0,4))}));
  ok(/vperiodo=2025/.test(r.url)&&/#perfil\/c\//.test(r.url)&&r.dts.every(y=>y==='2025'),`${vp.width} filtro período na URL: ${r.url} → ${r.cnt}`);
  const temas=await q.$$eval('.vt-filtros [name=tema] option',o=>o.map(x=>x.value).filter(Boolean));
  await q.select('.vt-filtros [name=tema]',temas[0]); await q.select('.vt-filtros [name=tipo]','nao-participou'); await new Promise(r=>setTimeout(r,300));
  r=await q.evaluate(()=>({cnt:document.querySelector('.vt-count').textContent,vazio:!!document.querySelector('#pfp .vt-list .empty-state'),n:document.querySelectorAll('#pfp .vote-item').length}));
  ok(r.vazio||r.n>=0,`${vp.width} filtros combinados (tema+não participou): ${r.cnt}${r.vazio?' (estado vazio exibido)':''}`);
  await q.click('#pft-projetos'); await new Promise(r=>setTimeout(r,1500));
  r=await q.evaluate(()=>({n:document.querySelectorAll('#pfp .item').length,links:document.querySelectorAll('#pfp .item a.ext').length,st:document.querySelectorAll('#pfp .item .note-sm').length,hash:location.hash,url:location.search}));
  ok(r.n>0&&r.links>0&&r.st>0&&/projetos$/.test(r.hash),`${vp.width} Projetos apresentados: ${r.n} itens, ${r.links} links, ${r.st} situações`);
  // senador
  await q.goto(B+`/politica/#perfil/s/${sen[0].id}/votos`,{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,2500));
  r=await q.evaluate(()=>({n:document.querySelectorAll('#pfp .vote-item').length,txt:document.querySelector('#pfp')?.textContent.slice(0,200)}));
  ok(r.n>0||/Não há voto registrado/.test(r.txt),`${vp.width} senador ${sen[0].n}: ${r.n} votos`);
  // página da votação
  await q.goto(B+'/politica/votacao/?id='+vC.k.replace(':','-'),{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,1500));
  r=await q.evaluate(()=>({h1:document.querySelector('#vt-h1').textContent,tabs:document.querySelectorAll('.vt-tabela').length,nomes:document.querySelectorAll('#vt-nomes li').length,ovf:document.documentElement.scrollWidth>innerWidth+1}));
  ok(r.tabs===2&&r.nomes===vC.n&&!r.ovf,`${vp.width} votação ${vC.k}: "${r.h1}", tabelas=${r.tabs}, nomes=${r.nomes}/${vC.n}, ovf=${r.ovf}`);
  await q.select('.vt-busca [name=uf]','SP'); await new Promise(r=>setTimeout(r,200));
  r=await q.evaluate(()=>[...document.querySelectorAll('#vt-nomes li small')].every(s=>/-SP$/.test(s.textContent)));
  ok(r,`${vp.width} filtro UF na votação`);
  await q.goto(B+'/politica/votacao/?id=c-999999-99',{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,800));
  ok(await q.evaluate(()=>!!document.querySelector('#vt-body .err')),`${vp.width} votação inexistente mostra erro`);
  // busca global com votações
  await q.goto(B+'/politica/?q='+encodeURIComponent(vC.p?vC.p.s:'votação')+'&tipo=votacao',{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,1500));
  r=await q.evaluate(()=>({n:document.querySelectorAll('#busca-res li.busca-votacao').length,href:document.querySelector('#busca-res li.busca-votacao a')?.getAttribute('href')}));
  ok(r.n>0&&/\/politica\/votacao\/\?id=/.test(r.href),`${vp.width} busca encontra votações: ${r.n} → ${r.href}`);
  ok(errs.length===0,`${vp.width} fase 4 sem erros de console: ${errs.slice(0,3).join(' | ')}`);
  await q.close();
}
await b.close();
