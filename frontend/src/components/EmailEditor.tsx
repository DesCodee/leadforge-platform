import { useState } from 'react'
import { Save, X } from 'lucide-react'

interface Props {
  subject: string
  body: string
  hook: string
  onSave: (data: { subject: string; body: string; hook: string }) => void
  onCancel: () => void
}

export const EmailEditor = ({ subject, body, hook, onSave, onCancel }: Props) => {
  const [s, setS] = useState(subject)
  const [b, setB] = useState(body)
  const [h, setH] = useState(hook)

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase">Subject</label>
        <input value={s} onChange={e => setS(e.target.value)} className="mt-1 w-full text-sm font-medium text-gray-900 bg-white p-2 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase">Hook</label>
        <input value={h} onChange={e => setH(e.target.value)} className="mt-1 w-full text-sm text-indigo-700 bg-white p-2 rounded border border-indigo-300 focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase">Body</label>
        <textarea value={b} onChange={e => setB(e.target.value)} rows={6} className="mt-1 w-full text-sm text-gray-700 bg-white p-3 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-500 whitespace-pre-wrap" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ subject: s, body: b, hook: h })} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700"><Save className="w-3 h-3"/>Сохранить</button>
        <button onClick={onCancel} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"><X className="w-3 h-3"/>Отмена</button>
      </div>
    </div>
  )
}
