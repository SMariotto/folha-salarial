# Guia Técnico — Folha de Pagamento 2026

## Visão geral

Calculadora de folha salarial CLT que aplica automaticamente as tabelas vigentes a partir de janeiro de 2026. O cálculo cobre INSS progressivo, escolha automática entre dedução simplificada e legal para base do IR, imposto de renda pela tabela progressiva e a redução do IR prevista na Lei 15.270/2025.

Toda a lógica reside em `calc.js`. A interface é gerenciada por `index.html` + `style.css`, sem dependências externas de framework.

---

## Constantes globais

### `TABELA_INSS`

Array de objetos `{ limite, aliquota }` com as quatro faixas do cálculo progressivo do INSS. Cada entrada representa o teto da faixa e a alíquota aplicável ao trecho correspondente.

| `limite`    | `aliquota` |
|-------------|------------|
| R$ 1.621,00 | 7,5%       |
| R$ 2.902,84 | 9,0%       |
| R$ 4.354,27 | 12,0%      |
| R$ 8.475,55 | 14,0%      |

### `TABELA_IR`

Array de objetos `{ base, aliquota, parcela }` com as cinco faixas do imposto de renda. O cálculo usa o método de parcela a deduzir: `IR = base × aliquota − parcela`.

| `base`        | `aliquota` | `parcela`   |
|---------------|------------|-------------|
| R$ 2.428,80   | 0%         | R$ 0,00     |
| R$ 2.826,65   | 7,5%       | R$ 182,16   |
| R$ 3.751,05   | 15,0%      | R$ 394,16   |
| R$ 4.664,68   | 22,5%      | R$ 675,49   |
| Infinity      | 27,5%      | R$ 908,73   |

### `DEDUCAO_DEPENDENTE`

`189.59` — valor mensal dedutível por dependente na modalidade de dedução legal.

### `DESCONTO_SIMPLES`

`607.20` — valor fixo do desconto simplificado mensal, que substitui todas as deduções legais (INSS + dependentes + pensão) para fins de cálculo da base do IR.

---

## Funções de cálculo

### `calcularINSS(salBruto)`

Calcula o INSS mensal pelo método progressivo, tributando cada faixa individualmente.

**Parâmetro:** `salBruto` — salário bruto em número.

**Retorno:** valor do INSS arredondado a duas casas decimais.

**Lógica:** itera sobre `TABELA_INSS`, acumulando `(teto_da_faixa − limite_anterior) × aliquota` enquanto o salário superar o limite inferior da faixa. Interrompe ao atingir a faixa que contém o salário.

---

### `calcularIRBruto(base)`

Calcula o imposto de renda bruto a partir da base de cálculo, usando o método de parcela a deduzir.

**Parâmetro:** `base` — base de cálculo do IR em número.

**Retorno:** `{ valor, aliquota }` onde `valor` é o IR calculado e `aliquota` é a alíquota marginal aplicada. Retorna `{ valor: 0, aliquota: 0 }` se a base for zero ou negativa, ou se nenhuma faixa corresponder.

**Fórmula:** `valor = max(0, base × aliquota − parcela)`.

---

### `calcularReducaoIR(rendimentos, baseIR, irBruto)`

Aplica a redução do IR prevista na Lei 15.270/2025. O critério de elegibilidade usa o rendimento tributável (salário bruto), não a base de cálculo.

**Parâmetros:**
- `rendimentos` — salário bruto.
- `baseIR` — base de cálculo do IR já determinada.
- `irBruto` — imposto calculado antes da redução.

**Retorno:** valor da redução a ser subtraído do IR bruto.

**Regras:**
- `rendimentos ≤ 0` ou `irBruto ≤ 0` → retorna `0`.
- `rendimentos ≤ R$ 5.000` → retorna `irBruto` integralmente (IR zerado).
- `R$ 5.000 < rendimentos ≤ R$ 7.350` → redução decrescente: `max(0, 978,62 − 0,133145 × baseIR)`, limitada ao valor do `irBruto`.
- `rendimentos > R$ 7.350` → retorna `0` (sem redução).

---

