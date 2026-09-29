import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Plot} from '../../teaching/omitted-variable-bias/plot.js';
const plots=new Map(),draw=Plot.prototype.draw;
Plot.prototype.draw=function(){plots.set(this.id,this);return draw.call(this);};
const html=fs.readFileSync(new URL('../../teaching/omitted-variable-bias/index.html',import.meta.url),'utf8');
const elements=new Map(),registered=new Map();
let expressions=0;
class Element{
 constructor(id=''){this.id=id;this.innerHTML='';this.textContent='';this.dataset={};this.style={};this.classList={add(){}};this.clientWidth=id.includes('figure-')?1000:500;this.clientHeight=510;this.children=new Map();this.handlers={};this.value='';}
 querySelector(s){if(!this.children.has(s))this.children.set(s,new Element(this.id+s));return this.children.get(s);}
 querySelectorAll(s){if(s==='[data-action]')return [...this.innerHTML.matchAll(/data-action="([^"]+)"/g)].map(m=>{let el=this.querySelector(m[1]);el.dataset.action=m[1];return el;});return [];}
 addEventListener(k,fn){this.handlers[k]=fn;}setAttribute(){}setPointerCapture(){}
 getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
 getContext(){const context={strokes:[],fills:[],path:[],beginPath(){this.path=[];},moveTo(x,y){this.path.push([x,y]);},lineTo(x,y){this.path.push([x,y]);},stroke(){this.strokes.push({points:[...this.path],color:this.strokeStyle,width:this.lineWidth});},fill(){this.fills.push(this.fillStyle);}};return new Proxy(context,{get:(o,k)=>o[k]??((...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),'Nonfinite canvas coordinate');}),set:(o,k,v)=>(o[k]=v,true)});}
}
globalThis.document={compatMode:'CSS1Compat',getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},querySelectorAll(s){if(s==='[data-tex]')return [...html.matchAll(/data-tex="([^"]+)"/g)].map(m=>{const el=new Element();el.dataset.tex=m[1];return el;});return [];},modelContext:{registerTool(tool){registered.set(tool.name,tool);}}};
globalThis.window={devicePixelRatio:1,addEventListener(){}};
globalThis.ResizeObserver=class{observe(){}};
globalThis.cancelAnimationFrame=()=>{};
globalThis.requestAnimationFrame=fn=>{fn(performance.now()+3000);return 1;};
globalThis.matchMedia=()=>({matches:false});
await import('../../teaching/omitted-variable-bias/app.js');
for(const id of ['noise-distribution','full-proposed','bias-numbers','second-error-formula','fitted-score-equation','recentered-error-moments','true-equation','estimated-equation','omitted-true','omitted-estimated','error-recentering','zero-slope-equation','zero-model-equation'])assert.match(elements.get(id).innerHTML,/class="katex"/);
assert.match(elements.get('figure-error').querySelector('.legend').innerHTML,/Expected error given study hours/);
assert.doesNotMatch(elements.get('figure-error').innerHTML,/OLS residual/);
assert.match(elements.get('second-error-explanation').textContent,/rises/);
const full=elements.get('figure-full'),person=elements.get('figure-person');
assert.ok(html.indexOf('id="sliders"')<html.indexOf('id="figure-true"'));
assert.ok(html.indexOf('id="figure-true"')<html.indexOf('id="correct-dgp"'));
function checkDgpPlot(){
 const root=elements.get('figure-true'),plot=plots.get('figure-true'),{result}=plot.getModel();
 root.querySelector('reset').onclick();
 assert.equal(plot.is3D,true);assert.equal(plot.points.length,500);
 assert.match(root.querySelector('.legend').innerHTML,/True relationship \(without noise\)/);
 assert.doesNotMatch(root.querySelector('.legend').innerHTML,/Fitted/);
 plot.ctx.strokes=[];plot.draw();
 const planeStrokes=structuredClone(plot.ctx.strokes),fullFit=result.full;
 try{
  result.full={a:800,b1:-100,b2:200};plot.ctx.strokes=[];plot.draw();
  assert.deepEqual(plot.ctx.strokes,planeStrokes,'The true plane must not depend on fitted coefficients');
 }finally{result.full=fullFit;}
 for(const [view,key,otherKey,beta,otherBeta] of [['study','x','z','b1','b2'],['sleep','z','x','b2','b1']]){
  plot.ctx.strokes=[];plot.ctx.fills=[];root.querySelector(`${view}-view`).onclick();
  assert.equal(plot.is3D,false);assert.equal(plot.points.length,500);
  assert.ok(!plot.ctx.fills.some(color=>String(color).startsWith('rgba(50,74,59')),'A score view shows a true line, not a plane');
  const lines=plot.ctx.strokes.filter(s=>s.color==='#324a3b'&&s.width===2.7);assert.equal(lines.length,1);
  const samples=plot.points.map(p=>({screen:p,datum:result.data[p.id]})),first=samples[0],second=samples.find(p=>Math.abs(p.datum.y-first.datum.y)>1e-6&&Math.abs(p.datum[key]-first.datum[key])>1e-6);
  const yScale=(second.screen.y-first.screen.y)/(second.datum.y-first.datum.y),xScale=(second.screen.x-first.screen.x)/(second.datum[key]-first.datum[key]);
  const [a,b]=lines[0].points,screenSlope=(b[1]-a[1])/(b[0]-a[0]);
  assert.ok(Math.abs(screenSlope*xScale/yScale-result.model[beta])<1e-9);
  const held=result.data.reduce((sum,d)=>sum+d[otherKey],0)/result.data.length;
  const trueScore=result.model.b0+result.model[beta]*first.datum[key]+result.model[otherBeta]*held;
  assert.ok(Math.abs(a[1]+screenSlope*(first.screen.x-a[0])-(first.screen.y+yScale*(trueScore-first.datum.y)))<1e-8);
  assert.match(root.querySelector('.legend').innerHTML,/True line/);
  assert.match(root.querySelector('.plot-hint').textContent,/is held at/);
 }
 root.querySelector('reset').onclick();assert.equal(plot.is3D,true);
}
checkDgpPlot();
assert.doesNotMatch(full.querySelector('.plot-labels').innerHTML,/beta_1|Delta/);
assert.match(person.querySelector('.plot-labels').innerHTML,/beta_1/);
assert.match(person.querySelector('.plot-labels').innerHTML,/hat e/);
for(const root of [full,person]){
 const plot=plots.get(root.id);
 for(const [view,key,otherKey,beta] of [['study','x','z','b1'],['sleep','z','x','b2']]){
  plot.ctx.strokes=[];plot.ctx.fills=[];
  root.querySelector(`${view}-view`).onclick();
  assert.equal(plot.flat,1);assert.equal(plot.is3D,false);
  assert.equal(plot.axes.length,2);
  assert.match(root.querySelector('.legend').innerHTML,/Fitted line/);
  assert.doesNotMatch(root.querySelector('.legend').innerHTML,/Fitted plane/);
  assert.match(root.querySelector('.plot-hint').textContent,/is held at/);
  assert.ok(!plot.ctx.fills.some(color=>String(color).startsWith('rgba(138,120,93')),'No shaded plane in either score view');
  const lines=plot.ctx.strokes.filter(s=>s.color==='#8a785d'&&s.width===2.7);
  assert.equal(lines.length,1);assert.equal(lines[0].points.length,2);
  const {state,result}=plot.getModel(),selected=result.data[state.selected];
  const endpoints=lines[0].points,screenSlope=(endpoints[1][1]-endpoints[0][1])/(endpoints[1][0]-endpoints[0][0]);
  const slope=result.full[beta];
  assert.equal(Math.sign(screenSlope),-Math.sign(slope));
  const held=root===person?selected[otherKey]:result.data.reduce((sum,d)=>sum+d[otherKey],0)/result.data.length;
  assert.match(root.querySelector('.plot-hint').textContent,new RegExp(held.toFixed(2)));
  // Convert the line and observed points back to a common y scale. This checks
  // the fitted coefficient and intercept without duplicating the plot's bounds.
  const samples=plot.points.map(p=>({screen:p,datum:result.data[p.id]}));
  const first=samples[0],second=samples.find(p=>Math.abs(p.datum.y-first.datum.y)>1e-6&&Math.abs(p.datum[key]-first.datum[key])>1e-6);
  assert.ok(second);
  const yScale=(second.screen.y-first.screen.y)/(second.datum.y-first.datum.y),xScale=(second.screen.x-first.screen.x)/(second.datum[key]-first.datum[key]);
  assert.ok(Math.abs(screenSlope*xScale/yScale-slope)<1e-9);
  const predicted=result.full.a+slope*first.datum[key]+result.full[beta==='b1'?'b2':'b1']*held;
  const screenPredicted=endpoints[0][1]+screenSlope*(first.screen.x-endpoints[0][0]);
  assert.ok(Math.abs(screenPredicted-(first.screen.y+yScale*(predicted-first.datum.y)))<1e-8);
  if(root===person){assert.match(root.querySelector('.plot-labels').innerHTML,new RegExp(`beta_${view==='study'?1:2}`));assert.doesNotMatch(root.querySelector('.plot-labels').innerHTML,new RegExp(`beta_${view==='study'?2:1}`));}
 }
 root.querySelector('reset').onclick();assert.equal(plot.is3D,true);assert.equal(plot.flat,0);assert.equal(plot.scoreView,null);
 assert.match(root.querySelector('.legend').innerHTML,/Fitted plane/);
 root.querySelector('sleep-view').onclick();plot.canvas.handlers.keydown({key:'r',preventDefault(){}});assert.equal(plot.is3D,true);assert.equal(plot.scoreView,null);
}
assert.doesNotMatch(full.querySelector('.legend').innerHTML,/True relationship/);
const truthToggle=full.querySelector('true-relationship');truthToggle.checked=true;truthToggle.onclick();
assert.match(full.querySelector('.legend').innerHTML,/True relationship/);
truthToggle.checked=false;truthToggle.onclick();assert.doesNotMatch(full.querySelector('.legend').innerHTML,/True relationship/);
assert.ok(html.indexOf('id="true-equation"')<html.indexOf('id="sliders"'));
assert.ok(!html.includes('By “real world,”'));
assert.ok(!html.includes('The economists do not know the betas.'));
assert.doesNotMatch(elements.get('omitted-true').innerHTML,/tilde/);
assert.match(elements.get('omitted-true').innerHTML,/alpha/);
assert.equal(elements.get('rho').value,.85);
elements.get('figure-omitted').querySelector('flatten').onclick();
function checkTrueModelLine(){
 const plot=plots.get('figure-omitted');plot.ctx.strokes=[];plot.draw();
 const line=plot.ctx.strokes.find(s=>s.color==='#324a3b'&&s.width===2.7);
 assert.ok(line);const {result}=plot.getModel();
 const points=plot.points.map(p=>({screen:p,datum:result.data[p.id]})),first=points[0],second=points.find(p=>Math.abs(p.datum.x-first.datum.x)>1e-6&&Math.abs(p.datum.y-first.datum.y)>1e-6);
 const xScale=(second.screen.x-first.screen.x)/(second.datum.x-first.datum.x),yScale=(second.screen.y-first.screen.y)/(second.datum.y-first.datum.y);
 const [a,b]=line.points,screenSlope=(b[1]-a[1])/(b[0]-a[0]);
 assert.ok(Math.abs(screenSlope*xScale/yScale-result.model.b1)<1e-9);
 const meanSleep=result.data.reduce((sum,d)=>sum+d.z,0)/result.data.length;
 const trueScore=result.model.b0+result.model.b1*first.datum.x+result.model.b2*meanSleep;
 assert.ok(Math.abs(a[1]+screenSlope*(first.screen.x-a[0])-(first.screen.y+yScale*(trueScore-first.datum.y)))<1e-8);
 assert.match(elements.get('figure-omitted').querySelector('.legend').innerHTML,/True model: study slope 5.00/);
 assert.doesNotMatch(elements.get('figure-omitted').querySelector('.legend').innerHTML,/Full regression/);
}
checkTrueModelLine();
assert.equal((elements.get('comparison-table-rows').innerHTML.match(/class="standard-error"/g)||[]).length,5);
assert.equal(registered.size,2);
const configure=registered.get('configure_ovb_simulation'),read=registered.get('read_ovb_simulation');
assert.equal(configure.execute({rho:0}).bias,0);assert.equal(read.execute({}).rho,0);
assert.match(elements.get('second-error-explanation').textContent,/flat at zero/);
assert.throws(()=>configure.execute({b1:2}));assert.throws(()=>configure.execute({rho:1.2}));assert.equal(read.execute({}).rho,0);
configure.execute({rho:-.95});assert.ok(Math.abs(read.execute({}).bias-3*(-.95)*.75/Math.sqrt(3))<1e-12);
assert.match(elements.get('second-error-explanation').textContent,/falls/);
configure.execute({rho:.85});
const originalStudent=read.execute({}).selectedStudent;
elements.get('b2').oninput({target:{value:'-3'}});
let current=read.execute({});
assert.equal(current.b2,-3);assert.ok(current.bias<0);
checkDgpPlot();
checkTrueModelLine();
assert.equal(elements.get('value-b2').textContent,'-3.00');
for(const key of ['x','z','u'])assert.equal(current.selectedStudent[key],originalStudent[key]);
assert.ok(Math.abs(current.selectedStudent.y-originalStudent.y+6*originalStudent.z)<1e-10);
assert.match(elements.get('bias-direction-current').textContent,/sleep lowers scores.*downward bias/);
assert.match(elements.get('error-centering-explanation').innerHTML,/mean -21.00/);
assert.match(elements.get('figure-error').querySelector('.plot-hint').textContent,/-3.00 ×/);
assert.match(elements.get('zero-model-equation').innerHTML,/Score\}=-1.00/);
configure.execute({rho:-.85});assert.ok(read.execute({}).bias>0);
configure.execute({b2:0});assert.ok(Math.abs(read.execute({}).bias)<1e-12);
checkDgpPlot();
assert.match(elements.get('bias-direction-current').textContent,/Sleep has no direct effect/);
assert.match(elements.get('second-error-explanation').textContent,/just noise/);
assert.match(elements.get('recentered-error-distribution-note').innerHTML,/just normally distributed Noise/);
assert.equal(read.execute({}).selectedStudent.v,read.execute({}).selectedStudent.u);
configure.execute({rho:0,b2:6});
assert.equal(read.execute({}).bias,0);
assert.match(elements.get('error-centering-explanation').innerHTML,/mean 42.00/);
assert.match(elements.get('second-error-explanation').textContent,/flat at zero/);
assert.equal(read.execute({}).b2,6);
checkDgpPlot();
for(const correlation of [.6,-.45]){
 elements.get('rho').oninput({target:{value:String(correlation)}});
 const beforeZero=read.execute({});
 assert.equal(elements.get('restore-correlation').disabled,true);
 elements.get('zero-correlation').onclick();
 assert.equal(read.execute({}).rho,0);
 assert.equal(elements.get('restore-correlation').disabled,false);
 elements.get('zero-correlation').onclick();
 elements.get('restore-correlation').onclick();
 assert.deepEqual(read.execute({}),beforeZero,'Restoring correlation preserves the sample, sleep coefficient, and selection');
 assert.equal(elements.get('restore-correlation').disabled,true);
}
assert.throws(()=>configure.execute({b2:7}));assert.throws(()=>configure.execute({b2:NaN}));
configure.execute({rho:.85,b2:3});
const before=read.execute({}).selectedStudent.id;elements.get('random-student').onclick();
assert.notEqual(read.execute({}).selectedStudent.id,before);
assert.match(elements.get('student-characteristics').innerHTML,/hours\/day/);
elements.get('resample').onclick();
assert.ok(!full.innerHTML.includes('<details'));
console.log('Runtime smoke test: equations, plots, student selection, sampling, both sliders, bias signs, and recentering pass in a DOM stand-in.');
