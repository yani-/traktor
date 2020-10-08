import React from 'react'
import cn from 'classnames'

const NAME_START_OFFSET= 0
const NAME_LENGTH = 255
const SIZE_START_BYTE = 255
const SIZE_END_BYTE = 269
const MTIME_START_BYTE = 269
const MTIME_END_BYTE = 281
const PREFIX_START_OFFSET= 281
const PREFIX_LENGTH = 4096


export default class HomePage extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            isDraggedOver: false,
            isDropped: false,
            file: null,
            originalFile: null,
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

    onDrop(event) {
        event.preventDefault()
        const file = event.dataTransfer.files.item(0)

        this.setState({
          isDraggedOver: false,
          isDropped: true,
          file: file,
          originalFile: file,
        })

        this.readFile(file)
    }

    readFile(file) {
        this.setState({file: file})
        if (file.size === 4377) {
            console.log('read')
            return
        }
        let self = this
        let reader = new FileReader();
        reader.addEventListener("loadend", function() {
            let name = self.getName(reader.result)
            let size = parseInt(self.getSize(reader.result), 10)
            let mtime = self.getMTime(reader.result)
            let prefix = self.getPrefix(reader.result)
//            addFile(new Block(name, size, mtime, prefix, self.byteNumber + 4377))
            self.byteNumber += 4377 + size
            self.readFile(file.slice(4377 + size, file.size))
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

    render () {
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
                                <img src={this.state.isDraggedOver ? '/decompress.svg' : '/archive.svg'} width="100" />
                            </div>
                            <div className="mt-3 mx-10 flex flex-col justify-center items-center pointer-events-none">
                                <h3 className="text-md leading-6 font-medium text-gray-900">Drop your file here, or <a className="pointer-events-auto cursor-pointer text-blue-500">browse</a></h3>
                                <p className="text-sm leading-5 text-gray-500">Supports: wpress</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}