### `calcularFolha({ salarioBruto, dependentes, pagaPensao, valorPensao })`

Função principal. Orquestra todas as etapas do cálculo e retorna o resultado completo.

**Parâmetros:**
- `salarioBruto` — valor bruto mensal.
- `dependentes` — número de dependentes (string ou número; convertido com `parseInt`).
- `pagaPensao` — booleano indicando se há desconto de pensão alimentícia.
- `valorPensao` — valor da pensão (ignorado se `pagaPensao` for falso).

**Fluxo interno:**

1. Sanitização das entradas (`parseFloat`, `parseInt`, guarda contra `NaN`).
2. Cálculo do INSS via `calcularINSS`.
3. Cálculo paralelo das duas bases de IR possíveis:
   - `baseIR_simples = max(0, bruto − 607,20)`
   - `baseIR_legal = max(0, bruto − INSS − dependentes × 189,59 − pensão)`
4. Escolha automática da dedução mais benéfica: usa a que resultar na menor base (`baseIR_simples < baseIR_legal` → simplificada; caso contrário, legal).
5. Cálculo do IR bruto via `calcularIRBruto`.
6. Cálculo da redução via `calcularReducaoIR`.
7. `irLiquido = max(0, irBruto − reducaoIR)`.
8. `liquido = max(0, bruto − INSS − irLiquido − pensão)`.
9. Alíquota efetiva do INSS: `(INSS / bruto) × 100`.

**Retorno:** objeto com os campos abaixo.

| Campo              | Tipo    | Descrição                                       |
|--------------------|---------|-------------------------------------------------|
| `salarioBruto`     | number  | Salário bruto sanitizado                        |
| `inss`             | number  | Desconto INSS                                   |
| `aliqINSSEfetiva`  | string  | Alíquota efetiva do INSS (ex.: `"9.62"`)        |
| `deducaoUsada`     | number  | Valor da dedução aplicada para base do IR       |
| `tipoDeducao`      | string  | `"Simplificada"` ou `"Legal"`                   |
| `baseIR`           | number  | Base de cálculo do IR                           |
| `irBruto`          | number  | IR calculado antes da redução                   |
| `irAliquota`       | number  | Alíquota marginal do IR (ex.: `0.225`)          |
| `reducaoIR`        | number  | Valor da redução Lei 15.270/2025                |
| `irLiquido`        | number  | IR efetivamente descontado após redução         |
| `pensao`           | number  | Valor da pensão alimentícia descontada          |
| `pagaPensao`       | boolean | Indica se pensão foi declarada                  |
| `liquido`          | number  | Salário líquido final                           |

---

## Utilitários

### `fmt(v)`

Formata um número como moeda brasileira.

**Parâmetro:** `v` — número.  
**Retorno:** string no padrão `R$ 1.234,56`.

---

### `fmtPct(v)`

Formata uma alíquota decimal como percentual com uma casa.

**Parâmetro:** `v` — número decimal (ex.: `0.225`).  
**Retorno:** string `"22.5%"`.

---

### `aplicarMascara(input)`

Aplica máscara de moeda brasileira em tempo real a um `<input>` de texto. Vincula um listener ao evento `input` que descarta não-dígitos, interpreta os dígitos como centavos e reformata no padrão `pt-BR`.

**Parâmetro:** `input` — elemento `HTMLInputElement`.

---

### `parseMoeda(str)`

Converte uma string formatada no padrão `pt-BR` de volta para `float`.

**Parâmetro:** `str` — string como `"1.234,56"`.  
**Retorno:** número `1234.56`. Retorna `0` se a entrada for nula ou não parseável.

---

### `set(id, txt)`

Atalho para atualizar o `textContent` de um elemento pelo id.

**Parâmetros:** `id` — string com o id do elemento; `txt` — texto a exibir.  
**Comportamento:** silencioso se o elemento não existir.

---

## Interface e eventos

### Inicialização (`DOMContentLoaded`)

Executada uma vez ao carregar a página. Responsabilidades:

