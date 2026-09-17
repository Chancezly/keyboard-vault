import type { CollectionItem } from './types'
import type { VaultHandle } from './fs'
import { basenameFromFilePath } from './naming'
import { parseItemMarkdown } from './parser'

interface F {
  kind: 'file'
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<{
    write: (value: string) => Promise<void>
    close: () => Promise<void>
  }>
}
interface D {kind:'directory';name:string;getDirectoryHandle:(n:string,o?:{create?:boolean})=>Promise<D>;getFileHandle:(n:string,o?:{create?:boolean})=>Promise<F>;removeEntry:(n:string)=>Promise<void>;entries:()=>AsyncIterableIterator<[string,F|D]>}
export interface HistoryVersion { itemId:string; fileName:string; savedAt:string; size:number; raw:string }
export interface HistoryDescription { name:string; status:string; hero:string; imageCount:number; contentPreview:string; changes:string[] }
const safe=(value:string)=>value.replace(/[/\\:*?"<>|]/g,'-')||'item'

export async function archiveExistingItem(handle:VaultHandle,item:Pick<CollectionItem,'id'|'category'|'filePath'>):Promise<void>{
  const root=handle as unknown as D
  const base=basenameFromFilePath(item.filePath); if(!base)return
  let source:F
  try{source=await (await root.getDirectoryHandle(item.category)).getFileHandle(`${base}.md`)}catch{return}
  const raw=await (await source.getFile()).text()
  const history=await (await root.getDirectoryHandle('.history',{create:true})).getDirectoryHandle(safe(item.id),{create:true})
  const stamp=new Date().toISOString().replace(/[:.]/g,'-')
  const out=await history.getFileHandle(`${stamp}.md`,{create:true});const writable=await out.createWritable();await writable.write(raw);await writable.close()
  const names:string[]=[];for await(const [name,entry] of history.entries())if(entry.kind==='file'&&name.endsWith('.md'))names.push(name)
  names.sort().reverse();for(const name of names.slice(20))await history.removeEntry(name)
}

export async function listHistory(handle:VaultHandle):Promise<HistoryVersion[]>{
  const root=handle as unknown as D;let history:D;try{history=await root.getDirectoryHandle('.history')}catch{return[]}
  const result:HistoryVersion[]=[]
  for await(const [itemId,entry] of history.entries()){if(entry.kind!=='directory')continue;for await(const [fileName,fileEntry] of entry.entries()){if(fileEntry.kind!=='file'||!fileName.endsWith('.md'))continue;const file=await fileEntry.getFile();const raw=await file.text();const stamp=fileName.replace(/\.md$/,'');const savedAt=stamp.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3}Z)$/,'$1:$2:$3.$4');result.push({itemId,fileName,savedAt,size:file.size,raw})}}
  return result.sort((a,b)=>b.fileName.localeCompare(a.fileName))
}

export function describeHistoryVersion(version:HistoryVersion,current:CollectionItem):HistoryDescription{
  const historical=parseItemMarkdown(version.raw,current.category,`history/${version.fileName}`)
  const changes:string[]=[]
  if(historical.name!==current.name)changes.push(`名称：${historical.name || '未命名'} → ${current.name || '未命名'}`)
  if(historical.status!==current.status)changes.push(`状态：${historical.status} → ${current.status}`)
  if(historical.images[0]!==current.images[0])changes.push('主图已更换')
  if(historical.images.length!==current.images.length)changes.push(`图片数量：${historical.images.length} → ${current.images.length}`)
  if(historical.price!==current.price)changes.push(`价格：${historical.price ?? '未填写'} → ${current.price ?? '未填写'}`)
  if(historical.content.trim()!==current.content.trim())changes.push('备注内容已修改')
  const specs=['layout','mount','plate','material','profile','switchType','color'] as const
  if(specs.some(key=>historical[key]!==current[key]))changes.push('规格参数已修改')
  return {name:historical.name,status:historical.status,hero:historical.images[0]??'',imageCount:historical.images.length,contentPreview:historical.content.trim().slice(0,180),changes:changes.length?changes:['与当前可识别字段一致']}
}

export async function restoreHistory(handle:VaultHandle,item:CollectionItem,version:HistoryVersion):Promise<void>{
  const root=handle as unknown as D
  const history=await (await root.getDirectoryHandle('.history')).getDirectoryHandle(safe(version.itemId))
  const raw=await (await history.getFileHandle(version.fileName)).getFile().then(f=>f.text())
  await archiveExistingItem(handle,item)
  const base=basenameFromFilePath(item.filePath);if(!base)throw new Error('无法定位当前 Markdown 文件')
  const target=await (await root.getDirectoryHandle(item.category)).getFileHandle(`${base}.md`)
  const writable=await target.createWritable();await writable.write(raw);await writable.close()
}
