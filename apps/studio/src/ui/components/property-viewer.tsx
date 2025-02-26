import { ICanvasEdge, ICanvasNode } from '@invana/data-store';
import { Badge } from '@invana/ui';
import { Copy, List } from 'lucide-react';
import React from 'react';



export interface PropertyViewerProps {
  // Define your props here
  className?: string;
  data: ICanvasNode | ICanvasEdge
}

const PropertyViewer: React.FC<PropertyViewerProps> = ({ className, data }) => {


  // const properties = {
  //   firstName: 'John',
  //   lastName: 'Doe',
  //   age: 30,
  //   email: 'john.doe@example.com',
  //   profilePic: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  // }
  console.log("====PropertyViewer", data, typeof data)
  if (!data) {
    return (
      <div>
        <p className='text-muted'>select a node or edge</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Your component content here */}
      <p className='text-zinc-500 dark:text-zinc-400 inline-flex items-center'>
        <Copy className="mr-1 h-4" />{data.id}</p>
      <h1 className='text-2xl mt-2 '>{data.label}</h1>
      <div className="flex items-center space-x-4">
        <div className=" ">
          <Badge>{data.type}</Badge>
        </div>

        {/* <p className='mt-2 text-zinc-500 dark:text-zinc-400 text-sm'>
          Updated at {new Date().toLocaleDateString()}
        </p> */}
      </div>
      {
        'source' in data && 'target' in data &&
        <div className='mt-2  '>
          <div>source: {(data as ICanvasEdge).source}</div>
          <div>target: {(data as ICanvasEdge).target}</div>
        </div>
      }
      {/* <p className='mt-2 mb-3 text-sm'>Node Description</p> */}

      <div className='border-b border-t mt-5 mb-3 px-1 mx-[-12px]'>
        <h2 className='font-semibold tex uppercase inline-flex items-center'>
          <List className='mr-2 h-4' /> Properties
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4  pb-3 sm:grid-cols-1">
        {Object.entries(data?.properties || {}).map(([key, value]) => (
          <div key={key} className='border-b pb-2'>
            <label className='font-bold ' htmlFor={key} >
              {key}
            </label>
            {key === 'profilePic'
              ? <img src={String(value)} alt="Profile" className="w-20 h-20  " />
              : <div>{String(value)}</div>
            }
          </div>
        ))}
      </div>
    </div>
  );
};

export default PropertyViewer;