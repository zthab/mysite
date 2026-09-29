import {simulate, MODEL} from './sim.js';
import {Plot, fmt} from './plot.js';
import {tex, putMath} from './math.js';
const $=id=>document.getElementById(id);
const state={rho:.85,b2:MODEL.b2,seed:42,selected:19};
let previousCorrelation=null;
const setCorrelation=value=>{if(value===0&&state.rho!==0)previousCorrelation=state.rho;state.rho=value;};
let result=simulate(state);
$('sliders').innerHTML=`<div class="slider"><label for="rho">${tex(String.raw`\operatorname{Corr}(\mathrm{Sleep},\mathrm{Study})`)}<output id="value-rho" for="rho"></output></label><input id="rho" type="range" min="-.95" max=".95" step=".05" value="${state.rho}"></div><div class="slider"><label for="b2">Sleep coefficient<output id="value-b2" for="b2"></output></label><input id="b2" type="range" min="-6" max="6" step=".5" value="${state.b2}"></div>`;
document.querySelectorAll('[data-tex]').forEach(el=>el.innerHTML=tex(el.dataset.tex));
const configs=[['figure-true',{mode:'true',title:'True relationship and simulated data'}],['figure-full',{mode:'full',title:'Estimated regression plane'}],['figure-person',{mode:'person',title:'The selected student and their fitted score'}],['figure-omitted',{mode:'omitted',title:'Estimated regression with sleep omitted'}],['figure-error',{field:'v',title:'Recentered error versus study hours'}]];
const plots=configs.map(([id,config])=>new Plot(id,config,()=>({state,result}),id=>{state.selected=id;updateSelection();draw();}));
const draw=()=>plots.forEach(p=>p.draw());
const term=(number,variable)=>`${number<0?'-':'+'}${fmt(Math.abs(number))}\\,\\mathrm{${variable}}_i`;
const coefficientCell=(model,key)=>key===null?'<td aria-label="Not included">—</td>':`<td>${model[key].toFixed(3)}<span class="standard-error" aria-label="Standard error ${model.standardErrors[key].toFixed(3)}">(${model.standardErrors[key].toFixed(3)})</span></td>`;
function updateSelection(){
 const d=result.data[state.selected];$('student-name').textContent=`Student ${d.id+1}`;
 $('student-characteristics').innerHTML=[['Study',`${fmt(d.x)} hours/day`],['Sleep',`${fmt(d.z)} hours/day`],['Observed score',`${fmt(d.y)} points`],['Fitted score',`${fmt(d.fullPrediction)} points`],[`Residual (${tex(String.raw`\hat e_{1i}`)})`,`${fmt(d.fullResidual)} points`],[`Error (${tex(String.raw`\varepsilon_{1i}`)})`,`${fmt(d.u)} points`]].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
 putMath('student-residual',String.raw`\hat e_{1i}=${fmt(d.y)}-${fmt(d.fullPrediction)}=${fmt(d.fullResidual)}`);
}
function render(){
 $('rho').value=state.rho;$('value-rho').textContent=fmt(state.rho);
 $('b2').value=state.b2;$('value-b2').textContent=fmt(state.b2);
 $('restore-correlation').disabled=state.rho!==0||previousCorrelation===null;
 const errorMean=state.b2*MODEL.meanSleep,centeredIntercept=MODEL.b0+errorMean;
 $('zero-correlation-status').textContent=`Current study–sleep correlation: ${fmt(state.rho)}. These buttons update all plots.`;
 putMath('noise-distribution',String.raw`\mathrm{Noise}_i\overset{\mathrm{iid}}{\sim}\mathcal N(0,${MODEL.sigma}^2)`);
 putMath('true-equation',String.raw`\mathrm{Score}_i=20+5\,\mathrm{Study}_i${term(state.b2,'Sleep')}+\mathrm{Noise}_i`);
 putMath('full-proposed',String.raw`\mathrm{Score}_i=\beta_0+\beta_1\mathrm{Study}_i+\beta_2\mathrm{Sleep}_i+\varepsilon_{1i}`);
 putMath('estimated-equation',String.raw`\mathrm{Score}_i=${fmt(result.full.a)}${term(result.full.b1,'Study')}${term(result.full.b2,'Sleep')}+\hat e_{1i}`);
 putMath('fitted-score-equation',String.raw`\begin{aligned}\widehat{\mathrm{Score}}_i={}&${fmt(result.full.a)}\\&${term(result.full.b1,'Study')}\\&${term(result.full.b2,'Sleep')}\end{aligned}`);
 $('regression-table-rows').innerHTML=[['Study hours','b1'],['Sleep hours','b2'],['Constant','a']].map(([label,key])=>`<tr><th scope="row">${label}</th>${coefficientCell(result.full,key)}</tr>`).join('');
 $('regression-fit').innerHTML=`<tr><th scope="row">Observations</th><td>${result.data.length}</td></tr><tr><th scope="row">${tex(String.raw`R^2`)}</th><td>${result.full.rSquared.toFixed(3)}</td></tr>`;
 $('comparison-table-rows').innerHTML=[['Study hours','b1','b'],['Sleep hours','b2',null],['Constant','a','a']].map(([label,fullKey,shortKey])=>`<tr><th scope="row">${label}</th>${coefficientCell(result.full,fullKey)}${coefficientCell(result.fit,shortKey)}</tr>`).join('');
 $('comparison-fit').innerHTML=`<tr><th scope="row">Observations</th><td>${result.data.length}</td><td>${result.data.length}</td></tr><tr><th scope="row">${tex(String.raw`\mathrm{R}^2`)}</th><td>${result.full.rSquared.toFixed(3)}</td><td>${result.fit.rSquared.toFixed(3)}</td></tr>`;
 putMath('omitted-true',String.raw`\mathrm{Score}_i=\alpha_0+\alpha_1\mathrm{Study}_i+\varepsilon_{2i}`);
 putMath('omitted-estimated',String.raw`\mathrm{Score}_i=${fmt(result.fit.a)}${term(result.fit.b,'Study')}+\hat e_{2i}`);
 const sleepSlope=state.rho*MODEL.sdSleep/MODEL.sdStudy;
 $('bias-direction-current').textContent=state.b2===0
  ? 'Sleep has no direct effect on scores holding study fixed, so leaving it out creates no population slope bias, even when sleep and study are correlated.'
  : state.rho===0
  ? 'At zero correlation, extra study is associated with no extra sleep, so the population bias is zero.'
  : `One extra study hour is associated with ${Math.abs(sleepSlope).toFixed(3)} ${sleepSlope>0?'more':'fewer'} sleep hours. Since sleep ${state.b2>0?'raises':'lowers'} scores, study gets ${result.bias>0?'too much credit (upward bias)':'too little credit (downward bias)'}.`;
 putMath('bias-numbers',String.raw`\begin{aligned}\text{Population sleep–study slope}&=${fmt(state.rho)}\times\frac{0.75}{\sqrt{3}}\approx ${sleepSlope.toFixed(3)}\\\text{Population slope bias}&=${fmt(state.b2)}\times(${sleepSlope.toFixed(3)})\approx ${result.bias.toFixed(3)}\\\text{Population short slope}&=5+(${result.bias.toFixed(3)})\approx ${result.populationSlope.toFixed(3)}\end{aligned}`);
 $('bias-sample-comparison').textContent=`The population study-only slope is ${result.populationSlope.toFixed(3)}. The slope estimated from these ${result.data.length} students is ${result.fit.b.toFixed(3)}; it varies from sample to sample. Bias compares the estimator’s average across repeated samples with the true effect of 5, rather than judging a single estimate.`;
 putMath('second-error-formula',String.raw`v_i=${fmt(state.b2)}\,\mathrm{Sleep}_i+\mathrm{Noise}_i`);
 $('error-centering-explanation').innerHTML=`Average sleep is 7 hours, so this error has population mean ${fmt(errorMean)}. We want the error to be nice and zero mean, so it’s perfectly OK to <a href="https://home.cerge-ei.cz/kaliskova/files/aqm2/Wooldridge%20Econometrics%20analysis.pdf#page=78" target="_blank" rel="noopener noreferrer" title="Wooldridge (2002), Section 4.3.1, p. 61">move that constant into the intercept and recenter the error</a>:`;
 putMath('error-recentering',String.raw`\begin{aligned}\mathrm{Score}_i&=${fmt(centeredIntercept)}+5\,\mathrm{Study}_i+u_i\\u_i&=${fmt(state.b2)}(\mathrm{Sleep}_i-7)+\mathrm{Noise}_i,\quad\mathrm{Noise}_i\sim\mathcal N(0,${MODEL.sigma}^2)\end{aligned}`);
 putMath('recentered-error-moments',String.raw`E[u_i]=0,\qquad\operatorname{Var}(u_i)=(${fmt(state.b2)})^2(0.75)^2+${MODEL.sigma}^2=${(state.b2**2*MODEL.sdSleep**2+MODEL.sigma**2).toFixed(4)}`);
 $('recentered-error-distribution-note').innerHTML=state.b2===0?`With a zero sleep coefficient, ${tex('u_i')} is just normally distributed Noise.`:`Only Noise is normally distributed here; the combined error ${tex('u_i')} also contains sleep.`;
 $('second-error-explanation').textContent=state.b2===0
  ? 'With no direct sleep effect, the recentered error is just noise. The green line is flat at zero, and the population slope bias is zero.'
  : state.rho===0
  ? 'At zero correlation, the green line is flat at zero: the recentered error has conditional mean zero at every study level. Individual errors still vary, but the population slope bias is zero.'
  : `At this setting, the structural error’s conditional mean ${result.bias>0?'rises':'falls'} by ${Math.abs(result.bias).toFixed(3)} score points per additional study hour. The study-only regression absorbs that trend into its slope, so OLS is biased for the causal study effect of 5.`;
 updateSelection();draw();
}
function update(){result=simulate(state);render();}
$('rho').oninput=e=>{setCorrelation(+e.target.value);update();};
$('b2').oninput=e=>{state.b2=+e.target.value;update();};
$('zero-correlation').onclick=()=>{setCorrelation(0);update();};
$('zero-sleep-coefficient').onclick=()=>{state.b2=0;update();};
$('restore-correlation').onclick=()=>{if(state.rho===0&&previousCorrelation!==null){setCorrelation(previousCorrelation);update();}};
$('resample').onclick=()=>{state.seed++;update();};
$('random-student').onclick=()=>{state.selected=(state.selected+1+Math.floor(Math.random()*(result.data.length-1)))%result.data.length;updateSelection();draw();};
render();
if(document.modelContext?.registerTool){const lifecycle=new AbortController();const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};register({name:'configure_ovb_simulation',description:'Update the correlation of study and sleep and the effect of sleep on scores.',inputSchema:{type:'object',properties:{rho:{type:'number',minimum:-.95,maximum:.95},b2:{type:'number',minimum:-6,maximum:6}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected settings');for(const[k,v]of Object.entries(input))if(!['rho','b2'].includes(k)||typeof v!=='number'||!Number.isFinite(v)||v<(k==='rho'?-.95:-6)||v>(k==='rho'?.95:6))throw Error('Invalid setting: '+k);if('rho' in input)setCorrelation(input.rho);if('b2' in input)state.b2=input.b2;update();return{bias:result.bias,populationSlope:result.populationSlope,sampleSlope:result.fit.b};}});register({name:'read_ovb_simulation',description:'Read parameters, coefficients, and the selected student.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('Expected empty object');return{rho:state.rho,b2:state.b2,bias:result.bias,populationSlope:result.populationSlope,sampleSlope:result.fit.b,selectedStudent:result.data[state.selected]};}});window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
