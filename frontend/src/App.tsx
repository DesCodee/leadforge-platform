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
      const parseRes = await fetch('http://localhost:8000/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: data.urls,
          niche: data.niche,
          max_concurrent: 3
        })
      })
      const parsed = await parseRes.json()
      
      const leadsWithEmails = []
      for (let i = 0; i < parsed.results.length; i++) {
        const lead = parsed.results[i]
        setProgress({ current: i + 1, total: parsed.results.length })
        
        if (lead.status === 'completed') {
          const genRes = await fetch('http://localhost:8000/api/generate-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_data: lead,
              niche: data.niche,
              model: 'gemini'
            })
          })
          const emailData = await genRes.json()
          leadsWithEmails.push({
            ...lead,
            id: `lead-${i}`,
            email: emailData.data
          })
        } else {
          leadsWithEmails.push({ ...lead, id: `lead-${i}` })
        }
      }
      
      setLeads(leadsWithEmails)
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">LeadForge</h1>
          <p className="text-gray-500 mt-1">Автоматический аудит сайтов и генерация холодных писем</p>
        </div>
        
        <CampaignForm 
          onSubmit={handleSubmit} 
          isLoading={loading} 
          progress={progress} 
        />
        
        {leads.length > 0 && (
          <ResultsTable 
            leads={leads} 
            onExport={(ids) => console.log('Export:', ids)} 
          />
        )}
      </div>
    </div>
  )
}

export default App
