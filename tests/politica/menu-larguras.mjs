import puppeteer from 'puppeteer-core';
const tag=process.argv[2];
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();let bad=0;
for(const font of [0,1])for(const w of [761,800,900,1024,1101,1121,1229,1280,1366,1440,1536,1920])for(const u of ['/politica/leis/','/politica/','/politica/votacao/']){
await p.setViewport({width:w,height:300});
await p.goto('http://localhost:8765'+u,{waitUntil:'networkidle2'});
if(font) await p.addStyleTag({content:'*{font-family:"DejaVu Sans",Verdana,sans-serif!important}'});
await p.evaluate(()=>document.fonts.ready); await new Promise(r=>setTimeout(r,250));
const r=await p.evaluate(()=>{const n=document.getElementById('main-nav'),w=document.querySelector('.nav-wrap').getBoundingClientRect(),br=document.querySelector('.brand').getBoundingClientRect();const o=[];
 const kids=[...n.children].filter(e=>e.offsetParent);const f=kids[0].getBoundingClientRect(),l=kids[kids.length-1].getBoundingClientRect();
 if(f.left<br.right+8)o.push('overlap brand');if(l.right>w.right+1)o.push('past right '+(l.right-w.right|0));
 for(const e of kids){const r=e.getBoundingClientRect();if(r.height>48)o.push('tall '+e.textContent.trim())}
 const bn=document.querySelector('.brand-name');if(bn&&bn.offsetParent&&bn.getBoundingClientRect().height>30)o.push('brand wraps');
 return o.join(',')});
if(r){bad++;console.log(font,w,u,r)}
if(tag&&u==='/politica/leis/'&&(w===1366||w===1229||w===1024))await p.screenshot({path:`/workspace/menu-${tag}-${w}${font?'-fallbackfont':''}.png`,clip:{x:0,y:0,width:w,height:90}});
}
console.log('bad',bad);await b.close();
