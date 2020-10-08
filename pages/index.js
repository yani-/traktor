import React from 'react'
import cn from 'classnames'

export default class HomePage extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            isDraggedOver: false,
            isDropped: false,
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
        this.setState({
          isDraggedOver: false,
          isDropped: true,
        })
        console.log('here')
    }

    render () {
        if (this.state.isDropped) {
            return (
              <div className="bg-gray-400">
                  <div className="container mx-auto h-screen flex justify-center items-center">
                      <div className="p-6 flex justify-center items-center rounded bg-white shadow-xl">
                          <div className="flex rounded border-dashed border border-gray-500 p-4 bg-blue-100">
                              <div className="my-3 mx-5 flex flex-col">
                                  <h3 className="text-md leading-6 font-medium text-gray-900 pr-64">Uploading...</h3>
                                  <p className="mt-2 text-sm leading-5">50%</p>
                                  <div className="w-6/12 bg-blue-500 py-1 rounded-full"></div>
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
