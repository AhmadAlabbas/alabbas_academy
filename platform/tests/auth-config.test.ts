import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {authConfigurationReady,configuredAuthOrigin,googleConfigurationReady,secureAuthCookies} from '@/lib/auth/config';

beforeEach(()=>{
  vi.stubEnv('NODE_ENV','production');
  vi.stubEnv('DATABASE_URL','postgresql://example.invalid/unused');
  vi.stubEnv('AUTH_SECRET','test-only-origin-validation-secret-12345');
  vi.stubEnv('AUTH_URL','https://academy.example');
  vi.stubEnv('NEXTAUTH_URL',undefined);
  vi.stubEnv('NEXT_PUBLIC_APP_URL','https://public-fallback.example');
  vi.stubEnv('VERCEL_URL','deployment.example');
  vi.stubEnv('GOOGLE_CLIENT_ID','test-only-google-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET','test-only-google-secret');
});
afterEach(()=>vi.unstubAllEnvs());

describe('canonical account origin configuration',()=>{
  it.each([
    'https://academy.example/ar',
    'https://academy.example/api/auth',
    'https://academy.example/?callback=account',
    'https://academy.example/#account',
    'https://academy.example?',
    'https://academy.example#',
    'https://username:password@academy.example',
    'http://academy.example',
  ])('keeps login and Google unavailable for noncanonical AUTH_URL %s',value=>{
    vi.stubEnv('AUTH_URL',value);
    expect(configuredAuthOrigin()).toBeNull();
    expect(authConfigurationReady()).toBe(false);
    expect(googleConfigurationReady()).toBe(false);
    expect(secureAuthCookies()).toBe(false);
  });

  it.each(['https://academy.example','HTTPS://ACADEMY.EXAMPLE/'])('accepts a canonical HTTPS origin %s',value=>{
    vi.stubEnv('AUTH_URL',value);
    expect(configuredAuthOrigin()).toBe('https://academy.example');
    expect(authConfigurationReady()).toBe(true);
    expect(googleConfigurationReady()).toBe(true);
    expect(secureAuthCookies()).toBe(true);
  });

  it.each(['','not a URL','https://academy.example/ar'])('does not hide invalid AUTH_URL behind a valid public fallback: %s',value=>{
    vi.stubEnv('AUTH_URL',value);
    expect(configuredAuthOrigin()).toBeNull();
    expect(authConfigurationReady()).toBe(false);
  });

  it('validates the public origin when AUTH_URL is absent',()=>{
    vi.stubEnv('AUTH_URL',undefined);
    expect(configuredAuthOrigin()).toBe('https://public-fallback.example');
    vi.stubEnv('NEXT_PUBLIC_APP_URL','https://public-fallback.example/ar');
    expect(authConfigurationReady()).toBe(false);
  });

  it('uses the platform hostname only when both application origins are absent',()=>{
    vi.stubEnv('AUTH_URL',undefined);
    vi.stubEnv('NEXT_PUBLIC_APP_URL',undefined);
    expect(configuredAuthOrigin()).toBe('https://deployment.example');
    vi.stubEnv('VERCEL_URL','deployment.example/ar');
    expect(authConfigurationReady()).toBe(false);
  });

  it.each(['','https://public-fallback.example/ar','https://other-academy.example','https://public-fallback.example#'])('rejects a legacy alias that disagrees with the selected origin: %s',value=>{
    vi.stubEnv('AUTH_URL',undefined);
    vi.stubEnv('NEXTAUTH_URL',value);
    expect(configuredAuthOrigin()).toBeNull();
    expect(authConfigurationReady()).toBe(false);
  });

  it('allows an equivalent canonical legacy alias and ignores it when AUTH_URL is configured',()=>{
    vi.stubEnv('AUTH_URL',undefined);
    vi.stubEnv('NEXTAUTH_URL','HTTPS://PUBLIC-FALLBACK.EXAMPLE/');
    expect(configuredAuthOrigin()).toBe('https://public-fallback.example');
    expect(authConfigurationReady()).toBe(true);
    vi.stubEnv('AUTH_URL','https://academy.example');
    vi.stubEnv('NEXTAUTH_URL','https://legacy.example/ar');
    expect(configuredAuthOrigin()).toBe('https://academy.example');
    expect(authConfigurationReady()).toBe(true);
  });

  it('rejects the path that the installed Auth.js release treats as its API base path',()=>{
    const projectDirectory=fileURLToPath(new URL('../',import.meta.url));
    const output=execFileSync(process.execPath,['--import','tsx','--eval',`
      const path=require('node:path');
      const {setEnvDefaults}=require(path.join(path.dirname(require.resolve('next-auth/package.json')),'lib/env.js'));
      const {createActionURL}=require('@auth/core');
      const cases=[
        {AUTH_URL:'https://academy.example/ar'},
        {AUTH_URL:'https://academy.example'},
        {NEXTAUTH_URL:'https://public-fallback.example/ar'},
        {NEXTAUTH_URL:'https://public-fallback.example'},
      ];
      const results=cases.map(values=>{
        for (const key of ['AUTH_URL','NEXTAUTH_URL']) {
          delete process.env[key];
          if (values[key] !== undefined) process.env[key]=values[key];
        }
        const configuration={providers:[]};
        setEnvDefaults(configuration);
        return {basePath:configuration.basePath,actionPath:createActionURL('signin','https',new Headers(),process.env,configuration).pathname};
      });
      process.stdout.write(JSON.stringify(results));
    `],{cwd:projectDirectory,encoding:'utf8',env:{...process.env,AUTH_URL:'https://academy.example/ar'}});
    expect(JSON.parse(output)).toEqual([
      {basePath:'/ar',actionPath:'/ar/signin'},
      {basePath:'/api/auth',actionPath:'/api/auth/signin'},
      {basePath:'/ar',actionPath:'/ar/signin'},
      {basePath:'/api/auth',actionPath:'/api/auth/signin'},
    ]);
    vi.stubEnv('AUTH_URL','https://academy.example/ar');
    expect(authConfigurationReady()).toBe(false);
    vi.stubEnv('AUTH_URL',undefined);
    vi.stubEnv('NEXTAUTH_URL','https://public-fallback.example/ar');
    expect(authConfigurationReady()).toBe(false);
  });
});
