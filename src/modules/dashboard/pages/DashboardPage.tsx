// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { useTranslation } from 'react-i18next';
import { Alert, Button, PageHeader, StatCard, Table } from '@midas/ui-cms';

function DashboardPage() {
  const { t } = useTranslation();
  return (
    <div data-testid="dashboard-custom-page">
      <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '24px', padding: '24px 24px 24px 24px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-surface, #F8FAFC)', minHeight: '684px' }}>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '0px', padding: '0px 0px 0px 0px', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <PageHeader title="Dashboard" description="Ringkasan aktivitas aplikasi" />
          </div>
          <div style={{ height: '40px', flexShrink: 0 }}>
            <Button variant="secondary" size="md" disabled={false}>{t('dashboard.dashboard.t1')}</Button>
          </div>
        </div>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', gap: '16px', padding: '0px 0px 0px 0px', justifyContent: 'flex-start', alignItems: 'flex-start', alignSelf: 'stretch', flexShrink: 0 }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <StatCard trend="up" label="Total user" value="1.248" caption="12% dari bulan lalu" />
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <StatCard trend="up" label="User aktif" value="1.032" caption="83% dari total" />
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <StatCard trend="neutral" label="Role" value="4" caption="Tidak berubah" />
          </div>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <StatCard trend="down" label="Menunggu verifikasi" value="47" caption="5 lebih banyak dari kemarin" />
          </div>
        </div>
        <div style={{ alignSelf: 'stretch' }}>
          <Alert variant="warning" message="47 user menunggu verifikasi email." />
        </div>
        <div style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: '16px', padding: '20px 20px 20px 20px', justifyContent: 'flex-start', alignItems: 'flex-start', background: 'var(--theme-background, #FFFFFF)', borderStyle: 'solid', borderColor: 'var(--theme-border, #E2E8F0)', borderWidth: '1px 1px 1px 1px', borderRadius: '8px', alignSelf: 'stretch', flexShrink: 0 }}>
          <p style={{ fontSize: '18px', fontWeight: 600, lineHeight: '28px', textAlign: 'left', whiteSpace: 'nowrap', margin: 0, color: 'var(--theme-foreground, #0F172A)', flexShrink: 0 }}>{t('dashboard.dashboard.t2')}</p>
          <div style={{ alignSelf: 'stretch' }}>
            <Table columns={[]} data={[]} rowKey={(_row, index) => index} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
