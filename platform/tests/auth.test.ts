import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {NextAuthConfig} from 'next-auth';
import type {NextRequest} from 'next/server';

const mocked = vi.hoisted(() => ({factory:undefined as unknown as (request?:NextRequest)=>NextAuthConfig, database:{user:{findUnique:vi.fn(),update:vi.fn()},session:{create:vi.fn(),findUnique:vi.fn(),updateMany:vi.fn()}}}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/db',()=>({getDatabase:()=>mocked.database}));
vi.mock('next-auth',()=>({default:(factory:(request?:NextRequest)=>NextAuthConfig)=>{mocked.factory=factory;return {auth:vi.fn(),handlers:{},signIn:vi.fn(),signOut:vi.fn()};}}));
import '@/auth';
import {authConfigurationReady,configuredAuthOrigin,secureAuthCookies} from '@/lib/auth/config';
import {registrationSchema,loginSchema,profileSchema} from '@/lib/auth/schemas';
import {recentPasswordOwnership} from '@/lib/auth/google';
import {readJson} from '@/lib/security/request';
import {generateSecretToken,hashSecretToken} from '@/lib/auth/crypto';
import {resolveSessionToken} from '@/lib/auth/session-records';

beforeEach(()=>{vi.stubEnv('DATABASE_URL','postgresql://local/test');vi.stubEnv('AUTH_SECRET','test-only-secret-'.repeat(4));vi.stubEnv('AUTH_URL','http://localhost:3001');vi.stubEnv('NEXT_PUBLIC_APP_URL','http://localhost:3001');vi.clearAllMocks();});
afterEach(()=>vi.unstubAllEnvs());
const request=(value:unknown,extra:Record<string,string>={})=>new Request('http://localhost:3001/api/account/register',{method:'POST',headers:{Origin:'http://localhost:3001','Content-Type':'application/json',...extra},body:JSON.stringify(value)});
const signup={name:'Test Learner',email:' Learner@Example.com ',password:'  valid-password  ',locale:'ar'};

describe('account input and browser mutation security',()=>{
  it('normalizes emails while preserving meaningful password whitespace',()=>{const parsed=registrationSchema.parse(signup);expect(parsed.email).toBe('learner@example.com');expect(parsed.password).toBe(signup.password);});
  it('rejects mass assignment, weak passwords and arbitrary avatar URLs',()=>{expect(registrationSchema.safeParse({...signup,roles:['administrator']}).success).toBe(false);expect(loginSchema.safeParse({email:'a@example.com',password:'short'}).success).toBe(false);expect(profileSchema.safeParse({name:'Test',preferredLocale:'en',image:'https://tracker.example/image'}).success).toBe(false);});
  it('accepts only bounded same-origin JSON input',async()=>{expect((await readJson(request(signup),registrationSchema)).locale).toBe('ar');});
  it.each(['https://attacker.example','null','http://localhost:3001.evil.example','http://localhost:3001/'])('rejects forged Origin %s',async origin=>{await expect(readJson(request(signup,{Origin:origin}),registrationSchema)).rejects.toMatchObject({code:'FORBIDDEN'});});
  it('rejects missing Origin, cross-site metadata and wrong content type',async()=>{const absent=request(signup);absent.headers.delete('origin');await expect(readJson(absent,registrationSchema)).rejects.toMatchObject({code:'FORBIDDEN'});await expect(readJson(request(signup,{'Sec-Fetch-Site':'cross-site'}),registrationSchema)).rejects.toMatchObject({code:'FORBIDDEN'});await expect(readJson(request(signup,{'Content-Type':'text/plain'}),registrationSchema)).rejects.toMatchObject({code:'INVALID_INPUT'});});
  it('enforces actual streaming body size when Content-Length is omitted',async()=>{await expect(readJson(request({...signup,name:'x'.repeat(9000)}),registrationSchema)).rejects.toMatchObject({status:413});});
  it('creates independent 256-bit tokens and persists only one-way digests',()=>{const first=generateSecretToken();const second=generateSecretToken();expect(first).toMatch(/^[a-f0-9]{64}$/);expect(first).not.toBe(second);expect(hashSecretToken(first)).toHaveLength(64);expect(hashSecretToken(first)).not.toBe(first);});
});

describe('trusted deployment origin',()=>{
  it('fails closed without a secret or valid origin',()=>{vi.stubEnv('AUTH_SECRET','short');expect(authConfigurationReady()).toBe(false);vi.stubEnv('AUTH_SECRET','x'.repeat(32));vi.stubEnv('AUTH_URL','not a url');expect(configuredAuthOrigin()).toBeNull();expect(authConfigurationReady()).toBe(false);});
  it('rejects public insecure production origins and enables secure cookies on canonical HTTPS',()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('AUTH_URL','http://academy.example');expect(authConfigurationReady()).toBe(false);vi.stubEnv('AUTH_URL','HTTPS://academy.example');expect(authConfigurationReady()).toBe(true);expect(secureAuthCookies()).toBe(true);});
});

describe('password-reset revocation and OAuth linking',()=>{
  it('rejects a credential proof made before a password reset even when current user is active',async()=>{mocked.database.user.findUnique.mockResolvedValue({id:'learner',status:'ACTIVE',sessionVersion:1});const callback=mocked.factory().callbacks!.jwt!;const result=await callback({token:{},user:{id:'learner',credentialSessionVersion:0},account:{provider:'credentials',providerAccountId:'learner',type:'credentials'},trigger:'signIn'});expect(result).toBeNull();expect(mocked.database.session.create).not.toHaveBeenCalled();});
  it.each(['revoked','expired','version','suspended'])('rejects %s session anchors on every read',async reason=>{mocked.database.session.findUnique.mockResolvedValue({id:'anchor',userId:'learner',revokedAt:reason==='revoked'?new Date():null,expires:new Date(Date.now()+(reason==='expired'?-1000:10000)),sessionVersion:0,user:{status:reason==='suspended'?'SUSPENDED':'ACTIVE',sessionVersion:reason==='version'?1:0}});await expect(resolveSessionToken({sub:'learner',sessionSecret:'a'.repeat(64),sessionVersion:0})).resolves.toBeNull();});
  it('requires verified ownership and recent password proof for Google account linking',()=>{const now=Date.now();const user={id:'learner',email:'learner@example.com',emailVerified:new Date()};const proof={sub:'learner',authenticationMethod:'credentials' as const,authenticatedAt:now-1000};expect(recentPasswordOwnership(proof,user,user.email,now)).toBe(true);expect(recentPasswordOwnership(null,user,user.email,now)).toBe(false);expect(recentPasswordOwnership({...proof,authenticatedAt:now-601000},user,user.email,now)).toBe(false);expect(recentPasswordOwnership({...proof,authenticationMethod:'google'},user,user.email,now)).toBe(false);expect(recentPasswordOwnership(proof,{...user,emailVerified:null},user.email,now)).toBe(false);expect(recentPasswordOwnership(proof,user,'other@example.com',now)).toBe(false);});
});
