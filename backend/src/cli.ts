import 'reflect-metadata';
import { CommandFactory } from 'nest-commander';
import {
  AdminProvisioningError,
} from './cli/admin-provisioning/admin-provisioning.service';
import { CliModule } from './cli/cli.module';

/** Removes the package-manager separator before Commander parses CLI arguments. */
function normalizePackageManagerArguments(): void {
  if (process.argv[2] === '--') {
    process.argv.splice(2, 1);
  }
}

/** Replaces Commander diagnostics so mistyped secret-like options are not echoed. */
function outputSafeCommanderError(
  _message: string,
  write: (message: string) => void,
): void {
  write('Invalid command options. Run with --help for usage.\n');
}

/** Reports a bounded CLI failure without leaking database or credential details. */
function reportCliError(error: unknown): void {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('commander.')
  ) {
    process.exitCode =
      'exitCode' in error && typeof error.exitCode === 'number'
        ? error.exitCode
        : 1;
    return;
  }
  const message =
    error instanceof AdminProvisioningError
      ? error.message
      : 'Admin command failed.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

/** Boots and closes the lightweight Nest command application context. */
async function bootstrap(): Promise<void> {
  try {
    await CommandFactory.run(CliModule, {
      cliName: 'tijaratk-admin',
      logger: ['error'],
      errorHandler: (error) => {
        throw error;
      },
      serviceErrorHandler: reportCliError,
      outputConfiguration: {
        outputError: outputSafeCommanderError,
      },
    });
  } catch (error) {
    reportCliError(error);
  }
}

normalizePackageManagerArguments();
void bootstrap();
