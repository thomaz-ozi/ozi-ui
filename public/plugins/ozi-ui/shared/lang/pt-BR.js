/**
 * shared/lang/pt-BR.js
 *
 * Dicionário global pt-BR do OZI-UI.
 * Contém apenas strings genuinamente compartilhadas por 3+ plugins.
 * Strings específicas de cada plugin ficam em component/lang/pt-BR.js.
 */

(function (window) {
    'use strict';

    function _register() {
        var lang = window.OZI && window.OZI.lang;
        if (!lang || !lang.register) return;

        lang.register('pt-BR', {
            common: {
                loading:  'Carregando...',
                saving:   'Salvando...',
                save:     'Salvar',
                cancel:   'Cancelar',
                confirm:  'Confirmar',
                close:    'Fechar',
                clear:    'Limpar',
                search:   'Pesquisar',
                add:      'Adicionar',
                remove:   'Remover',
                edit:     'Editar',
                back:     'Voltar',
                send:     'Enviar',
                apply:    'Aplicar',
                reset:    'Redefinir',
                empty:    'Nenhum resultado',
                error:    'Erro',
                success:  'Concluído',
                required: 'Campo obrigatório',
                optional: 'Opcional',
                yes:      'Sim',
                no:       'Não',
                ok:       'OK'
            }
        });
    }

    // aguarda OZI.ready() — garante que lang já existe
    if (window.OZI && window.OZI.isReady) {
        _register();
    } else if (window.OZI && window.OZI.ready) {
        window.OZI.ready(_register);
    } else {
        document.addEventListener('DOMContentLoaded', _register);
    }

})(window);