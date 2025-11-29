import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db'

export type Images = {
  id?: null | number
  keyword: string
  url: string
  alt_text: string
  file_name: string
  download_status: ('pending' | 'downloading' | 'downloaded' | 'failed')
  process_status: ('pending' | 'processing' | 'processed' | 'failed')
  file_size: number
  width: number
  height: number
  error_message: string
  created_at: string
  updated_at: string
}

export type ImageLabels = {
  id?: null | number
  image_id: number
  image?: Images
  label: string
  confidence: number
  is_manual: boolean
  reviewed: boolean
  created_at: string
  updated_at: string
}

export type DBProxy = {
  images: Images[]
  image_labels: ImageLabels[]
}

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    images: [],
    image_labels: [
      /* foreign references */
      ['image', { field: 'image_id', table: 'images' }],
    ],
  },
})
