// Estado global da interface (controlador). Preenchido por main.js.
export const G = {
  s: null,            // estado da simulação
  settings: null,
  speed: 1,
  office: null,       // renderizador
  refresh() {},       // atualiza HUD/escritório
  save() {},          // autosave
  tut() {},           // dica do tutorial
  setSpeed() {},
  newGame() {},
  loadState() {},
};
