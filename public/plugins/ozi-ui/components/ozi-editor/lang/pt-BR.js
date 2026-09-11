
/* ───────────────────────────────────────────── */

/**
 * components/ozi-editor/lang/pt-BR.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('pt-BR', {
        editor: {
            bold:        'Negrito',
            italic:      'Itálico',
            underline:   'Sublinhado',
            strike:      'Riscado',
            ul:          'Lista',
            ol:          'Lista numerada',
            codeblock:   'Bloco de código',
            source:      'HTML',
            table:       'Tabela',
            heading:     'Título',
            h1:          'Título 1',
            h2:          'Título 2',
            h3:          'Título 3',
            h4:          'Título 4',
            h5:          'Título 5',
            h6:          'Título 6',
            classes:     'Estilos',
            alignLeft:   'Alinhar à esquerda',
            alignCenter: 'Centralizar',
            alignRight:  'Alinhar à direita',
            justify:     'Justificar',
            quote:       'Citação',
            hr:          'Linha horizontal',
            undo:        'Desfazer',
            redo:        'Refazer',
            link:        'Link',
            unlink:      'Remover link',
            linkUrl:     'URL',
            color:       'Cor do texto',
            highlight:   'Cor de realce',
            image:            'Imagem',
            imageUrl:         'URL',
            imageAlt:         'Texto alternativo',
            imageWidth:       'Largura',
            imageHeight:      'Altura',
            imageUpload:      'Upload',
            imageUploading:   'Enviando…',
            imageUploadFailed: 'Não foi possível enviar a imagem. Tente novamente.',
            imageInvalidUrl:  'URL inválida ou de esquema não permitido.',
            imageAlign:       'Alinhamento',
            imageAlignLeft:   'À esquerda (texto ao lado)',
            imageAlignRight:  'À direita (texto ao lado)',
            imageAlignCenter: 'Centralizada',
            imageAlignFree:   'Posição livre (arraste a imagem)',
            paste:       'Colar',
            pasteFmt:    'Colar com formatação',
            apply:       'Aplicar',
            remove:      'Remover',
            none:        'Nenhuma',
            customize:   'Personalizar',
            clipboardBlocked: 'Não foi possível ler a área de transferência. Verifique a permissão do navegador (barra de endereço / configurações do site).',
            words:       'palavras',
            chars:       'caracteres',
            clear:       'Limpar formatação',
            moreTools:   'Mais ferramentas',
            fewerTools:  'Menos ferramentas',
            scrollPrev:  'Rolar para trás',
            scrollNext:  'Rolar para frente',
            unknown:     'Ferramenta desconhecida',
            incompatible: 'Indisponível neste modo',
            placeholder: 'Digite aqui...'
        }
    });
})(window);
