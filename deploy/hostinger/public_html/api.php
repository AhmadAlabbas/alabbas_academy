<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
try {
    initialize_session();
    $method=$_SERVER['REQUEST_METHOD'];
    if (in_array($method,['POST','PUT','DELETE'],true)&&!empty($_SERVER['HTTP_ORIGIN'])&&(parse_url($_SERVER['HTTP_ORIGIN'],PHP_URL_HOST)!==explode(':',$_SERVER['HTTP_HOST'])[0])) respond(403,['error'=>'Request origin is not allowed.']);
    $path=trim(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),'/');
    $body=[];
    if(in_array($method,['POST','PUT'],true)) {
        if((int)($_SERVER['CONTENT_LENGTH']??0)>20000000) respond(413,['error'=>'Request exceeds the 14 MB resource limit.']);
        $raw=file_get_contents('php://input',false,null,0,20000001);
        if(strlen($raw)>20000000)respond(413,['error'=>'Request too large.']);
        $body=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
        if(!is_array($body))respond(400,['error'=>'Invalid request.']);
    }
    if(!is_file(dirname(__DIR__).'/config.php')) {
        if($path==='api/me'&&$method==='GET')respond(200,['user'=>null]);
        if($path==='api/courses'&&$method==='GET') {
            $fixtures=require __DIR__.'/setup-data.php';
            $preview=array_map(function($c){$c['lessons']=array_map(fn($l)=>['title'=>$l['title']],$c['lessons']);$c['exam']=array_map(function($q){unset($q['answer'],$q['explanation']);return $q;},$c['exam']);return $c;},$fixtures['courses']);
            respond(200,['courses'=>$preview]);
        }
        respond(503,['error'=>'The storefront is in preview mode. Complete the database installation to enable accounts and enrollment.']);
    }
    $u=current_user();
    if($method==='GET'&&in_array($path,['api/courses','api/admin/courses'],true)) {
        if($path==='api/admin/courses')require_admin($u);
        upgrade_sample_content();
    }
    if($path==='api/me'&&$method==='GET')respond(200,['user'=>$u]);
    if($path==='api/signup'&&$method==='POST') {
        $name=trim((string)($body['name']??''));$email=strtolower(trim((string)($body['email']??'')));$password=(string)($body['password']??'');
        if(!$name||strlen($name)>150||strlen($email)>190||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<8||strlen($password)>72)respond(400,['error'=>'Enter a name, valid email, and password of 8–72 characters.']);
        if(query('SELECT id FROM academy_users WHERE email=?',[$email])->fetch())respond(409,['error'=>'This email is already registered.']);
        $id=uuid();query('INSERT INTO academy_users(id,name,email,password_hash,role) VALUES(?,?,?,?,?)',[$id,$name,$email,password_hash($password,PASSWORD_DEFAULT),'student']);
        sign_in(['id'=>$id]);respond(201,['user'=>current_user()]);
    }
    if($path==='api/login'&&$method==='POST') {
        // Persistent per-IP/email throttling: 10 unsuccessful attempts in 15 minutes.
        $key=hash('sha256',($_SERVER['REMOTE_ADDR']??'').'|'.strtolower(trim((string)($body['email']??''))));
        $limit=query('SELECT attempts,updated_at FROM academy_login_limits WHERE throttle_key=?',[$key])->fetch();
        if($limit&&(int)$limit['updated_at']>time()-900&&(int)$limit['attempts']>=10)respond(429,['error'=>'Too many login attempts. Try again in 15 minutes.']);
        $found=query('SELECT * FROM academy_users WHERE email=?',[strtolower(trim((string)($body['email']??'')))])->fetch();
        $valid=password_verify((string)($body['password']??''),$found?$found['password_hash']:'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');
        if(!$found||!$valid) {query('INSERT INTO academy_login_limits(throttle_key,attempts,updated_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE attempts=IF(updated_at<?,1,attempts+1),updated_at=?',[$key,time(),time()-900,time()]);respond(401,['error'=>'Email or password is incorrect.']);}
        query('DELETE FROM academy_login_limits WHERE throttle_key=?',[$key]);sign_in($found);respond(200,['user'=>current_user()]);
    }
    if($path==='api/logout'&&$method==='POST'){$_SESSION=[];session_destroy();setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Strict']);respond(200,['ok'=>true]);}
    if($path==='api/courses'&&$method==='GET') {
        $courses=[];
        foreach(query('SELECT payload FROM academy_courses ORDER BY created_at,id')->fetchAll() as $row) {
            $c=json_decode($row['payload'],true);$access=$u&&($u['role']==='admin'||in_array($c['id'],$u['enrolled'],true));
            if(!$access)$c['lessons']=array_map(fn($l)=>['title'=>$l['title']],$c['lessons']);
            $c['exam']=array_map(function($q){unset($q['answer'],$q['explanation']);return $q;},$c['exam']);$courses[]=$c;
        }respond(200,['courses'=>$courses]);
    }
    if($path==='api/admin/courses') {
        require_admin($u);
        if($method==='GET')respond(200,['courses'=>array_map(fn($r)=>json_decode($r['payload'],true),query('SELECT payload FROM academy_courses ORDER BY created_at,id')->fetchAll())]);
        if(in_array($method,['POST','PUT'],true)) {
            if(!is_array($body['course']??null))respond(400,['error'=>'Invalid course.']);$c=validate_course($body['course']);
            query('INSERT INTO academy_courses(id,payload) VALUES(?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload)',[$c['id'],json_encode($c,JSON_THROW_ON_ERROR)]);respond(200,['course'=>$c]);
        }
    }
    if($path==='api/enroll'&&$method==='POST') {
        if(!$u)respond(401,['error'=>'Please log in to enroll.']);
        if(!query('SELECT id FROM academy_courses WHERE id=?',[$body['id']??''])->fetch())respond(404,['error'=>'Course not found.']);
        query('INSERT IGNORE INTO academy_enrollments(user_id,course_id) VALUES(?,?)',[$u['id'],$body['id']]);respond(200,['user'=>current_user()]);
    }
    if($path==='api/exam'&&$method==='POST') {
        $id=$body['id']??'';
        if(!$u||($u['role']!=='admin'&&!in_array($id,$u['enrolled'],true)))respond(403,['error'=>'Enroll to take this exam.']);
        $row=query('SELECT payload FROM academy_courses WHERE id=?',[$id])->fetch();$c=$row?json_decode($row['payload'],true):null;
        if(!$c||!count($c['exam']))respond(400,['error'=>'No exam available.']);
        if(!is_array($body['answers']??null)||count($body['answers'])!==count($c['exam']))respond(400,['error'=>'Answer every question before submitting.']);
        $score=0;$review=[];
        foreach($c['exam'] as $i=>$q) {
            $answer=$body['answers'][$i]??null;
            if(!is_int($answer)||$answer<0||$answer>=count($q['options']))respond(400,['error'=>'Choose a valid answer for every question.']);
            $correct=$answer===$q['answer'];if($correct)$score++;
            $review[]=['correct'=>$correct,'answer'=>$q['options'][$q['answer']],'explanation'=>$q['explanation']??''];
        }
        query('INSERT INTO academy_exam_attempts(user_id,course_id,score,total) VALUES(?,?,?,?)',[$u['id'],$id,$score,count($c['exam'])]);respond(200,['score'=>$score,'total'=>count($c['exam']),'review'=>$review]);
    }
    respond(404,['error'=>'Not found.']);
} catch(JsonException $e) {respond(400,['error'=>'Invalid JSON request.']);}
catch(Throwable $e) {error_log('Academy API failure: '.$e->getMessage());respond(503,['error'=>'The academy is temporarily unavailable. Check database setup.']);}
