export type Role = 'admin' | 'curator' | 'user'
export type UserStatus = 'active' | 'deactivated'
export type EntryStatus = 'active' | 'archived' | 'deleted'
export type LinkStatus = 'ok' | 'broken' | 'unchecked'
export type LinkVisibility = 'public' | 'protected'
export type SourceType = 'canva' | 'gdrive' | 'gsheets' | 'gdocs' | 'other'

export interface User {
  id: number
  name: string
  email: string
  role: Role
  division_id: number | null
  status: UserStatus
  created_at: string
}

export interface UserWithDivision extends User {
  division_name: string | null
}

export interface Division {
  id: number
  name: string
  description: string | null
}

export interface Category {
  id: number
  name: string
}

export interface Tag {
  id: number
  name: string
}

export interface EntryLink {
  id: number
  entry_id: number
  url: string
  label: string
  source_type: SourceType
  sort_order: number
  link_status: LinkStatus
  last_checked_at: string | null
  visibility: LinkVisibility
  created_at: string
}

export interface Entry {
  id: number
  title: string
  description: string | null
  category_id: number | null
  created_by: number
  status: EntryStatus
  view_count: number
  created_at: string
  updated_at: string
  updated_by: number | null
}

export interface EntryWithDetails extends Entry {
  category_name: string | null
  creator_name: string
  tags: Tag[]
  links: EntryLink[]
  is_favorited?: boolean
}

export interface Favorite {
  user_id: number
  entry_id: number
  created_at: string
}

export interface JwtPayload {
  sub: number      // user id
  email: string
  role: Role
  name: string
  iat?: number
  exp?: number
}

export interface PaginatedResult<T> {
  items: T[]
  nextCursor: number | null
  total: number
}

export interface SearchParams {
  q?: string
  category_id?: number
  tag?: string
  sort?: 'recent' | 'popular' | 'title'
  cursor?: number
  limit?: number
  status?: EntryStatus
  favorites_only?: boolean
}
