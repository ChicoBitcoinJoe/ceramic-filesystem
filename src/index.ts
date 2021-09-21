import { TileDocument, TileMetadataArgs  } from '@ceramicnetwork/stream-tile'
import { AppendCollection, Collection } from '@cbj/ceramic-append-collection'
import aliases from './model.json'

export const version = "0.1.0"

export interface Options { 
  createIfUndefined: boolean;
}

export interface File {
  id: any;
  version: string;
  name: string;
  content: any;
}

export interface Folder extends File {
  open(paths: string[], options: Options): Promise<(Folder | File | undefined)[]>;
}

type Type = 'CeramicFolder' | 'CeramicFile'

type F = Folder | File | undefined

const getDefaultContent = async (ceramic: any, type: Type) => {
  if(type === 'CeramicFolder') {
    const collection = await AppendCollection.create(ceramic, { sliceMaxItems: 256 })
    const collectionStreamId = collection.id.toString()
    return { version, collectionStreamId }
  }
  else if(type === 'CeramicFile') {
    return { version }
  }
  else {
    throw new Error("Default Content type must be 'CeramicFolder' or 'CeramicFile'")
  }
}

const getDefaultMetadata = (type: Type, name: string, parentStreamId: string = ""): TileMetadataArgs => {
  return {
    family: type,
    tags: [name, parentStreamId],
    schema: type === 'CeramicFolder' ? aliases.schemas.Folder : undefined,
    deterministic: true,
  }
}

const getNextNameInPath = (path: string) => {
  if(path[0] === '/') path = path.slice(1, path.length)
  if(path.slice(0,2) === './') path = path.slice(2, path.length)
  if(path.includes('/')) {
    const index = path.indexOf('/')
    const name = path.slice(0, index)
    const extra = path.slice(index, path.length)
    return [ name, extra ]
  }
  else {
    return [ path, "" ]
  }
}

const create = async (ceramic: any, name: string, parentStreamId: string = ""): Promise<F> => {
  const type: Type = name.includes('.') ? 'CeramicFile' : 'CeramicFolder'
  let metadata: TileMetadataArgs = getDefaultMetadata(type, name, parentStreamId)
  let stream: any = await TileDocument.create(ceramic, null, metadata, { anchor: false, publish: false })
  stream = await TileDocument.load(ceramic, stream.id.toString())
  if(!stream.content.version) {
    stream = await TileDocument.create(ceramic, null, metadata, { anchor: true, publish: true })
    const content = await getDefaultContent(ceramic, type)
    metadata = {
      tags: [...metadata.tags as string[], version],
    }
    await stream.update(content, metadata)
  }

  return getF(ceramic, stream.id.toString())
}

const getF = async (ceramic: any, streamId: string): Promise<F> => {
  const doc: any = await TileDocument.load(ceramic, streamId)
  const version = doc.content?.version
  if(!version) return undefined

  const type = doc.metadata.family
  if(type === 'CeramicFolder') {
    const collection: Collection = await AppendCollection.load(ceramic, doc.content.collectionStreamId)  
  
    let folder = {
      id: doc.id,
      version,
      name: doc.metadata.tags[0],
      content: collection,
    }
    const open = async (paths: string[], options: Options): Promise<F[]> => {
      return openFilesAndFolders(ceramic, paths, folder as Folder, options)
    }

    return { ...folder, open } as Folder
  }
  else {
    const file: File = {
      id: doc.id,
      version,
      name: doc.metadata.tags[0],
      content: doc.content
    }
  
    return file
  }
}

const getDeterministicF = async (ceramic: any, name: string, parentStreamId: string = ""): Promise<F> => {
  const type: Type = name.includes('.') ? 'CeramicFile' : 'CeramicFolder'
  const metadata: TileMetadataArgs = getDefaultMetadata(type, name, parentStreamId)
  let stream: any = await TileDocument.create(ceramic, null, metadata, { anchor: false, publish: false })
  stream = await TileDocument.load(ceramic, stream.id.toString())
  return getF(ceramic, stream.id.toString())
}

const getRecursiveF = async (ceramic: any, path: string, parent?: Folder, options?: Options): Promise<F> => {
  const [ name, additionalPath ] = getNextNameInPath(path)
  if(name.includes('.') && additionalPath !== "") throw new Error("Invalid Path: folder name contains a period")
  
  const parentStreamId: string | undefined = parent?.id.toString()
  let f = await getDeterministicF(ceramic, name, parentStreamId)
  if(!f && options?.createIfUndefined) {
    f = await create(ceramic, name, parentStreamId)
    if(f && parent) {
      await parent.content.insert(name)
    }
  }
  
  if(!f) return undefined

  if(additionalPath === "") {
    return f
  }
  else {
    return getRecursiveF(ceramic, additionalPath, f as Folder, options)
  }
}

const openFilesAndFolders = async (ceramic: any, paths: string[], parent?: Folder, options?: Options): Promise<F[]> => {
  const filesAndFolders: Promise<File | Folder | undefined>[] = []
  paths.forEach((path) => {
    const promise = getRecursiveF(ceramic, path, parent, options)
    filesAndFolders.push(promise)
  });
  return Promise.all(filesAndFolders)
}

export const FileSystem = (ceramic: any) => {
  
  const get = async (streamId: string): Promise<F> => {
    return getF(ceramic, streamId)
  }

  const open = async (paths: string[], options?: Options, parent?: Folder): Promise<F[]> => {
    return openFilesAndFolders(ceramic, paths, parent, options)
  }

  return {
    version,
    get,
    open
  }
}