// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { useTranslation } from 'react-i18next';
import { Badge, Button, PageHeader } from '@midas/ui-cms';

function RoleViewPage() {
  const { t } = useTranslation();
  return (
    <div data-testid="role-view-page">
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '24px', padding: '24px 24px 24px 24px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-surface, #F8FAFC)', minHeight: '296px' }}>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '0px', padding: '0px 0px 0px 0px', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <PageHeader title="Detail Role" description="Informasi role" />
          </div>
          <div style={{ height: '40px', flexShrink: 0 }}>
            <Button variant="secondary" size="md" disabled={false}>{t('role.view.t1')}</Button>
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '16px', padding: '20px 20px 20px 20px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-background, #FFFFFF)', borderStyle: 'solid', borderColor: 'var(--theme-border, #E2E8F0)', borderWidth: '1px 1px 1px 1px', borderRadius: '8px', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-muted-foreground, #64748B)', width: '160px', flexShrink: 0 }}>{t('role.view.t2')}</p>
            <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-foreground, #0F172A)', flex: '1 1 0', minWidth: 0 }}>{t('role.view.t3')}</p>
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-muted-foreground, #64748B)', width: '160px', flexShrink: 0 }}>{t('role.view.t4')}</p>
            <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-foreground, #0F172A)', flex: '1 1 0', minWidth: 0 }}>{t('role.view.t5')}</p>
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-muted-foreground, #64748B)', width: '160px', flexShrink: 0 }}>{t('role.view.t6')}</p>
            <div style={{ flexShrink: 0 }}>
              <Badge variant="success">{t('role.view.t7')}</Badge>
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-muted-foreground, #64748B)', width: '160px', flexShrink: 0 }}>{t('role.view.t8')}</p>
            <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-foreground, #0F172A)', flex: '1 1 0', minWidth: 0 }}>{t('role.view.t9')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoleViewPage;
