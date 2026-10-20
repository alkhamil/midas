import type { ReactNode } from 'react';
import { Card } from '../../../shared/components/ui';

/** Blok dokumentasi konsisten: judul + deskripsi + demo live. */
function DocSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card title={title}>
      <div className="flex flex-col field-gap">
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
    </Card>
  );
}

export default DocSection;
