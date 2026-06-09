const TABELA_INSS = [
  { limite:  1621.00, aliquota: 0.075 },
  { limite:  2902.84, aliquota: 0.090 },
  { limite:  4354.27, aliquota: 0.120 },
  { limite:  8475.55, aliquota: 0.140 },
];

const TABELA_IR = [
  { base:    2428.80, aliquota: 0.000, parcela:   0.00 },
  { base:    2826.65, aliquota: 0.075, parcela: 182.16 },
  { base:    3751.05, aliquota: 0.150, parcela: 394.16 },
  { base:    4664.68, aliquota: 0.225, parcela: 675.49 },
  { base: Infinity,   aliquota: 0.275, parcela: 908.73 },
];

const DEDUCAO_DEPENDENTE = 189.59;  
const DESCONTO_SIMPLES   = 607.20;  

function calcularINSS(salBruto) {
  let inss = 0;
  let anterior = 0;
  for (const faixa of TABELA_INSS) {
    if (salBruto <= anterior) break;
    const teto = Math.min(salBruto, faixa.limite);
    inss += (teto - anterior) * faixa.aliquota;
    anterior = faixa.limite;
    if (salBruto <= faixa.limite) break;
  }
  return parseFloat(inss.toFixed(2));
}

function calcularIRBruto(base) {
  if (base <= 0) return { valor: 0, aliquota: 0 };
  for (const faixa of TABELA_IR) {
    if (base <= faixa.base) {
      const valor = Math.max(0, base * faixa.aliquota - faixa.parcela);
      return { valor: parseFloat(valor.toFixed(2)), aliquota: faixa.aliquota };
    }
  }
  return { valor: 0, aliquota: 0 };
}

function calcularReducaoIR(rendimentos, baseIR, irBruto) {
  // Lei 15.270/2025: critério é o rendimento tributável (salário bruto), não a base IR
  if (rendimentos <= 0 || irBruto <= 0) return 0;
  if (rendimentos <= 5000.00) {
    return irBruto;
  }
  if (rendimentos <= 7350.00) {
    const reducao = Math.max(0, 978.62 - 0.133145 * baseIR);
    return parseFloat(Math.min(reducao, irBruto).toFixed(2));
  }
  return 0;
}

function calcularFolha({ salarioBruto, dependentes, pagaPensao, valorPensao }) {
  const sb     = parseFloat(salarioBruto) || 0;
  const ndep   = parseInt(dependentes)    || 0;
  const pensao = pagaPensao ? (parseFloat(valorPensao) || 0) : 0;

  
  const inss = calcularINSS(sb);

  
  // Simplificada: substitui TUDO (base = bruto - 607,20)
  // Legal: base = bruto - INSS - dependentes - pensão
  // Usa quem der menor base IR (maior benefício ao trabalhador)
  const baseIR_simples = Math.max(0, sb - DESCONTO_SIMPLES);
  const baseIR_legal   = Math.max(0, sb - inss - (ndep * DEDUCAO_DEPENDENTE) - pensao);
  const usarSimples    = baseIR_simples < baseIR_legal;
  const baseIR         = usarSimples ? baseIR_simples : baseIR_legal;
  const deducaoUsada   = usarSimples ? DESCONTO_SIMPLES : (inss + (ndep * DEDUCAO_DEPENDENTE) + pensao);

  
  const { valor: irBruto, aliquota: irAliquota } = calcularIRBruto(baseIR);

  
  const reducaoIR = calcularReducaoIR(sb, baseIR, irBruto);
  const irLiquido = parseFloat(Math.max(0, irBruto - reducaoIR).toFixed(2));

  
  
  
  
  const liquido = parseFloat(Math.max(0, sb - inss - irLiquido - pensao).toFixed(2));

  
  const aliqINSSEfetiva = sb > 0 ? ((inss / sb) * 100).toFixed(2) : '0.00';

  return {
    salarioBruto: sb,
    inss,
    aliqINSSEfetiva,
    deducaoUsada,
    tipoDeducao: usarSimples ? 'Simplificada' : 'Legal',
    baseIR,
    irBruto,
    irAliquota,
    reducaoIR,
    irLiquido,
    pensao,
    pagaPensao,
    liquido,
  };
}

function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}
function fmtPct(v) { return (v * 100).toFixed(1) + '%'; }

function aplicarMascara(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    if (!v) { input.value = ''; return; }
    input.value = (parseInt(v, 10) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  });
}

function parseMoeda(str) {
  return parseFloat((str || '').replace(/\./g, '').replace(',', '.')) || 0;
}

