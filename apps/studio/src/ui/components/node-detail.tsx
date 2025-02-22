import { Badge } from '@invana/ui';
import { Copy, List } from 'lucide-react';
import React from 'react';



export interface NodeDetailProps {
  // Define your props here
  className?: string;
}

const NodeDetail: React.FC<NodeDetailProps> = () => {


  const properties = {
    firstName: 'John',
    lastName: 'Doe',
    age: 30,
    email: 'john.doe@example.com',
    profilePic: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?q=80&w=3000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  }
  return (
    <div>
      {/* Your component content here */}
      <p className='text-zinc-500 dark:text-zinc-400 text-sm inline-flex items-center'>
        <Copy className="mr-1 h-4" /> 123e4567-e89b-12d3-a456-426614174000</p>
      <h1 className='text-2xl mt-2 font-semibold'>Node Detail</h1>
      <div className="flex items-center space-x-4">
        <p className="mt-2 text-sm">
          <Badge >Node Type</Badge>
        </p>
        {/* <p className='mt-2 text-zinc-500 dark:text-zinc-400 text-sm'>
          Updated at {new Date().toLocaleDateString()}
        </p> */}
      </div>
      {/* <p className='mt-2 mb-3 text-sm'>Node Description</p> */}

      <div className='border-b border-t mt-5 mb-3 px-1 mx-[-12px]'>
        <h2 className='font-semibold tex uppercase inline-flex items-center'>
          <List className='mr-2 h-4' /> Properties
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4  pb-3 sm:grid-cols-1">

        {Object.entries(properties).map(([key, value]) => (
          <div key={key} className='border-b pb-2'>
            <label className='font-bold text-sm' htmlFor={key} >
              {key}
            </label>
            {key === 'profilePic' ? <img src={String(value)} alt="Profile" className="w-20 h-20  " /> : <div>{value}</div>}
          </div>
        ))}
        {/* </div>
          <div key={key}>
            <label className='font-bold text-sm' htmlFor={key} >
              {key}
            </label>
            <div>{value}</div>
          </div>
        ))} */}
      </div>



    </div>
  );
};

export default NodeDetail;