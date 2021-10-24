# Ceramic FileSystem
A simple file system built using ceramic

## API
Create the ceramic filesystem object
```
import { CeramicFileSystem } from '@cbj/ceramic-filesystem'

/* ... */

const fs = FileSystem(ceramic)
```

### Open a Folder or File
There are several ways to open a folder or file. The primary way is by using a direct path
```
const filePath = 'root/folder//file.ext'
const file = await folder.open(filePath) as CeramicFile
```
But you can open each folder sequentially
```
const rootName = 'root'
const folderName = 'folder'
const fileName = '/file.ext' // Files always start with a leading slash

const root = await fs.open(rootName) as CeramicFolder
const folder = await root.open(folderName) as CeramicFolder
const file = await folder.open(fileName) as CeramicFile
```

### Fetching a Folder or File From Another Controller
If you are fetching a folder or file from another controller set the controller field in the options
```
const filePath = 'root/folder//file.ext'
const file = await folder.open(filePath, { controller }) as CeramicFile
```

### Creating a Folder or File
By setting the optional 'createIfUndefined' flag to true it will create any folders or files in the path provided if they have not been created before.
```
const folder = await fs.open(filePath, { createIfUndefined: true }) as CeramicFolder
const file = await fs.open(filePath, { createIfUndefined: true }) as CeramicFile
```

### Getting Folder and File Names
You can fetch file and folder names in a folder by using the [AppendCollection API](https://github.com/ChicoBitcoinJoe/ceramic-append-collection)
```
const folder = await FS.open(path) as CeramicFolder
const fileNames = await folder.files.getFirstN(N)
const folderNames = await folder.folders.getFirstN(N)
// const fileNames = await folder.files.getLastN(N)
// const folderNames = await folder.folders.getLastN(N)
```