import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Auth } from './components/Auth'
import { CampaignForm } from './components/CampaignForm'
import { ResultsTable } from './components/ResultsTable'
import { LogOut, History, User, AlertCircle } from 'lucide-react'

function App() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [limitError, setLimitError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      loadProfile()
      loadCampaigns()
    }
  }, [user])

  const loadProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setProfile(data)
  }

  const loadCampaigns = async () => {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setCampaigns(data)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setLeads([])
    setShowHistory(false)
    setProfile(null)
  }

  const checkLimit = async (urlCount: number) => {
    if (!profile) return false
    const now = new Date()
    const reset = new Date(profile.reset_date)
    if (now > reset) {
      await supabase.from('profiles').update({
        monthly_url_used: 0,
        reset_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
      }).eq('id', user.id)
      setProfile({ ...profile, monthly_url_used: 0 })
      return urlCount <= profile.monthly_url_limit
    }
    return (profile.monthly_url_used + urlCount) <= profile.monthly_url_limit
  }

  const updateUsage = async (urlCount: number) => {
    await supabase.from('profiles').update({
      monthly_url_used: profile.monthly_url_used + urlCount
    }).eq('id', user.id)
    setProfile({ ...profile, monthly_url_used: profile.monthly_url_used + urlCount })
  }

  const saveCampaign = async (name: string, niche: string, location: string, leadsData: any[]) => {
    if (!user) return
    const { data: campaign } = await supabase.from('campaigns').insert({
      user_id: user.id,
      name,
      niche,
      location,
      status: 'completed',
      total_urls: leadsData.length,
      processed_urls: leadsData.filter(l => l.status === 'completed').length
    }).select().single()

    if (!campaign) return

    for (const lead of leadsData) {
      const { data: leadRow } = await supabase.from('leads').insert({
        campaign_id: campaign.id,
        url: lead.url,
        domain: lead.domain,
        company_name: lead.company_name,
        page_title: lead.page_title,
        meta_description: lead.meta_description,
        emails: lead.emails,
        phones: lead.phones,
        ssl_valid: lead.ssl_valid,
        load_time_ms: lead.load_time_ms,
        has_mobile_friendly: lead.has_mobile_friendly,
        detected_pains: lead.detected_pains,
        status: lead.status
      }).select().single()

      if (leadRow && lead.email) {
        await supabase.from('generated_emails').insert({
          lead_id: leadRow.id,
          campaign_id: campaign.id,
          user_id: user.id,
          subject: lead.email.subject,
          body: lead.email.body,
          personalized_hook: lead.email.hook,
          ai_model: lead.email.model || 'gemini'
        })
      }
    }
    loadCampaigns()
  }

  const handleUpdateLead = (leadId: string, email: { subject: string; body: string; hook: string }) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, email: { ...l.email, ...email }, is_edited: true } : l))
  }

  const handleSubmit = async (data: any) => {
    setLimitError('')
    setLoading(true)
    setProgress({ current: 0, total: data.urls.length })
    setShowHistory(false)

    const canProceed = await checkLimit(data.urls.length)
    if (!canProceed) {
      setLimitError(`Лимит исчерпан! На тарифе ${profile?.plan || 'free'} доступно ${profile?.monthly_url_limit || 10} URL/мес.`)
      setLoading(false)
      return
    }

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
      await updateUsage(data.urls.length)
      await saveCampaign(data.name, data.niche, data.location, leadsWithEmails)
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

  if (!user) return <Auth />

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">LeadForge</h1>
            <p className="text-gray-500 mt-1">Автоматический аудит сайтов и генерация холодных писем</p>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm text-gray-600">
                Тариф: <span className="font-semibold text-indigo-600 uppercase">{profile.plan}</span> | 
                Использовано: <span className="font-semibold">{profile.monthly_url_used}</span> / {profile.monthly_url_limit} URL
              </div>
            )}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <History className="w-4 h-4" /> {showHistory ? 'Назад' : 'История'}
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-gray-300 rounded-md hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" /> Выйти
            </button>
          </div>
        </div>

        {limitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{limitError}</p>
          </div>
        )}

        {showHistory ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Ниша</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.niche}</td>
                    <td className="px-4 py-3 text-gray-600">{c.total_urls}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        {c.status === 'completed' ? 'Готово' : c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Пока нет кампаний</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <CampaignForm onSubmit={handleSubmit} isLoading={loading} progress={progress} />
            {leads.length > 0 && (
              <ResultsTable leads={leads} onExport={handleExport} onUpdateLead={handleUpdateLead} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default App
