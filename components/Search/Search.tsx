import { IconX } from '@tabler/icons-react';
import { FC } from 'react';

import { useTranslation } from 'next-i18next';

interface Props {
  placeholder: string;
  searchTerm: string;
  onSearch: (searchTerm: string) => void;
  disabled?: boolean;
  paddingY?: string;
}
const Search: FC<Props> = ({ placeholder, searchTerm, onSearch, disabled=false, paddingY="py-3"}) => {
  const { t } = useTranslation('sidebar');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const clearSearch = () => {
    onSearch('');
  };

  return (
    <div className="relative flex items-center">
      <input
        className={`w-full flex-1 rounded-md border border-neutral-300 dark:border-neutral-600  bg-neutral-100 dark:bg-[#202123] px-4 ${paddingY} pr-10 text-[14px] leading-3 dark:text-white`}
        type="text"
        placeholder={t(placeholder) || ''}
        value={searchTerm}
        onChange={handleSearchChange}
        disabled={disabled}
        autoComplete={'off'}
        spellCheck={false}
      />

      {searchTerm && (
        <IconX
          className="absolute right-4 cursor-pointer text-neutral-300 hover:text-neutral-400"
          size={18}
          onClick={clearSearch}
        />
      )}
    </div>
  );
};

export default Search;
