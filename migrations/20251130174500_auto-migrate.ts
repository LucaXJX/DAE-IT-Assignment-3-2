import { Knex } from 'knex'

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('images'))) {
    await knex.schema.createTable('images', table => {
      table.increments('id')
      table.text('keyword').notNullable()
      table.string('url', 2048).notNullable().unique()
      table.text('alt_text').notNullable()
      table.string('file_name', 255).notNullable()
      table.string('file_path', 512).notNullable()
      table.string('country', 100).notNullable()
      table.enum('download_status', ['pending', 'downloading', 'downloaded', 'failed']).notNullable()
      table.enum('process_status', ['pending', 'processing', 'processed', 'failed']).notNullable()
      table.integer('file_size').notNullable()
      table.integer('width').notNullable()
      table.integer('height').notNullable()
      table.integer('channels').notNullable()
      table.string('format', 10).notNullable()
      table.string('checksum', 64).notNullable()
      table.text('error_message').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('labels'))) {
    await knex.schema.createTable('labels', table => {
      table.increments('id')
      table.string('name', 100).notNullable().unique()
      table.text('description').notNullable()
      table.string('category', 50).notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('image_labels'))) {
    await knex.schema.createTable('image_labels', table => {
      table.increments('id')
      table.integer('image_id').unsigned().notNullable().references('images.id')
      table.integer('label_id').unsigned().notNullable().references('labels.id')
      table.decimal('confidence', 5, 4).notNullable()
      table.boolean('is_manual').notNullable().defaultTo(0)
      table.boolean('is_reviewed').notNullable().defaultTo(0)
      table.timestamp('reviewed_at').notNullable()
      table.string('reviewed_by', 100).notNullable()
      table.string('model_version', 50).notNullable()
      table.(image_id,('unique').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('training_runs'))) {
    await knex.schema.createTable('training_runs', table => {
      table.increments('id')
      table.string('name', 200).notNullable()
      table.text('description').notNullable()
      table.string('model_version', 50).notNullable()
      table.integer('complexity').notNullable()
      table.integer('epochs').notNullable()
      table.integer('batch_size').notNullable()
      table.decimal('learning_rate', 10, 8).notNullable()
      table.decimal('validation_split', 3, 2).notNullable()
      table.string('dataset_path', 512).notNullable()
      table.string('model_path', 512).notNullable()
      table.enum('status', ['pending', 'training', 'completed', 'failed', 'cancelled']).notNullable()
      table.decimal('accuracy', 5, 4).notNullable()
      table.decimal('loss', 10, 8).notNullable()
      table.decimal('val_accuracy', 5, 4).notNullable()
      table.decimal('val_loss', 10, 8).notNullable()
      table.timestamp('started_at').notNullable()
      table.timestamp('completed_at').notNullable()
      table.text('error_message').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('training_samples'))) {
    await knex.schema.createTable('training_samples', table => {
      table.increments('id')
      table.integer('training_run_id').unsigned().notNullable().references('training_runs.id')
      table.integer('image_id').unsigned().notNullable().references('images.id')
      table.integer('label_id').unsigned().notNullable().references('labels.id')
      table.enum('split_type', ['train', 'validation', 'test']).notNullable()
      table.timestamp('created_at').notNullable()
    })
  }

  if (!(await knex.schema.hasTable('datasets'))) {
    await knex.schema.createTable('datasets', table => {
      table.increments('id')
      table.string('name', 200).notNullable().unique()
      table.text('description').notNullable()
      table.enum('source_type', ['scraper', 'image-dataset', 'manual', 'imported']).notNullable()
      table.string('dataset_path', 512).notNullable()
      table.integer('total_images').notNullable().defaultTo(0)
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('dataset_images'))) {
    await knex.schema.createTable('dataset_images', table => {
      table.increments('id')
      table.integer('dataset_id').unsigned().notNullable().references('datasets.id')
      table.integer('image_id').unsigned().notNullable().references('images.id')
      table.string('folder_name', 100).notNullable()
      table.timestamp('created_at').notNullable()
      table.(dataset_id,('unique').notNullable()
    })
  }

  if (!(await knex.schema.hasTable('model_versions'))) {
    await knex.schema.createTable('model_versions', table => {
      table.increments('id')
      table.string('version', 50).notNullable().unique()
      table.enum('model_type', ['classifier', 'image-dataset', 'custom']).notNullable()
      table.string('model_path', 512).notNullable()
      table.integer('source_training_run_id').unsigned().notNullable().references('training_runs.id')
      table.text('description').notNullable()
      table.boolean('is_active').notNullable().defaultTo(0)
      table.text('performance_metrics').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('reviews'))) {
    await knex.schema.createTable('reviews', table => {
      table.increments('id')
      table.integer('image_id').unsigned().notNullable().references('images.id')
      table.integer('image_label_id').unsigned().notNullable().references('image_labels.id')
      table.enum('review_type', ['quality', 'classification', 'content']).notNullable()
      table.enum('status', ['pending', 'approved', 'rejected', 'needs_rework']).notNullable()
      table.string('reviewer', 100).notNullable()
      table.text('comments').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('statistics'))) {
    await knex.schema.createTable('statistics', table => {
      table.increments('id')
      table.string('stat_type', 50).notNullable()
      table.string('stat_key', 100).notNullable()
      table.text('stat_value').notNullable()
      table.date('date_recorded').notNullable()
      table.timestamp('created_at').notNullable()
      table.(stat_type,('unique').notNullable()
    })
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('statistics')
  await knex.schema.dropTableIfExists('reviews')
  await knex.schema.dropTableIfExists('model_versions')
  await knex.schema.dropTableIfExists('dataset_images')
  await knex.schema.dropTableIfExists('datasets')
  await knex.schema.dropTableIfExists('training_samples')
  await knex.schema.dropTableIfExists('training_runs')
  await knex.schema.dropTableIfExists('image_labels')
  await knex.schema.dropTableIfExists('labels')
  await knex.schema.dropTableIfExists('images')
}
