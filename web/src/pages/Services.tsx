import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Tag, RefreshCw, Box } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { api } from '@/lib/api'
import { providerColor } from '@/lib/utils'

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', icon: '/openai.svg' },
  { value: 'anthropic', label: 'Anthropic (Claude)', icon: '/claude.svg' },
  { value: 'gemini', label: 'Google Gemini', icon: '/gemini.svg' },
]

function ServiceForm({ initial, onSave, onClose }: { initial?: any; onSave: (d: any) => Promise<any>; onClose: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    provider: initial?.provider || 'openai',
    api_key: '',
    base_url: initial?.base_url || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try { await onSave(form); onClose() }
    catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="svc-name">Service Name</Label>
        <Input id="svc-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My OpenAI" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="svc-provider">Provider</Label>
        <Select value={form.provider} onValueChange={v => setForm(f => ({ ...f, provider: v ?? 'openai' }))}>
          <SelectTrigger id="svc-provider">
            {(() => { const p = PROVIDERS.find(x => x.value === form.provider); return p ? (
              <span className="flex items-center gap-2"><img src={p.icon} alt="" className="h-4 w-4" />{p.label}</span>
            ) : <SelectValue /> })()}
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map(p => (
              <SelectItem key={p.value} value={p.value}>
                <span className="flex items-center gap-2">
                  <img src={p.icon} alt="" className="h-4 w-4" />
                  {p.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="svc-key">{initial ? 'API Key (leave blank to keep existing)' : 'API Key'}</Label>
        <Input id="svc-key" type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder="sk-..." required={!initial} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="svc-url">Base URL <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="svc-url" value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="Leave blank for default" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Service'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Models Manager ──────────────────────────────────────────────────────────

function ModelsManager({ service, onModelsChange }: { service: any; onModelsChange: () => void }) {
  const [models, setModels] = useState<any[]>([])
  const [newModelId, setNewModelId] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchEndpoint, setFetchEndpoint] = useState('')
  const [saving, setSaving] = useState(false)

  const loadModels = async () => {
    try { setModels(await api.getServiceModels(service.id)) } catch {}
  }
  useEffect(() => { loadModels() }, [service.id])

  async function addModel(e: React.FormEvent) {
    e.preventDefault()
    if (!newModelId.trim()) return
    setSaving(true)
    try {
      await api.addServiceModel(service.id, { model_id: newModelId.trim(), display_name: newDisplayName.trim() || undefined })
      setNewModelId(''); setNewDisplayName('')
      loadModels(); onModelsChange()
    } catch (err: any) { alert(err.message) }
    finally { setSaving(false) }
  }

  async function deleteModel(id: string) {
    try { await api.deleteServiceModel(service.id, id); loadModels(); onModelsChange() }
    catch (err: any) { alert(err.message) }
  }

  async function fetchModels() {
    setFetching(true)
    try {
      const result = await api.fetchServiceModels(service.id, fetchEndpoint || undefined)
      setModels(result.models)
      onModelsChange()
    } catch (err: any) { alert(err.message) }
    finally { setFetching(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Box size={11} /> Models ({models.length})
        </p>
        <div className="flex items-center gap-1">
          <Input
            className="h-7 text-xs w-48"
            value={fetchEndpoint}
            onChange={e => setFetchEndpoint(e.target.value)}
            placeholder="Custom models URL (optional)"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={fetchModels}
            disabled={fetching}
          >
            <RefreshCw size={11} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Fetching...' : 'Fetch Models'}
          </Button>
        </div>
      </div>

      {/* Model list */}
      <div className="flex flex-wrap gap-1 mb-2">
        {models.map((m: any) => (
          <span key={m.id} className="group inline-flex items-center gap-1 text-xs bg-muted rounded px-1.5 py-0.5">
            <span className="font-mono">{m.model_id}</span>
            {m.display_name && <span className="text-muted-foreground">({m.display_name})</span>}
            <button onClick={() => deleteModel(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive ml-0.5" title="Remove model">
              <Trash2 size={9} />
            </button>
          </span>
        ))}
        {models.length === 0 && <span className="text-xs text-muted-foreground">No models. Add manually or click Fetch Models.</span>}
      </div>

      {/* Add model form */}
      <form onSubmit={addModel} className="flex gap-2">
        <Input className="h-7 text-xs flex-1" value={newModelId} onChange={e => setNewModelId(e.target.value)} placeholder="Model ID (e.g. gpt-4o)" required />
        <Input className="h-7 text-xs w-32" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="Display name" />
        <Button type="submit" size="sm" variant="outline" disabled={saving || !newModelId.trim()} className="h-7 text-xs shrink-0">+ Add</Button>
      </form>
    </div>
  )
}

// ─── Aliases Manager ──────────────────────────────────────────────────────────

function AliasManager({ service, aliases, onRefresh }: { service: any; aliases: any[]; onRefresh: () => void }) {
  const [alias, setAlias] = useState('')
  const [targetModel, setTargetModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const serviceAliases = aliases.filter((a: any) => a.service_id === service.id)

  useEffect(() => {
    api.getServiceModels(service.id).then(setModels).catch(() => {})
  }, [service.id])

  async function addAlias(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try { await api.createAlias({ alias, service_id: service.id, target_model: targetModel }); setAlias(''); setTargetModel(''); onRefresh() }
    catch (err: any) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2"><Tag size={11} /> Aliases ({serviceAliases.length})</p>
      {serviceAliases.map((a: any) => (
        <div key={a.id} className="flex items-center justify-between py-1">
          <span className="flex items-center gap-2">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-primary">{a.alias}</code>
            <span className="text-xs text-muted-foreground">→ {a.target_model}</span>
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={async () => { try { await api.deleteAlias(a.id); onRefresh() } catch (e: any) { alert(e.message) } }}>
            <Trash2 size={11} />
          </Button>
        </div>
      ))}
      <form onSubmit={addAlias} className="flex gap-2 mt-1">
        <Input className="h-7 text-xs" value={alias} onChange={e => setAlias(e.target.value)} placeholder="Alias (e.g. fast)" required />
        <Select value={targetModel} onValueChange={v => setTargetModel(v ?? '')} required>
          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Select model" /></SelectTrigger>
          <SelectContent>
            {models.map((m: any) => <SelectItem key={m.model_id} value={m.model_id} className="text-xs">{m.model_id}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={saving || !targetModel} className="h-7 text-xs shrink-0">+ Add</Button>
      </form>
    </div>
  )
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ service, aliases, onEdit, onDelete, onRefresh }: any) {
  const [expanded, setExpanded] = useState(false)
  const [models, setModels] = useState<any[]>([])
  const color = providerColor(service.provider)
  const providerInfo = PROVIDERS.find(p => p.value === service.provider)
  const serviceAliases = aliases.filter((a: any) => a.service_id === service.id)

  const loadModels = async () => {
    try { setModels(await api.getServiceModels(service.id)) } catch {}
  }
  useEffect(() => { loadModels() }, [service.id])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 p-1.5"
              style={{ background: `${color}18` }}>
              {providerInfo?.icon ? (
                <img src={providerInfo.icon} alt={providerInfo.label} className="h-5 w-5 object-contain" />
              ) : (
                <span className="text-xs font-bold" style={{ color }}>{service.provider.slice(0, 3).toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="font-semibold text-sm">{service.name}</p>
              <p className="text-xs text-muted-foreground">{providerInfo?.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={service.enabled ? 'default' : 'secondary'} className="text-xs">
              {service.enabled ? 'Connected' : 'Disabled'}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(v => !v)}>
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(service)}>
              <Edit2 size={12} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(service.id)}>
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Always visible: models preview + key + aliases summary */}
        {models.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {models.slice(0, 6).map((m: any) => (
              <Badge key={m.id} variant="secondary" className="text-xs font-mono font-normal">
                {m.model_id}
              </Badge>
            ))}
            {models.length > 6 && (
              <Badge variant="secondary" className="text-xs font-normal">+{models.length - 6} more</Badge>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-mono">Key: {service.api_key}</span>
          {models.length > 0 && (
            <>
              <span>·</span>
              <span>{models.length} model{models.length !== 1 ? 's' : ''}</span>
            </>
          )}
          {serviceAliases.length > 0 && (
            <>
              <span>·</span>
              <span>{serviceAliases.length} alias{serviceAliases.length !== 1 ? 'es' : ''}</span>
            </>
          )}
        </div>

        {/* Expanded: full models + aliases management */}
        {expanded && (
          <div className="flex flex-col gap-3 mt-3 pt-3 border-t">
            <ModelsManager service={service} onModelsChange={loadModels} />
            <Separator />
            <AliasManager service={service} aliases={aliases} onRefresh={onRefresh} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Services Page ────────────────────────────────────────────────────────────

export default function Services() {
  const [services, setServices] = useState<any[]>([])
  const [aliases, setAliases] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editService, setEditService] = useState<any>(null)

  const load = async () => {
    try {
      const [s, a] = await Promise.all([api.getServices(), api.getAliases()])
      setServices(s); setAliases(a)
    } catch {}
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this service? All associated models and aliases will also be removed.')) return
    try { await api.deleteService(id); load() } catch (e: any) { alert(e.message) }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{services.length} service{services.length !== 1 ? 's' : ''} configured</p>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus size={14} /> Add Service
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {services.map(s => (
          <ServiceCard key={s.id} service={s} aliases={aliases} onEdit={setEditService} onDelete={handleDelete} onRefresh={load} />
        ))}
        <button onClick={() => setShowAdd(true)} className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 min-h-40 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
          <Plus size={20} />
          <span className="text-sm">Connect a new AI provider</span>
        </button>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
          <ServiceForm onSave={api.createService} onClose={() => { setShowAdd(false); load() }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editService} onOpenChange={v => !v && setEditService(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Service</DialogTitle></DialogHeader>
          {editService && (
            <ServiceForm initial={editService} onSave={d => api.updateService(editService.id, d)} onClose={() => { setEditService(null); load() }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
