export const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
export function regress(x, y) {
  const mx = mean(x), my = mean(y);
  let xx = 0, xy = 0;
  for (let i = 0; i < x.length; i++) { xx += (x[i] - mx) ** 2; xy += (x[i] - mx) * (y[i] - my); }
  const b = xy / xx;
  return { a: my - b * mx, b };
}
export const MODEL = { b0: 20, b1: 5, b2: 3, sigma: 3.5, meanStudy: 4, sdStudy: Math.sqrt(3), meanSleep: 7, sdSleep: .75 };
export function simulate({ rho = .85, b2 = MODEL.b2, seed = 42, n = 500 } = {}) {
  let s = seed >>> 0;
  const random = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return (s + .5) / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
  const standardizedUniform = () => Math.sqrt(3) * (2 * random() - 1);
  const m = { ...MODEL, b2 };
  // Independent bounded inputs keep hours realistic without truncation or clipping.
  // Their population variances equal one, so the construction has correlation rho.
  const data = Array.from({ length: n }, (_, id) => {
    const studyComponent = standardizedUniform(), independentSleep = standardizedUniform();
    const x = m.meanStudy + m.sdStudy * studyComponent;
    const z = m.meanSleep + m.sdSleep * (rho * studyComponent + Math.sqrt(1 - rho * rho) * independentSleep);
    const u = m.sigma * normal(), v = m.b2 * (z - m.meanSleep) + u;
    return { id, x, z, u, v, omittedError: m.b2 * z + u, y: m.b0 + m.b2 * m.meanSleep + m.b1 * x + v };
  });
  const x = data.map(d => d.x), y = data.map(d => d.y), z = data.map(d => d.z);
  const fit = regress(x, y), delta = regress(x, z), noise = regress(x, data.map(d => d.u));
  const mx = mean(x), mz = mean(z), my = mean(y);
  let xx = 0, zz = 0, xz = 0, xy = 0, zy = 0;
  data.forEach(d => { xx += (d.x - mx) ** 2; zz += (d.z - mz) ** 2; xz += (d.x - mx) * (d.z - mz); xy += (d.x - mx) * (d.y - my); zy += (d.z - mz) * (d.y - my); });
  const denom = xx * zz - xz * xz;
  const full = { b1: (xy * zz - zy * xz) / denom, b2: (zy * xx - xy * xz) / denom };
  full.a = my - full.b1 * mx - full.b2 * mz;
  const bias = m.b2 * rho * m.sdSleep / m.sdStudy, populationSlope = m.b1 + bias;
  const populationIntercept = m.b0 + m.b2 * m.meanSleep - bias * m.meanStudy;
  data.forEach(d => { d.fullPrediction = full.a + full.b1 * d.x + full.b2 * d.z; d.fullResidual = d.y - d.fullPrediction; d.residual = d.y - fit.a - fit.b * d.x; d.projectionError = d.y - populationIntercept - populationSlope * d.x; });
  const residualSS = data.reduce((sum,d) => sum + d.fullResidual ** 2, 0);
  const totalSS = data.reduce((sum,d) => sum + (d.y-my) ** 2, 0);
  const residualVariance = residualSS / (n-3);
  full.standardErrors = {
    a: Math.sqrt(residualVariance * (1/n + (zz*mx*mx - 2*xz*mx*mz + xx*mz*mz)/denom)),
    b1: Math.sqrt(residualVariance * zz/denom),
    b2: Math.sqrt(residualVariance * xx/denom)
  };
  full.rSquared = 1-residualSS/totalSS;
  full.residualSd = Math.sqrt(residualVariance);
  const shortResidualSS = data.reduce((sum,d) => sum + d.residual ** 2, 0);
  const shortVariance = shortResidualSS / (n-2);
  fit.standardErrors = { a: Math.sqrt(shortVariance*(1/n + mx*mx/xx)), b: Math.sqrt(shortVariance/xx) };
  fit.rSquared = 1-shortResidualSS/totalSS;
  return { model: m, data, fit, delta, noise, full, bias, populationSlope, populationIntercept,
    expectedSleep: study => m.meanSleep + rho * m.sdSleep / m.sdStudy * (study - m.meanStudy),
    expectedOmittedError: study => m.b2 * m.meanSleep + bias * (study - m.meanStudy),
    expectedError: study => bias * (study - m.meanStudy) };
}
