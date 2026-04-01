import { pgTable, pgEnum, varchar, timestamp, integer } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'rep'])

export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  role: roleEnum('role').notNull().default('rep'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
