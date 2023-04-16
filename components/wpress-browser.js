import path from 'path'
import React from 'react'
import cn from 'classnames'
import { saveAs } from 'file-saver'
import {Modal} from "./Modal";
import {DownloadIcon} from "./icons/DownloadIcon";
import {LoadingIcon} from "./icons/LoadingIcon";

import {
    makeKeyFromPassword,
    extractIv,
    extractEncryptedText,
    decrypt,
    decryptFile,
} from "../helpers/cryptoHelpers";

const NAME_START_OFFSET= 0
const NAME_LENGTH = 255
const SIZE_START_BYTE = 255
const SIZE_END_BYTE = 269
const MTIME_START_BYTE = 269
const MTIME_END_BYTE = 281
const PREFIX_START_OFFSET= 281
const PREFIX_LENGTH = 4096

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

class Tree {
  constructor(name) {
    this.root = new Node(name, true)
    this.root.parent = null
    this.root.tree = this
  }
}

class Node {
  constructor(name, expanded) {
    this.name     = name
    this.children = []
    this.files    = []
    this.expanded = !!expanded
  }

  addChild(child) {
    child.parent = this
    this.children.push(child)
    return child
  }

  findNode(name) {
    if (this.name === name) {
      return this
    } else {
      return this.children.find(child => {
        return child.findNode(name)
      })
    }
  }

  getRootNode() {
    if (this.parent === null)
      return this

    return this.parent.getRootNode()
  }
}

