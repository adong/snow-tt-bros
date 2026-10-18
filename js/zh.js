/* 中文 for Snow TT Bros: the words on the page, the banners and toasts, the 3D comic words and the ? panel
   (Kit.lang, from kit/lang.js). The kids' names and the game's name / logo stay in English on purpose, and so do the
   letters painted on the toy blocks (they're decoration). */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'Snow TT Bros', 'Esc']);

  const FLOORS = {
    'Hello, Snow!': '你好，雪！', 'Zigzag Hill': '之字山坡', 'Snow Pyramid': '雪花金字塔', 'Snowman Stairs': '雪人楼梯',
    'GIANT ZOMBO!': '巨无霸僵尸！', 'Toy Workshop': '玩具工坊', 'Gear Steps': '齿轮台阶', 'Twin Towers': '两座高塔',
    'Zigzag Factory': '之字工厂', 'ROBO-RUMBLE!': '轰隆隆机器人！', 'Icicle Hall': '冰柱大厅', 'Crystal Steps': '水晶台阶',
    'Narrow Ledges': '窄窄的台子', 'The Chimney': '大烟囱', 'BIG FLUFF!': '大毛球雪怪！', 'Drawbridge': '吊桥',
    'Battlements': '城墙垛口', 'Throne Hall': '王座大厅', 'Tower Top': '塔顶', 'KING GRUMPCASTLE!': '臭脸城堡大王！',
  };
  const BOSSES = { 'GIANT ZOMBO': '巨无霸僵尸', 'ROBO-RUMBLE': '轰隆隆机器人', 'BIG FLUFF': '大毛球雪怪', 'KING GRUMPCASTLE': '臭脸城堡大王' };
  const TIPS = {
    'Throw snow at a zombie 4 times to make a snowball. Then kick it!': '朝僵尸扔 4 次雪，它就变成大雪球。然后踢它！',
    'A rolling snowball bonks every baddy in its way. Line them up!': '滚动的雪球会撞倒一路上的坏蛋。让它们排排队！',
    'Snowballs are the only thing that bonks a boss. Roll them down onto him!': '只有雪球能打到大坏蛋。把雪球滚下去砸他！',
    'Snowballs bounce off solid blocks. Bonk, bounce, bonk!': '雪球碰到硬砖块会弹回来。咚，弹，咚！',
    'Kick a snowball from the top and watch it zigzag all the way down!': '从最上面踢一个雪球，看它一路拐弯滚下去！',
  };
  const POTIONS = { 'ZOOMY SHOES!': '飞毛腿鞋！', 'BIG SNOW!': '超大雪球！', 'LONG THROW!': '扔得超远！', 'BALLOON!': '气球飞飞！' };

  L.add(Object.assign({}, FLOORS, BOSSES, TIPS, POTIONS, {
    // title screen
    'Snow the baddies · roll them up · bowl them over! 20 floors to the top.': '把坏蛋变成雪球，滚起来，撞倒一大片！一共 20 层，冲到最顶上！',
    'BOTH!': '一起玩！', '🐣 EASY': '🐣 简单', '🐣 EASY: OFF': '🐣 简单：关', '🐣 EASY: ON': '🐣 简单：开',
    'Lower floor': '往下一层', 'Higher floor': '往上一层',
    // HUD and buttons (and their tooltips)
    'Pause': '暂停', 'Sound': '声音', 'Call your brother': '叫兄弟来帮忙', 'Jump': '跳', 'Throw': '扔雪球',
    'ANOTHER TREAT!': '再来一个零食！', 'HIGH FIVE!': '击掌！',
    // banners
    'GO!': '出发！', 'SUPER COMBO!': '超级连击！', 'HURRY UP!': '快点快点！', 'YOU BONKED': '你打败了',
    'FLOOR CLEAR!': '过关啦！', 'power burst! ⭐': '超级能量！⭐', 'KEEP GOING!': '继续加油！',
    // toasts
    '👻 A ghost-snowman! He just wants to tickle.': '👻 雪人幽灵来啦！他只是想挠你痒痒。',
    // pause, game over, the end
    'KEEP PLAYING': '继续玩', 'TITLE': '回标题', 'OOPS!': '哎呀！', 'YOU DID IT!': '你们做到啦！',
    'King Grumpcastle is bonked and the snowy tower is safe!': '臭脸城堡大王被打败了，雪塔安全啦！',
    // words drawn in the 3D scene
    'POW!': '砰！', 'BONK!': '咚！', 'POOF!': '噗！', 'KICK!': '踢！', 'BOING!': '嘣！', 'CRUNCH!': '咔嚓！', 'OOF!': '哎哟！',
    'POP!': '啪！', 'KA-BONK!': '咣当！', 'SNOWBALL!': '雪球！', 'HEE HEE!': '嘻嘻！', 'BRRR!': '抖一抖！', '1UP!': '加一条命！',
    'SWISH!': '唰！进球！',
    // the ? panel (js/keys.js)
    'throw snow · kick a snowball': '扔雪球 · 踢雪球', 'drop through a ledge': '从台子上跳下去',
    '1 player: ← → or A D to walk, ↑ W or Space to jump, F L or J to throw.': '单人：← → 或 A D 走，↑ W 或空格 跳，F L 或 J 扔雪球。',
    'Slide on the pad, ⬆️ to jump, ❄️ to throw. The big face button calls your brother.': '在方向板上滑动走路，⬆️ 跳，❄️ 扔雪球。点大头像按钮叫兄弟来帮忙。',
  }));

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^FLOOR (\d+)$/, '第 $1 层');
  L.rule(/^FLOOR (\d+) · roll snowballs into the boss!$/, '第 $1 层 · 把雪球滚向大坏蛋！');
  L.rule(/^CALL (.+)$/, '叫 $1 来帮忙');
  L.rule(/^HIGH FIVE IN (\d+)$/, '$1 秒后能击掌');
  L.rule(/^(\d+) COMBO!$/, '$1 连击！');
  L.rule(/^(\d+) COMBO! (.*)$/, '$1 连击！$2');
  L.rule(/^💡 (.+)$/, (m, tip) => '💡 ' + L.t(tip));
  L.rule(/^🧪 (.+)$/, (m, label) => '🧪 ' + L.t(label));
  L.rule(/^YOUR BROTHER SAVED YOU!$/, '兄弟救了你！');
  L.rule(/^(.+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^HERE COMES (.+)!$/, '$1 来帮忙啦！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^1UP! (.+) \+❤️$/, '加一条命！$1 +❤️');
  L.rule(/^(.+) is resting! Press (\S+) \(or ❄️\) to jump back in$/, '$1 在休息！按 $2（或 ❄️）回来接着玩');
  L.rule(/^(.+) IS BACK!$/, '$1 回来啦！');
  L.rule(/^Out of lives on floor (\d+)\. Snowballs never give up!$/, '在第 $1 层没命啦。雪球兄弟永不放弃！');
})();
