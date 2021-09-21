# Ceramic FileSystem
A simple file system built using ceramic

## API
Create the ceramic filesystem object
```
const cFS = FileSystem(ceramic)
```

### Creating a Folder or File
By setting the optional 'createIfUndefined' flag to true it will create any folders or files in the path provided if they have not been created before.
```
const [ file ] = await cFS.open([ filePath ], { createIfUndefined: true }) as [ File ]
```

### Open a Folder or File
There are several ways to open a folder or file. The first is to open folders or files sequentially:
```
const rootName = 'root'
const folderName = 'folder'
const fileName = 'file.ext'

const [ root ] = await cFS.open([ rootName ]) as [ Folder ]
const [ folder ] = await root.open([ folderName ]) as [ Folder ]
const [ file ] = await folder.open([ fileName ]) as [ File ]
```
If you just want to fetch the file you can shorthand it to:
```
const filePath = 'root/folder/file.ext'
const [ file ] = await folder.open([ filePath ]) as [ File ]
```

### Opening Multiple Folders and Files
If you need to fetch several folders or files:
```
const folderPath = 'root/folder'
const filePath = 'root/folder/file.ext'
const [ root, folder, file ] = await cFS.open([ root, folderPath, filePath ]) as [ Folder, Folder, File ]
```

### Fetching Folders and Files in a Folder
You can fetch file and folder names in a folder by using the [AppendCollection API](https://github.com/ChicoBitcoinJoe/ceramic-append-collection)
```
const rootCollection = await root.content.getFirstN(1) // [ 'folder' ]
const folderCollection = await folder.content.getFirstN(1) // [ 'file.ext' ]
```