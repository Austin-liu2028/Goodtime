import type { MouseEvent, PropsWithChildren } from 'react';
import { navigate } from '../hooks/useRoute';

interface LinkProps {
  to: string;
  className?: string;
  ariaLabel?: string;
}

// In-app link: navigates without a reload, but still lets cmd/ctrl-click open a new tab.
export const Link = ({ to, className, ariaLabel, children }: PropsWithChildren<LinkProps>) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} className={className} aria-label={ariaLabel} onClick={handleClick}>
      {children}
    </a>
  );
};
