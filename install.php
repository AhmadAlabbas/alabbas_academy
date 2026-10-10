<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
header('Cache-Control: no-store');
if(!is_file(dirname(__DIR__).'/config.php')) {
    $template=is_file(__DIR__.'/config.example.php')?file_get_contents(__DIR__.'/config.example.php'):false;
    if($template===false)$template="<?php\nreturn ['db_host'=>'localhost','db_name'=>'YOUR_DATABASE_NAME','db_user'=>'YOUR_DATABASE_USER','db_password'=>'YOUR_DATABASE_PASSWORD','setup_key'=>'CHOOSE_A_RANDOM_KEY_AT_LEAST_32_CHARACTERS'];";
    ?>
    <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Database setup · Alabbas Academy</title><link rel="stylesheet" href="/style.css?v=saudi-1"><link rel="icon" href="/logo.svg"></head><body><main class="wrap page setup-guide" style="max-width:850px"><a class="brand" href="/"><img class="brand-logo" src="/logo.svg" alt="Alabbas Academy logo">alabbas academy</a><h1 style="font-size:36px">Connect your academy.</h1><p class="notice">Your storefront is visible. Login, signup, and the dashboard need a MySQL database before they can work.</p><div class="panel"><ol><li>In Hostinger hPanel, open <strong>Databases → MySQL Databases</strong>. Create a database and user with a strong password. Keep the full database name and username Hostinger supplies.</li><li>Open <strong>Files → File Manager</strong>. Navigate to the directory containing <strong>public_html</strong>. Create <strong>config.php</strong> there, outside public_html.</li><li>Paste the template below. Replace the database placeholders with your Hostinger details, and set <strong>setup_key</strong> to a random secret of at least 32 characters. Save the file.</li><li>Refresh this page. Enter your setup key, then create your administrator account.</li><li>After installation, clear setup_key in your private config.php. The installer automatically locks once an administrator exists.</li></ol><pre><?=htmlspecialchars($template,ENT_QUOTES,'UTF-8')?></pre><p class="notice">Enter database credentials only in your private Hostinger config.php. Do not post them in chat. All prices are in Saudi riyals (SAR). Checkout remains demo-only.</p></div><a class="btn" href="/install.php">Check configuration ↗</a></main></body></html>
    <?php
    exit;
}
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
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Install Alabbas Academy</title><link rel="stylesheet" href="style.css"></head><body><main class="wrap page" style="max-width:620px"><h2>Set up your academy.</h2><?php if($done): ?><div class="notice">Installation complete. Delete <strong>public_html/install.php</strong> and clear <strong>setup_key</strong> in config.php. Then log in with your administrator account.</div><a class="btn" href="/">Open the academy ↗</a><?php else: ?><p class="notice">Enter the installation key you set in your private config.php file. This creates your administrator account and sample courses.</p><p class="error"><?=htmlspecialchars($error,ENT_QUOTES,'UTF-8')?></p><form method="post" class="panel"><label>Installation key<input type="password" name="setup_key" required autocomplete="off"></label><label>Administrator name<input name="name" required maxlength="150" autocomplete="name"></label><label>Administrator email<input name="email" type="email" required autocomplete="email"></label><label>Administrator password<input name="password" type="password" minlength="12" maxlength="72" required autocomplete="new-password"></label><button class="btn">Install academy ↗</button></form><?php endif ?></main></body></html>
