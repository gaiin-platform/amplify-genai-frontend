import { FC } from 'react';
import { Slider } from '../ReusableComponents/Slider';
interface Props {
  label: string;
  onResponseTokenRatioChange: (tokenRatio: number) => void;
}

export const ResponseTokensSlider: FC<Props> = ({
  label, onResponseTokenRatioChange,
}) => {



  return (

    <Slider
      label={label}
      description={"Higher values will allow, but do not guarantee, longer answers."}
      defaultState={ 3 }
      onChange={(newValue) => onResponseTokenRatioChange(newValue)}
      labels={["Concise", "Average", "Verbose"]}
      max={6}
      />

  );
};
