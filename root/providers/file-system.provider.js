const vscode = require('vscode')
const path = require('path')

class Directory {
  // type: vscode.FileType;
  // ctime: number;
  // mtime: number;
  // size: number;

  // name: string;
  // entries: Map<string, File | Directory>;

  constructor (name) {
    this.type = vscode.FileType.Directory
    this.ctime = Date.now()
    this.mtime = Date.now()
    this.size = 0
    this.name = name
    this.entries = new Map()
  }
}

class File {
  // type: vscode.FileType;
  // ctime: number;
  // mtime: number;
  // size: number;

  // name: string;
  // data?: Uint8Array;

  constructor (name) {
    this.type = vscode.FileType.File
    this.ctime = Date.now()
    this.mtime = Date.now()
    this.size = 0
    this.name = name
    this.data = null
  }
}

class MemFSProvider {
  constructor () {
    this.root = new Directory('')

    this._emitter = new vscode.EventEmitter()
    this._bufferedEvents = []
    this._fireSoonHandle = null
    this.onDidChangeFile = this._emitter.event
  }

  // --- manage file metadata
  stat (uri) {
    return this._lookup(uri, false)
  }

  readDirectory (uri) {
    const entry = this._lookupAsDirectory(uri, false)
    const result = []
    for (const [name, child] of entry.entries) {
      result.push([name, child.type])
    }
    return result
  }

  readFile (uri) {
    const data = this._lookupAsFile(uri, false).data
    if (data) {
      return data
    }
    throw vscode.FileSystemError.FileNotFound()
  }

  writeFile (uri, content, options = { create: true, overwrite: true }) {
    const basename = path.posix.basename(uri.path)
    const parent = this._lookupParentDirectory(uri)
    let entry = parent.entries.get(basename)
    if (entry instanceof Directory) {
      throw vscode.FileSystemError.FileIsADirectory(uri)
    }
    if (!entry && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri)
    }
    if (entry && options.create && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri)
    }
    if (!entry) {
      entry = new File(basename)
      parent.entries.set(basename, entry)
      this._fireSoon([{ type: vscode.FileChangeType.Created, uri }])
    }
    entry.mtime = Date.now()
    entry.size = content.byteLength
    entry.data = content
    this._fireSoon([{ type: vscode.FileChangeType.Changed, uri }])
  }

  rename (oldUri, newUri, options = { overwrite: true }) {
    if (!options.overwrite && this._lookup(newUri, true)) {
      throw vscode.FileSystemError.FileExists(newUri)
    }

    const entry = this._lookup(oldUri, false)
    const oldParent = this._lookupParentDirectory(oldUri)

    const newParent = this._lookupParentDirectory(newUri)
    const newName = path.posix.basename(newUri.path)

    oldParent.entries.delete(entry.name)
    entry.name = newName
    newParent.entries.set(newName, entry)

    this._fireSoon([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ])
  }

  delete (uri) {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) })
    const basename = path.posix.basename(uri.path)
    const parent = this._lookupAsDirectory(dirname, false)
    if (!parent.entries.has(basename)) {
      throw vscode.FileSystemError.FileNotFound(uri)
    }
    parent.entries.delete(basename)
    parent.mtime = Date.now()
    parent.size -= 1
    this._fireSoon([{ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted }])
  }

  createDirectory (uri) {
    const basename = path.posix.basename(uri.path)
    const dirname = uri.with({ path: path.posix.dirname(uri.path) })
    const parent = this._lookupAsDirectory(dirname, false)

    const entry = new Directory(basename)
    parent.entries.set(entry.name, entry)
    parent.mtime = Date.now()
    parent.size += 1
    this._fireSoon([{ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri }])
  }

  watch (_resource) {
    // ignore, fires for all changes...
    return new vscode.Disposable(() => { })
  }

  _lookup (uri, silent = false) {
    const parts = uri.path.split('/')
    let entry = this.root
    for (const part of parts) {
      if (!part) {
        continue
      }
      let child
      if (entry instanceof Directory) {
        child = entry.entries.get(part)
      }
      if (!child) {
        if (!silent) {
          throw vscode.FileSystemError.FileNotFound(uri)
        } else {
          return undefined
        }
      }
      entry = child
    }
    return entry
  }

  _lookupAsDirectory (uri, silent) {
    const entry = this._lookup(uri, silent)
    if (entry instanceof Directory) {
      return entry
    }
    throw vscode.FileSystemError.FileNotADirectory(uri)
  }

  _lookupParentDirectory (uri) {
    const dirname = uri.with({ path: path.posix.dirname(uri.path) })
    return this._lookupAsDirectory(dirname, false)
  }

  _lookupAsFile (uri, silent) {
    const entry = this._lookup(uri, silent)
    if (entry instanceof File) {
      return entry
    }
    throw vscode.FileSystemError.FileIsADirectory(uri)
  }

  // fs events
  _fireSoon (events) {
    this._bufferedEvents.push(...events)

    if (this._fireSoonHandle) {
      clearTimeout(this._fireSoonHandle)
    }

    this._fireSoonHandle = setTimeout(() => {
      this._emitter.fire(this._bufferedEvents)
      this._bufferedEvents.length = 0
    }, 5)
  }
}

module.exports = {
  MemFSProvider,
  Directory
}
