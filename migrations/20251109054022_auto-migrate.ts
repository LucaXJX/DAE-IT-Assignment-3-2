import { Knex } from 'knex'

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('images'))) {
    await knex.schema.createTable('images', table => {
      table.increments('id')
      table.string('url', 2048).notNullable().unique()
      table.text('alt_text').notNullable()
      table.string('file_name', 255).notNullable()
      table.enum('download_status', ['pending', 'downloading', 'downloaded', 'failed']).notNullable()
      table.enum('process_status', ['pending', 'processing', 'processed', 'failed']).notNullable()
      table.integer('file_size').notNullable()
      table.integer('width').notNullable()
      table.integer('height').notNullable()
      table.text('error_message').notNullable()
      table.timestamps(false, true)
    })
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('images')
}
