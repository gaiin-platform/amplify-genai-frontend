import { FC } from 'react';

import { Prompt } from '@/types/prompt';

import { PromptComponent } from './Prompt';

interface Props {
  prompts: Prompt[];
}

export const Prompts: FC<Props> = ({ prompts }) => {
  return (
    <div className="mt-2 flex w-full flex-col gap-0.5">
      {prompts
        .slice()
        .reverse()
        .map((prompt, index) => (
          <PromptComponent key={index} prompt={prompt} />
        ))}
    </div>
  );
};
