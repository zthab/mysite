import katex from './vendor/katex/katex.mjs';
import {utility,marginalUtility,ramseyRate,discountFactor,countryCalculation,poorestRecipientComparison,defaults} from './model.js';

const colors={phi:'#a13232',e:'#596b18',slope:'#ba5a08',rho:'#7844a2',r:'#2459a6',R:'#a83282',eta:'#82651c',g:'#24763c',capital:'#46515f',weight:'#007c8a'};
const C=(key,source)=>`{\\color{${colors[key]}}${source}}`;
function paint(source){
  return source.replace(/e'\(M(?:_[ijk])?\)|e\(M(?:_[ijk])?\)|f'\(K(?:_[ijk])?\)|\\phi(?:_[ijk])?|\\rho|\\eta|(?<![A-Za-z\\])[rRg](?![A-Za-z])/g,token=>{
    const key=token.startsWith("e'")?'slope':token.startsWith('e(')?'e':token.startsWith("f'")?'capital':token.startsWith('\\phi')?'phi':token==='\\rho'?'rho':token==='\\eta'?'eta':token;
    return C(key,token);
  });
}
function math(id,source){const el=typeof id==='string'?document.getElementById(id):id;try{el.innerHTML=katex.renderToString(paint(source),{displayMode:el.classList.contains('math'),throwOnError:true,strict:'error',output:'htmlAndMathml'});}catch(error){el.textContent=source;el.classList.add('math-error');console.error(error);}}
function prose(id,source){const el=document.getElementById(id);el.innerHTML=source;el.querySelectorAll('[data-tex]').forEach(term=>math(term,term.dataset.tex));}
const state=defaults();
const $=id=>document.getElementById(id);
const fmt=(n,d=2)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
const fixed=(n,d=2)=>(Math.round((Number(n)+Number.EPSILON*Math.max(1,Math.abs(n)))*10**d)/10**d).toFixed(d);
const money=n=>'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:2,...(Math.abs(n)>=1e6?{notation:'compact'}:{})});
const pct=n=>fixed(n*100,3)+'%';
const sample=(min,max,f,n=160)=>Array.from({length:n+1},(_,i)=>{const x=min+(max-min)*i/n;return {x,y:f(x)};});
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
let plotId=0;
function graph(id,{series,xmin,xmax,ymin,ymax,xLabel,yLabel,xFormat=fmt,yFormat=fmt,marker,log=false,summary,yTicks,legend=[]}){
  const el=$(id),width=Math.max(280,Math.round(el.getBoundingClientRect().width)),height=310,L=67,R=24,T=15,B=62;
  const range=series.filter(s=>s.range!==false).flatMap(s=>s.points.map(p=>log?Math.log10(p.y):p.y)).filter(Number.isFinite);
  const observedMin=Math.min(...range),observedMax=Math.max(...range),pad=(observedMax-observedMin||1)*.08;
  if(ymin===undefined)ymin=observedMin-pad;
  if(ymax===undefined)ymax=observedMax+pad;
  if(ymax<=ymin)ymax=ymin+1;
  const X=x=>L+(x-xmin)/(xmax-xmin)*(width-L-R),Y=y=>height-B-((log?Math.log10(y):y)-ymin)/(ymax-ymin)*(height-T-B),clip=`plot-${++plotId}`;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(summary)}"><title>${xml(summary)}</title><defs><clipPath id="${clip}"><rect x="${L}" y="${T}" width="${width-L-R}" height="${height-T-B}"/></clipPath></defs>`;
  const ticks=yTicks||Array.from({length:5},(_,i)=>{const y=ymin+(ymax-ymin)*i/4;return log?10**y:y;});
  for(const yp of ticks){
    s+=`<line x1="${L}" x2="${width-R}" y1="${Y(yp)}" y2="${Y(yp)}" stroke="#dedad1" data-grid-value="${yp}"/><text x="${L-9}" y="${Y(yp)+4}" text-anchor="end" font-size="12" fill="#6b665d">${xml(yFormat(yp))}</text>`;
  }
  for(let i=0;i<=4;i++){const xv=xmin+(xmax-xmin)*i/4;s+=`<text x="${X(xv)}" y="${height-B+23}" text-anchor="middle" font-size="12" fill="#6b665d">${xml(xFormat(xv))}</text>`;}
  s+=`<line x1="${L}" x2="${width-R}" y1="${height-B}" y2="${height-B}" stroke="#8b8579"/><text x="${(L+width-R)/2}" y="${height-13}" text-anchor="middle" font-size="12" fill="#262420">${xml(xLabel)}</text><text x="16" y="${(T+height-B)/2}" transform="rotate(-90 16 ${(T+height-B)/2})" text-anchor="middle" font-size="12" fill="#262420">${xml(yLabel)}</text>`;
  for(const line of series){let path='';for(const p of line.points){if(Number.isFinite(Y(p.y)))path+=`${path?'L':'M'}${X(p.x).toFixed(2)},${Y(p.y).toFixed(2)} `;}s+=`<path d="${path}" fill="none" stroke="${line.color||'#262420'}" stroke-width="${line.width||2.5}" ${line.dash?'stroke-dasharray="7 5"':''} clip-path="url(#${clip})"/>`;}
  if(marker&&Number.isFinite(Y(marker.y)))s+=`<circle cx="${X(marker.x)}" cy="${Y(marker.y)}" r="5" fill="${marker.color||'#262420'}" stroke="#faf8f4" stroke-width="2"/>`;
  if(legend.length){const lx=width-R-145,ly=T+7;s+=`<g class="plot-legend"><rect x="${lx-8}" y="${ly-5}" width="153" height="${legend.length*20+10}" fill="#faf8f4" fill-opacity=".96"/>`;legend.forEach((item,i)=>{const y=ly+8+i*20;s+=`<line x1="${lx}" x2="${lx+25}" y1="${y}" y2="${y}" stroke="${item.color||'#262420'}" stroke-width="2.5" ${item.dash?'stroke-dasharray="7 5"':''}/><text x="${lx+34}" y="${y+4}" font-size="12" fill="#262420">${xml(item.label)}</text>`;});s+='</g>';}
  el.innerHTML=s+'</svg>';
}
function renderUtility(){
  const x=state.c/10,mu=marginalUtility(x,state.eta),u=utility(x,state.eta);
  graph('utility-plot',{series:[{points:sample(5,100,c=>utility(c/10,state.eta))},{points:sample(5,100,c=>u+mu*(c/10-x)),dash:true,color:'#8b8579',range:false}],xmin:5,xmax:100,xLabel:'Consumption ($1,000/person)',yLabel:'Utility (utils)',marker:{x:state.c,y:u},summary:`Ruby’s utility function assigns utils to each consumption level. At eta ${state.eta}, consumption ${money(state.c*1000)} gives ${fixed(u,3)} utils. The dashed tangent shows marginal utility.`});
  graph('mu-plot',{series:[{points:sample(5,100,c=>marginalUtility(c/10,state.eta)/10)}],xmin:5,xmax:100,ymin:0,xLabel:'Consumption ($1,000/person)',yLabel:'Utils per $1,000',marker:{x:state.c,y:mu/10},yFormat:y=>y===0?'0':y>=.01?fmt(y,3):y.toExponential(1),summary:`Marginal utility at eta ${state.eta}, ${fixed(mu/10,5)} utils per $1,000 at the selected consumption. Doubling consumption multiplies marginal utility by ${fixed(2**-state.eta,4)}.`});

}
function renderDiscount(){
  const r=ramseyRate(state.rho/100,state.eta,state.g/100),rd=state.k/100,approx=state.rho/100+state.eta*state.g/100,chosen=state.method==='prescriptive'?r:rd,R=discountFactor(chosen,state.years);
  math('discount-equation',state.method==='prescriptive'?String.raw`r=(1+\rho)(1+g)^\eta-1=${C('r',fixed(r*100,3)+String.raw`\%`)},\qquad R_T=(1+r)^{-T}=${C('R',fixed(R,4))}.`:String.raw`f'(K)=1+${fixed(rd,4)}=${C('capital',fixed(1+rd,4))},\qquad R_T=[f'(K)]^{-T}=${C('R',fixed(R,4))}.`);
  prose('discount-reading',`With the ${state.method} approach, $100 of damage in ${state.years} years is worth ${money(100*R)} today. ${state.method==='prescriptive'?`The exact Ramsey rate is ${pct(r)}; the approximation <span data-tex="\\rho+\\eta g"></span> gives ${pct(approx)}.`:`The selected real net capital return is ${pct(rd)}; its gross payoff is ${fixed(1+rd,4)} future dollars per dollar invested.`}${chosen<0?' The selected consumption discount rate is negative, so the future dollar receives a weight above one.':''}`);
  const top=Math.max(1,discountFactor(r,150),discountFactor(rd,150))*1.05;
  const ticks=top<=1.051?[0,.25,.5,.75,1]:[1,...Array.from({length:5},(_,i)=>top*i/4).filter(v=>Math.abs(v-1)>top*.06)].sort((a,b)=>a-b);
  graph('discount-plot',{series:[{points:sample(0,150,t=>discountFactor(r,t)),color:colors.R},{points:sample(0,150,t=>discountFactor(rd,t)),color:colors.R,dash:true}],xmin:0,xmax:150,ymin:0,ymax:top,yTicks:ticks,legend:[{label:'Prescriptive',color:colors.R},{label:'Descriptive',color:colors.R,dash:true}],xLabel:'Years until climate damage occurs',yLabel:'Value today of $1 damage ($)',marker:{x:state.years,y:R,color:colors.R},yFormat:y=>fmt(y,2),summary:`Discount factors over time. Solid: prescriptive annual rate ${pct(r)}. Dashed: descriptive annual net return ${pct(rd)}. At ${state.years} years, the selected factor is ${fixed(R,4)}.`});
  document.querySelectorAll('[data-method]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.method===state.method)));
}
function countryInputTable(){
  $('country-inputs').innerHTML=state.countries.map((c,i)=>`<tr><th scope="row">${c.name}</th><td><input aria-label="${c.name} population" type="number" min="0.1" max="1500" step="0.1" value="${c.population}" data-country="${i}" data-field="population"></td><td><input aria-label="${c.name} future consumption" type="number" min="5" max="200" step="1" value="${c.consumption}" data-country="${i}" data-field="consumption"></td><td><input aria-label="${c.name} damage slope" type="number" min="0" max="50" step="0.01" value="${c.damage}" data-country="${i}" data-field="damage"></td></tr>`).join('');
}
function renderCountries(){
  const comparison=poorestRecipientComparison(state.countries,state.payer,state.eta,state.rho/100,state.years),calc=comparison.current,poorest=comparison.poorest;
  $('scc-poor-damaged').textContent=money(calc.scc)+' per tonne';
  $('scc-poor-spared').textContent=money(comparison.spared.scc)+' per tonne';
  $('poor-country-reading').textContent=`${poorest.name} has the lowest future consumption in the table: ${money(poorest.consumption*1000)} per person. Its current damage is ${money(poorest.damageDollars)} of future consumption per tonne. The comparison sets only that country's damage slope to zero; all other inputs stay fixed.`;
  prose('poor-country-difference',`Removing that damage lowers the SCC by <strong>${money(comparison.difference)} per tonne</strong>. The contribution removed is its future dollar damage, ${money(poorest.damageDollars)}, multiplied by its consumption weight, <span data-tex="(${fmt(state.payer)}/${fmt(poorest.consumption)})^\\eta=${fixed(poorest.weight,3)}"></span>, and the time-preference factor, ${fixed(calc.timeFactor,4)}.`);
  $('scc-value').textContent=money(calc.scc);
  $('country-results').innerHTML=calc.rows.map(c=>`<tr><th scope="row">${c.name}</th><td>${money(c.damageDollars)}</td><td class="weight">${fixed(c.weight,3)}</td><td class="preference-value">${fixed(calc.timeFactor,3)}</td><td title="${fmt(c.contribution,6)} dollars per tonne">${money(c.contribution)}</td></tr>`).join('');
  $('country-total').innerHTML=`<tr><th>Total</th><td>${money(calc.rawDamages)}</td><td colspan="2">Sum of the contributions →</td><td>${money(calc.scc)}</td></tr>`;
  const first=calc.rows[0];math('country-worked',String.raw`\text{Ruby's country: }(${fmt(first.population)}\times10^6)(${C('phi',fmt(first.damage))}\times10^{-6})\left(\frac{${fmt(state.payer)}}{${fmt(first.consumption)}}\right)^\eta(1+\rho)^{-T}=${fmt(first.contribution)}\;\$/\text{tonne}.`);
  $('country-reading').textContent=`The three countries lose ${money(calc.rawDamages)} of future consumption per tonne in total. After consumption weighting and time preference, the SCC is ${money(calc.scc)} in the payer's current dollars. Changing the payer's income changes the unit of valuation and the marginal utility of the consumption sacrificed today; it does not change the physical damage slopes.`;
  graph('eta-plot',{series:[{points:sample(0,4,eta=>countryCalculation(state.countries,state.payer,eta,state.rho/100,state.years).scc)}],xmin:0,xmax:4,ymin:0,xLabel:'Utility curvature η',yLabel:'SCC ($/tonne)',yFormat:y=>money(y),marker:{x:state.eta,y:calc.scc},summary:`Global SCC sensitivity to eta, holding country incomes and damages fixed. Current eta ${state.eta}, SCC ${money(calc.scc)}.`});
  graph('rho-plot',{series:[{points:sample(0,3,rho=>countryCalculation(state.countries,state.payer,state.eta,rho/100,state.years).scc)}],xmin:0,xmax:3,ymin:0,xLabel:'Annual time preference ρ (%)',yLabel:'SCC ($/tonne)',yFormat:y=>money(y),marker:{x:state.rho,y:calc.scc},summary:`Global SCC sensitivity to pure time preference. Current rho ${state.rho} percent and SCC ${money(calc.scc)}.`});
  const delta=.01,up=countryCalculation(state.countries,state.payer,Math.min(4,state.eta+delta),state.rho/100,state.years).scc,down=countryCalculation(state.countries,state.payer,Math.max(0,state.eta-delta),state.rho/100,state.years).scc;
  const direction=Math.abs(up-down)<1e-7?'leaves the SCC unchanged':up>down?'raises the SCC':'lowers the SCC';
  prose('sensitivity-reading',`At these country inputs, increasing <span data-tex="\\eta"></span> a little ${direction}. Increasing <span data-tex="\\rho"></span> lowers the SCC when damages are positive and arrive in the future. The horizon is ${state.years} years, and the current pure utility time factor is ${fixed(calc.timeFactor,4)}.`);
}
function syncControls(){
  document.querySelectorAll('[data-param]').forEach(el=>{if(document.activeElement!==el)el.value=state[el.dataset.param];});
  document.querySelectorAll('[data-value]').forEach(el=>{const key=el.dataset.value,v=state[key];el.textContent=['rho','g','k'].includes(key)?fixed(v,2)+'%':['c','payer'].includes(key)?money(v*1000):key==='years'?fmt(v)+' years':key==='slope'?fixed(v,3)+' t/$':fixed(v,2);});
  document.querySelectorAll('[data-country]').forEach(el=>{if(document.activeElement!==el)el.value=state.countries[Number(el.dataset.country)][el.dataset.field];});
}
function render(){syncControls();renderUtility();renderDiscount();renderCountries();math('mac-example',String.raw`\text{Marginal abatement cost}=\frac{1}{${C('slope',fixed(state.slope,3))}}=${fixed(1/state.slope,2)}\;\$/\text{tonne}.`);}
document.querySelectorAll('[data-tex]').forEach(el=>math(el,el.dataset.tex));
countryInputTable();
document.querySelectorAll('[data-param]').forEach(el=>el.addEventListener('input',()=>{state[el.dataset.param]=Number(el.value);render();}));
$('country-inputs').addEventListener('input',event=>{const el=event.target;if(el.dataset.country!==undefined&&el.value!==''&&el.validity.valid){state.countries[Number(el.dataset.country)][el.dataset.field]=Number(el.value);render();}});
$('country-inputs').addEventListener('change',event=>{const el=event.target;if(el.dataset.country===undefined)return;const value=Number(el.value);el.value=Math.max(Number(el.min),Math.min(Number(el.max),Number.isFinite(value)?value:0));state.countries[Number(el.dataset.country)][el.dataset.field]=Number(el.value);render();});
document.querySelectorAll('[data-method]').forEach(el=>el.addEventListener('click',()=>{state.method=el.dataset.method;renderDiscount();}));
document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>{
  const action=el.dataset.action;
  if(action.startsWith('eta-'))state.eta={zero:0,one:1}[action.slice(4)];
  else if(action==='match-returns')state.k=Math.round(ramseyRate(state.rho/100,state.eta,state.g/100)*100/.05)*.05;
  else if(action==='equal-incomes')state.countries.forEach(c=>c.consumption=state.payer);
  else if(action==='restore-countries')state.countries=defaults().countries;
  else if(action==='spare-poorest'){const {poorestIndex}=poorestRecipientComparison(state.countries,state.payer,state.eta,state.rho/100,state.years);state.countries[poorestIndex].damage=0;}
  render();
}));
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,100);});
document.fonts?.ready.then(render);render();
