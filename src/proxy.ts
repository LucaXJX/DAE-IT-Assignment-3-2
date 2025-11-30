import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db'

export type Images = {
  id?: null | number
  keyword: string
  url: string
  alt_text: string
  file_name: string
  file_path: string
  country: string
  download_status: ('pending' | 'downloading' | 'downloaded' | 'failed')
  process_status: ('pending' | 'processing' | 'processed' | 'failed')
  file_size: number
  width: number
  height: number
  channels: number
  format: string
  checksum: string
  error_message: string
  created_at: string
  updated_at: string
}

export type Labels = {
  id?: null | number
  name: string
  description: string
  category: string
  created_at: string
  updated_at: string
}

export type ImageLabels = {
  id?: null | number
  image_id: number
  image?: Images
  label_id: number
  label?: Labels
  confidence: number
  is_manual: boolean // default: 0
  is_reviewed: boolean // default: 0
  reviewed_at: string
  reviewed_by: string
  model_version: string
  created_at: string
  updated_at: string
}

export type TrainingRuns = {
  id?: null | number
  name: string
  description: string
  model_version: string
  complexity: number
  epochs: number
  batch_size: number
  learning_rate: number
  validation_split: number
  dataset_path: string
  model_path: string
  status: ('pending' | 'training' | 'completed' | 'failed' | 'cancelled')
  accuracy: number
  loss: number
  val_accuracy: number
  val_loss: number
  started_at: string
  completed_at: string
  error_message: string
  created_at: string
  updated_at: string
}

export type TrainingSamples = {
  id?: null | number
  training_run_id: number
  training_run?: TrainingRuns
  image_id: number
  image?: Images
  label_id: number
  label?: Labels
  split_type: ('train' | 'validation' | 'test')
  created_at: string
}

export type Datasets = {
  id?: null | number
  name: string
  description: string
  source_type: ('scraper' | 'image-dataset' | 'manual' | 'imported')
  dataset_path: string
  total_images: number // default: 0
  created_at: string
  updated_at: string
}

export type DatasetImages = {
  id?: null | number
  dataset_id: number
  dataset?: Datasets
  image_id: number
  image?: Images
  folder_name: string
  created_at: string
}

export type ModelVersions = {
  id?: null | number
  version: string
  model_type: ('classifier' | 'image-dataset' | 'custom')
  model_path: string
  source_training_run_id: number
  source_training_run?: TrainingRuns
  description: string
  is_active: boolean // default: 0
  performance_metrics: string
  created_at: string
  updated_at: string
}

export type Reviews = {
  id?: null | number
  image_id: number
  image?: Images
  image_label_id: number
  image_label?: ImageLabels
  review_type: ('quality' | 'classification' | 'content')
  status: ('pending' | 'approved' | 'rejected' | 'needs_rework')
  reviewer: string
  comments: string
  created_at: string
  updated_at: string
}

export type Statistics = {
  id?: null | number
  stat_type: string
  stat_key: string
  stat_value: string
  date_recorded: string
  created_at: string
}

export type DBProxy = {
  images: Images[]
  labels: Labels[]
  image_labels: ImageLabels[]
  training_runs: TrainingRuns[]
  training_samples: TrainingSamples[]
  datasets: Datasets[]
  dataset_images: DatasetImages[]
  model_versions: ModelVersions[]
  reviews: Reviews[]
  statistics: Statistics[]
}

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    images: [],
    labels: [],
    image_labels: [
      /* foreign references */
      ['image', { field: 'image_id', table: 'images' }],
      ['label', { field: 'label_id', table: 'labels' }],
    ],
    training_runs: [],
    training_samples: [
      /* foreign references */
      ['training_run', { field: 'training_run_id', table: 'training_runs' }],
      ['image', { field: 'image_id', table: 'images' }],
      ['label', { field: 'label_id', table: 'labels' }],
    ],
    datasets: [],
    dataset_images: [
      /* foreign references */
      ['dataset', { field: 'dataset_id', table: 'datasets' }],
      ['image', { field: 'image_id', table: 'images' }],
    ],
    model_versions: [
      /* foreign references */
      ['source_training_run', { field: 'source_training_run_id', table: 'training_runs' }],
    ],
    reviews: [
      /* foreign references */
      ['image', { field: 'image_id', table: 'images' }],
      ['image_label', { field: 'image_label_id', table: 'image_labels' }],
    ],
    statistics: [],
  },
})
