import { ArgumentsHost, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

const hostFor = (request: object, response: object): ArgumentsHost =>
  ({
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  }) as unknown as ArgumentsHost;

const responseDouble = (headersSent: boolean) => {
  const response = { headersSent, status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
};

describe('AllExceptionsFilter', () => {
  // Core Hub puts the access token in the query of /auth/callback.
  const callback = {
    method: 'GET',
    path: '/auth/callback',
    url: '/auth/callback?access_token=token-that-must-not-be-logged&token_type=Bearer',
  };

  let errors: jest.SpyInstance;

  beforeEach(() => {
    errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errors.mockRestore();
  });

  it('logs a failed request by its path, without the query string', () => {
    const response = responseDouble(false);

    new AllExceptionsFilter().catch(new Error('boom'), hostFor(callback, response));

    expect(JSON.parse(errors.mock.calls[0][0] as string)).toMatchObject({
      event: 'request.unhandled_error',
      path: '/auth/callback',
      status: 500,
    });
    expect(JSON.stringify(errors.mock.calls)).not.toContain('token-that-must-not-be-logged');
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('does not write a second response when the handler already sent one', () => {
    const response = responseDouble(true);

    new AllExceptionsFilter().catch(new Error('late'), hostFor(callback, response));

    expect(errors).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
