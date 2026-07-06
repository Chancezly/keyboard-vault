export interface ZfFlowListItem {
  id: number
  hash_id: string
  title?: string
  text?: string
  imgs?: string[]
  flow_type?: number
  view_url?: string
  equip_list?: {
    detail?: {
      kit?: { id?: string; name?: string }[]
    }
  } | null
}

export interface ZfFlowListResponse {
  ok: number
  msg: string
  data?: {
    list?: ZfFlowListItem[]
    offset?: string
  }
}

export interface ZfEquip {
  id?: number
  name?: string
  coverpic?: string
  hash_id?: string
  brand?: string | null
}

export interface ZfFlowDetail {
  flow: {
    id: number
    hash_id: string
    title?: string
    text?: string
    imgs?: string[]
    user?: {
      nickname?: string
    }
    item?: {
      title?: string
      equips?: ZfEquip[]
      article?: { text?: string }
    }
    share_config?: {
      title?: string
      link?: string
      thumb?: string
      bigCover?: string
    }
  }
}
