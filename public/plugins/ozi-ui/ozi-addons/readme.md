
# oziAddons

## Descrição 

**oziAddons** é uma biblioteca front-end com plugins e helpers utilitários para adicionar interações práticas ao HTML com configuração simples, baixo acoplamento e integração rápida.

## Descrição técnica

**oziAddons** é uma biblioteca de utilitários front-end baseada em **JavaScript** e **jQuery**, desenvolvida para padronizar comportamentos comuns de interface por meio de plugins reutilizáveis e funções auxiliares. Sua arquitetura combina configuração declarativa com **atributos `data-*`**, integração direta com o HTML e recursos voltados para ações recorrentes de interface, como cópia de conteúdo, alternância de visibilidade, validação de formulários e operações auxiliares no navegador.

## Plugins

### **oziCopy**
Plugin de cópia de conteúdo com acionamento por HTML, permitindo copiar valores diretos ou conteúdos referenciados, com feedback visual automático de sucesso ou erro.

**Recursos principais:**
- cópia por valor direto
- cópia por conteúdo referenciado
- feedback visual de sucesso e erro
- suporte a fallback para compatibilidade entre navegadores

### **oziToggle**
Plugin de alternância de visibilidade por grupo, com suporte a exibição simples, animações com slide, troca de indicadores visuais e sincronização de estado da interface.

**Recursos principais:**
- alternância de conteúdo por grupo
- suporte a `show()` e `hide()`
- suporte a `slideDown()` e `slideUp()`
- troca de indicadores visuais
- controle via HTML e JavaScript

### **oziAuth**
Plugin de validação de autenticação e formulários, com regras para email, senha, confirmação e critérios visuais de acesso, oferecendo feedback progressivo durante o preenchimento.

**Recursos principais:**
- validação de email
- validação de senha com múltiplas regras
- confirmação de senha
- feedback visual por campo
- controle de envio com base nos critérios definidos

## Helpers

### **zldGetElementById**
- verificação de existência de elemento por **ID**

### **zldClickCatch**
- captura e identificação do elemento clicado em um evento

### **zldSendRedirectForm**
- envio de dados via **formulário POST** com redirecionamento automático

### **zldWindow**
- abertura de janelas ou abas do navegador

### **zldRedirectUrl**
- redirecionamento direto para uma URL

### **oziLoadExternalScript**
- carregamento externo de scripts sob demanda

## Proposta de valor

**oziAddons** foi criado para **acelerar a implementação de comportamentos recorrentes no front-end**, reduzindo código repetitivo e facilitando a integração de interações comuns no HTML. A biblioteca entrega uma base leve, reutilizável e prática para projetos que precisam de **padronização, produtividade e facilidade de manutenção**, sem depender de estruturas pesadas.

## Resumo técnico

- **baseado em:** JavaScript e jQuery
- **modelo de uso:** declarativo via atributos `data-*`
- **foco:** interações utilitárias de interface
- **vantagem principal:** implementação rápida com baixo acoplamento
- **aplicação:** projetos que precisam de recursos front-end simples, organizados e reutilizáveis

## Versão curta para apresentação

**oziAddons** reúne plugins e helpers front-end para cópia de conteúdo, alternância de elementos, validação de formulários e utilidades de navegação, com configuração simples e integração rápida.

Se quiser, posso transformar isso agora em uma versão mais **institucional**, mais **comercial** ou em um **README ainda mais enxuto para GitHub**.