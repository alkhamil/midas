import { type ReactNode } from 'react';

interface PageContentProps {
  children: ReactNode;
  className?: string;
  testId?: string;
}

function PageContent({ children, className = '', testId }: PageContentProps) {
  return (
    <main
      data-testid={testId}
      className={`page-padding min-w-0 flex-1 overflow-y-auto bg-surface ${className}`}
    >
      {children}
    </main>
  );
}

export default PageContent;
