import assert from 'node:assert/strict';
import {simulate,MODEL,mean,regress} from '../../teaching/omitted-variable-bias/sim.js';
for(const b2 of [-6,-3,0,3,6])for(const rho of [-.95,-.5,0,.5,.95]){
 const r=simulate({rho,b2}),d=r.data;
 assert.equal(d.length,500);
 for(const p of d){
  assert.ok(p.x>=1&&p.x<=7);assert.ok(p.z>=5&&p.z<=9);
  assert.ok(Math.abs(p.y-(20+5*p.x+b2*p.z+p.u))<1e-10);
  assert.ok(Math.abs(p.y-(20+5*p.x+p.omittedError))<1e-10);
  assert.ok(Math.abs(p.omittedError-(b2*p.z+p.u))<1e-10);
  assert.ok(Math.abs(p.v-(b2*(p.z-7)+p.u))<1e-10);
  assert.ok(Math.abs(p.y-(20+7*b2+5*p.x+p.v))<1e-10);
  assert.ok(Math.abs(p.y-p.fullPrediction-p.fullResidual)<1e-10);
 }
 assert.ok(Math.abs(mean(d.map(p=>p.residual)))<1e-10);
 assert.ok(Math.abs(mean(d.map(p=>p.fullResidual)))<1e-10);
 for(const key of ['x','z'])assert.ok(Math.abs(regress(d.map(p=>p[key]),d.map(p=>p.fullResidual)).b)<1e-10);
 assert.ok(Math.abs(regress(d.map(p=>p.x),d.map(p=>p.residual)).b)<1e-10);
 assert.ok(Math.abs(r.fit.b-(5+b2*r.delta.b+r.noise.b))<1e-10);
 assert.ok(Math.abs(r.fit.b-r.full.b1-r.full.b2*r.delta.b)<1e-10);
 assert.ok(Math.abs(r.expectedError(4))<1e-10);
 assert.ok(Math.abs((r.expectedError(5)-r.expectedError(4))-r.bias)<1e-10);
 assert.equal(r.expectedOmittedError(4),7*b2);
 assert.ok(Math.abs(r.bias-b2*rho*.75/Math.sqrt(3))<1e-12);
 assert.ok(Math.abs((r.expectedOmittedError(5)-r.expectedOmittedError(4))-r.bias)<1e-10);
 assert.ok(Math.abs(regress(d.map(p=>p.x),d.map(p=>p.omittedError)).b-(r.fit.b-5))<1e-10);
}
const big=simulate({n:150000,rho:.7});
assert.ok(Math.abs(big.fit.b-big.populationSlope)<.03);
assert.ok(Math.abs(big.full.b1-5)<.03);assert.ok(Math.abs(big.full.b2-3)<.03);
for(const x of [2,4,6]){
 const bin=big.data.filter(d=>Math.abs(d.x-x)<.1);
 assert.ok(Math.abs(mean(bin.map(d=>d.v))-big.expectedError(x))<.15);
 assert.ok(Math.abs(mean(bin.map(d=>d.omittedError))-big.expectedOmittedError(x))<.15);
 assert.ok(Math.abs(mean(bin.map(d=>d.projectionError)))<.15);
}
assert.ok(Math.abs(simulate({rho:0}).bias)<1e-12);
console.log('Realistic hour bounds, error decomposition, full/short OLS identities, population slope, and conditional means pass.');
