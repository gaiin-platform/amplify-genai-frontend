import { FC, useContext, useEffect, useRef } from 'react';

import { DEFAULT_TEMPERATURE } from '@/utils/app/const';

import HomeContext from '@/pages/api/home/home.context';
import { Slider } from '../../ReusableComponents/Slider';

interface Props {
  onChangeTemperature: (temperature: number) => void;
}

export const TemperatureSlider: FC<Props> = ({
  onChangeTemperature,
}) => {
  const {
    state: { conversations },
  } = useContext(HomeContext);

  const conversationsRef = useRef(conversations);

  useEffect(() => {
    conversationsRef.current = conversations;
}, [conversations]);

  const lastConversation =  conversationsRef.current[ conversationsRef.current.length - 1]; 

  return (
    <Slider
      label={'Temperature'}
      description={"Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic."}
      defaultState={ lastConversation?.temperature ?? DEFAULT_TEMPERATURE }
      onChange={(newValue) => onChangeTemperature(newValue)}
      labels={["Precise", "Neutral", "Creative"]}
      max={1}
      />
  )

};