export default class WPressBrowser extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            tree                : new Tree('/'),
            isDraggedOver       : false,
            isDropped           : false,
            isListing           : false,
            isPasswordRequested : false,
            file                : null,
            originalFile        : null,
            errorMessage        : '',
            encryptedSignature  : '',
            decryptionKey       : '',
            password            : '',
            passwordError       : '',
            loading             : false,
        }

    }

    onDragEnter(event) {
        event.preventDefault()
        this.setState({isDraggedOver: true})
    }

    onDragOver(event) {
        event.preventDefault()
    }

    onDragLeave(event) {
        event.preventDefault()
        this.setState({isDraggedOver: false})
    }

    onFileSelected(event) {
        event.preventDefault()
        const file = event.target.files.item(0)
        this.processFile(file)
    }

    onDrop(event) {
        event.preventDefault()
        const file = event.dataTransfer.files.item(0)
        this.processFile(file)
    }

    processFile(file) {
        if (path.extname(file.name) !== '.wpress') {
            return this.setState({
                tree          : new Tree('/'),
                isDraggedOver : false,
                isDropped     : false,
                isListing     : false,
                file          : null,
                originalFile  : null,
                errorMessage  : 'Only .wpress files are allowed',
            })
        }

        this.setState({
          errorMessage: null,
          isDraggedOver: false,
          isDropped: true,
          file: file,
          originalFile: file,
        })

        this.readFile(file)
    }

    readPackageJson(file, size) {
        let reader = new FileReader();
        const self = this;
        reader.addEventListener("loadend", () => {
            const content = (new TextDecoder('utf-8')).decode(new DataView(reader.result));
            const config = JSON.parse(content);
            if(config.Encrypted) {
                self.setState({
                    isPasswordRequested: true,
                    encryptedSignature: config.EncryptedSignature
                });
            }
        });

        reader.readAsArrayBuffer(file.slice(4377, 4377 + size))
    }

    readFile(file) {
        this.setState({file: file})

        if (file.size === 4377) {
            this.setState({isListing: true})
            return
        }
        let reader = new FileReader();
        reader.addEventListener("loadend", () => {
            let node = this.state.tree.root
            let name = this.getName(reader.result)
            let size = parseInt(this.getSize(reader.result), 10)
            let mtime = this.getMTime(reader.result)
            let prefix = this.getPrefix(reader.result)
            prefix = prefix === '.' ? '' : prefix

            if (prefix.length > 0) {
                let parent = ''
                prefix.split('/').map((path, depth) => {
                    parent += '/' + path
                    let foundNode = node.findNode(parent)
                    node = !!foundNode ? foundNode : node.addChild(new Node(parent))
                })
            }
            if(name == 'package.json') {
                this.readPackageJson(file, size);
            }
            node.files.push({name, size, content: file.slice(4377, 4377 + size)})
            this.setState({tree: this.state.tree})
            this.byteNumber += 4377 + size
            this.readFile(file.slice(4377 + size, file.size))
        });
        reader.readAsArrayBuffer(file.slice(0, 4377))
    }

    getName(blob) {
        let length = new Int8Array(blob, NAME_START_OFFSET, NAME_LENGTH).reduceRight((previous, current, index) => {
            return previous ? previous : ((current === 0) ? false : index+1)
        }, false)

        let decoder = new TextDecoder('utf-8')
        return decoder.decode(new DataView(blob, NAME_START_OFFSET, length))

    }

    getSize(blob) {
        let dataView = new DataView(blob.slice(SIZE_START_BYTE, SIZE_END_BYTE))
        let decoder = new TextDecoder('utf-8')
        return decoder.decode(dataView)
    }

    getMTime(blob) {
        let dataView = new DataView(blob.slice(MTIME_START_BYTE, MTIME_END_BYTE))
        let decoder = new TextDecoder('utf-8')
        return decoder.decode(dataView)
    }

    getPrefix(blob) {
        let length = new Int8Array(blob, PREFIX_START_OFFSET, PREFIX_LENGTH).reduceRight((previous, current, index) => {
            return previous ? previous : ((current === 0) ? false : index+1)
        }, false)

        let decoder = new TextDecoder('utf-8')
        return decoder.decode(new DataView(blob, PREFIX_START_OFFSET, length))
    }

    getContent(blob) {
        let dataView = new DataView(blob.slice(0, blob.byteLength))
        let decoder = new TextDecoder('utf-8')
        return decoder.decode(dataView)
    }

    onNodeClick(node, event) {
        event.preventDefault()
        event.stopPropagation()
        node.expanded = !node.expanded
        this.setState({tree: node.getRootNode().tree})
    }

    onFileClick(file, event) {
        event.preventDefault()
        event.stopPropagation()

        if(this.state.loading) {
            return false;
        }

        this.setState({loading: file.name});
        const self = this;

        if(this.state.decryptionKey) {
            decryptFile(this.state.decryptionKey, file.content)
                .then(fileContent => {
                    const blob = new Blob([fileContent]);

                    saveAs(blob, file.name);

                    self.setState({loading: false});
                })
                .catch((error) => {
                    console.error(error);
                    self.setState({loading: false});

                    this.setState({ error })
                });
        } else {
            saveAs(file.content, file.name)
            self.setState({loading: false});
        }
    }

    traverse(node) {
        if (node.expanded === false) {
            return null
        }

        const { state: { loading } } = this;

        return (
            <ul className={node.name === '/' ? 'mb-6' : 'ml-4'}>
                <li onClick={node.name === '/' ? null : this.onNodeClick.bind(this, node)} className="cursor-pointer" key={node.name}>
                    <img className="inline mr-2 h-4" src={node.expanded ? '/folder-open.svg' : '/folder.svg'} />
                    {path.basename(node.name) || this.state.originalFile.name}

                    {node.children.map(child => {
                        if (child.expanded) {
                            return this.traverse(child)
                        } else {
                            return (
                                <ul className="ml-4">
                                    <li key={node.name} onClick={this.onNodeClick.bind(this, child)}>
                                        <img className="inline mr-2 h-4" src="/folder.svg"/>{path.basename(child.name)}
                                    </li>
                                </ul>
                            )
                        }
                    })}
                    {node.files.map(file => {
                        return (
                            <ul className="ml-4">
                                <li className={loading ? 'loading file' : 'file'} onClick={this.onFileClick.bind(this, file)} key={node.name + '/' + file.name}>
                                    <img className="inline mr-2 h-4" src="/file.svg"/>
                                    <span className="mr-2">{file.name}</span>
                                    <span className="text-xs text-gray-600 mr-2">{formatBytes(file.size)}</span>
                                    <DownloadIcon hidden={loading} />
                                    <LoadingIcon hidden={loading !== file.name} />
                                </li>
                            </ul>
                        )
                    })}
                </li>
            </ul>
        )
    }

    cancelPassword() {
        this.setState({
            tree                 : new Tree('/'),
            isDraggedOver        : false,
            isDropped            : false,
            isListing            : false,
            file                 : null,
            originalFile         : null,
            errorMessage         : '',
            isPasswordRequested  : false,
            passwordError        : '',
        });
    }

    validatePassword() {
        const password = this.state.password;
        try {
            const decryptionKey = makeKeyFromPassword(password);

            decrypt(
                extractEncryptedText(this.state.encryptedSignature),
                decryptionKey,
                extractIv(this.state.encryptedSignature)
            );

            this.setState({
                decryptionKey,
                isPasswordRequested: false
            });
        } catch (e) {
            console.error(e);

            this.setState({
                passwordError : 'Invalid password',
            })
        }
    }

    render () {
        if(this.state.isPasswordRequested) {
            let errorMessage = null

            if (this.state.passwordError) {
                errorMessage = (
                    <div className="bg-red-400 rounded p-4 fixed bottom-0 right-0 mb-12 mr-6">{this.state.passwordError}</div>
                )
            }

            return (
                <div className="bg-gray-400 max-h-screen">
                    <Modal>
                        <div className="flex flex-col gap-2 bg-white px-4 pb-4 rounded-lg">
                            <h1 className="text-xl text-black mt-2 pr-48">Backup is encrypted</h1>
                            <div className="flex flex-col gap-2 my-4">
                                <label htmlFor="email">Please enter password</label>
                                <input id="text" type="password" className="py-2 px-4 border border-gray-200 rounded-lg" placeholder="******"
                                       onChange={({target}) => this.setState({password: target.value})}/>
                            </div>
                            <div className="flex flex-row gap-2">
                                <a href="#" onClick={() => this.cancelPassword()} className="flex-1 py-2 px-4 bg-gray-500 hover:bg-gray-600 text-white font-bold text-lg rounded-full text-center">Cancel</a>
                                <button onClick={() => this.validatePassword()} className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg rounded-full">Decrypt</button>
                            </div>
                        </div>
                    </Modal>
                    {errorMessage}
                </div>
            );
        }

        if (this.state.isListing) {
            return (
              <div className="bg-gray-400 max-h-screen">
                  <div className="container mx-auto h-screen flex justify-center items-center">
                      <div className="p-6 pr-64 pb-0 flex justify-center items-center rounded bg-white shadow-xl overflow-y-auto max-h-full box-border">
                          <div className="max-h-85">
                              {this.traverse(this.state.tree.root)}
                          </div>
                      </div>
                  </div>
              </div>

            )
        }

        if (this.state.isDropped) {
            const percentProcessed = 100 - (this.state.file.size / this.state.originalFile.size) * 100
            const style = {
                width: percentProcessed.toFixed(0) + '%',
            }
            return (
              <div className="bg-gray-400">
                  <div className="container mx-auto h-screen flex justify-center items-center">
                      <div className="p-6 flex justify-center items-center rounded bg-white shadow-xl">
                          <div className="flex rounded border-dashed border border-gray-500 p-4 bg-blue-100">
                              <div className="my-3 mx-5 flex flex-col">
                                  <h3 className="text-md leading-6 font-medium text-gray-900 pr-64">Reading...</h3>
                                  <p className="mt-2 text-sm leading-5">{percentProcessed.toFixed(2)}%</p>
                                  <div className="bg-blue-500 py-1 rounded-full" style={style}></div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
            )
        }

        let errorMessage = null

        if (this.state.errorMessage) {
            errorMessage = (
                <div className="bg-red-400 rounded p-4 fixed bottom-0 right-0 mb-6 mr-6">{this.state.errorMessage}</div>
            )
        }

        return (
            <div className="bg-gray-400">
                <div className="container mx-auto h-screen flex justify-center items-center">
                    <div className="p-6 flex justify-center items-center rounded bg-white shadow-xl">
                        <div className={cn(
                                'flex rounded border-dashed border border-gray-500 p-12',
                                this.state.isDraggedOver ? 'bg-blue-100' : ''
                             )}
                             onDragEnter={this.onDragEnter.bind(this)}
                             onDragOver={this.onDragOver.bind(this)}
                             onDragLeave={this.onDragLeave.bind(this)}
                             onDrop={this.onDrop.bind(this)}>
                            <div className="mx-10 box-content flex-shrink-0 flex items-center justify-center pointer-events-none">
                                <img src={this.state.isDraggedOver ? '/file-upload.svg' : '/file-word.svg'} width="100" />
                            </div>
                            <div className="mt-3 mx-10 flex flex-col justify-center items-center pointer-events-none">
                                <h3 className="text-md leading-6 font-medium text-gray-900">Drop your file here, or <label className="pointer-events-auto cursor-pointer text-blue-500">browse <input type="file" className="hidden" onChange={this.onFileSelected.bind(this)} /></label></h3>
                                <p className="text-sm leading-5 text-gray-500">Supports: wpress</p>
                            </div>
                        </div>
                    </div>
                </div>
                {errorMessage}
            </div>
        )
    }
}
