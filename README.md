# Ceramic FileSystem
A simple file system built using ceramic

## API
Create the ceramic filesystem object
```
const FS = FileSystem(ceramic)
```

### Creating a Folder or File
By setting the optional 'createIfUndefined' flag to true it will create any folders or files in the path provided if they have not been created before.
```
const folder = await cFS.open(filePath, { createIfUndefined: true }) as Folder
const file = await cFS.open(filePath, { createIfUndefined: true }) as File
```

### Open a Folder or File
There are several ways to open a folder or file. The first is to open folders or files sequentially:
```
const rootName = 'root'
const folderName = 'folder'
const fileName = '/file.ext' // Files always start with a leading slash

const root = await cFS.open(rootName) as Folder
const folder = await root.open(folderName) as Folder
const file = await folder.open(fileName) as File
```
But if you just want to fetch the file you can shorthand by using just the file path:
```
const filePath = 'root/folder//file.ext'
const file = await folder.open(filePath) as File
```

### Getting Folder and File Names
You can fetch file and folder names in a folder by using the [AppendCollection API](https://github.com/ChicoBitcoinJoe/ceramic-append-collection)
```
const folder = await FS.open(path) as Folder
const fileNames = await folder.files.getFirstN(N)
const folderNames = await folder.folders.getFirstN(N)
// const fileNames = await folder.files.getLastN(N)
// const folderNames = await folder.folders.getLastN(N)
```