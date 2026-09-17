import type { CollectionItem } from './types'
import type { VaultHandle } from './fs'
import { basenameFromFilePath } from './naming'

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
export interface HistoryVersion { itemId:string; fileName:string; savedAt:string; size:number }
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
  for await(const [itemId,entry] of history.entries()){if(entry.kind!=='directory')continue;for await(const [fileName,fileEntry] of entry.entries()){if(fileEntry.kind!=='file'||!fileName.endsWith('.md'))continue;const file=await fileEntry.getFile();result.push({itemId,fileName,savedAt:fileName.replace(/\.md$/,''),size:file.size})}}
  return result.sort((a,b)=>b.fileName.localeCompare(a.fileName))
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
