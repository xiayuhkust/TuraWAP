import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { US, CN } from 'country-flag-icons/react/3x2';

export const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    setOpen(false);
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button className="p-2 hover:bg-[#2F3136] rounded-md">
          {i18n.language === 'en' ? <US className="w-6 h-6" /> : <CN className="w-6 h-6" />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="bg-[#2B2D31] border border-[#393B40] rounded-md p-1 w-32">
        <DropdownMenu.Item 
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#2F3136] rounded cursor-pointer"
          onClick={() => handleLanguageChange('en')}
        >
          <US className="w-4 h-4" />
          <span className="text-[#F2F3F5]">English</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item 
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#2F3136] rounded cursor-pointer"
          onClick={() => handleLanguageChange('zh')}
        >
          <CN className="w-4 h-4" />
          <span className="text-[#F2F3F5]">中文</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
