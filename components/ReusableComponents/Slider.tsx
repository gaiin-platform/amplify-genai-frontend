import { FC, useState } from 'react';


interface Props {
  label: string;
  description: string;
  defaultState: number;
  onChange: (n: number) => void;
  labels: string[];
  max: number;
  step?:number;
}

  export const Slider: FC<Props> = ({label, description, defaultState, onChange,  labels, max, step=0.1}) => {
  const [slider, setSlider] = useState(defaultState);  

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    setSlider(newValue);
    onChange(newValue);
  };

  return (
    <div className="flex flex-col">
      <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
        {label}
      </label>
      <span className="text-[12px] text-black/50 dark:text-white/50 text-sm">
        {description}
      </span>
      <span className="mt-2 mb-2 text-center text-neutral-900 dark:text-neutral-100">
        {slider.toFixed(1)}
      </span>
      <input
        className="w-full h-[3px] rounded-none appearance-none cursor-pointer bg-gray-300"
        id="slider"
        style={{
            outline: 'none',
            background: 'linear-gradient(to right, #3b82f6 0%, #3b82f6 ' + (slider / max * 100) + '%, #d1d5db ' + (slider / max * 100) + '%, #d1d5db 100%)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.1)',
        }}
        type="range"
        min={0.0}
        max={max}
        step={step}
        value={slider}
        onChange={handleChange}
      />
      <ul className="w mt-2 pb-8 flex justify-between px-[24px] text-neutral-900 dark:text-neutral-100">
        {labels.map((label, index) => (
            <li className="flex justify-center" key={index}>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

