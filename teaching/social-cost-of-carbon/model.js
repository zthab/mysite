// Consumption uses a common reference unit. Additive normalization leaves marginal utility ratios unchanged.
export function utility(x, eta) {
  if (!(x > 0)) throw new RangeError('Consumption must be positive.');
  return Math.abs(1-eta)<1e-8 ? Math.log(x) : Math.expm1((1-eta)*Math.log(x))/(1-eta);
}
export const marginalUtility = (x, eta) => Math.pow(x, -eta);
export const ramseyRate = (rho, eta, g) => Math.expm1(Math.log1p(rho)+eta*Math.log1p(g));
export const discountFactor = (r, years) => Math.exp(-years*Math.log1p(r));
export function countryCalculation(countries, payerConsumption, eta, rho, years) {
  const timeFactor=discountFactor(rho,years);
  const rows=countries.map(country=> {
    // Millions of people × microdollars per person per tonne = dollars per tonne.
    const damage=country.population*country.damage;
    const weight=Math.pow(payerConsumption/country.consumption,eta);
    return {...country,damageDollars:damage,weight,timeFactor,contribution:damage*weight*timeFactor};
  });
  return {rows,timeFactor,rawDamages:rows.reduce((a,c)=>a+c.damageDollars,0),scc:rows.reduce((a,c)=>a+c.contribution,0)};
}
export function poorestRecipientComparison(countries, payerConsumption, eta, rho, years) {
  const poorestIndex=countries.reduce((best,country,i)=>country.consumption<countries[best].consumption?i:best,0);
  const current=countryCalculation(countries,payerConsumption,eta,rho,years);
  const spared=countryCalculation(countries.map((country,i)=>i===poorestIndex?{...country,damage:0}:country),payerConsumption,eta,rho,years);
  return {current,spared,poorest:current.rows[poorestIndex],poorestIndex,difference:current.scc-spared.scc};
}
export const defaults=()=>({eta:1,c:40,rho:0.5,g:1.5,k:3,years:50,payer:40,slope:0.02,method:'prescriptive',countries:[
  {name:"Ruby's country",population:10,consumption:60,damage:0.2},
  {name:"Juno's country",population:30,consumption:25,damage:0.5},
  {name:"Zahra's country",population:60,consumption:10,damage:0.8}
]});
