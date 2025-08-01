import { IconSearch, IconX } from '@tabler/icons-react';
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
      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
        <IconSearch size={12} stroke={3} className="text-neutral-400 dark:text-neutral-400" />
      </div>
      <input
        id="SearchBar"
        className={`w-full flex-1 rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-[#202123] pl-7 pr-2 ${paddingY} text-[14px] leading-3 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow duration-150`}
        type="text"
        placeholder={t(placeholder) || ''}
        value={searchTerm}
        onChange={handleSearchChange}
        disabled={disabled}
        autoComplete={'off'}
        spellCheck={false}
      />

      {searchTerm && (
        <button
          className="absolute cursor-pointer right-0 pr-2.5 flex items-center text-neutral-500 hover:text-neutral-400"
          onClick={clearSearch}
        >
          <IconX size={12} stroke={3} />
        </button>
      )}
    </div>
  );
};

export default Search;
