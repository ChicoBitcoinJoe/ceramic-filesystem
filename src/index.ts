import { TileDocument, TileMetadataArgs  } from '@ceramicnetwork/stream-tile'
import { AppendCollection, Collection } from '@cbj/ceramic-append-collection'
import aliases from './model.json'

export const version = "0.1.0"

export interface CreateOptions { 
  createIfUndefined: boolean;
  hidden: boolean;
  temporary: boolean;
}

export interface F {
  id: string;
  name: string;
  path: { full: string, parent: string },
  stream: TileDocument
}

export interface File extends F {
  history: Collection;
}

export interface Folder extends F {
  folders: Collection;
  files: Collection;
  open(path: string, options?: CreateOptions): Promise<Folder | File | undefined>;
}

const getTypeFromPath = (path: string) => { 
  return path.includes('//') ? 'File' : 'Folder'
}

const validPath = (path: string): boolean => {
  if(!path) return false;
  const type = getTypeFromPath(path)
  if(type === "File") {
    const array = path.split('//')
    
    // There should only ever be one instance of //
    if(array.length > 2) return false
    
    // The file name cannot contain a /
    if(array[1].includes('/')) return false
  }

  return true
}

const parsePath = (path: string) => {
  // Remove leading or end slash if there is one
  if(path[0] === '/') path = path.slice(1)
  if(path[path.length-1] === '/') path = path.slice(0,path.length-1)
    
  let pathArray = path.split('/')
  const name = pathArray[pathArray.length-1]
  const parentPath = pathArray.slice(0,pathArray.length-1).join('/')
  return [ name, parentPath, getTypeFromPath(path) ]
}

const getMetadata = (controller: string, path: string): TileMetadataArgs => {
  return {
    controllers: [controller],
    tags: [path],
    deterministic: true,
    // schema: type === 'Folder' ? schema.folder : schema.file
  }
}

const getStreamIdFromPath = async (ceramic: any, controller: string, path: string): Promise<string | undefined> => {
  if(!validPath(path)) return undefined

  const metadata: TileMetadataArgs = getMetadata(controller, path)
  let stream: any = await TileDocument.create(ceramic, null, metadata, { anchor: false, publish: false })
  return stream.id.toString()
 }

const exists = async (ceramic:any, controller: string, path: string): Promise<TileDocument | false> => {
  const streamId = await getStreamIdFromPath(ceramic, controller, path)
  if(!streamId) return false
  
  const stream: TileDocument = await TileDocument.load(ceramic, streamId)
  if(!stream.metadata) return false
  if(!stream.content) return false
  if(Object.keys(stream.content).length === 0) return false
  if(stream.metadata.tags?.length !== 1) return false
  if(path !== stream.metadata.tags[0]) return false
  return stream
}

const create = async (ceramic: any, path: string, options: CreateOptions): Promise<TileDocument> => {
  let metadata: TileMetadataArgs = getMetadata(ceramic.did.id.toString(), path)
  let stream: TileDocument = await TileDocument.create<Record<string, any>>(ceramic, null, metadata, { anchor: !options?.temporary, publish: !options?.temporary })
  let content: any = null
  let [ name, parentPath, type ] = parsePath(path)
  if(type === 'Folder') {
    const folderCollection = await AppendCollection.create(ceramic, { sliceMaxItems: 256 })
    const fileCollection = await AppendCollection.create(ceramic, { sliceMaxItems: 256 })
    content = { 
      folderCollectionId: folderCollection.id.toString(),
      fileCollectionId: fileCollection.id.toString() 
    }
  }
  else {
    const historyCollection = await AppendCollection.create(ceramic, { sliceMaxItems: 256 })
    content = {
      historyCollectionId: historyCollection.id.toString()
    }
  }
  await stream.update(content)

  if(!options?.hidden) {
    if(parentPath) {
      const parent = await openPath(ceramic, stream.metadata.controllers[0], parentPath, options) as Folder
      if(type === "Folder"){
        await parent.folders.insert(name)
      }
      else {
        await parent.files.insert(name)
      }
    }
  }

  return stream
}

const getF = async (ceramic: any, stream: TileDocument): Promise<Folder | File | undefined> => {
  const fullPath = stream.metadata.tags ? stream.metadata.tags[0] : ""
  if(!validPath(fullPath)) return undefined
  const [ name, parentPath, type ] = parsePath(fullPath)

  const f: F = {
    id: stream.id.toString(),
    name,
    path: { full: fullPath, parent: parentPath },
    stream
  }

  if(type === 'Folder') {
    const folders: any = await AppendCollection.load(ceramic, stream.content.folderCollectionId)
    const files: any = await AppendCollection.load(ceramic, stream.content.fileCollectionId)
  
    const open = async (path: string, options: CreateOptions): Promise<Folder | File | undefined> => {
      return openPath(ceramic, stream.metadata.controllers[0], fullPath + '/' + path, options)
    }

    const folder: Folder = { 
      ...f,
      folders,
      files,
      open 
    } 
    
    return folder
  }
  else {
    const history: any = await AppendCollection.load(ceramic, stream.content.historyCollectionId)  
    
    const file: File = {
      ...f,
      history
    }
    return file
  }
}

const openPath = async (ceramic: any, controller: string, path: string, options?: CreateOptions): Promise<Folder | File | undefined> => {
  // Remove end slash if there is one
  if(path[path.length-1] === '/') path = path.slice(0,path.length-1)

  let stream: TileDocument | false = await exists(ceramic, controller, path)
  if(stream) {
    return getF(ceramic, stream)
  }
  else if(ceramic?.did?.id.toString() === controller && options?.createIfUndefined) {
    stream = await create(ceramic, path, options)    
    return getF(ceramic, stream)
  }
}

export const FileSystem = (ceramic: any) => {
  
  const check = async (controller: string, path: string): Promise<TileDocument | false> => {
    const stream: TileDocument | false = await exists(ceramic, controller, path)
    return stream
  }

  const get = async (streamId: string): Promise<Folder | File | undefined> => {
    const stream: TileDocument = await TileDocument.load(ceramic, streamId)
    return getF(ceramic, stream)
  }

  const open = async (controller: string, path: string, options?: CreateOptions): Promise<Folder | File | undefined> => {
    return openPath(ceramic, controller, path, options)
  }

  return {
    version,
    check,
    get,
    open,
    validPath,
    parsePath,
    getTypeFromPath
  }
}