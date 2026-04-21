
# oziCore
 
 Versão: 1.2.0

 Data: 2026-04-19

 ----------------------------------------------

 @description
 Orquestrador do ecossistema ozi-ui.
 Responsável por carregar os scripts dos plugins
 em sequência garantida, respeitando dependências,
 e registrar automaticamente os hooks de
 reinicialização no zldConf.zldHooks.afterRender.


### DEPENDÊNCIA
 
 ozi-loaddata deve ser o primeiro script da lista,
 pois os demais plugins dependem do zldConf e dos
 hooks que ele expõe.


### USO BÁSICO
 
````javascript
 oziCore({
     urlBase: '/plugins/ozi-ui/',
     urlScript: [
              'ozi-loaddata/js/ozi-loaddata.js',
              'ozi-select/js/ozi-select.js',
              'ozi-search/js/ozi-search.js'
          ],
     log: false
 });
````

### USO COMPLETO
 
````javascript
 oziCore({
     urlBase: '/plugins/ozi-ui/',
     urlScript: [
              'ozi-loaddata/js/ozi-loaddata.js',
              'ozi-select/js/ozi-select.js',
              'ozi-autocomplete/js/ozi-autocomplete.js',
              'ozi-audio/js/ozi-audio.js',
              'ozi-editor/js/ozi-editor.js',
              'ozi-search/js/ozi-search.js',
              'ozi-addons/js/ozi-addons.js'
          ],
     log: false
 });
````

### USO COM STRING (urlBase apenas)
 
 Quando passado como string, usa a lista padrão
 de scripts (loaddata + select + search).

 ````javascript
 oziCore('/plugins/ozi-ui/');
````

 ### RETORNO
  
A função retorna uma Promise que resolve com:
````javascript
 {
     ok: true,
     urlBase: '/plugins/ozi-ui/',
     urlScript: [...]
 }

* Em caso de erro:
````javascript
 {
     ok: false,
     error: Error
}
````

````javascript 
 oziCore({ urlBase: '/plugins/ozi-ui/' })
     .then(function (result) {
         if (result.ok) {
             console.log('Pronto!');
         }
     });

````

### HOOKS AUTOMÁTICOS
 
 Após o carregamento, o oziCore registra
 automaticamente no zldConf.zldHooks.afterRender
 os plugins que precisam ser reinicializados
 quando novo conteúdo é inserido via ZLD:

 - OziSelect
 - OziAudio
 - OziAutocomplete
 - OziEditor

* oziCheck e oziAuth se auto-registram internamente.
* oziSearch e oziToggle operam via delegação de
* eventos e não precisam de reinicialização.


### API PÚBLICA
 
 oziCore(config)           → carrega scripts e registra hooks
 oziCore.loadScript(src)   → carrega um script individual
 oziCore.loadMany(base, []) → carrega lista sequencial
 oziCore.version           → versão atual


### ESTRUTURA DE PASTAS ESPERADA

 ````html
 public/plugins/ozi-ui/
 ├── ozi-loaddata/js/ozi-loaddata.js
 ├── ozi-select/js/ozi-select.js
 ├── ozi-autocomplete/js/ozi-autocomplete.js
 ├── ozi-audio/js/ozi-audio.js
 ├── ozi-editor/js/ozi-editor.js
 ├── ozi-search/js/ozi-search.js
 └── ozi-addons/js/ozi-addons.js
````
````php
 @param {Object|string} config
 @param {string}   config.urlBase    → base dos plugins
 @param {string[]} config.urlScript  → lista de scripts a carregar
 @param {boolean}  config.log        → ativa logs de depuração
 @returns {Promise<{ok: boolean, urlBase: string, urlScript: string[]}>}

````