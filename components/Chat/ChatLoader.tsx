import { FC, useContext } from 'react';
import { Amplify } from './Avatars';
import HomeContext from '@/pages/api/home/home.context';

interface Props { }

export const ChatLoader: FC<Props> = () => {
  const { state: { selectedArtifacts} } = useContext(HomeContext);
  
  return (
    <div
      className="group border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100"
      style={{ overflowWrap: 'anywhere' }}
    >
      <div className="flex gap-4 p-4 text-base md:gap-6 md:py-6 ml-[85px] min-w-[40px]">
        <div className={`${selectedArtifacts ? "ml-[18px]" : ""} min-w-[40px] items-end`}>
          <Amplify/>
        </div>
        <span className="animate-pulse cursor-default mt-1">▍</span>
      </div>
    </div>
  );
};
