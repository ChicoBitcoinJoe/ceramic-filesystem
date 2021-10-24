import { randomBytes } from '@stablelib/random'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import { DID } from 'dids'

import { FileSystem, CeramicFolder, CeramicFile, CreateOptions } from '../src/index';

const CeramicClient = require('@ceramicnetwork/http-client').default
const KeyDidResolver = require('key-did-resolver').default
const ceramic = new CeramicClient()
const fs = FileSystem(ceramic)

const oneMinute = 60000
jest.setTimeout(oneMinute / 2);

describe("test AppendCollection correctness", () => {
  
  let controller: string;
  let options: CreateOptions;

  beforeAll(async () => {
    const provider = new Ed25519Provider(randomBytes(32))
    const resolver = KeyDidResolver.getResolver()
    ceramic.did = new DID({ provider, resolver })
    await ceramic.did.authenticate()
    controller = ceramic.did.id.toString()
    options = { 
      controller,
      createIfUndefined: true
    }
  });

  const [ rootName, folderName, fileName] = ['C:','folder','/file.ext']
  const folderPath = rootName + '/' + folderName
  const filePath = folderPath + '/' + fileName

  it("create a root filesystem", async () => {
    let root = await fs.open(rootName) as CeramicFolder
    expect(root).toEqual(undefined)
    root = await fs.open(rootName, options) as CeramicFolder
    const exists = await fs.check(rootName, options)
    expect(exists !== undefined).toEqual(true)
    expect(root.name).toEqual(rootName)
  });

  it("create a folder in root", async () => {
    const root = await fs.open(rootName, options) as CeramicFolder
    const folderFromRoot = await root.open(folderName, options) as CeramicFolder
    const folderFromPath = await fs.open(folderPath, options) as CeramicFile
    expect(folderFromPath.id).toEqual(folderFromRoot.id)
    expect(folderFromPath.name).toEqual(folderName)
    const rootFolderNames = await root.folders.getFirstN(1)
    expect(rootFolderNames[0].value).toEqual(folderName)
  });
  
  it("create a file in a folder", async () => {
    const root = await fs.open(rootName, options) as CeramicFolder
    const folder = await root.open(folderName, options) as CeramicFolder
    const fileFromRoot = await folder.open(fileName, options) as CeramicFile
    const fileFromPath = await fs.open(filePath, options) as CeramicFile
    expect(fileFromRoot.id).toEqual(fileFromPath.id)
    expect('/'+fileFromRoot.name).toEqual(fileName)
    expect(fileFromRoot.name).toEqual(fileFromPath.name)
    const folderFileNames = await folder.files.getFirstN(1)
    expect('/'+folderFileNames[0].value).toEqual(fileName)
  });
});