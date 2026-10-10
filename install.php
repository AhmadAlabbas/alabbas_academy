<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
$error='';$done=false;
try {
    $config=config();
    if(strlen($config['setup_key']??'')<32) {http_response_code(403);exit('Installation is disabled. Set a random setup_key of at least 32 characters in the private config.php file.');}
    if(query("SHOW TABLES LIKE 'academy_users'")->fetch()&&query("SELECT id FROM academy_users WHERE role='admin' LIMIT 1")->fetch()){http_response_code(403);exit('The academy is already installed. Delete install.php and clear setup_key in config.php.');}
    if($_SERVER['REQUEST_METHOD']==='POST') {
        if(!hash_equals($config['setup_key'],(string)($_POST['setup_key']??'')))throw new RuntimeException('Incorrect installation key.');
        $name=trim((string)($_POST['name']??''));$email=strtolower(trim((string)($_POST['email']??'')));$password=(string)($_POST['password']??'');
        if(!$name||strlen($name)>150||strlen($email)>190||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<12||strlen($password)>72)throw new RuntimeException('Enter a name, valid email, and an administrator password of 12–72 characters.');
        $fixtures=require __DIR__.'/setup-data.php';
        $schema=$fixtures['schema'];
        foreach(explode(';',$schema) as $sql)if(trim($sql))database()->exec($sql);
        database()->beginTransaction();
        $existing=query("SELECT id FROM academy_users WHERE role='admin' LIMIT 1 FOR UPDATE")->fetch();if($existing)throw new RuntimeException('An administrator already exists.');
        query('INSERT INTO academy_users(id,name,email,password_hash,role) VALUES(?,?,?,?,?)',[uuid(),$name,$email,password_hash($password,PASSWORD_DEFAULT),'admin']);
        $seed=$fixtures['courses'];
        foreach($seed as $c)query('INSERT IGNORE INTO academy_courses(id,payload) VALUES(?,?)',[$c['id'],json_encode($c,JSON_THROW_ON_ERROR)]);
        database()->commit();$done=true;
    }
} catch(Throwable $e){if(isset($config)){try{if(database()->inTransaction())database()->rollBack();}catch(Throwable $ignored){}}error_log('Academy installation: '.$e->getMessage());$error='Installation failed. Check your database configuration, key, and administrator details. Password must be 12–72 characters.';}
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Install Aabbas Academy</title><link rel="stylesheet" href="style.css"></head><body><main class="wrap page" style="max-width:620px"><h2>Set up your academy.</h2><?php if($done): ?><div class="notice">Installation complete. Delete <strong>public_html/install.php</strong> and clear <strong>setup_key</strong> in config.php. Then log in with your administrator account.</div><a class="btn" href="/">Open the academy ↗</a><?php else: ?><p class="notice">Enter the installation key you set in your private config.php file. This creates your administrator account and sample courses.</p><p class="error"><?=htmlspecialchars($error,ENT_QUOTES,'UTF-8')?></p><form method="post" class="panel"><label>Installation key<input type="password" name="setup_key" required autocomplete="off"></label><label>Administrator name<input name="name" required maxlength="150" autocomplete="name"></label><label>Administrator email<input name="email" type="email" required autocomplete="email"></label><label>Administrator password<input name="password" type="password" minlength="12" maxlength="72" required autocomplete="new-password"></label><button class="btn">Install academy ↗</button></form><?php endif ?></main></body></html>
