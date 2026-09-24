import { IconCheck, IconClipboard, IconDownload } from '@tabler/icons-react';
import { FC, memo, useState, useEffect } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTranslation } from 'next-i18next';
import { generateRandomString } from '@/utils/app/codeblock';
import { programmingLanguages } from '@/utils/app/fileTypeTranslations';

interface Props {
  language: string;
  value: string;
}

const useIsDarkMode = (): boolean => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return true;
    return document.querySelector('main')?.classList.contains('dark') ?? true;
  });

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    const observer = new MutationObserver(() => {
      setIsDark(mainEl.classList.contains('dark'));
    });
    observer.observe(mainEl, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

export const CodeBlock: FC<Props> = memo(({ language, value }) => {

  const { t } = useTranslation('markdown');
  const isDarkMode = useIsDarkMode();

  const [isCopied, setIsCopied] = useState<Boolean>(false);

  const copyToClipboard = () => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      return;
    }

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };

  const downloadAsFile = () => {
    const fileExtension = programmingLanguages[language] || '.file';
    const suggestedFileName = `file-${generateRandomString(3, true)}${fileExtension}`;
    const fileName = window.prompt(t('Enter file name') || '', suggestedFileName);
    if (!fileName) return;
    const blob = new Blob([value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="codeblock relative font-sans text-[16px]"
      style={{ width: '100%', minWidth: 0, maxWidth: '100%' }}
    >
      {/* ── Header bar — copy button always has its own row, never overlaps code ── */}
      <div
        className="flex items-center justify-between py-1.5 px-4"
        style={{
          color: 'var(--text-secondary, #ccc)',
          borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
        }}
      >
        <span className="text-xs lowercase" style={{ color: 'inherit' }}>{language}</span>

        <div className="flex items-center">
          <button
            className="flex gap-1.5 items-center rounded bg-none p-1 text-xs"
            style={{ color: 'inherit' }}
            onClick={copyToClipboard}
          >
            {isCopied ? <IconCheck size={18} /> : <IconClipboard size={18} />}
            {isCopied ? t('Copied!') : t('Copy code')}
          </button>
          <button
            className="flex items-center rounded bg-none p-1 text-xs"
            style={{ color: 'inherit' }}
            onClick={downloadAsFile}
            title="Download Block"
          >
            <IconDownload size={18} />
          </button>
        </div>
      </div>

      {/* ── Code area — overflow-x: auto so long lines scroll horizontally ── */}
      <div style={{ overflowX: 'auto' }}>
        <SyntaxHighlighter
          language={language}
          style={isDarkMode ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            overflow: 'visible',
            boxSizing: 'border-box',
            background: 'transparent',
          }}
          PreTag="div"
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});
CodeBlock.displayName = 'CodeBlock';
