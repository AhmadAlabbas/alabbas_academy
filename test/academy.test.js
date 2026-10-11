const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
test('signup, permissions, course editing, enrollment and exam scoring',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'academy-test-'));
 const child=spawn(process.execPath,['legacy-server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:'3011',ACADEMY_DATA_DIR:dir}});
 try{
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',c=>reject(Error('Server exited '+c)));});
 const call=async(route,body,cookie)=>{const r=await fetch('http://localhost:3011/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 assert.equal((await fetch('http://localhost:3011/')).status,200);
 assert.equal((await call('admin/courses')).status,403);
 const a=await call('signup',{name:'Admin',email:'admin@example.com',password:'secure-password'});assert.equal(a.status,201);assert.equal(a.data.user.role,'admin');
 const s=await call('signup',{name:'Student',email:'student@example.com',password:'student-password'});assert.equal(s.data.user.role,'student');
 assert.equal((await call('login',{email:'student@example.com',password:'wrong'})).status,401);
 assert.equal((await call('admin/courses',null,s.cookie)).status,403);
 const course={title:'Test course',category:'Design',level:'Beginner',price:10,instructor:'Admin',duration:'1 hour',description:'Test',lessons:[{title:'Lesson',notes:'Learning content',video:'',files:[]}],exam:[{question:'Correct?',options:['Yes','No','Maybe'],answer:0}]};
 const saved=await call('admin/courses',{course},a.cookie);assert.equal(saved.status,200);const id=saved.data.course.id;
 let catalog=await call('courses',null,s.cookie);let c=catalog.data.courses.find(c=>c.id===id);assert.equal(c.lessons[0].notes,undefined);assert.equal(c.exam[0].answer,undefined);
 assert.equal((await call('exam',{id,answers:[0]},s.cookie)).status,403);
 assert.equal((await call('enroll',{id},s.cookie)).status,200);
 catalog=await call('courses',null,s.cookie);assert.equal(catalog.data.courses.find(c=>c.id===id).lessons[0].notes,'Learning content');
 assert.deepEqual((await call('exam',{id,answers:[0]},s.cookie)).data,{score:1,total:1,review:[{correct:true,answer:'Yes',explanation:''}]});
 assert.deepEqual((await call('exam',{id,answers:[1]},s.cookie)).data,{score:0,total:1,review:[{correct:false,answer:'Yes',explanation:''}]});
 assert.equal((await call('exam',{id,answers:[]},s.cookie)).status,400);
 const persisted=JSON.parse(fs.readFileSync(path.join(dir,'db.json')));assert.equal(persisted.users[1].enrolled[0],id);assert.notEqual(persisted.users[1].password,'student-password');
 await call('logout',{},s.cookie);assert.equal((await call('me',null,s.cookie)).data.user,null);
 }finally{child.kill();fs.rmSync(dir,{recursive:true,force:true});}
});
