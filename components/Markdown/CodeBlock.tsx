import { IconCheck, IconClipboard, IconDownload } from '@tabler/icons-react';
import { FC, memo, useContext, useState, useRef, useEffect } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useTranslation } from 'next-i18next';
import { generateRandomString } from '@/utils/app/codeblock';
import { programmingLanguages } from '@/utils/app/fileTypeTranslations';

interface Props {
  language: string;
  value: string;
}

export const CodeBlock: FC<Props> = memo(({ language, value }) => {

  const { t } = useTranslation('markdown');

  const [isCopied, setIsCopied] = useState<Boolean>(false);
  const [showFloatingCopy, setShowFloatingCopy] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, right: 0 });
  const codeBlockRef = useRef<HTMLDivElement>(null);
  const topCopyButtonRef = useRef<HTMLButtonElement>(null);

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
    const suggestedFileName = `file-${generateRandomString(
      3,
      true,
    )}${fileExtension}`;
    const fileName = window.prompt(
      t('Enter file name') || '',
      suggestedFileName,
    );

    if (!fileName) {
      // user pressed cancel on prompt
      return;
    }

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

  // Check if top copy button is visible and code block is in view
  useEffect(() => {
    const checkVisibility = () => {
      if (!topCopyButtonRef.current || !codeBlockRef.current) return;

      const topButtonRect = topCopyButtonRef.current.getBoundingClientRect();
      const codeBlockRect = codeBlockRef.current.getBoundingClientRect();

      // Top button is out of view (scrolled up past viewport)
      const topButtonOutOfView = topButtonRect.bottom < 0;

      // Code block is at least partially visible in viewport
      const codeBlockInView = codeBlockRect.top < window.innerHeight && codeBlockRect.bottom > 0;

      const viewportBottom = window.innerHeight;
      const codeBlockTop = codeBlockRect.top;
      const codeBlockBottom = codeBlockRect.bottom;
      const codeBlockRight = codeBlockRect.right;

      // Calculate position FIRST, then decide if we should show
      let buttonTop;
      let targetPosition; // Track what we wanted before clamping

      // Check if code block bottom is visible in viewport
      // BUT add 200px buffer for chat input area - bottom must be at least 200px above viewport bottom
      const isBottomVisible = codeBlockBottom <= (viewportBottom - 200);

      if (isBottomVisible) {
        // Bottom is visible - put button at the actual bottom corner
        targetPosition = codeBlockBottom - 50; // 50px above code block bottom
      } else {
        // In the middle - position 150px up from viewport bottom to avoid chat input
        targetPosition = viewportBottom - 150;
      }

      buttonTop = targetPosition;

      // CLAMP: Never go above code block top + 60px, never go below code block bottom - 50px
      buttonTop = Math.max(buttonTop, codeBlockTop + 60); // At least 60px below top
      buttonTop = Math.min(buttonTop, codeBlockBottom - 50); // At least 50px above bottom

      // CRITICAL CHECK: Only hide if clamping pushed it way below where it should be
      // If we wanted it at viewport-150 but it got clamped way down, hide it to prevent flash
      const clampedTooFar = !isBottomVisible && (buttonTop > targetPosition + 50);

      // Only show if: top button hidden, code block visible, AND not clamped too far
      const shouldShow = topButtonOutOfView && codeBlockInView && !clampedTooFar;

      setShowFloatingCopy(shouldShow);

      if (shouldShow) {
        // Align with right edge of code block
        const buttonRight = window.innerWidth - codeBlockRight + 8;
        setButtonPosition({ top: buttonTop, right: buttonRight });
      }

    };

    // Check on scroll and resize
    window.addEventListener('scroll', checkVisibility, true); // Use capture to catch all scrolls
    window.addEventListener('resize', checkVisibility);

    // Initial check
    checkVisibility();

    return () => {
      window.removeEventListener('scroll', checkVisibility, true);
      window.removeEventListener('resize', checkVisibility);
    };
  }, []);



  return (
    <div ref={codeBlockRef} className="codeblock relative font-sans text-[16px]" style={{ width: '100%', minWidth: 0 }}>
      <div className="flex items-center justify-between py-1.5 px-4">
        <span className="text-xs lowercase text-white">{language}</span>

        <div className="flex items-center">
          <button
            ref={topCopyButtonRef}
            className="flex gap-1.5 items-center rounded bg-none p-1 text-xs text-white"
            onClick={copyToClipboard}
          >
            {isCopied ? <IconCheck size={18} /> : <IconClipboard size={18} />}
            {isCopied ? t('Copied!') : t('Copy code')}
          </button>
          <button
            className="flex items-center rounded bg-none p-1 text-xs text-white"
            onClick={downloadAsFile}
            title="Download Block"
          >
            <IconDownload size={18} />
          </button>
        </div>
      </div>

      <div style={{ overflow: 'hidden' }}>
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            overflow: 'auto',
            boxSizing: 'border-box'
          }}
          PreTag="div"
        >
          {value}
        </SyntaxHighlighter>
      </div>

      {/* Floating copy button - fixed position, calculated to stay within code block */}
      {showFloatingCopy && (
        <button
          className="fixed p-2 rounded bg-gray-800/90 hover:bg-gray-700 text-white shadow-lg z-50"
          onClick={copyToClipboard}
          title={isCopied ? 'Copied!' : 'Copy code'}
          style={{
            backdropFilter: 'blur(4px)',
            top: `${buttonPosition.top}px`,
            right: `${buttonPosition.right}px`,
          }}
        >
          {isCopied ? <IconCheck size={18} /> : <IconClipboard size={18} />}
        </button>
      )}
    </div>
  );
});
CodeBlock.displayName = 'CodeBlock';
