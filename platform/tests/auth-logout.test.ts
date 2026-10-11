import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const mocked=vi.hoisted(()=>({getToken:vi.fn(),revoke:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('next-auth/jwt',()=>({getToken:mocked.getToken}));
vi.mock('@/lib/auth/session-records',()=>({revokeSessionToken:mocked.revoke}));
import {POST} from '@/app/api/account/logout/route';
beforeEach(()=>{vi.stubEnv('DATABASE_URL','postgresql://local/test');vi.stubEnv('AUTH_SECRET','test-only-secret'.repeat(4));vi.stubEnv('AUTH_URL','http://localhost:3001');vi.clearAllMocks();mocked.getToken.mockResolvedValue({sessionSecret:'a'.repeat(64)});mocked.revoke.mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllEnvs());
const request=(origin='http://localhost:3001')=>new Request('http://localhost:3001/api/account/logout',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
describe('durable logout guard',()=>{
 it('waits for anchor revocation before reporting success and leaves cookie clearing to Auth.js',async()=>{let release:()=>void=()=>{};mocked.revoke.mockImplementation(()=>new Promise<void>(resolve=>{release=resolve;}));const pending=POST(request());await vi.waitFor(()=>expect(mocked.revoke).toHaveBeenCalled());let resolved=false;void pending.then(()=>{resolved=true;});expect(resolved).toBe(false);release();const response=await pending;expect(await response.json()).toEqual({ok:true,code:'SIGNED_OUT'});expect(response.headers.has('set-cookie')).toBe(false);});
 it('reports database failure before the client can clear its cookie',async()=>{mocked.revoke.mockRejectedValue(new Error('private database detail'));const response=await POST(request());expect(response.status).toBe(503);expect(await response.json()).toEqual({ok:false,code:'SERVICE_UNAVAILABLE'});expect(response.headers.has('set-cookie')).toBe(false);});
 it('rejects foreign origins before decoding or mutating a session',async()=>{const response=await POST(request('https://attacker.example'));expect(response.status).toBe(403);expect(mocked.getToken).not.toHaveBeenCalled();expect(mocked.revoke).not.toHaveBeenCalled();});
});
