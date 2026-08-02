import { useState } from 'react'
import { CampaignForm } from './components/CampaignForm'
import { ResultsTable } from './components/ResultsTable'

function App() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const handleSubmit = async (data: any) => {
    setLoading(true)
    setProgress({ current: 0, total: data.urls.length })
    try {
      const parseRes = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: data.urls, niche: data.niche, max_concurrent: 3 })
      })
      const parsed = await parseRes.json()
      const leadsWithEmails = []
      for (let i = 0; i < parsed.results.length; i++) {
        const lead = parsed.results[i]
        setProgress({ current: i + 1, total: parsed.results.length })
        if (lead.status === "completed") {
          const genRes = await fetch("/api/generate-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lead_data: lead, niche: data.niche, model: "gemini" })
          })
          const emailData = await genRes.json()
          leadsWithEmails.push({ ...lead, id: `lead-${i}`, email: emailData.data })
        } else {
          leadsWithEmails.push({ ...lead, id: `lead-${i}` })
        }
      }
      setLeads(leadsWithEmails)
    } catch (err: any) {
      alert("Ошибка: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (selectedIds: string[]) => {
    const selectedLeads = leads.filter(l => selectedIds.includes(l.id))
    const header = "Domain,Company,Pains,Subject,Body,Hook\n"
    const rows = selectedLeads.map(l => {
      const pains = (l.detected_pains || []).join("; ")
      const sub = l.email?.subject || ""
      const body = (l.email?.body || "").replace(/"/g, '""').replace(/\n/g, " ")
      const hook = l.email?.hook || ""
      return `"${l.domain || ""}","${l.company_name || ""}","${pains}","${sub}","${body}","${hook}"`
    }).join("\n")
    const csv = "\uFEFF" + header + rows
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `leadforge-export-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">LeadForge</h1>
          <p className="text-gray-500 mt-1">Автоматический аудит сайтов и генерация холодных писем</p>
        </div>
        <CampaignForm onSubmit={handleSubmit} isLoading={loading} progress={progress} />
        {leads.length > 0 && (
          <ResultsTable leads={leads} onExport={handleExport} />
        )}
      </div>
    </div>
  )
}

export default App
