/**
 * #  oziAddons
 *
 *
 * ------------------------------------------
 * [3] HELPERS
 * ------------------------------------------
 * Cole aqui, sem mudar assinatura:
 * - zldGetElementById
 * - zldClickCatch
 * - zldSendRedirectForm
 * - zldWindow
 * - zldRedirectUrl
 * - oziLoadExternalScript
 */


// --------------------> VERIFICA SE ELEMENTO EXISTE POR ID <------------------------
function zldGetElementById(elmId) {
    return document.getElementById(elmId) !== null;
}
// --------------------> MANIPULADOR DE CLICK <------------------------
//A função zldClickCatch(e) é um manipulador de eventos de clique que identifica e retorna o elemento HTML que foi clicado pelo usuário.
function zldClickCatch(e) {
    var elem, evt = e ? e : event;
    if (typeof evt != 'undefined') {
        if (evt.srcElement) elem = evt.srcElement; else if (evt.target) elem = evt.target;
    } else {
        elem = 'undefined';
    }
    return elem;
}

/**
 * enviarDadosPorFormulario
 *-----------------------------------
 * zldSendRedirectForm('https://example.com/destino', {
 * * nome: 'Thomaz',
 * * idade: '28',
 * * mensagem: 'Olá mundo!'
 *
 *});

 * */
function zldSendRedirectForm(destiny, data) {
    // Cria um novo formulário invisível
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = destiny;
    form.style.display = 'none';

    // Cria os campos com base no objeto 'dados'
    for (const chave in data) {
        if (data.hasOwnProperty(chave)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = chave;
            input.value = data[chave];
            form.appendChild(input);
        }
    }

    // Adiciona o formulário ao corpo e envia
    document.body.appendChild(form);
    form.submit();
}

/**
 *
 *  ABRE UMA JANELA
 *  ---------------------------------
 *  * winName| _blank
 * @param theURL
 * @param winName
 * @param features
 */
function zldWindow(theURL, winName = '', features = '') {
    if (winName == '') {
        winName = "_blank";
    }
    if (features == '') {
        features = "toolbar=no,scrollbars=yes,resizable=yes,top=150,right=150,width=960,height=640";
    }

    window.open(theURL, winName, features);
}

function zldRedirectUrl(url) {
    window.location.href = url;
}



function oziLoadExternalScript(config = {}) {
    const script = document.createElement(config.tagName ?? "script");

    script.src = config.src ?? "https://code.jquery.com/jquery-3.7.1.js";
    script.integrity = config.integrity ?? "sha256-eKhayi8LEQwp4NKxN+CfCh+3qOVUtJn3QNZ0TciWLP4=";
    script.crossOrigin = config.crossOrigin ?? "anonymous";

    const resourceName = config.resourceName ?? "jQuery";
    const startAfterEvent = config.startAfterEvent ?? false;

    script.onload = function () {
        console.log("Carregado:", resourceName);

        $(document).ready(function () {
            console.log("DOM pronto, " + resourceName + " disponível!");

            if (startAfterEvent) {
                startEvent();
            }
        });
    };

    document.head.appendChild(script);
}
