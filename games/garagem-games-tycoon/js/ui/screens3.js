// Telas de Redes Sociais e Imprensa (v0.3).
import * as D from '../data.js';
import * as C from '../catalog.js';
import * as SO from '../social.js';
import * as PR from '../press.js';
import * as LE from '../lifeevents.js';
import { money, num, numShort, dateStr } from '../util.js';
import { sfx } from '../audio.js';
import { h, modal, toast, sparkline, barChart, pairChart } from './dom.js';
import { G } from './ctrl.js';

const s = () => G.s;
const say = (err, ok) => { if (err) { toast(err[0].toUpperCase() + err.slice(1), 'ruim'); sfx.bad(); return false; } if (ok) toast(ok, 'bom'); sfx.coin(); G.refresh(); return true; };
const bar = (pct, cls = '') => h('div', { class: 'bar ' + cls }, h('i', { style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));
const kv = (k, v, cls) => h('div', { class: 'kv' }, h('span', {}, k), h('b', { class: cls || '' }, v));
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// =====================================================================
// REDES
// =====================================================================
export function openSocial(tab = 'postar', net = 'tuiter') {
  const body = h('div', {});
  const m = modal({ title: 'Redes Sociais', color: '#1d9bf0', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const st = s(); const soc = SO.ensureSoc(st);
    const unread = soc.inbox.filter((x) => x.status === 'novo').length;
    const tabs = h('div', { class: 'tabs' }, [['postar', 'Postar'], ['caixa', `Caixa${unread ? ' (' + unread + ')' : ''}`], ['discord', 'Discorde'], ['infl', 'Influenc.'], ['ads', 'Anúncios'], ['met', 'Métricas']]
      .map(([id, l]) => h('button', { class: tab === id ? 'on' : '', onclick: () => { tab = id; render(); } }, l)));
    const head = h('div', { class: 'hrs' }, h('div', { class: 'row small' }, h('b', {}, `Horas da semana: ${soc.hours.toFixed(1)}/${SO.WEEK_HOURS}`), h('span', { class: 'sp' }), h('span', {}, `Energia: ${Math.round(st.employees[0].energy)}%`)),
      bar(soc.hours / SO.WEEK_HOURS * 100, soc.hours > 28 ? 'r' : soc.hours > 18 ? 'o' : 'b'),
      h('div', { class: 'small muted' }, `Tempo em redes é tempo fora do código: seu ritmo de desenvolvimento cai ${Math.round((1 - SO.founderTimeMult(st)) * 100)}% esta semana.`));
    const c = h('div', { class: 'col' });
    if (soc.crisis) c.append(h('div', { class: 'warn', onclick: () => { m.close(); openCrisis(); } }, `⚠️ Crise: ${soc.crisis.nome}${soc.crisis.pending ? ' — responda agora!' : ' (em andamento)'} · toque para abrir`));
    if (tab === 'postar') {
      c.append(h('div', { class: 'netrow' }, C.NETWORKS.map((n) => {
        const ns = soc.nets[n.id];
        return h('button', { class: 'netb' + (net === n.id ? ' on' : ''), style: { borderColor: net === n.id ? n.cor : '' }, onclick: () => { net = n.id; render(); } },
          h('span', { class: 'ni' }, n.ico), h('span', { class: 'nn' }, n.nome), h('span', { class: 'nf' }, n.id === 'discorde' ? numShort(soc.discord.members) : numShort(ns.fol)));
      })));
      const nd = SO.NET_BY_ID[net];
      c.append(h('div', { class: 'small muted' }, nd.desc));
      for (const def of SO.POSTS.filter((x) => x.net === net)) {
        const blk = SO.postBlock(st, def);
        c.append(h('div', { class: 'li' + (blk ? ' dim' : '') }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, def.nome), h('div', { class: 'small muted' }, `${def.desc} · ${def.h}h · energia −${def.en}${def.custo ? ' · ' + money(def.custo * (1 + 0.06 * (st.week / 48))) : ''}`), blk ? h('div', { class: 'small', style: { color: '#9c2b1b' } }, blk) : null),
          h('button', { class: 'btn sm ok', disabled: !!blk, onclick: () => { const r = SO.doPost(st, def.id); if (typeof r === 'string') say(r); else { sfx.coin(); const p = r.post; toast(`${p.viral ? '🔥 VIRALIZOU! ' : ''}${numShort(p.reach)} de alcance · ${p.likes} curtidas · +${Math.round(p.fol)} seguidores`, p.viral ? 'conq' : 'bom'); G.refresh(); render(); } } }, 'Postar')));
      }
      const mine = soc.feed.filter((p) => p.net === net).slice(0, 4);
      c.append(h('h3', {}, 'Seus posts recentes'), mine.length ? mine.map((p) => h('div', { class: 'post' }, h('div', { class: 'small b' }, `${p.nome} · ${dateStr(p.w)}${p.viral ? ' 🔥' : ''}`), h('div', { class: 'small' }, p.txt), h('div', { class: 'small muted' }, `👁 ${numShort(p.reach)} · ❤️ ${numShort(p.likes)} · 🔁 ${numShort(p.shares)} · 💬 ${numShort(p.comments)} · qualidade ${Math.round(p.q * 100)}%`))) : h('div', { class: 'muted small' }, 'Nada postado nesta rede ainda.'));
    } else if (tab === 'caixa') {
      const items = soc.inbox.filter((x) => x.status === 'novo');
      if (!items.length) c.append(h('div', { class: 'muted' }, 'Caixa vazia. Poste algo e as pessoas vão aparecer (fãs, dúvidas… e trolls).'));
      const kindLabel = { fan: '❤️ Fã', duvida: '❓ Dúvida', sugestao: '💡 Sugestão', bug: '🐛 Bug', troll: '👹 Troll', spam: '🗑️ Spam', streamer: '🎮 Streamer', jornalista: '📰 Jornalista' };
      for (const it of items.slice(0, 12)) {
        const dm = it.kind === 'streamer' || it.kind === 'jornalista';
        c.append(h('div', { class: 'li dm' }, h('div', { class: 'grow' }, h('div', { class: 'small b' }, `${kindLabel[it.kind] || it.kind} · @${it.from} · ${SO.NET_BY_ID[it.net]?.nome || ''}`), h('div', { class: 'small' }, it.txt),
          dm ? h('div', { class: 'row wrap' }, h('button', { class: 'btn sm', onclick: () => { m.close(); it.kind === 'streamer' ? openSocial('infl') : openPress('enviar'); } }, it.kind === 'streamer' ? 'Ir para Influenciadores' : 'Ir para Imprensa'), h('button', { class: 'btn sm', onclick: () => { it.status = 'resolvido'; render(); } }, 'Dispensar'))
            : h('div', { class: 'row wrap tones' }, SO.TONES.map(([id, l]) => h('button', { class: 'btn sm', onclick: () => { const r = SO.replyTo(st, it.id, id); if (typeof r === 'string') say(r); else { toast(r.msg); G.refresh(); render(); } } }, l))))));
      }
    } else if (tab === 'discord') {
      const d = soc.discord;
      if (!d.open) c.append(h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, '💬 Abrir servidor do Discorde'), h('div', { class: 'small muted' }, 'Reúne a comunidade, dá feedback rápido e gera fãs leais. Mas exige moderação para não virar bagunça.')), h('button', { class: 'btn sm ok', onclick: () => { if (say(SO.openDiscord(st), 'Servidor aberto!')) render(); } }, 'Abrir')));
      else {
        c.append(kv('Membros', num(d.members)), h('div', { class: 'small b' }, `Toxicidade: ${Math.round(d.tox)}%`), bar(d.tox, d.tox > 60 ? 'r' : d.tox > 35 ? 'o' : ''), kv('Moderadores voluntários', String(d.mods)), kv('Regras fixadas', d.rules ? 'sim' : 'não'), kv('Bot de moderação', d.bot ? 'sim' : 'não'), kv('Banimentos', String(d.bans)));
        c.append(h('div', { class: 'small muted' }, 'Toxicidade alta derruba o humor dos fãs e pode gerar drama público. Moderadores, regras e bot seguram o servidor.'));
        const act = (id, label, desc) => h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, label), h('div', { class: 'small muted' }, desc)), h('button', { class: 'btn sm', onclick: () => { if (say(SO.discordAction(st, id), 'Feito!')) render(); } }, 'Aplicar'));
        c.append(act('regras', 'Fixar regras do servidor', '−12 de toxicidade (uma vez).'), act('mod', 'Recrutar moderador voluntário', 'Um membro fiel assume. Precisa de membros suficientes.'), act('bot', `Instalar bot de moderação (${money(120)})`, 'Filtra palavrões e spam.'), act('limpar', 'Faxina: banir encrenqueiros (2h)', '−15 de toxicidade, perde alguns membros.'));
        c.append(h('div', { class: 'small muted' }, 'Posts no Discorde (aviso, evento, enquete) ficam na aba Postar.'));
      }
    } else if (tab === 'infl') {
      c.append(h('div', { class: 'small muted' }, 'Mande uma chave grátis (a chance depende do tamanho do criador, do gênero e da qualidade do seu jogo) ou pague um patrocínio (garantido, mas menos crível — e o público percebe).'));
      for (const inf of SO.INFLUENCERS) {
        const ch = SO.influencerChance(st, inf); const sent = soc.infl.sent.find((x) => x.id === inf.id && !x.resolved);
        c.append(h('div', { class: 'li' }, h('div', { class: 'ico' }, inf.kind === 'streamer' ? '🎮' : '📺'), h('div', { class: 'grow' }, h('div', { class: 'nm' }, inf.nome), h('div', { class: 'small muted' }, `${numShort(inf.seg)} seguidores · ${inf.estilo} · gosta de ${inf.gosta.map((g) => D.GENRES.find((x) => x.id === g)?.nome).slice(0, 2).join(', ')}`), h('div', { class: 'small' }, sent ? 'Chave enviada… aguardando' : `Chance de cobrir: ${Math.round(ch * 100)}%`)),
          h('div', { class: 'col', style: { gap: '4px' } }, h('button', { class: 'btn sm ok', disabled: !!sent, onclick: () => { if (say(SO.sendKey(st, inf.id, false), 'Chave enviada!')) render(); } }, 'Enviar chave'), h('button', { class: 'btn sm', disabled: !!sent || st.money < SO.sponsorCost(st, inf), onclick: () => { if (say(SO.sendKey(st, inf.id, true), 'Patrocínio fechado!')) render(); } }, `Patrocinar ${money(SO.sponsorCost(st, inf))}`))));
      }
      if (soc.infl.covered.length) c.append(h('h3', {}, 'Coberturas recentes'), soc.infl.covered.map((x) => kv(`${x.nome} · ${x.result}${x.sponsor ? ' (pago)' : ''}`, `${numShort(x.reach)} views · ~${x.wl} wishlists`)));
    } else if (tab === 'ads') {
      c.append(h('div', { class: 'small muted' }, 'Anúncios compram alcance imediato (2 semanas), mas rendem menos seguidores que o orgânico. O custo por wishlist costuma ficar entre R$ 3 e R$ 8.'));
      for (const n of C.NETWORKS.filter((x) => SO.NET[x.id].cpm)) {
        const running = soc.ads.find((a) => a.net === n.id && a.left > 0);
        c.append(h('div', { class: 'li' }, h('div', { class: 'ico' }, n.ico), h('div', { class: 'grow' }, h('div', { class: 'nm' }, n.nome), h('div', { class: 'small muted' }, `~${money(SO.NET[n.id].cpm)} por mil de alcance`), running ? h('div', { class: 'small' }, `Rodando: ${money(running.budget)} · ${running.left} sem.`) : null),
          h('div', { class: 'col', style: { gap: '4px' } }, SO.AD_OPTIONS.map((v) => h('button', { class: 'btn sm', disabled: !!running || st.money < SO.adCost(st, v), onclick: () => { if (say(SO.buyAds(st, n.id, v), 'Anúncio no ar!')) render(); } }, money(SO.adCost(st, v)))))));
      }
      c.append(h('h3', {}, 'Campanhas'));
      for (const cp of SO.CAMPAIGNS) c.append(h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, cp.nome), h('div', { class: 'small muted' }, `${cp.desc} · ${cp.h}h${cp.custo ? ' · ' + money(cp.custo) : ''}`)), h('button', { class: 'btn sm ok', onclick: () => { const r = SO.runCampaign(st, cp.id); if (typeof r === 'string') say(r); else { toast(r.msg, 'bom'); sfx.coin(); G.refresh(); render(); } } }, 'Rodar')));
    } else {
      const total = SO.totalFollowers(st);
      c.append(h('div', { class: 'row' }, h('div', { class: 'big' }, numShort(total)), h('div', { class: 'small muted' }, 'seguidores somados (sem Discorde)')),
        kv('Wishlists / interessados acumulados', num(soc.wl), 'pos'), kv('Reputação nas redes', Math.round(soc.rep) + '/100'), kv('Memes a seu favor', String(soc.memes)), kv('Posts virais', String(soc.totals.viral)));
      c.append(h('h3', {}, 'Seguidores por rede'));
      for (const n of C.NETWORKS) { const ns = soc.nets[n.id]; c.append(h('div', { class: 'row' }, h('span', { style: { width: '24px' } }, n.ico), h('div', { style: { width: '76px' }, class: 'small b' }, n.nome), h('div', { style: { flex: 1, height: '28px' }, html: sparkline(ns.hist.length > 1 ? ns.hist : [0, 0], n.cor) }), h('div', { class: 'small', style: { width: '52px', textAlign: 'right' } }, n.id === 'discorde' ? numShort(soc.discord.members) : numShort(ns.fol)))); }
      c.append(h('h3', {}, 'Alcance: orgânico × anúncios'), kv('Orgânico (total)', numShort(soc.totals.organic)), kv('Pago (total)', numShort(soc.totals.paid)));
      const pct = soc.totals.organic + soc.totals.paid ? soc.totals.paid / (soc.totals.organic + soc.totals.paid) * 100 : 0;
      c.append(bar(pct, 'o'), h('div', { class: 'small muted' }, `${Math.round(pct)}% do alcance veio de anúncios.`));
      if (soc.crisisHist.length) c.append(h('h3', {}, 'Crises passadas'), soc.crisisHist.map((x) => kv(x.nome, `${x.res} · ${dateStr(x.w)}`)));
    }
    body.replaceChildren(head, tabs, c);
  };
  render();
}

