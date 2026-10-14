import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {utility,marginalUtility,ramseyRate,discountFactor,countryCalculation,poorestRecipientComparison,defaults} from '../../teaching/social-cost-of-carbon/model.js';
const close=(x,y,tol=1e-8)=>assert.ok(Math.abs(x-y)<tol,`${x} differs from ${y}`);
for(const eta of [0,.5,.999999,1,1.000001,2,4])for(const x of [.5,1,4,10]){
  close((utility(x+1e-6,eta)-utility(x-1e-6,eta))/2e-6,marginalUtility(x,eta),2e-6);
  close(marginalUtility(2*x,eta)/marginalUtility(x,eta),2**-eta);
}
close(utility(1,2),0);close(utility(4,1),Math.log(4));close(ramseyRate(.005,1,-.01),-.00505);
for(const [rho,eta,g,T] of [[.005,1,.015,50],[0,0,.04,150],[.03,4,.04,100],[.005,1,-.01,50]]){
  const r=ramseyRate(rho,eta,g);close(discountFactor(r,T),discountFactor(rho,T)*Math.pow(1+g,-eta*T));
}
const d=defaults(),calc=countryCalculation(d.countries,40,1,.005,50);
close(calc.rawDamages,65);close(calc.rows[0].damageDollars,2);close(calc.rows[2].weight,4);
close(calc.scc,(2*(40/60)+15*(40/25)+48*4)*Math.pow(1.005,-50));
close(countryCalculation(d.countries,40,0,.005,50).scc,65*Math.pow(1.005,-50));
const equal=d.countries.map(c=>({...c,consumption:40}));close(countryCalculation(equal,40,4,.005,50).scc,65*Math.pow(1.005,-50));
const rescaled=d.countries.map(c=>({...c,consumption:c.consumption*10}));close(countryCalculation(rescaled,400,1,.005,50).scc,calc.scc);
assert.ok(countryCalculation(d.countries,40,1,.01,50).scc<calc.scc);
assert.ok(countryCalculation(d.countries,80,1,.005,50).scc>calc.scc);
const comparison=poorestRecipientComparison(d.countries,40,1,.005,50);
assert.equal(comparison.poorestIndex,2);
close(comparison.difference,calc.rows[2].contribution);
close(comparison.spared.rawDamages,17);
close(d.countries[2].damage,.8); // The displayed counterfactual must not mutate the inputs.
const poorer=d.countries.map((c,i)=>i===2?{...c,consumption:5}:c);
close(countryCalculation(poorer,40,1,.005,50).rows[2].contribution,2*calc.rows[2].contribution);
close(countryCalculation(poorer,40,0,.005,50).scc,countryCalculation(d.countries,40,0,.005,50).scc);
const undamaged=d.countries.map((c,i)=>i===2?{...c,damage:0}:c);
const undamagedPoorer=undamaged.map((c,i)=>i===2?{...c,consumption:5}:c);
close(countryCalculation(undamagedPoorer,40,1,.005,50).scc,countryCalculation(undamaged,40,1,.005,50).scc);
// Independently differentiate a feasible two-period objective at an interior optimum.
// These are synthetic values for checking algebra, not the website's calibration.
const P=2,phi=-.1,rho=.01,c1=100,c2=110,K=10,M=5;
const R=c1/((1+rho)*c2),a=1/(R*(-phi)*P),A=2*Math.sqrt(K)/R;
const f=k=>A*Math.sqrt(k),e=m=>100-a*m,y1=c1+K+M,y2=c2-f(K)-phi*P*e(M);
const W=(k,m)=>P*(Math.log((y1-k-m)/10000)+Math.log((y2+f(k)+phi*P*e(m))/10000)/(1+rho));
close((W(K+1e-4,M)-W(K-1e-4,M))/2e-4,0,1e-8);
close((W(K,M+1e-4)-W(K,M-1e-4))/2e-4,0,1e-8);
const lambda1=P/c1,lambda2=P/((1+rho)*c2);
close(lambda2/lambda1,R);close(-lambda1+lambda2*A/(2*Math.sqrt(K)),0);
close(-lambda1+lambda2*phi*P*(-a),0);close(1/a,(-phi)*P*R);
const html=readFileSync('teaching/social-cost-of-carbon/index.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
for(const [,path] of html.matchAll(/(?:src|href)="([^"#:]+)"/g)){if(!path.startsWith('http'))assert.ok(existsSync('teaching/social-cost-of-carbon/'+path),`Missing asset ${path}`);}
console.log('Passed: utility derivatives and log limit, marginal-utility ratios, exact Ramsey compounding, country units and aggregation, income scaling, sensitivity directions, and HTML assets.');
