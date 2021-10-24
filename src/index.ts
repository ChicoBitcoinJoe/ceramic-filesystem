import { TileDocument, TileMetadataArgs  } from '@ceramicnetwork/stream-tile'
import { AppendCollection, Collection, Cursor } from '@cbj/ceramic-append-collection'
import aliases from './model.json'

export const version = "0.3.0"

export interface CreateOptions {
  controller: string;
  createIfUndefined?: boolean;
  hidden?: boolean;
  temporary?: boolean;
}

interface F {
  id: string;
  name: string;
  path: { full: string, parent: string },
  stream: TileDocument
}

export interface CeramicFile extends F {
  history: Collection;
  data: string;
  update(data: any): Promise<Cursor>;
}

export interface CeramicFolder extends F {
  folders: Collection;
  files: Collection;
  open(path: string, options?: CreateOptions): Promise<CeramicFolder | CeramicFile | undefined>;
}

export const getTypeFromPath = (path: string): 'File' | 'Folder' => { 
  return path.includes('//') ? 'File' : 'Folder'
}

export const validPath = (path: string): boolean => {
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

export const parsePath = (path: string) => {
  // Remove leading or end slash if there is one
  if(path[0] === '/') path = path.slice(1)
  if(path[path.length-1] === '/') path = path.slice(0,path.length-1)
    
  let pathArray = path.split('/')
  const name = pathArray[pathArray.length-1]
  const parentPath = pathArray.slice(0,pathArray.length-1).join('/')
  return [ name, parentPath, getTypeFromPath(path) ]
}

export const getMetadata = (controller: string, path: string): TileMetadataArgs => {
  return {
    controllers: [controller],
    tags: [path],
    deterministic: true,
    // schema: type === 'Folder' ? schema.folder : schema.file
  }
}

const getStreamIdFromPath = async (ceramic: any, path: string, options: CreateOptions): Promise<string> => {
  if(!validPath(path)) throw new Error(`${path} is not a valid path`)

  const metadata: TileMetadataArgs = getMetadata(options.controller, path)
  let stream: any = await TileDocument.create(ceramic, null, metadata, { anchor: false, publish: false })
  return stream.id.toString()
 }

const exists = async (ceramic:any, path: string, options: CreateOptions): Promise<TileDocument | false> => {
  if(!validPath(path)) throw new Error(`${path} is not a valid path`)
  const streamId = await getStreamIdFromPath(ceramic, path, options)
  if(!streamId) return false
  
  const stream: TileDocument = await TileDocument.load(ceramic, streamId)
  if(!stream.metadata) return false
  if(!stream.content) return false
  if(Object.keys(stream.content).length === 0) return false
  if(stream.metadata.tags?.length !== 1) return false
  if(path !== stream.metadata.tags[0]) return false

  let [ , , type ] = parsePath(path)
  const keys = Object.keys(stream.content)
  if(type == 'Folder') {
    if(!keys.includes('folderCollectionId')) return false
    if(!keys.includes('fileCollectionId')) return false
  }
  else {
    if(!keys.includes('history')) return false
  }

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
      const parent = await openPath(ceramic, parentPath, options) as CeramicFolder
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

const getF = async (ceramic: any, stream: TileDocument): Promise<CeramicFolder | CeramicFile | undefined> => {
  const fullPath = stream.metadata.tags!.length > 0 && stream.metadata.tags![0]
  if(!fullPath) throw new Error(`${stream.id.toString()} doest not have an associated path`)
  if(!validPath(fullPath)) throw new Error(`${stream.id.toString()} does not have a valid path: ${fullPath}`)

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
  
    const open = async (path: string, options: CreateOptions): Promise<CeramicFolder | CeramicFile | undefined> => {
      return openPath(ceramic, fullPath + '/' + path, options)
    }

    const folder: CeramicFolder = { 
      ...f,
      folders,
      files,
      open 
    } 
    
    return folder
  }
  else {
    const history: any = await AppendCollection.load(ceramic, stream.content.historyCollectionId)  
    const data: any = await history.getLastN(1)
    const file: CeramicFile = {
      ...f,
      history,
      data,
      update: (data) => history.insert(data)
    }
    return file
  }
}

const openPath = async (ceramic: any, path: string, options: CreateOptions): Promise<CeramicFolder | CeramicFile | undefined> => {
  // Remove end slash if there is one
  if(path[path.length-1] === '/') path = path.slice(0,path.length-1)

  let stream: TileDocument | false = await exists(ceramic, path, options)
  if(stream) {
    return getF(ceramic, stream)
  }
  else if(ceramic?.did?.id.toString() === options.controller && options?.createIfUndefined) {
    stream = await create(ceramic, path, options)    
    return getF(ceramic, stream)
  }
  else {
    // throw new Error(`${path} does not exist. Did you mean to create it? <options.createIfUndefined: true>`)
    return undefined
  }
}

export const FileSystem = (ceramic: any) => {
  
  const check = async (path: string, options: CreateOptions): Promise<TileDocument | boolean> => {
    const stream: TileDocument | false = await exists(ceramic, path, options)
    return stream
  }

  const get = async (streamId: string): Promise<CeramicFolder | CeramicFile | undefined> => {
    const stream: TileDocument = await TileDocument.load(ceramic, streamId)
    return getF(ceramic, stream)
  }

  const open = async (path: string, options?: CreateOptions): Promise<CeramicFolder | CeramicFile | undefined> => {
    if(!options) options = { controller: "" }
    if(!options.controller) options.controller = ceramic?.did?.id.toString()
    if(!options.controller) throw new Error(`No controller specified for ${path}`)
    return openPath(ceramic, path, options)
  }

  return {
    check,
    get,
    open,
    getStreamIdFromPath
  }
}