document.addEventListener('DOMContentLoaded', () => {

  
  const inputSal    = document.getElementById('salarioBruto');
  const inputPensao = document.getElementById('pensaoValor');
  aplicarMascara(inputSal);
  aplicarMascara(inputPensao);

  
  let pagaPensao = false;
  const btnNao   = document.getElementById('pensaoNao');
  const btnSim   = document.getElementById('pensaoSim');
  const grpPensao = document.getElementById('pensaoValorGroup');

  btnNao.addEventListener('click', () => {
    pagaPensao = false;
    btnNao.classList.add('active');
    btnSim.classList.remove('active');
    grpPensao.classList.add('hidden');
  });

  btnSim.addEventListener('click', () => {
    pagaPensao = true;
    btnSim.classList.add('active');
    btnNao.classList.remove('active');
    grpPensao.classList.remove('hidden');
  });

  
  document.getElementById('btnCalcular').addEventListener('click', () => {
    const sb  = parseMoeda(inputSal.value);
    if (!sb || sb <= 0) {
      inputSal.focus();
      inputSal.closest('.input-wrap').style.boxShadow = '0 0 0 3px rgba(124,45,18,0.2)';
      inputSal.closest('.input-wrap').style.borderColor = '#7C2D12';
      setTimeout(() => {
        inputSal.closest('.input-wrap').style.boxShadow = '';
        inputSal.closest('.input-wrap').style.borderColor = '';
      }, 1500);
      return;
    }

    const res = calcularFolha({
      salarioBruto: sb,
      dependentes:  document.getElementById('dependentes').value,
      pagaPensao,
      valorPensao:  parseMoeda(inputPensao.value),
    });

    exibirResultado(res);
    abrirModal('overlayResultado');
  });

  
  [inputSal, inputPensao].forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btnCalcular').click();
    });
  });

  

  function abrirModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function fecharModal(id) {
    document.getElementById(id).classList.add('hidden');
    
    if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
      document.body.style.overflow = '';
    }
  }

  
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) fecharModal(overlay.id);
    });
  });

  
  document.getElementById('fecharResultado').addEventListener('click', () => fecharModal('overlayResultado'));
  document.getElementById('fecharTabelas').addEventListener('click',  () => fecharModal('overlayTabelas'));
  document.getElementById('fecharSobre').addEventListener('click',    () => fecharModal('overlaySobre'));

  
  document.getElementById('btnAbrirTabelas').addEventListener('click', () => abrirModal('overlayTabelas'));
  document.getElementById('btnAbrirSobre').addEventListener('click',   () => abrirModal('overlaySobre'));

  
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(o => fecharModal(o.id));
    }
  });

  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', false);
        p.classList.add('hidden');
      });
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + target);
      panel.classList.remove('hidden');
      panel.classList.add('active');
    });
  });

});

function exibirResultado(r) {
  set('resSalarioBruto', fmt(r.salarioBruto));
  set('resINSS',        '− ' + fmt(r.inss));
  set('resAliquotaINSS', 'Alíquota efetiva: ' + r.aliqINSSEfetiva + '%');

  
  const rowPensao = document.getElementById('rowPensao');
  if (r.pagaPensao && r.pensao > 0) {
    rowPensao.classList.remove('hidden');
    set('resPensao', '− ' + fmt(r.pensao));
  } else {
    rowPensao.classList.add('hidden');
  }

  set('resDeducaoIR',    '− ' + fmt(r.deducaoUsada));
  set('resTipoDeducao',  r.tipoDeducao);
  set('resBaseIR',       fmt(r.baseIR));

  
  if (r.irBruto === 0) {
    set('resIR', fmt(0));
    set('resAliquotaIR', 'Isento');
    document.getElementById('resIR').className = 'res-value';
  } else {
    set('resIR', '− ' + fmt(r.irBruto));
    set('resAliquotaIR', 'Alíquota: ' + fmtPct(r.irAliquota));
    document.getElementById('resIR').className = 'res-value neg';
  }

  
  const rowReducao = document.getElementById('rowReducaoIR');
  if (r.reducaoIR > 0) {
    rowReducao.classList.remove('hidden');
    set('resReducaoIR', '+ ' + fmt(r.reducaoIR));
  } else {
    rowReducao.classList.add('hidden');
  }

  set('resLiquido', fmt(r.liquido));

  
  const tags = [];
  if (r.irLiquido === 0 && r.salarioBruto > 0) tags.push({ txt: 'Isento de IR', cls: 'tag-isento' });
  if (r.reducaoIR > 0 && r.irLiquido > 0)      tags.push({ txt: 'Redução IR aplicada', cls: 'tag-reducao' });
  if (r.tipoDeducao === 'Simplificada')          tags.push({ txt: 'Dedução simplificada' });
  else                                            tags.push({ txt: 'Dedução legal' });

  const tagsEl = document.getElementById('resTags');
  tagsEl.innerHTML = tags.map(t =>
    `<span class="res-tag ${t.cls || ''}">${t.txt}</span>`
  ).join('');
}

function set(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}