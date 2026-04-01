import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'

const LIST_CATEGORIES = {
  oficinas: 'expense_oficina',
  pecas: 'expense_peca',
  servicos: 'expense_servico',
  locaisEstacionamento: 'expense_estacionamento_local',
  locaisEstetica: 'expense_estetica_local',
  tiposMulta: 'expense_multa_tipo',
  tiposImposto: 'expense_imposto_tipo',
  seguradoras: 'expense_seguradora',
  financeiras: 'expense_financeira',
}

const DEFAULTS = {
  oficinas: ['Oficina Central', 'Auto Center Bairro'],
  pecas: ['Óleo do motor', 'Filtro de óleo'],
  servicos: ['Troca de óleo', 'Alinhamento e balanceamento'],
  locaisEstacionamento: ['Centro', 'Shopping'],
  locaisEstetica: ['Estética Automotiva Premium'],
  tiposMulta: ['Velocidade', 'Estacionamento irregular', 'Avanço de sinal'],
  tiposImposto: ['IPVA', 'Licenciamento', 'Outros'],
  seguradoras: ['Porto Seguro', 'Azul Seguros'],
  financeiras: ['Banco A', 'Banco B'],
}

const TIPOS_DESPESA = ['Manutenção', 'Multa', 'Financiamento', 'Impostos', 'Seguro', 'Acessórios', 'Estacionamento', 'Estética', 'Pedágio', 'KM inicial']

function addMonths(isoDate, months) {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function addInterval(isoDate, frequency, steps) {
  const d = new Date(`${isoDate}T00:00:00`)
  if (frequency === 'diario') d.setDate(d.getDate() + steps)
  else if (frequency === 'semanal') d.setDate(d.getDate() + (steps * 7))
  else if (frequency === 'mensal') d.setMonth(d.getMonth() + steps)
  else if (frequency === 'anual') d.setFullYear(d.getFullYear() + steps)
  return d.toISOString().slice(0, 10)
}

function renderInlineCreateField({ show, value, onChange, onAdd, placeholder }) {
  if (!show) return null

  return (
    <div className="d-flex gap-2 align-items-center mt-2">
      <input className="form-control form-control-sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <button type="button" className="btn btn-sm btn-outline-primary inline-create-btn" onClick={onAdd}>Adicionar</button>
    </div>
  )
}

function parseMaintenanceItems(block) {
  const text = String(block || '').trim()
  if (!text || text === '-') return []

  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)\s*\(R\$\s*([\d.,]+)\)$/)
      if (!match) return { nome: item, valor: 0 }
      const raw = String(match[2] || '').trim()
      const normalized = raw.includes(',')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw
      return {
        nome: match[1].trim(),
        valor: Number(normalized) || 0,
      }
    })
}

function parseInstallments(description) {
  const text = String(description || '')
  const parcelas = (text.match(/Parcela\s+\d+\/(\d+)/i) || text.match(/Parcelas:\s*(\d+)/i) || [])[1]
  const valorParcela = (text.match(/Valor da parcela:\s*([\d.,]+)/i) || [])[1]
  const classeBonus = (text.match(/Classe bônus:\s*([^•]+)/i) || [])[1]
  return {
    parcelas: parcelas || '',
    valorParcela: valorParcela
      ? Number(valorParcela.includes(',') ? valorParcela.replace(/\./g, '').replace(',', '.') : valorParcela)
      : '',
    classeBonus: classeBonus ? String(classeBonus).trim() : '',
  }
}

function parsePaymentType(description) {
  return (String(description || '').match(/Tipo de pagamento:\s*([^•]+)/i) || [])[1]?.trim() || 'Dinheiro'
}

function parseMaintenanceDescription(description) {
  const text = String(description || '')
  const parts = text.split(' • ').map((part) => part.trim())
  const getValue = (prefix) => parts.find((part) => part.startsWith(prefix))?.slice(prefix.length).trim() || ''

  return {
    pecas: parseMaintenanceItems(getValue('Peças: ')),
    servicos: parseMaintenanceItems(getValue('Serviços: ')),
    descricaoServico: getValue('Descrição: '),
  }
}

