import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Dialog, useToast } from '../../../shared/components/ui';
import type { GeneratedFile, GeneratorConfig, ModuleRegistration } from '../types';
import { definitionToConfig } from '../engine/fromDefinition';
import { GeneratorConfigError, generateModule } from '../engine/moduleGenerator';
import { buildRegistration } from '../engine/registration';
import {
  WriteConflictError,
  WriteEndpointUnavailableError,
  writeModuleToRepo,
} from '../api/writeToRepo';
import type { ModuleDefinition } from '../definitions';
import OutputPanel from './OutputPanel';

interface GenerateDialogProps {
  def: ModuleDefinition;
  onClose: () => void;
}

type WriteStatus =
  | { state: 'idle' }
  | { state: 'writing' }
  | { state: 'written'; count: number; registered: { routes: number; navigation: boolean } | null }
  | { state: 'conflict'; existing: string[] }
  | { state: 'failed'; message: string };

function GenerateDialog({ def, onClose }: GenerateDialogProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [writeStatus, setWriteStatus] = useState<WriteStatus>({ state: 'idle' });

  const generated = useMemo((): {
    files: GeneratedFile[];
    config: GeneratorConfig;
    registration: ModuleRegistration;
  } | { error: string } => {
    try {
      const config = definitionToConfig(def);
      return {
        files: generateModule(config),
        config,
        registration: buildRegistration(config),
      };
    } catch (err) {
      return {
        error:
          err instanceof GeneratorConfigError
            ? err.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
            : t('generate.generateFailed'),
      };
    }
  }, [def]);

  async function writeFiles(
    files: GeneratedFile[],
    overwrite: boolean,
    registration: ModuleRegistration,
  ): Promise<void> {
    setWriteStatus({ state: 'writing' });
    try {
      const result = await writeModuleToRepo(files, overwrite, registration);
      setWriteStatus({
        state: 'written',
        count: result.written.length,
        registered: result.registered,
      });
      const reg = result.registered;
      showToast({
        variant: 'success',
        message:
          reg && (reg.routes > 0 || reg.navigation)
            ? t('generate.writtenRegistered', { count: result.written.length })
            : t('generate.written', { count: result.written.length }),
      });
    } catch (err) {
      if (err instanceof WriteConflictError) {
        setWriteStatus({ state: 'conflict', existing: err.existing });
      } else if (err instanceof WriteEndpointUnavailableError) {
        setWriteStatus({ state: 'failed', message: err.message });
      } else {
        setWriteStatus({
          state: 'failed',
          message: err instanceof Error ? err.message : t('generate.writeFailed'),
        });
      }
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('generate.title', { label: def.label })}
      maxWidth="2xl"
      testId="generate-dialog"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          {'files' in generated && (
            <Button
              disabled={writeStatus.state === 'writing'}
              onClick={() => void writeFiles(generated.files, false, generated.registration)}
            >
              {writeStatus.state === 'writing'
                ? t('generate.writing')
                : t('generate.writeRepo', { count: generated.files.length })}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col stack-gap">
        {'error' in generated ? (
          <Alert variant="error" message={generated.error} />
        ) : (
          <>
            {writeStatus.state === 'writing' && (
              <Alert variant="info" message={t('generate.writingFiles')} />
            )}
            {writeStatus.state === 'written' && (
              <Alert
                variant="success"
                message={`${t('generate.writtenDone', { count: writeStatus.count })}${
                  writeStatus.registered &&
                  (writeStatus.registered.routes > 0 || writeStatus.registered.navigation)
                    ? ` ${t('generate.registeredAuto', { count: writeStatus.registered.routes })}`
                    : ` ${t('generate.registeredBefore')}`
                }`}
              />
            )}
            {writeStatus.state === 'failed' && (
              <Alert
                variant="warning"
                message={`${writeStatus.message} ${t('generate.manualFallback')}`}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {t('generate.devOnlyNote')}
            </p>
            <OutputPanel files={generated.files} config={generated.config} onBack={onClose} />
          </>
        )}
      </div>
      <Dialog
        testId="generate-overwrite-dialog"
        open={writeStatus.state === 'conflict'}
        onClose={() => setWriteStatus({ state: 'idle' })}
        title={t('generate.conflictTitle')}
        maxWidth="md"
        closeOnEscape
        closeOnBackdropClick
        footer={
          <>
            <Button variant="secondary" onClick={() => setWriteStatus({ state: 'idle' })}>
              {t('common.cancel')}
            </Button>
            {'files' in generated && (
              <Button
                onClick={() => void writeFiles(generated.files, true, generated.registration)}
              >
                {t('generate.overwriteAll')}
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm text-foreground">
          {t('generate.conflictBody', { count: writeStatus.state === 'conflict' ? writeStatus.existing.length : 0 })}
        </p>
        {writeStatus.state === 'conflict' && (
          <ul className="mt-2 max-h-48 list-disc overflow-y-auto pl-5 font-mono text-xs text-foreground">
            {writeStatus.existing.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        )}
      </Dialog>
    </Dialog>
  );
}

export default GenerateDialog;
