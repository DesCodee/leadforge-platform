import React, { useState } from 'react'
import { Copy, Download, Mail, ExternalLink, Edit3, Check, ChevronDown, ChevronUp, AlertCircle, Zap, Shield, Smartphone, BarChart3, MessageCircle } from 'lucide-react'
import { EmailEditor } from './EmailEditor'

interface Lead {
  id: string
  url: string
  domain: string
  company_name: string
  detected_pains: string[]
  status: 'pending' | 'analyzing' | 'completed' | 'failed'
  email?: { subject: string; body: string; hook: string }
  is_edited?: boolean
}

interface ResultsTableProps {
  leads: Lead[]
  onExport: (selectedIds: string[]) => void
  onUpdateLead?: (id: string, email: { subject: string; body: string; hook: string }) => void
}

const PAIN_ICONS: Record<string, React.ReactNode> = {
  slow_speed: <Zap className="w-3 h-3" />,
  no_ssl: <Shield className="w-3 h-3" />,
  not_mobile_friendly: <Smartphone className="w-3 h-3" />,
  no_analytics: <BarChart3 className="w-3 h-3" />,
  no_chat_widget: <MessageCircle className="w-3 h-3" />,
  outdated_stack: <AlertCircle className="w-3 h-3" />,
}

const PAIN_LABELS: Record<string, string> = {
  slow_speed: 'Медленный',
  no_ssl: 'Нет SSL',
  not_mobile_friendly: 'Не адаптив',
  no_analytics: 'Нет аналитики',
  no_chat_widget: 'Нет чата',
  outdated_stack: 'Устаревший стек',
  poor_social_presence: 'Соцсети',
  site_unavailable: 'Недоступен',
}

const PainBadge: React.FC<{ pain: string }> = ({ pain }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
    {PAIN_ICONS[pain] || <AlertCircle className="w-3 h-3" />}
    {PAIN_LABELS[pain] || pain}
  </span>
)

export const ResultsTable: React.FC<ResultsTableProps> = ({ leads, onExport, onUpdateLead }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleSelectAll = () => {
    if (selected.size === leads.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(leads.map(l => l.id)))
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-600',
      analyzing: 'bg-blue-50 text-blue-600',
      completed: 'bg-green-50 text-green-600',
      failed: 'bg-red-50 text-red-600',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {status === 'pending' && 'Ожидание'}
        {status === 'analyzing' && 'Анализ...'}
        {status === 'completed' && 'Готово'}
        {status === 'failed' && 'Ошибка'}
      </span>
    )
  }

  const startEdit = (lead: Lead) => {
    setEditingId(lead.id)
  }

  const saveEdit = (leadId: string, data: { subject: string; body: string; hook: string }) => {
    if (onUpdateLead) {
      onUpdateLead(leadId, data)
    }
    setEditingId(null)
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            Выбрано: <span className="font-semibold text-gray-900">{selected.size}</span> / {leads.length}
          </span>
          {selected.size > 0 && (
            <button
              onClick={() => onExport(Array.from(selected))}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Экспорт CSV
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          {leads.filter(l => l.status === 'completed').length} готово
          <span className="w-2 h-2 rounded-full bg-red-500 ml-2"></span>
          {leads.filter(l => l.status === 'failed').length} ошибок
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === leads.length && leads.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3">Сайт / Компания</th>
                <th className="px-4 py-3">Боли</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Письмо</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <React.Fragment key={lead.id}>
                  <tr className={`hover:bg-gray-50 transition-colors ${selected.has(lead.id) ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <a
                          href={lead.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-900 hover:text-indigo-600 flex items-center gap-1"
                        >
                          {lead.company_name || lead.domain}
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </a>
                        <span className="text-xs text-gray-400">{lead.domain}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lead.detected_pains.length > 0 ? (
                          lead.detected_pains.map((pain) => (
                            <PainBadge key={pain} pain={pain} />
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">Нет проблем</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(lead.status)}</td>
                    <td className="px-4 py-3">
                      {lead.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs text-gray-600 truncate max-w-[200px]">
                            {lead.email.subject}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRow(expandedRow === lead.id ? null : lead.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {expandedRow === lead.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {expandedRow === lead.id && lead.email && (
                    <tr className="bg-gray-50/50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="space-y-3 max-w-3xl">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                              <Edit3 className="w-4 h-4" />
                              Сгенерированное письмо
                              {lead.is_edited && (
                                <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                  Изменено
                                </span>
                              )}
                            </h4>
                            <div className="flex items-center gap-2">
                              {editingId !== lead.id && onUpdateLead && (
                                <button
                                  onClick={() => startEdit(lead)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  Редактировать
                                </button>
                              )}
                              <button
                                onClick={() => copyToClipboard(lead.email!.body, `body-${lead.id}`)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                {copiedId === `body-${lead.id}` ? (
                                  <><Check className="w-3 h-3 text-green-500" /> Скопировано</>
                                ) : (
                                  <><Copy className="w-3 h-3" /> Копировать</>
                                )}
                              </button>
                            </div>
                          </div>

                          {editingId === lead.id ? (
                            <EmailEditor
                              subject={lead.email.subject}
                              body={lead.email.body}
                              hook={lead.email.hook}
                              onSave={(data) => saveEdit(lead.id, data)}
                              onCancel={() => setEditingId(null)}
                            />
                          ) : (
                            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                              <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subject</label>
                                <p className="mt-1 text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded">
                                  {lead.email.subject}
                                </p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hook (персонализация)</label>
                                <p className="mt-1 text-sm text-indigo-700 bg-indigo-50 p-2 rounded border border-indigo-100">
                                  {lead.email.hook}
                                </p>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Body</label>
                                <div className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap leading-relaxed">
                                  {lead.email.body}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {leads.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-900 mb-1">Нет данных</p>
            <p className="text-sm">Запустите кампанию, чтобы увидеть результаты</p>
          </div>
        )}
      </div>
    </div>
  )
}
