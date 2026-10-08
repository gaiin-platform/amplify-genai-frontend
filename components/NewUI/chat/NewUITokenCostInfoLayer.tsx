/**
 * NewUITokenCostInfoLayer
 *
 * Adds the shared `InfoTooltip` (i) next to the "Total Token Cost: $x" line inside the
 * Reasoning / Actions disclosure. That line is rendered by AgentLogBlock.tsx (off-limits,
 * NEW_UI_GUIDE §2), so this layer finds it in the DOM and portals the tooltip into a small
 * host span inserted right after the label.
 *
 * The tooltip clarifies that the figure is informational — it is not passed on to the user.
 *
 * Scoping: only spans inside the AgentLogBlock panel (`.pointer-events-auto.max-w-full
 * .overflow-hidden > .border-l`) whose text starts with "Total Token Cost" are matched.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { InfoTooltip } from '@/components/NewUI/shared/InfoTooltip';

const PANEL_SELECTOR = '.pointer-events-auto.max-w-full.overflow-hidden > .border-l';
const LABEL_PREFIX = 'Total Token Cost';
const HOST_ATTR = 'data-nui-token-cost-host';

const TOOLTIP_TEXT =
  'This is not a charge to you. It shows what these requests cost to run, so you can see the resources they use.';

export const NewUITokenCostInfoLayer: React.FC = () => {
  const [hosts, setHosts] = useState<HTMLElement[]>([]);

  const scan = useCallback(() => {
    const container = document.querySelector('.chatcontainer');
    if (!container) {
      setHosts((prev) => (prev.length ? [] : prev));
      return;
    }

    const next: HTMLElement[] = [];
    container.querySelectorAll<HTMLElement>(`${PANEL_SELECTOR} span.font-medium`).forEach((label) => {
      if (!label.textContent?.trim().startsWith(LABEL_PREFIX)) return;
      let host = label.nextElementSibling as HTMLElement | null;
      if (!host || !host.hasAttribute(HOST_ATTR)) {
        host = document.createElement('span');
        host.setAttribute(HOST_ATTR, 'true');
        host.style.display = 'inline-flex';
        host.style.verticalAlign = 'middle';
        host.style.marginLeft = '4px';
        label.insertAdjacentElement('afterend', host);
      }
      next.push(host);
    });

    setHosts((prev) =>
      prev.length === next.length && prev.every((h, i) => h === next[i]) ? prev : next,
    );
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    const attach = () => {
      const container = document.querySelector('.chatcontainer');
      if (!container) {
        retry = setTimeout(attach, 200);
        return;
      }
      scan();
      observer = new MutationObserver((records) => {
        // Ignore our own host mutations (tooltip open/close) to avoid rescan loops.
        const external = records.some(
          (r) => !(r.target instanceof HTMLElement && r.target.closest(`[${HOST_ATTR}]`)),
        );
        if (!external) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(scan, 100);
      });
      observer.observe(container, { childList: true, subtree: true });
    };

    attach();
    return () => {
      if (retry) clearTimeout(retry);
      if (timer) clearTimeout(timer);
      observer?.disconnect();
      document.querySelectorAll(`[${HOST_ATTR}]`).forEach((h) => h.remove());
    };
  }, [scan]);

  return (
    <>
      {hosts.map((host, i) =>
        createPortal(
          <InfoTooltip
            key={i}
            text={TOOLTIP_TEXT}
            ariaLabel="About token cost"
          />,
          host,
        ),
      )}
    </>
  );
};

export default NewUITokenCostInfoLayer;
