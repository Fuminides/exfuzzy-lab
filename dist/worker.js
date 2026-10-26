/* Python and the real exFuzzy wheel run in an isolated Web Worker.
   Pyodide and the scientific packages are served from ./pyodide/ next to the app (mirrored from the official
   Pyodide 0.29.5 distribution), so the engine needs no third-party CDN at runtime. */
let python;
let booting;
let ready = false;
// `ready` turns true only after the engine code has run, so a request that arrives mid-boot waits for the whole boot.
async function initialize() {
  if (ready) return;
  if (booting) return booting;
  booting = (async () => {
    self.postMessage({type:'progress', message:'Starting Python in your browser (step 1 of 4)…'});
    const pyodideURL = new URL('./pyodide/', self.location.href).href;
    importScripts(pyodideURL + 'pyodide.js');
    python = await loadPyodide({indexURL: pyodideURL});
    self.postMessage({type:'progress', message:'Downloading the scientific packages, about 35 MB on a first visit (step 2 of 4)…'});
    await python.loadPackage(['numpy','pandas','scipy','scikit-learn','micropip']);  // matplotlib is not needed by the engine path
    // PyMoo and its pure-Python dependencies, vendored as py3-none-any wheels. PyMoo's optional Cython
    // speed-ups are absent in the browser, so it uses its own Python fallbacks. `moocore` is a stub that
    // only lets PyMoo import: exFuzzy's single-objective search never computes hypervolume indicators.
    const wheels = ['moocore-0.0.0+exfuzzy.lab.stub', 'wrapt-2.5.1', 'deprecated-3.0.0', 'about_time-4.2.2', 'grapheme-0.5.0',
                    'alive_progress-3.3.0', 'autograd-1.9.1', 'cma-4.5.0', 'pymoo-0.6.1.6', 'ex_fuzzy-3.3.1'];
    for (const name of wheels) {
      self.postMessage({type:'progress', message: name.startsWith('ex_fuzzy') ? 'Loading exFuzzy (step 4 of 4)…' : 'Loading PyMoo (step 3 of 4)…'});
      python.globals.set('wheel_url', new URL('./vendor/' + name + '-py3-none-any.whl', self.location.href).href);
      await python.runPythonAsync('import micropip\nawait micropip.install(wheel_url, deps=False)');
    }
    const engine = await fetch('./engine.py').then(r => {if(!r.ok) throw Error('Could not load the experiment engine.'); return r.text();});
    await python.runPythonAsync(engine.replace('if __name__ == "__main__":', 'if False:'));
    ready = true;
    self.postMessage({type:'ready'});
  })();
  try {await booting;} catch(e) {python = null; booting = null; ready = false; throw e;}
}
self.onmessage = async ({data}) => {
  try {
    await initialize();
    if (data.action === 'init') return;
    python.globals.set('input_csv', data.csv);
    python.globals.set('input_config_json', JSON.stringify(data.config || {}));
    if(data.action==='inspect') {
      const result = await python.runPythonAsync('json.dumps(inspect_dataset(input_csv, json.loads(input_config_json).get("separator", "auto")))');
      self.postMessage({type:'inspected', id:data.id, result:JSON.parse(result)});
    } else if(data.action==='run') {
      self.postMessage({type:'progress', message:'Training…'});
      const result = await python.runPythonAsync('json.dumps(run_experiment(input_csv, json.loads(input_config_json)))');
      self.postMessage({type:'result', id:data.id, result:JSON.parse(result)});
    }
  } catch(e) {
    self.postMessage({type:'error', id:data.id, action:data.action, message:String(e.message || e)});
  }
};
