const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const dataDir=process.env.ACADEMY_DATA_DIR||path.join(root,'data');
fs.mkdirSync(dataDir,{recursive:true});
const dbpath = path.join(dataDir,'db.json');
const initial = {users:[],courses:[
 {id:'design',title:'The fundamentals of UI design',category:'Design',level:'Beginner',price:49,instructor:'Sarah Mitchell',description:'Turn your ideas into intuitive digital experiences. Learn visual hierarchy, typography, and the principles behind interfaces people love.',color:'#e9e9e6',art:'design',duration:'8 hours',lessons:[{title:'Seeing like a designer',video:'',notes:'Welcome! Start by observing the interfaces you use every day. Identify hierarchy, spacing, and contrast.',files:[]}],exam:[{question:'What helps establish visual hierarchy?',options:['Contrast and scale','Using every color','Removing all spacing'],answer:0}]},
 {id:'code',title:'Python for curious minds',category:'Technology',level:'Beginner',price:39,instructor:'Omar Hassan',description:'Build a practical foundation in programming, one small project at a time. No previous experience needed.',color:'#e4e8e6',art:'code',duration:'12 hours',lessons:[{title:'Your first lines of Python',video:'',notes:'Python uses print() to display text. Try print("Hello, world!") in a Python interpreter.',files:[]}],exam:[{question:'Which function displays output in Python?',options:['print()','show()','echo()'],answer:0}]},
 {id:'business',title:'Build a business that lasts',category:'Business',level:'All levels',price:59,instructor:'Daniel Brooks',description:'From finding your audience to shaping your first offer, develop the confidence to start something of your own.',color:'#ede8e0',art:'business',duration:'6 hours',lessons:[{title:'Start with a real problem',video:'',notes:'Interview potential customers before designing your solution. Listen for repeated problems.',files:[]}],exam:[{question:'What should you validate first?',options:['Customer needs','Your logo','Office furniture'],answer:0}]},
 {id:'photo',title:'Photography beyond the basics',category:'Creative',level:'Intermediate',price:45,instructor:'Lina Ahmed',description:'Find your perspective. Master light, composition, and storytelling to create photographs with intention.',color:'#e6e6e8',art:'photo',duration:'10 hours',lessons:[{title:'Learning to read light',video:'',notes:'Compare soft window light with direct sunlight. Notice how shadows change the mood.',files:[]}],exam:[{question:'Which produces softer shadows?',options:['A large diffused light source','A small direct light','No light'],answer:0}]}
]};
const legacyCourses=initial.courses;
initial.courses=JSON.parse(fs.readFileSync(path.join(root,'deploy/hostinger/seed.json'),'utf8'));
let db = fs.existsSync(dbpath)?JSON.parse(fs.readFileSync(dbpath)):initial;
const {isDeepStrictEqual}=require('node:util');
for(const sample of initial.courses){
 const c=db.courses.find(c=>c.id===sample.id),original=legacyCourses.find(c=>c.id===sample.id);
 if(!c||!original)continue;
 if(isDeepStrictEqual(c.lessons,original.lessons)){c.lessons=sample.lessons;c.preview=sample.preview;c.sample=true;if(c.duration===original.duration)c.duration=sample.duration;}
 if(isDeepStrictEqual(c.exam,original.exam))c.exam=sample.exam;
 if(c.color===original.color)c.color=sample.color;
}
const save=()=>fs.writeFileSync(dbpath,JSON.stringify(db,null,2));
save();
const sessions = new Map();
const hash=(password,salt)=>crypto.scryptSync(password,salt,64).toString('hex');
const safeUser=u=>u?{id:u.id,name:u.name,email:u.email,role:u.role,enrolled:u.enrolled}:null;
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost');
 const token=(req.headers.cookie||'').match(/(?:^|; )session=([^;]+)/)?.[1];
 const session=sessions.get(token);const user=session&&session.expires>Date.now()?db.users.find(u=>u.id===session.id):null;
 if(url.pathname.startsWith('/api/')){
 if(['POST','PUT','DELETE'].includes(req.method)&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return send(res,403,{error:'Request origin is not allowed.'});
 let body={};if(['POST','PUT'].includes(req.method)){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000000)return send(res,413,{error:'File too large (maximum 14 MB).'});}body=JSON.parse(raw||'{}');}
 if(url.pathname==='/api/me')return send(res,200,{user:safeUser(user)});
 if(url.pathname==='/api/signup'&&req.method==='POST'){
 const email=String(body.email||'').trim().toLowerCase();
 if(!body.name?.trim()||!/^\S+@\S+\.\S+$/.test(email)||String(body.password||'').length<8)return send(res,400,{error:'Enter a name, valid email, and password of at least 8 characters.'});
 if(db.users.some(u=>u.email===email))return send(res,409,{error:'This email is already registered.'});
 const salt=crypto.randomBytes(16).toString('hex');const u={id:crypto.randomUUID(),name:body.name.trim(),email,salt,password:hash(body.password,salt),role:db.users.length?'student':'admin',enrolled:[]};db.users.push(u);save();const t=crypto.randomBytes(32).toString('hex');sessions.set(t,{id:u.id,expires:Date.now()+86400000});res.setHeader('Set-Cookie',`session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);return send(res,201,{user:safeUser(u)});
 }
 if(url.pathname==='/api/login'&&req.method==='POST'){const u=db.users.find(u=>u.email===String(body.email||'').trim().toLowerCase());if(!u||!crypto.timingSafeEqual(Buffer.from(u.password,'hex'),Buffer.from(hash(String(body.password||''),u.salt),'hex')))return send(res,401,{error:'Email or password is incorrect.'});const t=crypto.randomBytes(32).toString('hex');sessions.set(t,{id:u.id,expires:Date.now()+86400000});res.setHeader('Set-Cookie',`session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);return send(res,200,{user:safeUser(u)});}
 if(url.pathname==='/api/logout'){sessions.delete(token);res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
 if(url.pathname==='/api/courses'&&req.method==='GET')return send(res,200,{courses:db.courses.map(c=>({...c,lessons:c.lessons.map(l=>user&&(user.role==='admin'||user.enrolled.includes(c.id))?l:{title:l.title}),exam:c.exam.map(({answer,explanation,...q})=>q)}))});
 if(url.pathname==='/api/admin/courses'){if(user?.role!=='admin')return send(res,403,{error:'Admin access required.'});if(req.method==='GET')return send(res,200,{courses:db.courses});if(req.method==='POST'||req.method==='PUT'){const c=body.course;if(!c?.title?.trim()||!Array.isArray(c.lessons)||!Array.isArray(c.exam)||!Number.isFinite(Number(c.price))||Number(c.price)<0)return send(res,400,{error:'A title, valid price, lessons and exam are required.'});c.id=c.id||crypto.randomUUID();c.price=Number(c.price);const i=db.courses.findIndex(x=>x.id===c.id);if(i<0)db.courses.push(c);else db.courses[i]=c;save();return send(res,200,{course:c});}}
 if(url.pathname==='/api/enroll'&&req.method==='POST'){if(!user)return send(res,401,{error:'Please log in to enroll.'});if(!db.courses.some(c=>c.id===body.id))return send(res,404,{error:'Course not found.'});if(!user.enrolled.includes(body.id))user.enrolled.push(body.id);save();return send(res,200,{user:safeUser(user)});}
 if(url.pathname==='/api/exam'&&req.method==='POST'){if(!user||(!user.enrolled.includes(body.id)&&user.role!=='admin'))return send(res,403,{error:'Enroll to take this exam.'});const c=db.courses.find(c=>c.id===body.id);if(!c||!c.exam.length)return send(res,400,{error:'No exam available.'});if(!Array.isArray(body.answers)||body.answers.length!==c.exam.length||body.answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=c.exam[i].options.length))return send(res,400,{error:'Answer every question before submitting.'});const score=c.exam.reduce((s,q,i)=>s+(body.answers[i]===q.answer?1:0),0);return send(res,200,{score,total:c.exam.length,review:c.exam.map((q,i)=>({correct:body.answers[i]===q.answer,answer:q.options[q.answer],explanation:q.explanation||''}))});}
 return send(res,404,{error:'Not found.'});
 }
 const filename=url.pathname==='/'?'/index.html':url.pathname;const target=path.resolve(root,'public','.'+filename);if(!target.startsWith(path.join(root,'public')+path.sep))return send(res,403,{error:'Forbidden'});if(!fs.existsSync(target)){res.writeHead(404);return res.end('Not found');}res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res);
 }catch(e){send(res,500,{error:'Unable to complete request.'});}
});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Alabbas Academy running on port '+(process.env.PORT||3000)));
