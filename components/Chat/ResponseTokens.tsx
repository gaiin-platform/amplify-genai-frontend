import { FC, useContext, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { DEFAULT_TEMPERATURE } from '@/utils/app/const';

import HomeContext from '@/pages/api/home/home.context';
import {OpenAIModelID, OpenAIModels} from "@/types/openai";

interface Props {
  label: string;
  onResponseTokenRatioChange: (tokenRatio: number) => void;
}

export const ResponseTokensSlider: FC<Props> = ({
  label, onResponseTokenRatioChange,
}) => {
  const {
    state: { conversations },
  } = useContext(HomeContext);


  const [responseTokenRatio, setResponseTokenRatio] = useState(
      3
  );
  const { t } = useTranslation('chat');
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value);
      setResponseTokenRatio(newValue);
      onResponseTokenRatioChange(newValue);
  };

  return (
    <div className="flex flex-col">
      <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
        {label}
      </label>
      <span className="text-[12px] text-black/50 dark:text-white/50 text-sm">
        {t(
          'Higher values will allow, but do not guarantee, longer answers.',
        )}
      </span>
      <span className="mt-2 mb-1 text-center text-neutral-900 dark:text-neutral-100">
        {responseTokenRatio.toFixed(1)}
      </span>
      <input
        className="cursor-pointer"
        type="range"
        min={0.0}
        max={6}
        step={0.1}
        value={responseTokenRatio}
        onChange={handleChange}
      />
      <ul className="w mt-2 pb-8 flex justify-between px-[24px] text-neutral-900 dark:text-neutral-100">
        <li className="flex justify-center">
          <span className="absolute">{t('Concise')}</span>
        </li>
        <li className="flex justify-center">
          <span className="absolute">{t('Average')}</span>
        </li>
        <li className="flex justify-center">
          <span className="absolute">{t('Verbose')}</span>
        </li>
      </ul>
    </div>
  );
};
