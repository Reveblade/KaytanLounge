import { assertMongoUriForRuntime, resolveBindAddress } from './configuration';

describe('resolveBindAddress', () => {
  it('keeps localhost binds in development', () => {
    expect(resolveBindAddress({ NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '3300' })).toEqual({
      host: '127.0.0.1',
      port: 3300,
    });
  });

  it('ignores HOST=127.0.0.1 when Cloud Run injects K_SERVICE', () => {
    expect(
      resolveBindAddress({
        K_SERVICE: 'backend',
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '3300',
      }),
    ).toEqual({ host: '0.0.0.0', port: 8080 });
  });

  it('uses Cloud Run PORT when it is not the local default', () => {
    expect(resolveBindAddress({ K_SERVICE: 'backend', PORT: '8080' })).toEqual({
      host: '0.0.0.0',
      port: 8080,
    });
  });
});

describe('assertMongoUriForRuntime', () => {
  it('allows localhost URIs in development', () => {
    expect(() =>
      assertMongoUriForRuntime('mongodb://127.0.0.1:27017', { NODE_ENV: 'development' }),
    ).not.toThrow();
  });

  it('rejects Atlas placeholders and localhost on Cloud Run', () => {
    const env = { K_SERVICE: 'backend', NODE_ENV: 'production' };
    expect(() =>
      assertMongoUriForRuntime(
        'mongodb+srv://<yildizreve_db_user>:secret@cluster.mongodb.net/',
        env,
      ),
    ).toThrow(/placeholder/);
    expect(() => assertMongoUriForRuntime('mongodb://127.0.0.1:27017', env)).toThrow(/localhost/);
  });
});
