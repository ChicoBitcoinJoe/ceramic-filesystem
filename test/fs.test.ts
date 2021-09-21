import { randomBytes } from '@stablelib/random'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import { DID } from 'dids'

import { FileSystem, Folder, File } from '../dist/index';

const CeramicClient = require('@ceramicnetwork/http-client').default
const KeyDidResolver = require('key-did-resolver').default
const ceramic = new CeramicClient()
const cFS = FileSystem(ceramic)

const oneMinute = 60000
jest.setTimeout(oneMinute / 2);

describe("test AppendCollection correctness", () => {
  
  beforeAll(async () => {
    const provider = new Ed25519Provider(randomBytes(32))
    const resolver = KeyDidResolver.getResolver()
    ceramic.did = new DID({ provider, resolver })
    await ceramic.did.authenticate()
  });

  const [ rootName, folderName, fileName] = ['root','folder','file.ext']
  const folderPath = rootName + '/' + folderName
  const filePath = folderPath + '/' + fileName
  const options = { createIfUndefined: true }

  it("create a root filesystem", async () => {
    const [ root ] = await cFS.open([ rootName ], options) as [ Folder ]
    expect(root.name).toEqual(rootName)
  });

  it("create a folder in root", async () => {
    const [ root ] = await cFS.open([ rootName ], options) as [ Folder ]
    const [ folder ] = await root.open([ folderName ], options) as [ Folder ]
    const [ folderFromPath ] = await cFS.open([ folderPath ]) as [ Folder ]
    const rootNameCollection = await root.content.getFirstN(1)
    expect(rootNameCollection[0].value).toEqual(folderName)
    expect(folder.id.toString()).toEqual(folderFromPath.id.toString())
    expect(folder.name).toEqual(folderName)
  });
  
  it("create a file in a folder", async () => {
    const [ root ] = await cFS.open([ rootName ], options) as [ Folder ]
    const [ folder ] = await root.open([ folderName ], options) as [ Folder ]
    const [ file ] = await folder.open([fileName], options) as [ File ]
    const [ fileFromPath ] = await cFS.open([ filePath ]) as [ File ]
    const folderNameCollection = await folder.content.getFirstN(1)
    expect(folderNameCollection[0].value).toEqual(fileName)
    expect(file.id.toString()).toEqual(fileFromPath.id.toString())
    expect(file.name).toEqual(fileName)
  });
});