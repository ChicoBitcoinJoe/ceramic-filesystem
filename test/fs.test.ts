import { randomBytes } from '@stablelib/random'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import { DID } from 'dids'

import { FileSystem, Folder, File, CreateOptions } from '../src/index';

const CeramicClient = require('@ceramicnetwork/http-client').default
const KeyDidResolver = require('key-did-resolver').default
const ceramic = new CeramicClient()
const FS = FileSystem(ceramic)

const oneMinute = 60000
jest.setTimeout(oneMinute / 2);

describe("test AppendCollection correctness", () => {
  
  beforeAll(async () => {
    const provider = new Ed25519Provider(randomBytes(32))
    const resolver = KeyDidResolver.getResolver()
    ceramic.did = new DID({ provider, resolver })
    await ceramic.did.authenticate()
  });

  const [ rootName, folderName, fileName] = ['C:','folder','/file.ext']
  const folderPath = rootName + '/' + folderName
  const filePath = folderPath + '/' + fileName
  const options: CreateOptions = { 
    createIfUndefined: true,
    hidden: false,
    temporary: true
  }

  it("create a root filesystem", async () => {
    let root = await FS.open(rootName) as Folder
    expect(root).toEqual(undefined)    
    root = await FS.open(rootName, options) as Folder
    expect(root.name).toEqual(rootName)
  });

  it("create a folder in root", async () => {
    const root = await FS.open(rootName) as Folder
    const folderFromRoot = await root.open(folderName, options) as Folder
    const folderFromPath = await FS.open(folderPath, options) as Folder
    expect(folderFromPath.id).toEqual(folderFromRoot.id)
    expect(folderFromPath.name).toEqual(folderName)
    const rootFolderNames = await root.folders.getFirstN(1)
    expect(rootFolderNames[0].value).toEqual(folderName)
  });
  
  it("create a file in a folder", async () => {
    const root = await FS.open(rootName, options) as Folder
    const folder = await root.open(folderName, options) as Folder
    const fileFromRoot = await folder.open(fileName, options) as File
    const fileFromPath = await FS.open(filePath, options) as File
    expect(fileFromRoot.id).toEqual(fileFromPath.id)
    expect('/'+fileFromRoot.name).toEqual(fileName)
    expect(fileFromRoot.name).toEqual(fileFromPath.name)
    const folderFileNames = await folder.files.getFirstN(1)
    expect('/'+folderFileNames[0].value).toEqual(fileName)
  });
});