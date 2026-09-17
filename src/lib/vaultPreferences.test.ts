import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, readVaultPreferences, serializePreferences, writeVaultPreferences } from './vaultPreferences'
import type { VaultHandle } from './fs'

class FileHandle { kind='file' as const; name:string; data=new Blob(); constructor(name:string){this.name=name} async getFile(){return new File([this.data],this.name)} async createWritable(){return {write:async(v:string)=>{this.data=new Blob([v])},close:async()=>{}}} }
class Dir { kind='directory' as const; name:string; children=new Map<string,Dir|FileHandle>(); constructor(name:string){this.name=name} async getDirectoryHandle(n:string,o?:{create?:boolean}){const e=this.children.get(n);if(e?.kind==='directory')return e;if(!o?.create)throw Error('not found');const d=new Dir(n);this.children.set(n,d);return d} async getFileHandle(n:string,o?:{create?:boolean}){const e=this.children.get(n);if(e?.kind==='file')return e;if(!o?.create)throw Error('not found');const f=new FileHandle(n);this.children.set(n,f);return f} }

describe('vault preferences',()=>{
  it('returns defaults when user.md is absent',async()=>{await expect(readVaultPreferences(new Dir('vault') as unknown as VaultHandle)).resolves.toEqual(DEFAULT_PREFERENCES)})
  it('writes and reads settings/user.md',async()=>{const root=new Dir('vault');const value={...DEFAULT_PREFERENCES,favoriteLayouts:['65%'],budgetRange:[500,3000] as [number,number],notes:'轻手感'};await writeVaultPreferences(root as unknown as VaultHandle,value);await expect(readVaultPreferences(root as unknown as VaultHandle)).resolves.toEqual(value);expect(serializePreferences(value)).toContain('favoriteLayouts')})
})
