import { useState } from 'react'
import { Heart, X } from 'lucide-react'
import type { UserPreferences } from '../lib/types'

interface Props { preferences: UserPreferences; onSave: (value: UserPreferences) => Promise<void>; onClose: () => void }
const split = (value: string) => value.split(/[,，]/).map((part) => part.trim()).filter(Boolean)

export function PreferencesDialog({ preferences, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(preferences)
  const [saving, setSaving] = useState(false)
  const fields: { key: keyof Pick<UserPreferences, 'favoriteLayouts'|'favoriteProfiles'|'favoriteSwitchTypes'|'favoriteBrands'>; label: string; placeholder: string }[] = [
    { key: 'favoriteLayouts', label: '偏好配列', placeholder: '例如：65%，75%，TKL' },
    { key: 'favoriteProfiles', label: '偏好键帽高度', placeholder: '例如：Cherry，SA' },
    { key: 'favoriteSwitchTypes', label: '偏好轴体', placeholder: '例如：线性，段落' },
    { key: 'favoriteBrands', label: '偏好品牌', placeholder: '例如：QwertyKeys' },
  ]
  return <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
    <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="关闭偏好设置" onClick={onClose} />
    <section role="dialog" aria-modal="true" aria-labelledby="preferences-title" className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#17171b] shadow-2xl">
      <header className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4">
        <Heart className="h-5 w-5 text-rose-300"/><div className="flex-1"><h2 id="preferences-title" className="font-semibold">当前收藏库偏好</h2><p className="text-xs text-text-tertiary">保存到 settings/user.md，仅属于当前目录</p></div>
        <button onClick={onClose} aria-label="关闭" className="p-2 text-text-tertiary"><X className="h-4 w-4"/></button>
      </header>
      <div className="space-y-4 px-5 py-5">
        {fields.map((field) => <label key={field.key} className="block text-xs text-text-secondary">{field.label}
          <input className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-sm" value={draft[field.key].join('，')} placeholder={field.placeholder} onChange={(e) => setDraft({...draft,[field.key]:split(e.target.value)})}/>
        </label>)}
        <div className="grid grid-cols-2 gap-3"><label className="text-xs text-text-secondary">预算下限<input type="number" min="0" className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-sm" value={draft.budgetRange[0]} onChange={(e)=>setDraft({...draft,budgetRange:[Number(e.target.value),draft.budgetRange[1]]})}/></label><label className="text-xs text-text-secondary">预算上限<input type="number" min="0" className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-sm" value={draft.budgetRange[1]} onChange={(e)=>setDraft({...draft,budgetRange:[draft.budgetRange[0],Number(e.target.value)]})}/></label></div>
        <label className="block text-xs text-text-secondary">备注<textarea rows={4} className="mt-1.5 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-sm" value={draft.notes} onChange={(e)=>setDraft({...draft,notes:e.target.value})}/></label>
      </div>
      <footer className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3"><button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-text-secondary">取消</button><button disabled={saving} onClick={async()=>{setSaving(true);try{await onSave(draft)}finally{setSaving(false)}}} className="rounded-xl bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">{saving?'保存中…':'保存偏好'}</button></footer>
    </section>
  </div>
}
