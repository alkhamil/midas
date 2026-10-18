// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { useTranslation } from 'react-i18next';
import { Badge, Button, PageHeader } from '@midas/ui-cms';

function UserViewPage() {
  const { t } = useTranslation();
  return (
    <div data-testid="user-view-page">
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '24px', padding: '24px 24px 24px 24px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-surface, #F8FAFC)', minHeight: '332px' }}>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '0px', padding: '0px 0px 0px 0px', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <PageHeader title="Detail User" description="Informasi akun" />
          </div>
          <div style={{ height: '40px', flexShrink: 0 }}>
            <Button variant="secondary" size="md" disabled={false}>{t('user.view.t1')}</Button>
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '16px', padding: '20px 20px 20px 20px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-background, #FFFFFF)', borderStyle: 'solid', borderColor: 'var(--theme-border, #E2E8F0)', borderWidth: '1px 1px 1px 1px', borderRadius: '8px', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-muted-foreground, #64748B)', width: '160px', flexShrink: 0 }}>{t('user.view.t2')}</p>
            <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-foreground, #0F172A)', flex: '1 1 0', minWidth: 0 }}>{t('user.view.t3')}</p>
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-muted-foreground, #64748B)', width: '160px', flexShrink: 0 }}>{t('user.view.t4')}</p>
            <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-foreground, #0F172A)', flex: '1 1 0', minWidth: 0 }}>{t('user.view.t5')}</p>
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-muted-foreground, #64748B)', width: '160px', flexShrink: 0 }}>{t('user.view.t6')}</p>
            <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-foreground, #0F172A)', flex: '1 1 0', minWidth: 0 }}>{t('user.view.t7')}</p>
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-muted-foreground, #64748B)', width: '160px', flexShrink: 0 }}>{t('user.view.t8')}</p>
            <div style={{ flexShrink: 0 }}>
              <Badge variant="success">{t('user.view.t9')}</Badge>
            </div>
          </div>
          <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 400, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-muted-foreground, #64748B)', width: '160px', flexShrink: 0 }}>{t('user.view.t10')}</p>
            <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: '20px', textAlign: 'left', whiteSpace: 'pre-wrap', margin: 0, color: 'var(--theme-foreground, #0F172A)', flex: '1 1 0', minWidth: 0 }}>{t('user.view.t11')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserViewPage;
