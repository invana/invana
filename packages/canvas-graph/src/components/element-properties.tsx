

import { IProperties } from '@invana/data-store';
import React from 'react';


export const ElementProperties: React.FC<IProperties> = ({ properties }) => {
  console.log("ElementPropertiesCard edge", properties)
  return (
    <div className="text-sm">
      <h4 className="font-bold mb-2 uppercase">Properties</h4>
      {Object.entries(properties).map(([key, value], index, array) => (
        <div key={key} className={`mb-2 pb-2 ${index !== array.length - 1 ? 'border-b' : ''}`}>
          <h5 className='font-bold'>{key}</h5>
          <div>
            {typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://')) ? (
              value.match(/\.(jpeg|jpg|gif|png)$/) != null ? (
                <img src={value} alt={key} className="w-full h-auto" />
              ) : (
                <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                  {value}
                </a>
              )
            ) : typeof value === 'object' ? (
              <div>{JSON.stringify(value)}</div>
            ) : (
              <div>{value}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

