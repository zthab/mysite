import katex from './vendor/katex/katex.mjs';
export const tex = (source, displayMode = false) => katex.renderToString(source, {displayMode, throwOnError: true, strict: 'error', output: 'htmlAndMathml'});
export const putMath = (id, source) => { document.getElementById(id).innerHTML = tex(source); };
