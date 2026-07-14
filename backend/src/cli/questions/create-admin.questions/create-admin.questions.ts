import { Question, QuestionSet, ValidateFor } from 'nest-commander';
import {
  validateAdminPassword,
} from '../../admin-provisioning/admin-provisioning.service';

export type CreateAdminAnswers = {
  password: string;
  passwordConfirmation: string;
};

/** Defines masked password prompts for administrator creation. */
@QuestionSet({ name: 'create-admin' })
export class CreateAdminQuestions {
  /** Preserves the password after interactive policy validation. */
  @Question({
    type: 'password',
    name: 'password',
    message: 'Admin password:',
    mask: '*',
    validate: (value: string) => validateAdminPassword(value) ?? true,
  })
  parsePassword(value: string): string {
    return value;
  }

  /** Preserves a masked confirmation after matching it to the password. */
  @Question({
    type: 'password',
    name: 'passwordConfirmation',
    message: 'Confirm admin password:',
    mask: '*',
  })
  parsePasswordConfirmation(value: string): string {
    return value;
  }

  /** Ensures the confirmation exactly matches the first masked password. */
  @ValidateFor({ name: 'passwordConfirmation' })
  validatePasswordConfirmation(
    value: string,
    answers: CreateAdminAnswers,
  ): boolean | string {
    return (
      value === answers.password || 'Password confirmation does not match.'
    );
  }
}
