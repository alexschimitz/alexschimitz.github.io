// Teste de navegador (opcional): python3 -m http.server 8765 na raiz; npm i puppeteer-core (fora do repo); CHROME=/caminho node tests/politica/e2e.mjs
import puppeteer from 'puppeteer-core';
const B=process.env.BASE||'http://localhost:8765';
const pages=['/politica/','/politica/gastos/','/politica/economia/','/politica/planos/','/politica/mapa/','/politica/eleicoes/','/politica/politicos/','/politica/governo/','/politica/propostas/','/politica/leis/','/politica/sigilos/','/politica/escandalos/','/politica/glossario/','/politica/fontes/'];
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
await b.close();