// =====================================================================
// CRISE
// =====================================================================
export function openLifeEvent() {
  const st = s(); const cur = LE.current(st); if (!cur) return;
  const body = h('div', { class: 'col' });
  const m = modal({ title: `${cur.ev.ico} ${cur.ev.nome}`, color: '#8a5cc2', body, closable: true, actions: [{ label: 'Decidir depois', fn: () => m.close() }] });
  body.replaceChildren(h('p', {}, cur.txt), h('div', { class: 'small muted' }, 'Sem resposta em 3 semanas, vale a escolha mais passiva.'),
    h('div', { class: 'col' }, cur.ev.opts.map((o) => { const blk = LE.optBlock(st, o); return h('button', { class: 'pick' + (blk ? ' lock' : ''), disabled: blk ? true : null, onclick: () => { const r = LE.choose(st, o.id); if (r.err) { say(r.err); return; } sfx.coin(); toast(r.msg, 'info'); G.refresh(); m.close(); } }, h('span', {}, o.label), h('span', { class: 'v small' }, o.desc + (blk ? ' — ' + blk : ''))); })));
}
export function openCrisis() {
  const st = s(); const soc = SO.ensureSoc(st); const cr = soc.crisis;
  if (!cr) return toast('Sem crise no momento');
  const body = h('div', { class: 'col' });
  const m = modal({ title: '⚠️ ' + cr.nome, color: '#d9453d', body, closable: !cr.pending, actions: cr.pending ? [] : [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    body.replaceChildren(h('p', {}, cr.txt), h('div', { class: 'small muted' }, `Gravidade ${cr.sev}/3 · reputação ${Math.round(soc.rep)}/100 · seguidores e vendas sofrem enquanto durar (${cr.left} sem.).`),
      cr.pending ? h('div', { class: 'col' }, SO.CRISIS_OPTIONS.map((o) => h('button', { class: 'pick', onclick: () => { const r = SO.respondCrisis(st, o.id); if (typeof r === 'string') { say(r); return; } sfx[r.ok ? 'good' : 'bad'](); toast(r.msg, r.ok ? 'bom' : 'ruim'); G.refresh(); render(); m.close(); } }, h('span', {}, h('b', {}, o.nome), h('br'), h('span', { class: 'small muted' }, o.desc)))))
        : h('div', { class: 'warn' }, cr.res === 'bem' ? 'Você respondeu bem. A tempestade está passando.' : cr.res === 'mal' ? 'A resposta não deu certo. Segure a onda.' : 'A crise seguiu sem resposta.'));
  };
  render();
}

// =====================================================================
// IMPRENSA
// =====================================================================
export function openPress(tab = 'kit') {
  const body = h('div', {});
  const m = modal({ title: 'Imprensa', color: '#8a5cc2', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  let kind = 'preview', embargo = false, tone = 'humilde';
  const render = () => {
    const st = s(); const pr = PR.ensurePress(st); const soc = SO.ensureSoc(st);
    const tabs = h('div', { class: 'tabs' }, [['kit', 'Press kit'], ['enviar', 'Enviar'], ['mat', 'Matérias'], ['ag', 'Assessoria']].map(([id, l]) => h('button', { class: tab === id ? 'on' : '', onclick: () => { tab = id; render(); } }, l)));
    const head = h('div', { class: 'small b' }, `Horas na semana: ${soc.hours.toFixed(1)}/${SO.WEEK_HOURS}`);
    const c = h('div', { class: 'col' });
    if (tab === 'kit') {
      c.append(h('div', { class: 'small muted' }, 'O press kit é o seu cartão de visita: sem ele, jornalistas e youtubers ignoram o e-mail. Cada nível melhora a chance de resposta.'));
      PR.KIT_LEVELS.forEach((k, i) => {
        const cur = pr.kit.level === i; const blk = i > 0 ? PR.kitBlock(st, i) : null;
        c.append(h('div', { class: 'li' + (i < pr.kit.level ? ' dim' : '') }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, k.nome + (cur ? ' (atual)' : '')), h('div', { class: 'small muted' }, `${k.desc}${i ? ` · ${k.h}h${k.custo ? ' · ' + money(k.custo) : ''}` : ''} · chance ×${k.mult}`), blk && i > pr.kit.level ? h('div', { class: 'small', style: { color: '#9c2b1b' } }, blk) : null),
          i > pr.kit.level ? h('button', { class: 'btn sm ok', disabled: !!blk, onclick: () => { if (say(PR.makeKit(st, i), 'Press kit pronto!')) render(); } }, 'Fazer') : null));
      });
    } else if (tab === 'enviar') {
      c.append(h('div', { class: 'seg' }, Object.entries(PR.PITCH_KINDS).map(([id, k]) => h('button', { class: kind === id ? 'on' : '', style: { fontSize: '12px' }, onclick: () => { kind = id; render(); } }, k.nome.replace('Enviar ', '').replace('Propor ', '')))));
      c.append(h('div', { class: 'small muted' }, PR.PITCH_KINDS[kind].desc));
      if (kind === 'review') c.append(h('label', { class: 'row small' }, h('input', { type: 'checkbox', checked: embargo, onchange: (e) => { embargo = e.target.checked; } }), 'Com embargo (todas as reviews saem no dia do lançamento: pico maior, mas todo mundo ao mesmo tempo)'));
      if (kind === 'entrevista') c.append(h('div', { class: 'seg' }, ['humilde', 'ambicioso', 'polêmico'].map((t) => h('button', { class: tone === t ? 'on' : '', onclick: () => { tone = t; render(); } }, t))), h('div', { class: 'small muted' }, 'Humilde: seguro. Ambicioso: +hype. Polêmico: mais alcance, mas risco de crise.'));
      for (const o of C.OUTLETS) {
        const blk = PR.pitchBlock(st, o.id, kind); const ch = PR.pitchChance(st, o, kind); const copy = pr.copies[o.id];
        c.append(h('div', { class: 'li' + (blk ? ' dim' : '') }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, o.nome, h('span', { class: 'muted small' }, ` · ${o.tipo}`)), h('div', { class: 'small' }, `${stars(o.alcance)} · relação ${Math.round(pr.rel[o.id] || 0)}`), h('div', { class: 'small muted' }, copy ? `Cópia enviada${copy.embargo ? ' (embargo)' : ''}` : blk ? blk : `Chance de resposta: ${Math.round(ch * 100)}%`)),
          h('button', { class: 'btn sm ok', disabled: !!blk, onclick: () => { if (say(PR.sendPitch(st, o.id, kind, { embargo, tone }), 'E-mail enviado!')) render(); } }, 'Enviar')));
      }
      const pend = pr.pitches.filter((x) => x.status === 'pendente');
      if (pend.length) c.append(h('h3', {}, 'Aguardando resposta'), pend.map((x) => kv(PR.OUTLET_BY_ID[x.outlet].nome, `${PR.PITCH_KINDS[x.kind].nome.replace('Enviar ', '')} · ${Math.max(0, x.due - st.week)} sem.`)));
    } else if (tab === 'mat') {
      if (!pr.articles.length) c.append(h('div', { class: 'muted' }, 'Nenhuma matéria ainda. Envie previews, entrevistas ou cópias de review.'));
      for (const a of pr.articles.slice(0, 20)) c.append(h('div', { class: 'li' }, a.nota != null ? h('div', { class: 'nota', style: { background: a.nota >= 7 ? '#2e8a4a' : a.nota >= 5 ? '#e0a030' : '#d04030', color: '#fff', borderRadius: '10px', width: '38px', height: '38px', display: 'grid', placeItems: 'center', fontWeight: '900', flex: 'none' } }, String(a.nota).replace('.', ',')) : h('div', { class: 'ico' }, { preview: '👀', entrevista: '🎤', estudio: '🏢', noticia: '📰' }[a.kind] || '📰'),
        h('div', { class: 'grow' }, h('div', { class: 'nm small' }, a.titulo), h('div', { class: 'small muted' }, `${PR.OUTLET_BY_ID[a.outlet]?.nome} · ${a.kind}${a.embargo ? ' (embargo)' : ''} · alcance ${numShort(a.reach)} · ${dateStr(a.w)}`))));
    } else {
      c.append(h('div', { class: 'small muted' }, 'Assessorias cuidam dos e-mails, sugerem pautas e ajudam em crises. Cobram toda semana e têm contrato mínimo.'));
      if (pr.agency) { const a = PR.AGENCIES.find((x) => x.id === pr.agency.id); c.append(h('div', { class: 'li', style: { background: '#e9f7ec' } }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, a.nome + ' (contratada)'), h('div', { class: 'small muted' }, `${money(a.semanal)}/semana · desde ${dateStr(pr.agency.since)} · total pago ${money(pr.agencyPaid)}`)), h('button', { class: 'btn sm red', onclick: () => { if (say(PR.cancelAgency(st), 'Contrato encerrado.')) render(); } }, 'Encerrar'))); }
      for (const a of PR.AGENCIES) { const blk = PR.agencyBlock(st, a.id); c.append(h('div', { class: 'li' + (pr.agency ? ' dim' : '') }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, a.nome), h('div', { class: 'small muted' }, `${a.desc} · ${money(a.semanal)}/sem. · mín. ${a.minSem} sem. · chance ×${a.mult}`), blk && !pr.agency ? h('div', { class: 'small', style: { color: '#9c2b1b' } }, blk) : null), h('button', { class: 'btn sm ok', disabled: !!blk, onclick: () => { if (say(PR.hireAgency(st, a.id), 'Assessoria contratada!')) render(); } }, 'Contratar'))); }
    }
    body.replaceChildren(head, tabs, c);
  };
  render();
}
