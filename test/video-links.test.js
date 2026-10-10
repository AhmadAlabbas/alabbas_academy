const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../deploy/hostinger/public_html/app.js'),'utf8');
const line=source.split('\n').find(l=>l.startsWith('function youtubeVideo('));
const context={URL};vm.createContext(context);vm.runInContext(line,context);
const parse=context.youtubeVideo;
 test('YouTube watch, short, shorts and embed URLs normalize to a trusted privacy-enhanced player',()=>{
 for(const url of ['https://www.youtube.com/watch?v=rfscVS0vtbw','https://youtu.be/rfscVS0vtbw','https://www.youtube.com/shorts/rfscVS0vtbw','https://www.youtube-nocookie.com/embed/rfscVS0vtbw'])assert.equal(parse(url).embed,'https://www.youtube-nocookie.com/embed/rfscVS0vtbw?rel=0');
 assert.match(parse('https://youtu.be/rfscVS0vtbw?t=120').embed,/start=120/);
 });
 test('Untrusted hosts, non-HTTPS schemes and invalid IDs do not become iframe URLs',()=>{
 for(const url of ['javascript:alert(1)','http://youtu.be/rfscVS0vtbw','https://youtube.com.example.org/watch?v=rfscVS0vtbw','https://www.youtube.com/watch?v=bad','not a URL'])assert.equal(parse(url),null);
 });