export default function ExpensePage({ vehicleId }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const cloneId = searchParams.get('clone')
  const returnPath = searchParams.get('return')
  const returnFilters = searchParams.get('filters')
  const isEditing = Boolean(editId)

  const [oficinas, setOficinas] = useState(DEFAULTS.oficinas)
  const [pecas, setPecas] = useState(DEFAULTS.pecas)
  const [servicos, setServicos] = useState(DEFAULTS.servicos)
  const [locaisEstacionamento, setLocaisEstacionamento] = useState(DEFAULTS.locaisEstacionamento)
  const [locaisEstetica, setLocaisEstetica] = useState(DEFAULTS.locaisEstetica)
  const [tiposMulta, setTiposMulta] = useState(DEFAULTS.tiposMulta)
  const [tiposImposto, setTiposImposto] = useState(DEFAULTS.tiposImposto)
  const [seguradoras, setSeguradoras] = useState(DEFAULTS.seguradoras)
  const [financeiras, setFinanceiras] = useState(DEFAULTS.financeiras)

  const [form, setForm] = useState({
    tipoPrincipal: 'Manutenção',
    data: new Date().toISOString().slice(0, 10),
    quilometragem: '',
    valor: '',
    valorParcela: '',
    descricao: '',
    local: '',
    descricaoServico: '',
    vencimento: '',
    status: 'A vencer',
    validade_km: '',
    validade_dias: '',
    oficina: oficinas[0] || '',
    peca: pecas[0] || '',
    valorPecaItem: '',
    servico: servicos[0] || '',
    valorServicoItem: '',
    tipoMulta: tiposMulta[0] || '',
    tipoPagamento: 'Dinheiro',
    parcelas: '',
    tipoImposto: tiposImposto[0] || '',
    seguradora: seguradoras[0] || '',
    financeira: financeiras[0] || '',
    classeBonus: '',
    nomePeca: '',
    localEstacionamento: locaisEstacionamento[0] || '',
    localEstetica: locaisEstetica[0] || '',
    desconsiderarKmRegistrada: false,
    repetirRegistro: false,
    frequenciaRepeticao: 'mensal',
    numeroRepeticoes: '1',
  })

  const [manutencaoPecas, setManutencaoPecas] = useState([])
  const [manutencaoServicos, setManutencaoServicos] = useState([])

  const [novos, setNovos] = useState({
    oficina: '',
    peca: '',
    servico: '',
    localEstacionamento: '',
    localEstetica: '',
    tipoMulta: '',
    tipoImposto: '',
    seguradora: '',
    financeira: '',
  })

  const [showNovo, setShowNovo] = useState({
    oficina: false,
    peca: false,
    servico: false,
    localEstacionamento: false,
    localEstetica: false,
    tipoMulta: false,
    tipoImposto: false,
    seguradora: false,
    financeira: false,
  })

  const tipoKey = useMemo(() => form.tipoPrincipal.toLowerCase(), [form.tipoPrincipal])
  const totalPecas = useMemo(() => manutencaoPecas.reduce((sum, item) => sum + Number(item.valor || 0), 0), [manutencaoPecas])
  const totalServicos = useMemo(() => manutencaoServicos.reduce((sum, item) => sum + Number(item.valor || 0), 0), [manutencaoServicos])
  const totalManutencao = totalPecas + totalServicos
  const totalParcelado = Number(form.valorParcela || 0) * Number(form.parcelas || 0)

  const loadOptionList = async (stateKey) => {
    const category = LIST_CATEGORIES[stateKey]
    const { data } = await api.get('/lookup', { params: { category } })
    const values = (Array.isArray(data) ? data.map((item) => item.value) : []).filter(Boolean)
    return values.length ? values : DEFAULTS[stateKey]
  }

  useEffect(() => {
    ;(async () => {
      const [a, b, c, d, e, f, g, h, i] = await Promise.all([
        loadOptionList('oficinas'),
        loadOptionList('pecas'),
        loadOptionList('servicos'),
        loadOptionList('locaisEstacionamento'),
        loadOptionList('locaisEstetica'),
        loadOptionList('tiposMulta'),
        loadOptionList('tiposImposto'),
        loadOptionList('seguradoras'),
        loadOptionList('financeiras'),
      ])
      setOficinas(a); setPecas(b); setServicos(c); setLocaisEstacionamento(d); setLocaisEstetica(e); setTiposMulta(f); setTiposImposto(g); setSeguradoras(h); setFinanceiras(i)
    })().catch(() => {})
  }, [])

  useEffect(() => {
    if (!vehicleId || (!editId && !cloneId)) return
    api.get(`/expenses/${editId || cloneId}`).then(({ data }) => {
      const tipoPrincipal = TIPOS_DESPESA.find((item) => item.toLowerCase() === String(data.tipo || '').toLowerCase()) || 'Manutenção'
      const maintenanceData = tipoPrincipal === 'Manutenção' ? parseMaintenanceDescription(data.descricao) : null
      const installmentData = parseInstallments(data.descricao)
      const paymentType = parsePaymentType(data.descricao)
      setForm((prev) => ({
        ...prev,
        tipoPrincipal,
        data: String(data.data || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        quilometragem: isEditing ? (data.quilometragem || '') : '',
        valor: isEditing ? (data.valor || '') : '',
        descricao: data.descricao || '',
        vencimento: isEditing ? (data.vencimento ? String(data.vencimento).slice(0, 10) : '') : '',
        status: data.status || 'registrado',
        validade_km: data.validade_km || '',
        validade_dias: data.validade_dias || '',
        oficina: tipoPrincipal === 'Manutenção' ? data.local || prev.oficina : prev.oficina,
        local: ['Multa', 'Acessórios'].includes(tipoPrincipal) ? (data.local || '') : prev.local,
        localEstacionamento: tipoPrincipal === 'Estacionamento' ? data.local || prev.localEstacionamento : prev.localEstacionamento,
        localEstetica: tipoPrincipal === 'Estética' ? data.local || prev.localEstetica : prev.localEstetica,
        tipoImposto: tipoPrincipal === 'Impostos' ? data.local || prev.tipoImposto : prev.tipoImposto,
        seguradora: tipoPrincipal === 'Seguro' ? data.local || prev.seguradora : prev.seguradora,
        financeira: tipoPrincipal === 'Financiamento' ? data.local || prev.financeira : prev.financeira,
        descricaoServico: tipoPrincipal === 'Manutenção' ? (maintenanceData?.descricaoServico || '') : prev.descricaoServico,
        valorParcela: ['Financiamento', 'Seguro'].includes(tipoPrincipal) ? (installmentData.valorParcela || data.valor || '') : prev.valorParcela,
        parcelas: ['Financiamento', 'Seguro'].includes(tipoPrincipal) ? (installmentData.parcelas || '1') : prev.parcelas,
        classeBonus: tipoPrincipal === 'Seguro' ? installmentData.classeBonus : prev.classeBonus,
        tipoPagamento: tipoPrincipal === 'Pedágio' ? paymentType : prev.tipoPagamento,
        nomePeca: tipoPrincipal === 'Acessórios' ? (data.local || '') : prev.nomePeca,
        desconsiderarKmRegistrada: String(data.descricao || '').includes('Desconsiderar KM: sim'),
      }))
      setManutencaoPecas(maintenanceData?.pecas || [])
      setManutencaoServicos(maintenanceData?.servicos || [])
    }).catch(() => navigate('/'))
  }, [vehicleId, editId, cloneId, navigate, isEditing])

  const addOption = async (field) => {
    const value = (novos[field] || '').trim()
    if (!value) return

    const map = {
      oficina: [oficinas, setOficinas, LIST_CATEGORIES.oficinas, 'oficina', 'oficinas'],
      peca: [pecas, setPecas, LIST_CATEGORIES.pecas, 'peca', 'pecas'],
      servico: [servicos, setServicos, LIST_CATEGORIES.servicos, 'servico', 'servicos'],
      localEstacionamento: [locaisEstacionamento, setLocaisEstacionamento, LIST_CATEGORIES.locaisEstacionamento, 'localEstacionamento', 'locaisEstacionamento'],
      localEstetica: [locaisEstetica, setLocaisEstetica, LIST_CATEGORIES.locaisEstetica, 'localEstetica', 'locaisEstetica'],
      tipoMulta: [tiposMulta, setTiposMulta, LIST_CATEGORIES.tiposMulta, 'tipoMulta', 'tiposMulta'],
      tipoImposto: [tiposImposto, setTiposImposto, LIST_CATEGORIES.tiposImposto, 'tipoImposto', 'tiposImposto'],
      seguradora: [seguradoras, setSeguradoras, LIST_CATEGORIES.seguradoras, 'seguradora', 'seguradoras'],
      financeira: [financeiras, setFinanceiras, LIST_CATEGORIES.financeiras, 'financeira', 'financeiras'],
    }

    const [arr, setter, category, formKey, stateKey] = map[field]
    try {
      await api.post('/lookup', { category, value })
    } catch {}
    const next = await loadOptionList(stateKey)
    setter(next)

    setForm((prev) => ({ ...prev, [formKey]: value }))
    setNovos((prev) => ({ ...prev, [field]: '' }))
    setShowNovo((prev) => ({ ...prev, [field]: false }))
  }

  const addPecaManutencao = () => {
    const nome = String(form.peca || '').trim()
    const valor = Number(form.valorPecaItem || 0)
    if (!nome || valor < 0) return
    setManutencaoPecas((prev) => [...prev, { nome, valor }])
    setForm((prev) => ({ ...prev, valorPecaItem: '' }))
  }

  const removePecaManutencao = (idx) => setManutencaoPecas((prev) => prev.filter((_, i) => i !== idx))

  const addServicoManutencao = () => {
    const nome = String(form.servico || '').trim()
    const valor = Number(form.valorServicoItem || 0)
    if (!nome || valor < 0) return
    setManutencaoServicos((prev) => [...prev, { nome, valor }])
    setForm((prev) => ({ ...prev, valorServicoItem: '' }))
  }

  const removeServicoManutencao = (idx) => setManutencaoServicos((prev) => prev.filter((_, i) => i !== idx))

  const handleCancel = () => goBackToTimeline()

  const goBackToTimeline = () => {
    if (returnFilters && vehicleId) {
      try {
        localStorage.setItem(`kartrack_timeline_filters_${vehicleId}`, decodeURIComponent(returnFilters))
      } catch {}
    }
    navigate(returnPath ? decodeURIComponent(returnPath) : '/')
  }

  const submit = async (e) => {
    e.preventDefault()
    const dataIso = form.data

    const payload = {
      vehicle_id: vehicleId,
      tipo: tipoKey,
      data: dataIso,
      quilometragem: ['manutenção', 'km inicial'].includes(tipoKey) ? (form.quilometragem ? Number(form.quilometragem) : null) : null,
      valor: Number(form.valor || 0),
      vencimento: form.vencimento || null,
      status: form.status || 'registrado',
      validade_km: form.validade_km ? Number(form.validade_km) : null,
      validade_dias: form.validade_dias ? Number(form.validade_dias) : null,
      local: '',
      descricao: '',
    }

    if (tipoKey === 'manutenção') {
      payload.local = form.oficina
      payload.valor = totalManutencao
      payload.descricao = [
        `Peças: ${manutencaoPecas.map((p) => `${p.nome} (R$ ${Number(p.valor).toFixed(2)})`).join(', ') || '-'}`,
        `Serviços: ${manutencaoServicos.map((s) => `${s.nome} (R$ ${Number(s.valor).toFixed(2)})`).join(', ') || '-'}`,
        `Descrição: ${form.descricaoServico || '-'}`,
        `Valor peças: ${totalPecas.toFixed(2)}`,
        `Valor serviços: ${totalServicos.toFixed(2)}`,
        `Desconsiderar KM: ${form.desconsiderarKmRegistrada ? 'sim' : 'não'}`,
      ].join(' • ')
    } else if (tipoKey === 'multa') {
      payload.local = form.local || ''
      payload.valor = Number(form.valor || 0)
      payload.descricao = [form.tipoMulta, form.descricao].filter(Boolean).join(' • ')
      payload.status = form.status || 'A vencer'
    } else if (tipoKey === 'financiamento') {
      payload.local = form.financeira || ''
      payload.valor = totalParcelado
      payload.descricao = [form.descricao, `Parcelas: ${form.parcelas || 1}`, `Valor da parcela: ${Number(form.valorParcela || 0).toFixed(2)}`].filter(Boolean).join(' • ')
    } else if (tipoKey === 'impostos') {
      payload.local = ''
      payload.descricao = [form.tipoImposto, form.descricao].filter(Boolean).join(' • ')
    } else if (tipoKey === 'seguro') {
      payload.local = form.seguradora || ''
      payload.valor = totalParcelado
      payload.descricao = [form.descricao, `Classe bônus: ${form.classeBonus || '-'}`, `Parcelas: ${form.parcelas || 1}`, `Valor da parcela: ${Number(form.valorParcela || 0).toFixed(2)}`].filter(Boolean).join(' • ')
    } else if (tipoKey === 'acessórios') {
      payload.local = form.nomePeca || ''
      payload.valor = Number(form.valor || 0)
      payload.descricao = form.descricao || ''
    } else if (tipoKey === 'estacionamento') {
      payload.local = form.localEstacionamento
      payload.valor = Number(form.valor || 0)
      payload.descricao = form.descricao || ''
    } else if (tipoKey === 'estética') {
      payload.local = form.localEstetica
      payload.valor = Number(form.valor || 0)
      payload.descricao = form.descricao || ''
    } else if (tipoKey === 'pedágio') {
      payload.valor = Number(form.valor || 0)
      payload.descricao = [`Tipo de pagamento: ${form.tipoPagamento}`, form.descricao].filter(Boolean).join(' • ')
    } else if (tipoKey === 'km inicial') {
      payload.valor = 0
      payload.descricao = form.descricao || 'Registro de KM inicial'
    }

    if (!isEditing && (tipoKey === 'financiamento' || tipoKey === 'seguro') && Number(form.parcelas || 0) > 1 && Number(form.valorParcela || 0) > 0) {
      const qtd = Number(form.parcelas)
      const valorParcela = Number(form.valorParcela)
      for (let i = 0; i < qtd; i += 1) {
        await api.post('/expenses', { ...payload, data: addMonths(dataIso, i), valor: valorParcela, descricao: `${payload.descricao} • Parcela ${i + 1}/${qtd}` })
      }
    } else if (!isEditing && form.repetirRegistro && !['manutenção', 'financiamento', 'seguro'].includes(tipoKey)) {
      const total = Number(form.numeroRepeticoes || 1)
      for (let i = 0; i < total; i += 1) {
        await api.post('/expenses', { ...payload, data: addInterval(dataIso, form.frequenciaRepeticao, i) })
      }
    } else if (isEditing) {
      await api.put(`/expenses/${editId}`, payload)
    } else {
      await api.post('/expenses', payload)
    }

    goBackToTimeline()
  }

  const deleteCurrent = async () => {
    if (!editId || !window.confirm('Deseja excluir esta despesa?')) return
    await api.delete(`/expenses/${editId}`)
    goBackToTimeline()
  }

  return (
    <form className="card card-body" onSubmit={submit}>
      <h4><i className="fa-solid fa-receipt me-2" />{isEditing ? 'Editar despesa' : cloneId ? 'Clonar despesa' : 'Nova despesa'}</h4>

      <div className="row g-2">
        <Field label="Tipo" icon="fa-solid fa-layer-group"><select className="form-select" value={form.tipoPrincipal} onChange={(e) => setForm({ ...form, tipoPrincipal: e.target.value })}>{TIPOS_DESPESA.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></Field>
        {tipoKey === 'financiamento' && <Field label="Financeira" icon="fa-solid fa-building-columns"><select className="form-select" value={form.financeira} onChange={(e) => setForm({ ...form, financeira: e.target.value })}>{financeiras.map((item) => <option key={item}>{item}</option>)}</select><ToggleCreate show={showNovo.financeira} onToggle={() => setShowNovo((prev) => ({ ...prev, financeira: !prev.financeira }))} addLabel="Cadastrar nova financeira" cancelLabel="Cancelar" value={novos.financeira} onChange={(v) => setNovos((prev) => ({ ...prev, financeira: v }))} onAdd={() => addOption('financeira')} placeholder="Ex.: Banco XYZ" /></Field>}
        <Field label="Data" icon="fa-regular fa-calendar-days"><input className="form-control" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>

        {(tipoKey === 'manutenção' || tipoKey === 'km inicial') && (
          <Field label="Quilometragem do veículo" icon="fa-solid fa-road">
            <div className="d-flex gap-2 align-items-center">
              <input className="form-control" style={{ maxWidth: 220 }} value={form.quilometragem} onChange={(e) => setForm({ ...form, quilometragem: e.target.value })} />
              {tipoKey === 'manutenção' && <div className="form-check mb-0">
                <input className="form-check-input" id="desconsiderar-km" type="checkbox" checked={form.desconsiderarKmRegistrada} onChange={(e) => setForm({ ...form, desconsiderarKmRegistrada: e.target.checked })} />
                <label className="form-check-label" htmlFor="desconsiderar-km">Desconsiderar km registrada</label>
              </div>}
            </div>
          </Field>
        )}

        {!['financiamento', 'seguro', 'manutenção', 'acessórios', 'estética', 'multa', 'km inicial'].includes(tipoKey) && <Field label="Valor" icon="fa-solid fa-money-bill-wave"><input className="form-control" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></Field>}

        {tipoKey === 'manutenção' && (
          <>
            <Field label="Oficina" icon="fa-solid fa-warehouse">
              <select className="form-select" value={form.oficina} onChange={(e) => setForm({ ...form, oficina: e.target.value })}>{oficinas.map((item) => <option key={item}>{item}</option>)}</select>
              <ToggleCreate show={showNovo.oficina} onToggle={() => setShowNovo((prev) => ({ ...prev, oficina: !prev.oficina }))} addLabel="Cadastrar nova oficina" cancelLabel="Cancelar" value={novos.oficina} onChange={(v) => setNovos((prev) => ({ ...prev, oficina: v }))} onAdd={() => addOption('oficina')} placeholder="Ex.: Oficina do João" />
            </Field>

            <Field label="Peças" icon="fa-solid fa-gears" colClass="col-12">
              <div className="row g-2">
                <div className="col-md-6">
                  <select className="form-select" value={form.peca} onChange={(e) => setForm({ ...form, peca: e.target.value })}>{pecas.map((item) => <option key={item}>{item}</option>)}</select>
                  <button type="button" className="btn btn-link btn-sm mt-1 px-0" onClick={() => setShowNovo((prev) => ({ ...prev, peca: !prev.peca }))}>{showNovo.peca ? 'Cancelar nova peça' : 'Cadastrar nova peça'}</button>
                  {renderInlineCreateField({
                    show: showNovo.peca,
                    value: novos.peca,
                    onChange: (v) => setNovos((prev) => ({ ...prev, peca: v })),
                    onAdd: () => addOption('peca'),
                    placeholder: 'Ex.: Pastilha de freio',
                  })}
                </div>
                <div className="col-md-4"><input className="form-control" placeholder="Valor da peça" value={form.valorPecaItem} onChange={(e) => setForm({ ...form, valorPecaItem: e.target.value })} /></div>
                <div className="col-md-2 d-flex align-items-center maintenance-add-slot">{form.peca && Number(form.valorPecaItem || 0) >= 0 && <button type="button" className="btn btn-sm btn-outline-primary maintenance-add-btn" onClick={addPecaManutencao}>Adicionar</button>}</div>
              </div>
              {!!manutencaoPecas.length && <ListValues items={manutencaoPecas} onRemove={removePecaManutencao} />}
            </Field>

            <Field label="Valor das peças" icon="fa-solid fa-coins"><input className="form-control" value={totalPecas.toFixed(2)} readOnly /></Field>

            <Field label="Serviços" icon="fa-solid fa-screwdriver-wrench" colClass="col-12">
              <div className="row g-2">
                <div className="col-md-6">
                  <select className="form-select" value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })}>{servicos.map((item) => <option key={item}>{item}</option>)}</select>
                  <button type="button" className="btn btn-link btn-sm mt-1 px-0" onClick={() => setShowNovo((prev) => ({ ...prev, servico: !prev.servico }))}>{showNovo.servico ? 'Cancelar novo serviço' : 'Cadastrar novo serviço'}</button>
                  {renderInlineCreateField({
                    show: showNovo.servico,
                    value: novos.servico,
                    onChange: (v) => setNovos((prev) => ({ ...prev, servico: v })),
                    onAdd: () => addOption('servico'),
                    placeholder: 'Ex.: Revisão elétrica',
                  })}
                </div>
                <div className="col-md-4"><input className="form-control" placeholder="Valor do serviço" value={form.valorServicoItem} onChange={(e) => setForm({ ...form, valorServicoItem: e.target.value })} /></div>
                <div className="col-md-2 d-flex align-items-center maintenance-add-slot">{form.servico && Number(form.valorServicoItem || 0) >= 0 && <button type="button" className="btn btn-sm btn-outline-primary maintenance-add-btn" onClick={addServicoManutencao}>Adicionar</button>}</div>
              </div>
              {!!manutencaoServicos.length && <ListValues items={manutencaoServicos} onRemove={removeServicoManutencao} />}
            </Field>

            <Field label="Valor do serviços" icon="fa-solid fa-screwdriver-wrench"><input className="form-control" value={totalServicos.toFixed(2)} readOnly /></Field>

            <Field label="Descrição dos serviços" icon="fa-regular fa-note-sticky" colClass="col-12"><AutoGrowTextarea value={form.descricaoServico} onChange={(value) => setForm({ ...form, descricaoServico: value })} /></Field>
            <Field label="Validade em quilometragem" icon="fa-solid fa-gauge-high"><input className="form-control" value={form.validade_km} onChange={(e) => setForm({ ...form, validade_km: e.target.value })} /></Field>
            <Field label="Validade em dias" icon="fa-regular fa-clock"><input className="form-control" value={form.validade_dias} onChange={(e) => setForm({ ...form, validade_dias: e.target.value })} /></Field>
            <Field label="Total" icon="fa-solid fa-calculator" colClass="col-12"><input className="form-control" value={totalManutencao.toFixed(2)} readOnly /></Field>
          </>
        )}

        {tipoKey === 'multa' && (
          <>
            <Field label="Tipo da multa" icon="fa-solid fa-triangle-exclamation">
              <select className="form-select" value={form.tipoMulta} onChange={(e) => setForm({ ...form, tipoMulta: e.target.value })}>{tiposMulta.map((item) => <option key={item}>{item}</option>)}</select>
              <ToggleCreate show={showNovo.tipoMulta} onToggle={() => setShowNovo((prev) => ({ ...prev, tipoMulta: !prev.tipoMulta }))} addLabel="Cadastrar novo tipo" cancelLabel="Cancelar" value={novos.tipoMulta} onChange={(v) => setNovos((prev) => ({ ...prev, tipoMulta: v }))} onAdd={() => addOption('tipoMulta')} placeholder="Ex.: Rodízio" />
            </Field>
            <Field label="Local" icon="fa-solid fa-location-dot"><input className="form-control" value={form.local || ''} onChange={(e) => setForm({ ...form, local: e.target.value })} /></Field>
            <Field label="Descrição" icon="fa-regular fa-note-sticky"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Status" icon="fa-solid fa-list-check"><select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>A vencer</option><option>Paga</option><option>Recorrida</option></select></Field>
            {form.status === 'A vencer' && <Field label="Vencimento" icon="fa-regular fa-calendar-check"><input className="form-control" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>}
            <Field label="Valor" icon="fa-solid fa-money-bill-wave" colClass="col-12"><input className="form-control" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          </>
        )}

        {tipoKey === 'financiamento' && (
          <>
            <Field label="Quantidade de parcelas" icon="fa-solid fa-list-ol"><input className="form-control" value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value })} /></Field>
            <Field label="Valor da parcela" icon="fa-solid fa-coins"><input className="form-control" value={form.valorParcela} onChange={(e) => setForm({ ...form, valorParcela: e.target.value })} /></Field>
            <Field label="Descrição" icon="fa-regular fa-note-sticky"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor do financiamento" icon="fa-solid fa-calculator"><input className="form-control" value={totalParcelado.toFixed(2)} readOnly /></Field>
          </>
        )}

        {tipoKey === 'impostos' && <>
          <Field label="Tipo de imposto" icon="fa-solid fa-file-invoice-dollar"><select className="form-select" value={form.tipoImposto} onChange={(e) => setForm({ ...form, tipoImposto: e.target.value })}>{tiposImposto.map((item) => <option key={item}>{item}</option>)}</select><ToggleCreate show={showNovo.tipoImposto} onToggle={() => setShowNovo((prev) => ({ ...prev, tipoImposto: !prev.tipoImposto }))} addLabel="Cadastrar novo tipo de imposto" cancelLabel="Cancelar" value={novos.tipoImposto} onChange={(v) => setNovos((prev) => ({ ...prev, tipoImposto: v }))} onAdd={() => addOption('tipoImposto')} placeholder="Ex.: Taxa administrativa" /></Field>
          <Field label="Descrição" icon="fa-regular fa-note-sticky"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
        </>}

        {tipoKey === 'seguro' && (
          <>
            <Field label="Seguradora" icon="fa-solid fa-shield-halved"><select className="form-select" value={form.seguradora} onChange={(e) => setForm({ ...form, seguradora: e.target.value })}>{seguradoras.map((item) => <option key={item}>{item}</option>)}</select><ToggleCreate show={showNovo.seguradora} onToggle={() => setShowNovo((prev) => ({ ...prev, seguradora: !prev.seguradora }))} addLabel="Cadastrar nova seguradora" cancelLabel="Cancelar" value={novos.seguradora} onChange={(v) => setNovos((prev) => ({ ...prev, seguradora: v }))} onAdd={() => addOption('seguradora')} placeholder="Ex.: Tokio Marine" /></Field>
            <Field label="Classe de bônus" icon="fa-solid fa-star"><input className="form-control" value={form.classeBonus} onChange={(e) => setForm({ ...form, classeBonus: e.target.value })} /></Field>
            <Field label="Valor da parcela" icon="fa-solid fa-coins"><input className="form-control" value={form.valorParcela} onChange={(e) => setForm({ ...form, valorParcela: e.target.value })} /></Field>
            <Field label="Quantidade de parcelas" icon="fa-solid fa-list-ol"><input className="form-control" value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value })} /></Field>
            <Field label="Descrição" icon="fa-regular fa-note-sticky"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor do seguro" icon="fa-solid fa-calculator" colClass="col-12"><input className="form-control" value={totalParcelado.toFixed(2)} readOnly /></Field>
          </>
        )}

        {tipoKey === 'acessórios' && (
          <>
            <Field label="Nome" icon="fa-solid fa-puzzle-piece"><input className="form-control" value={form.nomePeca} onChange={(e) => setForm({ ...form, nomePeca: e.target.value })} /></Field>
            <Field label="Descrição" icon="fa-regular fa-note-sticky"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor" icon="fa-solid fa-money-bill-wave" colClass="col-12"><input className="form-control" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          </>
        )}

        {tipoKey === 'estacionamento' && <>
          <Field label="Local" icon="fa-solid fa-square-parking"><select className="form-select" value={form.localEstacionamento} onChange={(e) => setForm({ ...form, localEstacionamento: e.target.value })}>{locaisEstacionamento.map((item) => <option key={item}>{item}</option>)}</select><ToggleCreate show={showNovo.localEstacionamento} onToggle={() => setShowNovo((prev) => ({ ...prev, localEstacionamento: !prev.localEstacionamento }))} addLabel="Cadastrar novo local" cancelLabel="Cancelar" value={novos.localEstacionamento} onChange={(v) => setNovos((prev) => ({ ...prev, localEstacionamento: v }))} onAdd={() => addOption('localEstacionamento')} placeholder="Ex.: Shopping Central" /></Field>
          <Field label="Descrição" icon="fa-regular fa-note-sticky"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
        </>}

        {tipoKey === 'estética' && (
          <>
            <Field label="Local" icon="fa-solid fa-sparkles"><select className="form-select" value={form.localEstetica} onChange={(e) => setForm({ ...form, localEstetica: e.target.value })}>{locaisEstetica.map((item) => <option key={item}>{item}</option>)}</select><ToggleCreate show={showNovo.localEstetica} onToggle={() => setShowNovo((prev) => ({ ...prev, localEstetica: !prev.localEstetica }))} addLabel="Cadastrar novo local" cancelLabel="Cancelar" value={novos.localEstetica} onChange={(v) => setNovos((prev) => ({ ...prev, localEstetica: v }))} onAdd={() => addOption('localEstetica')} placeholder="Ex.: Estética da Vila" /></Field>
            <Field label="Descrição" icon="fa-regular fa-note-sticky"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor" icon="fa-solid fa-money-bill-wave" colClass="col-12"><input className="form-control" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          </>
        )}

        {tipoKey === 'pedágio' && (
          <>
            <Field label="Tipo de pagamento" icon="fa-solid fa-credit-card">
              <select className="form-select" value={form.tipoPagamento} onChange={(e) => setForm({ ...form, tipoPagamento: e.target.value })}>
                <option>Dinheiro</option>
                <option>Cartão</option>
                <option>Taggy</option>
              </select>
            </Field>
            <Field label="Descrição" icon="fa-regular fa-note-sticky"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor" icon="fa-solid fa-money-bill-wave" colClass="col-12"><input className="form-control" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          </>
        )}

        {!['manutenção', 'financiamento', 'seguro'].includes(tipoKey) && (
          <Field label="Repetição" icon="fa-solid fa-repeat" colClass="col-12">
            <div className="form-check mb-2">
              <input className="form-check-input" id="repetir-registro" type="checkbox" checked={form.repetirRegistro} onChange={(e) => setForm({ ...form, repetirRegistro: e.target.checked })} />
              <label className="form-check-label" htmlFor="repetir-registro">Repetir registro</label>
            </div>
            {form.repetirRegistro && (
              <div className="row g-2">
                <div className="col-md-6">
                  <select className="form-select" value={form.frequenciaRepeticao} onChange={(e) => setForm({ ...form, frequenciaRepeticao: e.target.value })}>
                    <option value="diario">Diariamente</option>
                    <option value="semanal">Semanalmente</option>
                    <option value="mensal">Mensalmente</option>
                    <option value="anual">Anualmente</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <input className="form-control" type="number" min="1" placeholder="Número de vezes" value={form.numeroRepeticoes} onChange={(e) => setForm({ ...form, numeroRepeticoes: e.target.value })} />
                </div>
              </div>
            )}
          </Field>
        )}
      </div>

      <div className="d-flex gap-2 mt-3 flex-wrap">
        <button type="submit" className="btn btn-primary"><i className="fa-solid fa-floppy-disk me-2" />Salvar</button>
        <button type="button" className="btn btn-outline-secondary" onClick={handleCancel}><i className="fa-solid fa-arrow-left me-2" />Cancelar</button>
        {isEditing && <button type="button" className="btn btn-outline-danger" onClick={deleteCurrent}><i className="fa-solid fa-trash me-2" />Excluir registro</button>}
      </div>
    </form>
  )
}

