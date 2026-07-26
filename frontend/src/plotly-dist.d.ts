// El paquete plotly.js-dist-min no incluye tipos propios; reusamos los de
// @types/plotly.js (que tipan el módulo 'plotly.js').
declare module 'plotly.js-dist-min' {
  import Plotly from 'plotly.js';
  export = Plotly;
}
