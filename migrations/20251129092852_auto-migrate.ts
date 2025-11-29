import { Knex } from 'knex'

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('image_labels'))) {
    await knex.schema.createTable('image_labels', table => {
      table.increments('id')
      table.integer('image_id').unsigned().notNullable().references('images.id')
      table.text('label').notNullable()
      table.float('confidence').notNullable()
      table.boolean('is_manual').notNullable()
      table.boolean('reviewed').notNullable()
      table.timestamps(false, true)
    })
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('image_labels')
}
