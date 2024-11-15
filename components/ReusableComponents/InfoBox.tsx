import { IconInfoCircle } from '@tabler/icons-react';
import { FC, ReactElement, useState } from 'react';


interface Props {
  content: ReactElement;
  size?: number;
}

  export const InfoBox: FC<Props> = ({content, size=16}) => {
    return (
        <div className="flex items-center p-2 border border-gray-400 dark:border-gray-500 rounded text-gray-600 dark:text-gray-400">
              <IconInfoCircle size={size} className='ml-1 mb-1 flex-shrink-0 text-gray-600 dark:text-gray-400' />
              {content}
        </div>

    )

  }