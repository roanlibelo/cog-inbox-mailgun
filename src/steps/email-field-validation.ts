/*tslint:disable:no-else-after-return*/

import { BaseStep, Field, StepInterface } from '../core/base-step';
import { Step, FieldDefinition, StepDefinition } from '../proto/cog_pb';
import { Email, Inbox } from '../models';

export class EmailFieldValidationStep extends BaseStep implements StepInterface {
  private operators: string[] = ['should contain', 'should not contain', 'should be'];

  protected stepName: string = 'Check the content of an email';
  // tslint:disable-next-line:max-line-length
  protected stepExpression: string = 'the (?<field>(subject|body-html|body-plain|from)) of the (?<position>\\d+)(?:(st|nd|rd|th))? mailgun email for (?<email>.+) (?<operator>(should contain|should not contain|should be)) (?<expectation>.+)';
  protected stepType: StepDefinition.Type = StepDefinition.Type.VALIDATION;
  protected expectedFields: Field[] = [{
    field: 'email',
    type: FieldDefinition.Type.EMAIL,
    description: 'The inbox\'s email address',
  }, {
    field: 'position',
    type: FieldDefinition.Type.NUMERIC,
    description: 'The nth message to check from the email\'s inbox',
  }, {
    field: 'field',
    type: FieldDefinition.Type.STRING,
    description: 'Field name to check',
  }, {
    field: 'operator',
    type: FieldDefinition.Type.STRING,
    description: 'The operator to use when performing the validation. Current supported values are: should contain, should not contain, and should be',
  }, {
    field: 'expectation',
    type: FieldDefinition.Type.ANYSCALAR,
    description: 'Expected field value',
  }];

  async executeStep(step: Step) {
    const stepData: any = step.getData() ? step.getData().toJavaScript() : {};
    const expectation = stepData.expectation;
    const field = stepData.field;
    // tslint:disable-next-line:radix
    const position = parseInt(stepData.position) || 1;
    const operator = stepData.operator;

    try {
      const domain: string = stepData.email.split('@')[1];
      const authDomain: string = this.client.auth.get('domain').toString();

      if (domain !== authDomain) {
        return this.error('Can\'t check inbox for %s: email domain doesn\'t match %s', [
          stepData.email,
          authDomain,
        ]);
      }

      const inbox: Inbox = await this.client.getInbox(stepData.email);

      if (!inbox || inbox === null) {
        return this.error('Cannot fetch inbox for: %s', [
          stepData.email,
        ]);
      }

      if (inbox['message']) {
        return this.error(inbox['message']);
      }

      if (!inbox.items[position - 1]) {
        return this.error('Cannot fetch email in position: %s', [
          position,
        ]);
      }

      const storageUrl: string = inbox.items.reverse()[position - 1].storage.url;
      const email: Email = await this.client.getEmailByStorageUrl(storageUrl);

      if (email === null || !email) {
        return this.error('Cannot fetch email in position: %s', [
          position,
        ]);
      }

      if (this.executeComparison(expectation, email[field], operator)) {
        return this.pass('Check on email %s passed: %s %s "%s"', [
          field,
          field,
          operator,
          expectation,
        ]);
      } else {
        return this.fail('Check on email %s failed: %s %s "%s", but it was actually %s', [
          field,
          field,
          operator,
          expectation,
          email[field],
        ]);
      }
    } catch (e) {
      return this.error('There was an error retrieving email messages: %s', [e.toString()]);
    }
  }

  executeComparison(expected: string, actual: string, operator: string): boolean {
    let result: boolean = false;
    if (actual === undefined) {
      return false;
    }

    if (operator === 'should be') {
      result = expected === actual;
    } else if (operator === 'should contain') {
      result = actual.toLowerCase().includes(expected.toLowerCase());
    } else if (operator === 'should not contain') {
      result = !actual.toLowerCase().includes(expected.toLowerCase());
    }

    return result;
  }
}

export { EmailFieldValidationStep as Step };