function Field({ label, icon, children, colClass = 'col-md-6' }) {
  return <div className={colClass}><label className="form-label"><i className={`${icon} me-2`} />{label}</label>{children}</div>
}

function ToggleCreate({ show, onToggle, addLabel, cancelLabel, value, onChange, onAdd, placeholder }) {
  return (
    <>
      <button type="button" className="btn btn-link btn-sm mt-1 px-0" onClick={onToggle}>{show ? cancelLabel : addLabel}</button>
      {show && <div className="d-flex gap-2 mt-1"><input className="form-control form-control-sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /><button type="button" className="btn btn-sm btn-outline-primary" onClick={onAdd}>Adicionar</button></div>}
    </>
  )
}

function ListValues({ items, onRemove }) {
  return (
    <div className="d-flex flex-wrap gap-2 mt-2">
      {items.map((item, idx) => (
        <span className="badge text-bg-light border" key={`${item.nome}-${idx}`}>
          {item.nome} • R$ {Number(item.valor).toFixed(2)}
          <button type="button" className="btn btn-sm py-0 px-1 ms-1" onClick={() => onRemove(idx)} title="Remover"><i className="fa-solid fa-xmark" /></button>
        </span>
      ))}
    </div>
  )
}

function AutoGrowTextarea({ value, onChange, minRows = 2 }) {
  return (
    <textarea
      className="form-control"
      rows={minRows}
      style={{ resize: 'vertical' }}
      value={value}
      onInput={(e) => {
        e.currentTarget.style.height = 'auto'
        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
      }}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
