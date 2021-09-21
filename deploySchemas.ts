import { writeFile } from 'fs/promises'
import { CeramicClient } from '@ceramicnetwork/http-client'
import { ModelManager } from '@glazed/devtools'
import { DID } from 'dids'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import { getResolver } from 'key-did-resolver'

require('dotenv').config()

const ceramic = new CeramicClient()

const FolderSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $comment: "filesystemFolder",
  title: "Folder",
  type: "object",
  properties: {
    name: { type: "string", minimum: 0, maximum: 256 },
    folders: { type: "string", minimum: 0, maximum: 150 },
    files: { type: "string", minimum: 0, maximum: 150 },
  },
  required: ["name", "folders", "files"]
}

async function bootstrap() {
  const seed: any = process.env.PRIVATE_KEY
  const key: Buffer = Buffer.from(seed, 'base64')
  const provider = new Ed25519Provider(key)
  const resolver = getResolver()
  ceramic.did = new DID({ provider, resolver })
  await ceramic.did.authenticate()

  const manager = new ModelManager(ceramic)
  await manager.createSchema('Folder', FolderSchema)

  // Publish model to Ceramic node
  const model = await manager.toPublished()
  // Write published model to JSON file
  await writeFile('./src/model.json', JSON.stringify(model))
  console.log('Schemas written to ./src/model.json file:', model)
}

bootstrap().catch(console.error)