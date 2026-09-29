import {tex} from './math.js';
const C={plane:'#8a785d',residual:'#916b2e',error:'#324a3b',ink:'#262420',study:'#574d3f',sleep:'#6b665d'};
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const fmt = n => (Math.abs(n) < .0005 ? 0 : n).toFixed(2);
export const color=z=>{const t=clamp((z-5)/4,0,1);return `rgb(${145-Math.round(85*t)},${154-Math.round(73*t)},${133-Math.round(70*t)})`;};
export function projectPoint(x, z, y, view, bounds, width, height, flat) {
  const nx = (x-(bounds.xCenter||0)) / bounds.x, nz = (z-(bounds.zCenter||0)) / bounds.z, ny = (y - bounds.center) / bounds.y;
  const ca = Math.cos(view.yaw), sa = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const horizontal = ca * nx + sa * nz, depth = -sa * nx + ca * nz;
  return {
    x: width * (.5 + view.panX) + view.zoomX * ((1 - flat) * Math.min(width*.28,height*.30) * horizontal + flat * width*.31 * nx),
    y: height * (.48 + view.panY) - view.zoomY * ((1 - flat) * Math.min(width*.28,height*.30) * (cp * ny + sp * depth) + flat * height*.32 * ny),
    depth: cp * depth - sp * ny
  };
}
export function dragView(start, dx, dy, axis, is3D, width, height) {
  const next = { ...start };
  if (is3D) {
    if (axis !== 'y') next.yaw = clamp(start.yaw + dx / 160, -Math.PI, Math.PI);
    if (axis !== 'x') next.pitch = clamp(start.pitch - dy / 180, -1.35, 1.35);
  } else {
    if (axis !== 'y') next.panX = clamp(start.panX + dx / width, -.4, .4);
    if (axis !== 'x') next.panY = clamp(start.panY + dy / height, -.4, .4);
  }
  return next;
}
const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const defaultView = () => ({ yaw: .52, pitch: .42, panX: 0, panY: 0, zoomX: 1, zoomY: 1 });
export class Plot {
  constructor(id, config, getModel, onSelect) {
    this.id = id; this.config = config; this.getModel = getModel; this.onSelect = onSelect;
    this.view = defaultView(); this.is3D=['true','full','person'].includes(config.mode);this.flat=this.is3D?0:1; this.points = []; this.axes = [];
    this.root = document.getElementById(id);
    if (config.field) this.root.classList.add('compact');
    this.fittedPlane = true; this.showTrue = false; this.scoreView = null;
    this.root.innerHTML=`<h3>${config.title}</h3><div class="plot-stage"><canvas tabindex="0" aria-label="${config.title}. Arrow keys move the view; R resets it."></canvas><div class="plot-labels"></div></div><div class="legend"></div><div class="figure-actions">${config.mode==='full'?'<label class="truth-toggle"><input type="checkbox" data-action="true-relationship"> True relationship</label>':''}${this.is3D?'<button data-action="study-view">Study–score view</button><button data-action="sleep-view">Sleep–score view</button>':''}${config.mode==='omitted'?'<button data-action="flatten">Replay collapse</button>':''}<button data-action="reset">Reset view</button></div><p class="plot-hint"></p>`;
    this.canvas = this.root.querySelector('canvas'); this.ctx = this.canvas.getContext('2d');
    this.root.querySelectorAll('[data-action]').forEach(b => b.onclick = () => {
      if (b.dataset.action === 'true-relationship') this.showTrue=b.checked;
      else if (b.dataset.action === 'flatten') this.animateFlatten();
      else if (b.dataset.action === 'study-view' || b.dataset.action === 'sleep-view') {cancelAnimationFrame(this.animation);this.scoreView=b.dataset.action==='study-view'?'study':'sleep';this.view=defaultView();this.is3D=false;this.flat=1;}
      else if (b.dataset.action === 'reset') this.resetView();
      else this.zoom(b.dataset.action === 'zoom-in' ? 1.15 : 1 / 1.15);
      this.syncControls(); this.draw();
    });
    this.bindPointer(); this.syncControls();
    this.resizeObserver = new ResizeObserver(() => this.draw()); this.resizeObserver.observe(this.canvas);
  }
  resetView() {cancelAnimationFrame(this.animation);this.scoreView=null;this.view=defaultView();this.is3D=['true','full','person'].includes(this.config.mode);this.flat=this.is3D?0:1;}
  syncControls() {this.root.querySelectorAll('[data-action]').forEach(b=>{if(['study-view','sleep-view'].includes(b.dataset.action))b.setAttribute('aria-pressed',String(b.dataset.action===`${this.scoreView}-view`));});}
  zoom(factor) { this.view.zoomX = clamp(this.view.zoomX * factor, .45, 2); this.view.zoomY = clamp(this.view.zoomY * factor, .45, 2); }
  animateFlatten() {
    cancelAnimationFrame(this.animation); this.view = defaultView(); this.syncControls();
    const start = performance.now(), duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1400;
    const tick = now => { const t = duration ? Math.min(1, (now - start) / duration) : 1; this.flat = t * t * (3 - 2 * t); this.draw(); if (t < 1) this.animation = requestAnimationFrame(tick); };
    this.animation = requestAnimationFrame(tick);
  }
  bindPointer() {
    const canvas = this.canvas;
    const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const p = local(e), axis = this.axes.find(a => distanceToSegment(p, a.start, a.end) < 13)?.key;
      this.drag = { ...p, view: { ...this.view }, axis, moved: false }; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      const p = local(e);
      if (!this.drag) { canvas.style.cursor = this.axes.some(a => distanceToSegment(p, a.start, a.end) < 13) ? 'move' : 'grab'; return; }
      const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
      if (Math.hypot(dx, dy) < 3 && !this.drag.moved) return;
      this.drag.moved = true; cancelAnimationFrame(this.animation);
      if (!this.is3D) this.flat = 1;
      this.view = dragView(this.drag.view, dx, dy, this.drag.axis, this.is3D, canvas.clientWidth, canvas.clientHeight);
      this.syncControls(); this.draw();
    });
    canvas.addEventListener('pointerup', e => {
      if (this.drag && !this.drag.moved && !this.config.field) { const p = local(e); const near = this.points.map(d => ({ ...d, distance: Math.hypot(d.x - p.x, d.y - p.y) })).sort((a, b) => a.distance - b.distance)[0]; if (near?.distance < 16) this.onSelect(near.id); }
      this.drag = null;
    });
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
    canvas.addEventListener('lostpointercapture', () => { this.drag = null; });
    canvas.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'r', 'R'].includes(e.key)) return;
      e.preventDefault();
      if (e.key.toLowerCase() === 'r') this.resetView();
      else if (['+', '=', '-'].includes(e.key)) this.zoom(e.key === '-' ? 1 / 1.15 : 1.15);
      else { const d = e.shiftKey ? 30 : 10, dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0; this.view = dragView(this.view, dx, dy, null, this.is3D, canvas.clientWidth, canvas.clientHeight); }
      this.syncControls(); this.draw();
    });
  }
  drawScoreView() {
    const {state,result}=this.getModel(),selected=result.data[state.selected],person=this.config.mode==='person',isTrue=this.config.mode==='true',study=this.scoreView==='study';
    const key=study?'x':'z',otherKey=study?'z':'x',axisName=study?'Study':'Sleep',otherName=study?'Sleep':'Study';
    this.root.querySelector('h3').textContent=`${axisName}–score view: ${isTrue?'true relationship':'fitted line'}`;
    const held=person?selected[otherKey]:result.data.reduce((sum,d)=>sum+d[otherKey],0)/result.data.length;
    const coefficients=isTrue?{a:result.model.b0,b1:result.model.b1,b2:result.model.b2}:result.full;
    const slope=study?coefficients.b1:coefficients.b2,otherSlope=study?coefficients.b2:coefficients.b1;
    const fitted=value=>coefficients.a+slope*value+otherSlope*held;
    const truth=value=>result.model.b0+(study?result.model.b1:result.model.b2)*value+(study?result.model.b2:result.model.b1)*held;
    const lo=person?Math.max(0,selected[key]-.35):study?0:4,hi=person?selected[key]+1.2:study?8:10;
    const data=person?result.data.filter(d=>d.x>=Math.max(0,selected.x-.35)&&d.x<=selected.x+1.2&&d.z>=selected.z-.35&&d.z<=selected.z+1.2):result.data;
    const scores=[...data.map(d=>d.y),fitted(lo),fitted(hi),...(this.showTrue?[truth(lo),truth(hi)]:[])];
    const tickSize=person?1:10,low=Math.floor((Math.min(...scores)-1)/tickSize)*tickSize,high=Math.ceil((Math.max(...scores)+1)/tickSize)*tickSize;
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;if(!width||!height)return;
    const dpr=window.devicePixelRatio||1,c=this.ctx;this.canvas.width=width*dpr;this.canvas.height=height*dpr;c.scale(dpr,dpr);
    const bounds={x:(hi-lo)/2,xCenter:(hi+lo)/2,z:1,y:(high-low)/2,center:(high+low)/2};
    const project=(x,y)=>projectPoint(x,0,y,this.view,bounds,width,height,1),labels=[];
    const label=(source,p,col=C.ink,dx=0,dy=0)=>labels.push(`<span class="plot-label" style="left:${clamp(p.x+dx,65,width-65)}px;top:${clamp(p.y+dy,20,height-20)}px;color:${col}">${tex(source)}</span>`);
    const segment=(a,b,col,weight=1,dash=[])=>{const p=project(...a),q=project(...b);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle=col;c.lineWidth=weight;c.setLineDash(dash);c.stroke();c.setLineDash([]);};
    c.save();c.beginPath();c.rect(4,4,width-8,height-8);c.clip();
    c.font='14px Georgia, serif';c.fillStyle='#6b665d';
    for(let x=Math.ceil(lo);x<=hi;x+=person?1:2){segment([x,low],[x,high],'#e8e4dc');const p=project(x,low);c.textAlign='center';c.fillText(String(x),p.x,p.y+20);}
    for(let i=0;i<=5;i++){const y=low+i*(high-low)/5;segment([lo,y],[hi,y],'#e8e4dc');const p=project(lo,y);c.textAlign='right';c.fillText(Number(y.toFixed(1)).toString(),p.x-12,p.y+4);}c.textAlign='left';
    this.axes=[{key:'x',start:project(lo,low),end:project(hi,low)},{key:'y',start:project(lo,low),end:project(lo,high)}];
    segment([lo,low],[hi,low],'#918b7e',1.5);segment([lo,low],[lo,high],'#918b7e',1.5);
    label(`\\text{${axisName} hours}`,project(hi,low),C.ink,15,38);label('\\text{Test score}',project(lo,high),C.ink,0,-18);
    segment([lo,fitted(lo)],[hi,fitted(hi)],isTrue?C.error:C.plane,2.7);
    if(this.showTrue)segment([lo,truth(lo)],[hi,truth(hi)],C.error,2.5,[6,4]);
    this.points=data.map(d=>({...project(d[key],d.y),id:d.id,z:d.z}));
    this.points.forEach(p=>{const highlight=person&&p.id===state.selected;c.globalAlpha=highlight?1:person?.16:.55;c.fillStyle=highlight?C.residual:color(p.z);c.beginPath();c.arc(p.x,p.y,highlight?6:3.6,0,2*Math.PI);c.fill();});c.globalAlpha=1;
    if(person){
      segment([selected[key],selected.fullPrediction],[selected[key],selected.y],C.residual,3);
      label('\\hat e_{1i}='+fmt(selected.fullResidual),project(selected[key],(selected.fullPrediction+selected.y)/2),C.residual,55,0);
      const from=project(selected[key],selected.fullPrediction),to=project(selected[key]+1,selected.fullPrediction+slope),angle=Math.atan2(to.y-from.y,to.x-from.x);
      segment([selected[key],selected.fullPrediction],[selected[key]+1,selected.fullPrediction+slope],study?C.study:C.sleep,2.3);
      c.beginPath();c.moveTo(to.x,to.y);c.lineTo(to.x-8*Math.cos(angle-.4),to.y-8*Math.sin(angle-.4));c.lineTo(to.x-8*Math.cos(angle+.4),to.y-8*Math.sin(angle+.4));c.closePath();c.fillStyle=study?C.study:C.sleep;c.fill();
      label(`\\hat\\beta_${study?1:2}=${fmt(slope)}`,to,study?C.study:C.sleep,-30,-20);
    }
    c.restore();this.root.querySelector('.plot-labels').innerHTML=labels.join('');
    const legend=[[isTrue?C.error:C.plane,`${isTrue?'True line':'Fitted line'}: ${axisName.toLowerCase()} slope ${fmt(slope)}`],...(isTrue?[[C.plane,`${data.length} students (including noise)`]]:[]),...(person?[[C.residual,'Selected student and residual']]:[]),...(this.showTrue?[[C.error,'True relationship (dashed)']]:[])];
    this.root.querySelector('.legend').innerHTML=legend.map(([col,t])=>`<span><i class="swatch" style="background:${col}"></i>${t}</span>`).join('');
    this.root.querySelector('.plot-hint').textContent=`${otherName} is held at ${fmt(held)} hours (${person?'this student’s value':'the sample average'}) for the ${isTrue?'true':'fitted'} line. Dots show observed scores. Reset view restores the 3D plane.`;
    this.canvas.setAttribute('aria-label',`${axisName}–score view. ${isTrue?'True':'Fitted'} line holding ${otherName.toLowerCase()} at ${fmt(held)} hours. Arrow keys move the view; R restores the 3D plane.`);
  }
  draw() {
    if(this.scoreView)return this.drawScoreView();
    this.root.querySelector('h3').textContent=this.config.title;
    this.canvas.setAttribute('aria-label',`${this.config.title}. Arrow keys move the view; R resets it.`);
    const {state,result}=this.getModel(), data=result.data, model=result.model, config=this.config, c=this.ctx;
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;if(!width||!height)return;
    const dpr=window.devicePixelRatio||1;this.canvas.width=width*dpr;this.canvas.height=height*dpr;c.scale(dpr,dpr);
    const plane=['true','omitted'].includes(config.mode)?{a:model.b0,b1:model.b1,b2:model.b2}:result.full, selected=data[state.selected], labels=[];
    const label=(source,p,col=C.ink,dx=0,dy=0)=>labels.push(`<span class="plot-label" style="left:${clamp(p.x+dx,65,width-65)}px;top:${clamp(p.y+dy,20,height-20)}px;color:${col}">${tex(source)}</span>`);
    const person=config.mode==='person';
    const xmin=person?Math.max(0,selected.x-.35):config.mode==='omitted'?1:0,xmax=person?selected.x+1.2:config.mode==='omitted'?7:8,zmin=person?selected.z-.35:4,zmax=person?selected.z+1.2:10;
    const scoreRange=data.map(d=>d.y);
    if(['true','full'].includes(config.mode))for(const x of [xmin,xmax])for(const z of [zmin,zmax])scoreRange.push(plane.a+plane.b1*x+plane.b2*z,model.b0+model.b1*x+model.b2*z);
    let low=Math.min(0,Math.floor(Math.min(...scoreRange)/10)*10),high=Math.max(100,Math.ceil(Math.max(...scoreRange)/10)*10);
    if(config.field){const values=data.map(d=>d[config.field]);low=Math.min(0,Math.floor(Math.min(...values)/5)*5);high=Math.max(5,Math.ceil(Math.max(...values)/5)*5);if(config.field==='residual'){low=Math.min(-10,low);high=Math.max(10,high);}}
    if(config.field==='z'){low=4;high=10;}
    if(config.field==='v'){const extent=Math.max(10,Math.abs(low),Math.abs(high));low=-extent;high=extent;}
    if(config.mode==='omitted'){const meanSleep=data.reduce((sum,d)=>sum+d.z,0)/data.length;const values=[...data.map(d=>d.y),...([xmin,xmax].flatMap(x=>[result.fit.a+result.fit.b*x,plane.a+plane.b1*x+plane.b2*meanSleep]))];low=Math.floor((Math.min(...values)-2)/5)*5;high=Math.ceil((Math.max(...values)+2)/5)*5;}
    if(person){const corners=[...[[xmin,zmin],[xmin,zmax],[xmax,zmin],[xmax,zmax]].map(([x,z])=>result.full.a+result.full.b1*x+result.full.b2*z),selected.y];low=Math.floor(Math.min(...corners)-1);high=Math.ceil(Math.max(...corners)+1);}
    const bounds={x:(xmax-xmin)/2,xCenter:(xmin+xmax)/2,z:(zmax-zmin)/2,zCenter:(zmin+zmax)/2,y:(high-low)/2,center:(high+low)/2};
    const project=(x,z,y)=>projectPoint(x,z,y,this.view,bounds,width,height,this.flat);
    const segment=(a,b,color,weight=1,dash=[])=>{const p=project(...a),q=project(...b);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle=color;c.lineWidth=weight;c.setLineDash(dash);c.stroke();c.setLineDash([]);};
    const fitted=(x,z)=>plane.a+plane.b1*x+plane.b2*z;
    const arrow=(a,b,color)=>{segment(a,b,color,2.3);const p=project(...a),q=project(...b),angle=Math.atan2(q.y-p.y,q.x-p.x);c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x-8*Math.cos(angle-.4),q.y-8*Math.sin(angle-.4));c.lineTo(q.x-8*Math.cos(angle+.4),q.y-8*Math.sin(angle+.4));c.closePath();c.fillStyle=color;c.fill();};
    c.save();c.beginPath();c.rect(4,4,width-8,height-8);c.clip();
    if(this.flat>.01){for(let x=Math.ceil(xmin);x<=xmax;x+=2)segment([x,7,low],[x,7,high],'#e8e4dc');for(let i=0;i<=5;i++){const y=low+i*(high-low)/5;segment([xmin,7,y],[xmax,7,y],'#e8e4dc');}}
    if(this.flat<.99){
      const cube=[[xmin,zmin,low],[xmax,zmin,low],[xmax,zmax,low],[xmin,zmax,low],[xmin,zmin,high],[xmax,zmin,high],[xmax,zmax,high],[xmin,zmax,high]];
      for(const[a,b]of[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])segment(cube[a],cube[b],'#d4d0c6');
      for(let x=Math.ceil(xmin);x<=xmax;x+=person?1:2)segment([x,zmin,low],[x,zmax,low],'#ebe7de');for(let z=Math.ceil(zmin);z<=zmax;z+=person?1:2)segment([xmin,z,low],[xmax,z,low],'#ebe7de');
      const corners=[[xmin,zmin],[xmax,zmin],[xmax,zmax],[xmin,zmax]];c.beginPath();corners.forEach(([x,z],i)=>{const p=project(x,z,fitted(x,z));i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.closePath();c.fillStyle=`rgba(${config.mode==='true'?'50,74,59':'138,120,93'},${.15*(1-this.flat)})`;c.fill();
      for(let x=Math.ceil(xmin);x<=xmax;x+=person?.5:1)segment([x,zmin,fitted(x,zmin)],[x,zmax,fitted(x,zmax)],config.mode==='true'?C.error:'#c9bfac');
      for(let z=Math.ceil(zmin);z<=zmax;z+=person?.5:1)segment([xmin,z,fitted(xmin,z)],[xmax,z,fitted(xmax,z)],config.mode==='true'?C.error:'#c9bfac');
      if(config.mode==='full'&&this.showTrue){const truth=(x,z)=>model.b0+model.b1*x+model.b2*z;for(let x=xmin;x<=xmax;x+=1)segment([x,zmin,truth(x,zmin)],[x,zmax,truth(x,zmax)],'#324a3b',1.4,[5,3]);for(let z=zmin;z<=zmax;z+=1)segment([xmin,z,truth(xmin,z)],[xmax,z,truth(xmax,z)],'#324a3b',1.4,[5,3]);}
    }
    const edgeZ=this.flat<.99?zmin:7;
    const axes=[{key:'x',a:[xmin,edgeZ,low],b:[xmax,edgeZ,low],label:'Study hours'},{key:'y',a:[xmin,edgeZ,low],b:[xmin,edgeZ,high],label:config.field==='z'?'Sleep hours':config.field==='v'?'Recentered error':config.field?'Residual':'Test score'}];
    if(this.flat<.99)axes.push({key:'z',a:[xmin,zmin,low],b:[xmin,zmax,low],label:'Sleep hours'});
    const visibleAxes=axes.filter(a=>{const p=project(...a.a),q=project(...a.b);return Math.hypot(p.x-q.x,p.y-q.y)>15;});
    this.axes=visibleAxes.map(a=>({key:a.key,start:project(...a.a),end:project(...a.b)}));
    visibleAxes.forEach(a=>{segment(a.a,a.b,'#918b7e',1.5);const p=project(...a.b);c.beginPath();c.arc(p.x,p.y,5,0,2*Math.PI);c.fillStyle='#fff';c.fill();c.strokeStyle='#8a8170';c.lineWidth=1.5;c.stroke();const axisTex=config.field==='v'&&a.key==='y'?String.raw`u_i\text{ (points)}`:'\\text{'+a.label+'}';label(axisTex,p,C.ink,a.key==='y'?0:15,a.key==='y'?-18:21);});
    c.font='14px Georgia, serif';c.fillStyle='#6b665d';for(let x=Math.ceil(xmin);x<=xmax;x+=person?1:2){const p=project(x,edgeZ,low);c.textAlign='center';c.fillText(String(x),p.x,p.y+20);}
    const tickCount=config.field==='v'?4:5;for(let i=0;i<=tickCount;i++){const y=low+i*(high-low)/tickCount,p=project(xmin,edgeZ,y);c.textAlign='right';c.fillText(Number(y.toFixed(1)).toString(),p.x-12,p.y+4);}
    if(this.flat<.99)for(let z=Math.ceil(zmin);z<=zmax;z+=person?1:2){const p=project(xmin,z,low);c.textAlign='left';c.fillText(String(z),p.x+8,p.y+15);}c.textAlign='left';
    if(config.field==='v')segment([xmin,7,0],[xmax,7,0],'#918b7e',1.2,[4,4]);
    if(config.field){const expectation=config.field==='z'?result.expectedSleep:config.field==='v'?result.expectedError:()=>0;segment([xmin,7,expectation(xmin)],[xmax,7,expectation(xmax)],config.field==='residual'?C.residual:C.error,2.5);}
    else if(config.mode==='omitted'&&this.flat>.01){
      segment([xmin,7,fitted(xmin,data.reduce((sum,d)=>sum+d.z,0)/data.length)],[xmax,7,fitted(xmax,data.reduce((sum,d)=>sum+d.z,0)/data.length)],'#324a3b',2.7,[6,4]);
      segment([xmin,7,result.fit.a+result.fit.b*xmin],[xmax,7,result.fit.a+result.fit.b*xmax],C.residual,2.5);
    }
    const visibleData=person?data.filter(d=>d.x>=xmin&&d.x<=xmax&&d.z>=zmin&&d.z<=zmax):data;
    this.points=visibleData.map(d=>({...project(d.x,config.field?7:d.z,config.field?d[config.field]:d.y),id:d.id,z:d.z})).sort((a,b)=>a.depth-b.depth);
    this.points.forEach(p=>{const highlight=['person','omitted'].includes(config.mode)&&p.id===state.selected;c.globalAlpha=highlight?1:config.mode==='person'?.16:.55;c.fillStyle=highlight?C.residual:color(p.z);c.beginPath();c.arc(p.x,p.y,highlight?6:3.6,0,2*Math.PI);c.fill();if(highlight){c.strokeStyle='#fff';c.lineWidth=1.5;c.stroke();}});c.globalAlpha=1;
    if(config.mode==='person'){
      const foot=[selected.x,selected.z,selected.fullPrediction],point=[selected.x,selected.z,selected.y];
      segment(foot,point,C.residual,3);const f=project(...foot);c.beginPath();c.arc(f.x,f.y,4,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.strokeStyle=C.residual;c.lineWidth=2;c.stroke();
      label('\\hat e_{1i}='+fmt(selected.fullResidual),project(selected.x,selected.z,(selected.fullPrediction+selected.y)/2),C.residual,55,0);
      const directions=[{axis:0,coefficient:plane.b1,symbol:'\\hat\\beta_1',color:C.study,dx:42,dy:-19},{axis:1,coefficient:plane.b2,symbol:'\\hat\\beta_2',color:C.sleep,dx:-42,dy:18}];
      for(const d of directions){const end=[...foot];end[d.axis]+=1;end[2]+=d.coefficient;arrow(foot,end,d.color);label(d.symbol+'='+fmt(d.coefficient),project(...end),d.color,d.dx,d.dy);}
    }
    if(config.mode==='omitted'&&this.flat>.99){
      const datum=project(selected.x,7,selected.y),fit=project(selected.x,7,result.fit.a+result.fit.b*selected.x);
      const bracket=(base,end,offset,col,symbol,value)=>{const x=end.x+offset;c.strokeStyle=col;c.lineWidth=2.7;c.beginPath();c.moveTo(x,base.y);c.lineTo(x,end.y);c.moveTo(x-4,base.y);c.lineTo(x+4,base.y);c.moveTo(x-4,end.y);c.lineTo(x+4,end.y);c.stroke();label(symbol+'='+fmt(value),{x,y:(base.y+end.y)/2},col,offset<0?-51:51,0);};
      bracket(fit,datum,-9,C.residual,'\\hat e_{2i}',selected.residual);
    }
    c.restore();this.root.querySelector('.plot-labels').innerHTML=labels.join('');
    const legend=config.mode==='true'?[[C.error,'True relationship (without noise)'],[C.plane,`${data.length} students (including noise)`]]:config.mode==='full'?[[C.plane,'Fitted plane'],...(this.showTrue?[[C.error,'True relationship (dashed)']]:[])]:config.mode==='person'?[[C.plane,'Fitted plane'],[C.residual,'Selected student and residual']]:config.mode==='omitted'?[['#324a3b',`True model: study slope ${fmt(model.b1)}`],[C.residual,`Short regression: study slope ${fmt(result.fit.b)}`]]:config.field==='v'?[[C.error,'Expected error given study hours'],['#918b7e','Zero reference']]:[[config.field==='z'?C.error:C.residual,config.field==='z'?'Population relationship between sleep and study':'OLS residual trend: zero']];
    this.root.querySelector('.legend').innerHTML=legend.map(([col,t])=>`<span><i class="swatch" style="background:${col}"></i>${t}</span>`).join('');
    this.root.querySelector('.plot-hint').textContent=person?'Close-up centered on the selected student. Drag to rotate; reset restores this close-up.':this.is3D?'Drag to rotate. Drag an axis to turn or tilt the view.':config.field==='v'?`Each dot plots study hours per day against ${fmt(model.b2)} × (sleep hours − 7) + noise, in score points. The green line is the population conditional mean.`:config.field?'Drag an axis to move the view.':'The brown distance is the selected student’s residual from the short regression.';
  }
}
