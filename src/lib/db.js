import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbFile = path.join(__dirname, '..', '..', 'prisma', 'dev.db')

const adapter = new PrismaLibSql({ url: `file:${dbFile}` })
export const prisma = new PrismaClient({ adapter })
