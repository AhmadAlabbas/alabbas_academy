<?php
declare(strict_types=1);
function config(): array {
    $file = dirname(__DIR__) . '/config.php';
    if (!is_file($file)) throw new RuntimeException('Database configuration is missing.');
    return require $file;
}
function database(): PDO {
    static $db;
    if (!$db) {
        $c = config();
        $db = new PDO('mysql:host='.$c['db_host'].';dbname='.$c['db_name'].';charset=utf8mb4', $c['db_user'], $c['db_password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
    }
    return $db;
}
function query(string $sql, array $args=[]): PDOStatement { $s=database()->prepare($sql); $s->execute($args); return $s; }
function uuid(): string { return bin2hex(random_bytes(16)); }
function initialize_session(): void {
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params(['lifetime'=>86400, 'path'=>'/', 'secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off', 'httponly'=>true, 'samesite'=>'Strict']);
    session_start();
}
function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    if (($_SESSION['expires']??0)<time()) {$_SESSION=[];return null;}
    $u=query('SELECT id,name,email,role FROM academy_users WHERE id=?',[$_SESSION['user_id']])->fetch();
    if (!$u) return null;
    $u['enrolled']=query('SELECT course_id FROM academy_enrollments WHERE user_id=?',[$u['id']])->fetchAll(PDO::FETCH_COLUMN);
    return $u;
}
function sign_in(array $user): void {session_regenerate_id(true);$_SESSION['user_id']=$user['id'];$_SESSION['expires']=time()+86400;}
function respond(int $status, array $data): never {http_response_code($status);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');echo json_encode($data,JSON_UNESCAPED_SLASHES);exit;}
function require_admin(?array $u): void {if (($u['role']??'')!=='admin') respond(403,['error'=>'Admin access required.']);}
function validate_course(array $c): array {
    foreach (['title','instructor','description','duration','category','level'] as $key) if (!is_string($c[$key]??null)||!trim($c[$key])) respond(400,['error'=>'Complete the course details.']);
    if (!isset($c['price'])||!is_numeric($c['price'])||(float)$c['price']<0) respond(400,['error'=>'Enter a valid price.']);
    if (!is_array($c['lessons']??null)||!is_array($c['exam']??null)) respond(400,['error'=>'Invalid lessons or exam.']);
    foreach ($c['lessons'] as $l) {
        if (!is_string($l['title']??null)||!trim($l['title'])) respond(400,['error'=>'Each lesson needs a title.']);
        if (!empty($l['video'])&&(!filter_var($l['video'],FILTER_VALIDATE_URL)||strtolower(parse_url($l['video'],PHP_URL_SCHEME)??'')!=='https')) respond(400,['error'=>'Video URLs must use HTTPS.']);
        foreach ($l['files']??[] as $f) if (!is_string($f['name']??null)||!is_string($f['data']??null)||strlen($f['data'])>7100000||!preg_match('~^data:[a-zA-Z0-9.+/-]*;base64,[A-Za-z0-9+/=\r\n]*$~',$f['data'])) respond(400,['error'=>'Invalid resource or file exceeds 5 MB.']);
    }
    foreach ($c['exam'] as $q) {
        if (!is_string($q['question']??null)||!trim($q['question'])||!is_array($q['options']??null)||count($q['options'])!==3||!is_int($q['answer']??null)||$q['answer']<0||$q['answer']>2) respond(400,['error'=>'Each exam question needs three options and a correct answer.']);
        foreach($q['options'] as $option) if(!is_string($option)||!trim($option)) respond(400,['error'=>'Complete every answer option.']);
    }
    $c['id']=$c['id']??uuid();if(!preg_match('/^[a-zA-Z0-9-]{1,64}$/',$c['id'])) respond(400,['error'=>'Invalid course ID.']);
    $c['price']=(float)$c['price'];$c['color']='#e9e9e6';
    $c['art']=in_array($c['art']??'', ['design','code','business','photo'],true)?$c['art']:'design';
    return $c;
}
