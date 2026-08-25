import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { useUI } from '../components/UIProvider'
import Field, { LookupSelect, ChipList, AutoGrowTextarea } from '../components/Field'
import Icon from '../components/Icon'
import { ButtonSpinner } from '../components/Loading'

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
  const { confirm, toast } = useUI()
  const [submitting, setSubmitting] = useState(false)
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

  const addLookup = async (field, rawValue) => {
    const value = String(rawValue || '').trim()
    if (!value) return false

    const map = {
      oficina: [setOficinas, LIST_CATEGORIES.oficinas, 'oficina', 'oficinas'],
      peca: [setPecas, LIST_CATEGORIES.pecas, 'peca', 'pecas'],
      servico: [setServicos, LIST_CATEGORIES.servicos, 'servico', 'servicos'],
      localEstacionamento: [setLocaisEstacionamento, LIST_CATEGORIES.locaisEstacionamento, 'localEstacionamento', 'locaisEstacionamento'],
      localEstetica: [setLocaisEstetica, LIST_CATEGORIES.locaisEstetica, 'localEstetica', 'locaisEstetica'],
      tipoMulta: [setTiposMulta, LIST_CATEGORIES.tiposMulta, 'tipoMulta', 'tiposMulta'],
      tipoImposto: [setTiposImposto, LIST_CATEGORIES.tiposImposto, 'tipoImposto', 'tiposImposto'],
      seguradora: [setSeguradoras, LIST_CATEGORIES.seguradoras, 'seguradora', 'seguradoras'],
      financeira: [setFinanceiras, LIST_CATEGORIES.financeiras, 'financeira', 'financeiras'],
    }

    const [setter, category, formKey, stateKey] = map[field]
    try {
      await api.post('/lookup', { category, value })
    } catch {}
    const next = await loadOptionList(stateKey)
    setter(next)
    setForm((prev) => ({ ...prev, [formKey]: value }))
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
    if (submitting) return
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

    setSubmitting(true)
    try {
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

      toast.success(isEditing ? 'Despesa atualizada.' : 'Despesa salva.')
      goBackToTimeline()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Não foi possível salvar a despesa.')
      setSubmitting(false)
    }
  }

  const deleteCurrent = async () => {
    if (!editId) return
    const ok = await confirm({ title: 'Excluir despesa', message: 'Deseja excluir esta despesa?', confirmLabel: 'Excluir', danger: true })
    if (!ok) return
    await api.delete(`/expenses/${editId}`)
    toast.success('Despesa excluída.')
    goBackToTimeline()
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1 className="page-title"><Icon name="receipt" />{isEditing ? 'Editar despesa' : cloneId ? 'Clonar despesa' : 'Nova despesa'}</h1>

      <div className="grid-2">
        <Field label="Tipo" icon="layers"><select className="select" value={form.tipoPrincipal} onChange={(e) => setForm({ ...form, tipoPrincipal: e.target.value })}>{TIPOS_DESPESA.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></Field>
        {tipoKey === 'financiamento' && (
          <Field label="Financeira" icon="landmark">
            <LookupSelect
              value={form.financeira}
              onChange={(financeira) => setForm({ ...form, financeira })}
              options={financeiras}
              placeholder=""
              addPlaceholder="Ex.: Banco XYZ"
              addAriaLabel="Cadastrar nova financeira"
              onAdd={(value) => addLookup('financeira', value)}
            />
          </Field>
        )}
        <Field label="Data" icon="calendar"><input className="input" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></Field>

        {(tipoKey === 'manutenção' || tipoKey === 'km inicial') && (
          <Field label="Quilometragem do veículo" icon="route">
            <div className="cluster">
              <input className="input" style={{ maxWidth: 220 }} type="number" inputMode="numeric" min="0" value={form.quilometragem} onChange={(e) => setForm({ ...form, quilometragem: e.target.value })} />
              {tipoKey === 'manutenção' && <div className="check">
                <input id="desconsiderar-km" type="checkbox" checked={form.desconsiderarKmRegistrada} onChange={(e) => setForm({ ...form, desconsiderarKmRegistrada: e.target.checked })} />
                <label htmlFor="desconsiderar-km">Desconsiderar km registrada</label>
              </div>}
            </div>
          </Field>
        )}

        {!['financiamento', 'seguro', 'manutenção', 'acessórios', 'estética', 'multa', 'km inicial'].includes(tipoKey) && <Field label="Valor" icon="banknote"><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required /></Field>}

        {tipoKey === 'manutenção' && (
          <>
            <Field label="Oficina" icon="warehouse">
              <LookupSelect
                value={form.oficina}
                onChange={(oficina) => setForm({ ...form, oficina })}
                options={oficinas}
                placeholder=""
                addPlaceholder="Ex.: Oficina do João"
                addAriaLabel="Cadastrar nova oficina"
                onAdd={(value) => addLookup('oficina', value)}
              />
            </Field>

            <Field label="Peças" icon="settings" span>
              <LookupSelect
                value={form.peca}
                onChange={(peca) => setForm({ ...form, peca })}
                options={pecas}
                placeholder=""
                addPlaceholder="Ex.: Pastilha de freio"
                addAriaLabel="Cadastrar nova peça"
                onAdd={(value) => addLookup('peca', value)}
              />
              <div className="input-row">
                <input className="input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Valor da peça" value={form.valorPecaItem} onChange={(e) => setForm({ ...form, valorPecaItem: e.target.value })} />
                <button type="button" className="btn btn-accent" onClick={addPecaManutencao}>Adicionar</button>
              </div>
              {!!manutencaoPecas.length && <ChipList items={manutencaoPecas} onRemove={removePecaManutencao} />}
            </Field>

            <Field label="Valor das peças" icon="coins"><input className="input" value={totalPecas.toFixed(2)} readOnly /></Field>

            <Field label="Serviços" icon="wrench" span>
              <LookupSelect
                value={form.servico}
                onChange={(servico) => setForm({ ...form, servico })}
                options={servicos}
                placeholder=""
                addPlaceholder="Ex.: Revisão elétrica"
                addAriaLabel="Cadastrar novo serviço"
                onAdd={(value) => addLookup('servico', value)}
              />
              <div className="input-row">
                <input className="input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="Valor do serviço" value={form.valorServicoItem} onChange={(e) => setForm({ ...form, valorServicoItem: e.target.value })} />
                <button type="button" className="btn btn-accent" onClick={addServicoManutencao}>Adicionar</button>
              </div>
              {!!manutencaoServicos.length && <ChipList items={manutencaoServicos} onRemove={removeServicoManutencao} />}
            </Field>

            <Field label="Valor do serviços" icon="wrench"><input className="input" value={totalServicos.toFixed(2)} readOnly /></Field>

            <Field label="Descrição dos serviços" icon="stickyNote" span><AutoGrowTextarea value={form.descricaoServico} onChange={(value) => setForm({ ...form, descricaoServico: value })} /></Field>
            <Field label="Validade em quilometragem" icon="gauge"><input className="input" type="number" inputMode="numeric" min="0" value={form.validade_km} onChange={(e) => setForm({ ...form, validade_km: e.target.value })} /></Field>
            <Field label="Validade em dias" icon="clock"><input className="input" type="number" inputMode="numeric" min="0" value={form.validade_dias} onChange={(e) => setForm({ ...form, validade_dias: e.target.value })} /></Field>
            <Field label="Total" icon="calculator" span><input className="input" value={totalManutencao.toFixed(2)} readOnly /></Field>
          </>
        )}

        {tipoKey === 'multa' && (
          <>
            <Field label="Tipo da multa" icon="triangleAlert">
              <LookupSelect
                value={form.tipoMulta}
                onChange={(tipoMulta) => setForm({ ...form, tipoMulta })}
                options={tiposMulta}
                placeholder=""
                addPlaceholder="Ex.: Rodízio"
                addAriaLabel="Cadastrar novo tipo de multa"
                onAdd={(value) => addLookup('tipoMulta', value)}
              />
            </Field>
            <Field label="Local" icon="mapPin"><input className="input" value={form.local || ''} onChange={(e) => setForm({ ...form, local: e.target.value })} /></Field>
            <Field label="Descrição" icon="stickyNote"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Status" icon="listChecks"><select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>A vencer</option><option>Paga</option><option>Recorrida</option></select></Field>
            {form.status === 'A vencer' && <Field label="Vencimento" icon="calendarCheck"><input className="input" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></Field>}
            <Field label="Valor" icon="banknote" span><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          </>
        )}

        {tipoKey === 'financiamento' && (
          <>
            <Field label="Quantidade de parcelas" icon="listOrdered"><input className="input" type="number" inputMode="numeric" min="1" step="1" value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value })} /></Field>
            <Field label="Valor da parcela" icon="coins"><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.valorParcela} onChange={(e) => setForm({ ...form, valorParcela: e.target.value })} /></Field>
            <Field label="Descrição" icon="stickyNote"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor do financiamento" icon="calculator"><input className="input" value={totalParcelado.toFixed(2)} readOnly /></Field>
          </>
        )}

        {tipoKey === 'impostos' && <>
          <Field label="Tipo de imposto" icon="fileSpreadsheet">
            <LookupSelect
              value={form.tipoImposto}
              onChange={(tipoImposto) => setForm({ ...form, tipoImposto })}
              options={tiposImposto}
              placeholder=""
              addPlaceholder="Ex.: Taxa administrativa"
              addAriaLabel="Cadastrar novo tipo de imposto"
              onAdd={(value) => addLookup('tipoImposto', value)}
            />
          </Field>
          <Field label="Descrição" icon="stickyNote"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
        </>}

        {tipoKey === 'seguro' && (
          <>
            <Field label="Seguradora" icon="shield">
              <LookupSelect
                value={form.seguradora}
                onChange={(seguradora) => setForm({ ...form, seguradora })}
                options={seguradoras}
                placeholder=""
                addPlaceholder="Ex.: Tokio Marine"
                addAriaLabel="Cadastrar nova seguradora"
                onAdd={(value) => addLookup('seguradora', value)}
              />
            </Field>
            <Field label="Classe de bônus" icon="star"><input className="input" value={form.classeBonus} onChange={(e) => setForm({ ...form, classeBonus: e.target.value })} /></Field>
            <Field label="Valor da parcela" icon="coins"><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.valorParcela} onChange={(e) => setForm({ ...form, valorParcela: e.target.value })} /></Field>
            <Field label="Quantidade de parcelas" icon="listOrdered"><input className="input" type="number" inputMode="numeric" min="1" step="1" value={form.parcelas} onChange={(e) => setForm({ ...form, parcelas: e.target.value })} /></Field>
            <Field label="Descrição" icon="stickyNote"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor do seguro" icon="calculator" span><input className="input" value={totalParcelado.toFixed(2)} readOnly /></Field>
          </>
        )}

        {tipoKey === 'acessórios' && (
          <>
            <Field label="Nome" icon="puzzle"><input className="input" value={form.nomePeca} onChange={(e) => setForm({ ...form, nomePeca: e.target.value })} /></Field>
            <Field label="Descrição" icon="stickyNote"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor" icon="banknote" span><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          </>
        )}

        {tipoKey === 'estacionamento' && <>
          <Field label="Local" icon="parking">
            <LookupSelect
              value={form.localEstacionamento}
              onChange={(localEstacionamento) => setForm({ ...form, localEstacionamento })}
              options={locaisEstacionamento}
              placeholder=""
              addPlaceholder="Ex.: Shopping Central"
              addAriaLabel="Cadastrar novo local"
              onAdd={(value) => addLookup('localEstacionamento', value)}
            />
          </Field>
          <Field label="Descrição" icon="stickyNote"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
        </>}

        {tipoKey === 'estética' && (
          <>
            <Field label="Local" icon="sparkles">
              <LookupSelect
                value={form.localEstetica}
                onChange={(localEstetica) => setForm({ ...form, localEstetica })}
                options={locaisEstetica}
                placeholder=""
                addPlaceholder="Ex.: Estética da Vila"
                addAriaLabel="Cadastrar novo local"
                onAdd={(value) => addLookup('localEstetica', value)}
              />
            </Field>
            <Field label="Descrição" icon="stickyNote"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor" icon="banknote" span><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          </>
        )}

        {tipoKey === 'pedágio' && (
          <>
            <Field label="Tipo de pagamento" icon="creditCard">
              <select className="select" value={form.tipoPagamento} onChange={(e) => setForm({ ...form, tipoPagamento: e.target.value })}>
                <option>Dinheiro</option>
                <option>Cartão</option>
                <option>Taggy</option>
              </select>
            </Field>
            <Field label="Descrição" icon="stickyNote"><AutoGrowTextarea value={form.descricao} onChange={(value) => setForm({ ...form, descricao: value })} /></Field>
            <Field label="Valor" icon="banknote" span><input className="input" type="number" inputMode="decimal" min="0" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></Field>
          </>
        )}

        {!['manutenção', 'financiamento', 'seguro'].includes(tipoKey) && (
          <Field label="Repetição" icon="repeat" span>
            <div className="check">
              <input id="repetir-registro" type="checkbox" checked={form.repetirRegistro} onChange={(e) => setForm({ ...form, repetirRegistro: e.target.checked })} />
              <label htmlFor="repetir-registro">Repetir registro</label>
            </div>
            {form.repetirRegistro && (
              <div className="grid-2">
                <div>
                  <select className="select" value={form.frequenciaRepeticao} onChange={(e) => setForm({ ...form, frequenciaRepeticao: e.target.value })}>
                    <option value="diario">Diariamente</option>
                    <option value="semanal">Semanalmente</option>
                    <option value="mensal">Mensalmente</option>
                    <option value="anual">Anualmente</option>
                  </select>
                </div>
                <div>
                  <input className="input" type="number" min="1" placeholder="Número de vezes" value={form.numeroRepeticoes} onChange={(e) => setForm({ ...form, numeroRepeticoes: e.target.value })} />
                </div>
              </div>
            )}
          </Field>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? <><ButtonSpinner />Salvando...</> : <><Icon name="save" size={16} />Salvar</>}
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={submitting}><Icon name="arrowLeft" size={16} />Cancelar</button>
        {isEditing && <button type="button" className="btn btn-danger" onClick={deleteCurrent} disabled={submitting}><Icon name="trash" size={16} />Excluir registro</button>}
      </div>
    </form>
  )
}