- Aplica `aplicarMascara` nos campos `#salarioBruto` e `#pensaoValor`.
- Gerencia o estado `pagaPensao` (booleano local) e alterna os botões `#pensaoNao` / `#pensaoSim`, exibindo ou ocultando `#pensaoValorGroup`.
- Registra o listener do botão `#btnCalcular`: valida o salário (exibe borda vermelha temporária se vazio), chama `calcularFolha`, passa o resultado para `exibirResultado` e abre o modal `#overlayResultado`.
- Permite acionar o cálculo pressionando **Enter** nos campos de valor.
- Define as funções internas `abrirModal(id)` e `fecharModal(id)`:
  - `abrirModal` remove a classe `hidden` do overlay e bloqueia o scroll do body.
  - `fecharModal` adiciona `hidden` e restaura o scroll quando não há mais modais abertos.
- Registra fechamento por clique no overlay (fora do modal), pelos botões `#fecharResultado`, `#fecharTabelas`, `#fecharSobre` e pela tecla **Escape**.
- Registra abertura dos modais secundários pelos botões `#btnAbrirTabelas` e `#btnAbrirSobre`.
- Implementa o sistema de abas no modal de tabelas: ao clicar em um `.tab-btn`, desativa todas as abas, oculta todos os `.tab-panel` e ativa o painel cujo id seja `tab-{data-tab}`.

---

### `exibirResultado(r)`

Popula o modal `#overlayResultado` com os dados do objeto retornado por `calcularFolha`.

**Parâmetro:** `r` — objeto de resultado.

**Ações:**
- Preenche salário bruto, INSS (com alíquota efetiva), dedução IR (com tipo), base de cálculo e IR.
- Exibe ou oculta a linha de pensão (`#rowPensao`) conforme `r.pagaPensao && r.pensao > 0`.
- Para o IR: se `irBruto === 0`, exibe "Isento" e remove a classe `neg`; caso contrário exibe o valor negativo com a alíquota marginal.
- Exibe ou oculta a linha de redução do IR (`#rowReducaoIR`) conforme `r.reducaoIR > 0`.
- Preenche o salário líquido final.
- Gera as tags informativas (`#resTags`):
  - `tag-isento` — quando `irLiquido === 0` e salário > 0.
  - `tag-reducao` — quando há redução e ainda há IR a pagar.
  - Tag de tipo de dedução (simplificada ou legal), sempre presente.

---

## Fluxo de uma sessão

```
Usuário preenche o formulário
        ↓
btnCalcular.click()
        ↓
parseMoeda(inputSal.value)       → valida que salário > 0
        ↓
calcularFolha({ sb, ndep, pensao, pagaPensao })
  ├─ calcularINSS(sb)
  ├─ determina baseIR (simples vs legal)
  ├─ calcularIRBruto(baseIR)
  └─ calcularReducaoIR(sb, baseIR, irBruto)
        ↓
exibirResultado(res)             → popula o modal com todos os campos
        ↓
abrirModal('overlayResultado')   → exibe o demonstrativo
```

---

## Legislação de referência

| Norma                              | Aplicação                                                                 |
|------------------------------------|---------------------------------------------------------------------------|
| Portaria Intermin. MPS/MF nº 13/2026 | Tabela e teto do INSS progressivo                                       |
| Lei nº 15.191/2025                 | Tabela do IRPF com faixas e parcelas vigentes a partir de janeiro/2026   |
| Lei nº 15.270/2025                 | Redução do IR para rendimentos até R$ 7.350,00                           |
| RIR / IN RFB                       | Dedução por dependente (R$ 189,59) e desconto simplificado (R$ 607,20)  |

---

## Notas de manutenção

- Para atualizar tabelas: editar `TABELA_INSS`, `TABELA_IR`, `DEDUCAO_DEPENDENTE` e `DESCONTO_SIMPLES` no topo de `calc.js`. Nenhuma outra parte do código precisa ser alterada.
- A escolha entre dedução simplificada e legal é automática e favorece sempre o trabalhador (menor base de IR). Não é necessário expor essa opção ao usuário.
- A redução da Lei 15.270/2025 é aplicada sobre o IR já calculado, e seu critério de elegibilidade é o salário bruto — não a base de cálculo do IR.